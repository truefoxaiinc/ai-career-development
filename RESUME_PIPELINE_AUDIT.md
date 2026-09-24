# Resume upload and generation pipeline — Phase 3 report

**Date:** 2026-09-24  
**Scope:** Resume upload, extraction, candidate verification, Resume Studio, targeted generation, claims, export, ownership, retry, deletion and testability. Existing implementation was inspected before changes. Unrelated job discovery/application behavior was left untouched.

## 1. Existing architecture

```text
Authenticated candidate
  → ResumeUpload UI (PDF/DOCX)
  → XMLHttpRequest upload with progress
  → POST /api/v1/resume-studio/resumes
  → extension/MIME/signature/size checks and private storage
  → UploadedFile row with candidate, filename, hash, size, version and state
  → resume_parse AsyncJob (inline dev or database worker)
  → private object read; PDF/DOCX text extraction
  → AI structured facts when configured, deterministic parser fallback
  → ProfileEntry rows, initially unverified and linked to source file
  → candidate confirms, edits or rejects facts via profile verification API
  → selected target job + selected uploaded resume
  → generation receives verified profile facts plus verified facts from upload
  → generated document claim report
  → user edits/saves immutable new versions and explicitly approves
  → approved, claim-safe PDF/DOCX export
```

The primary resume feature UI is `components/resume-studio/resume-upload.tsx`, `fact-review.tsx`, and `resume-studio-page.tsx`. Job-specific generation is in `components/features/document-pages.tsx`. The upload client is `lib/resume-studio.ts`; the shared API client is `lib/api.ts`. Backend routes are in `backend/app/domains/resume_studio/router.py`, parsing/validation in `backend/app/domains/profiles/service.py`, claim-aware generation/export in `backend/app/domains/documents/service.py`, private storage in `backend/app/integrations/storage.py`, and dispatch/worker code in `backend/app/domains/tasks/service.py` and `backend/app/worker.py`.

## 2. Changes made in this phase

- Added owner-scoped retry for failed resume extraction: `POST /resume-studio/resumes/{file_id}/retry`. It resets persisted processing state and enqueues the existing task type.
- Added owner-scoped resume deletion: `DELETE /resume-studio/resumes/{file_id}`. It prevents deletion while parsing is active, deletes the private object before its DB reference, deletes source-linked extracted facts, and returns a retryable 503 while keeping the DB record if storage cleanup fails.
- Added retry and confirmed delete actions to the upload list. Delete requires browser confirmation; resume lists refresh after actions.
- Corrected upload idempotent replay so it cannot attach the latest unrelated parse task to an older matching file.
- Rejected empty uploads in backend file validation.
- Connected selected upload facts to the job-targeted generation. The selected file must belong to the user, be fully parsed, and have no pending extracted facts. Its confirmed entries are included with the candidate’s verified profile facts. Its file ID is saved as document provenance. Edited versions also include those upload facts when rechecking claims.
- Updated targeted resume test setup to confirm all extracted facts and create its target through the current Resume Studio target endpoint.
- Added a Docker `test` target for backend tests and `backend-tests` Compose profile. The production API image explicitly copies app/migrations but not test sources.
- Added a frontend Docker test target and `frontend-tests` Compose profile to run Vitest outside the Windows host sandbox.
- Added explicit React Testing Library cleanup and wrapped upload tests in `ToastProvider`.
- Changed account deletion storage cleanup to return a safe 503 and retain the account when a resume object cannot be deleted; it no longer silently ignores the failure.

## 3. Resume API connection matrix

All routes below are under `/api/v1` and require a verified session unless noted. Ownership is checked by deriving the candidate from the authenticated user; no client-supplied user ID is trusted.

| Operation | API | Frontend consumer | Auth/ownership | Status |
|---|---|---|---|---|
| Upload | `POST /resume-studio/resumes` multipart, 202 | `ResumeUpload` → XHR `uploadResume` | Verified user; candidate is derived server-side | Connected; PDF/DOCX validated, private object saved, parse task queued |
| List / processing state | `GET /resume-studio/overview` | `useStudioOverview` → upload list | Verified user; filters by candidate | Connected; polls while queued/processing |
| Individual status | `GET /resume-studio/resumes/{id}` | `studioApi.resumeStatus` | Verified user + candidate ownership | Connected in client; primary list currently uses overview |
| Extracted facts | `GET /resume-studio/resumes/{id}/facts` | `useResumeFacts` → `FactReview` | Verified user + candidate ownership | Connected |
| Confirm/edit/reject fact | `POST /profile/verify` | `studioApi.verify` → `FactReview` | Verified user; service checks each entry belongs to candidate | Connected; candidate decision recorded |
| Retry failed extraction | `POST /resume-studio/resumes/{id}/retry`, 202 | `studioApi.retryResume` → retry button | Verified user + candidate ownership; failed state required | Added and connected |
| Delete uploaded resume | `DELETE /resume-studio/resumes/{id}` | `studioApi.deleteResume` → delete button | Verified user + candidate ownership; active parse prohibited | Added and connected; storage cleanup failure keeps row and reports failure |
| Analyze suggestions | `POST /resume-studio/resumes/{id}/suggestions`, 202 | `Suggestions` → `studioApi.requestSuggestions` | Verified user + ownership | Connected; background task |
| Read suggestions | `GET /resume-studio/resumes/{id}/suggestions` | `useResumeSuggestions` | Verified user; candidate-filtered query | Connected |
| Apply/dismiss suggestion | `POST /resume-studio/suggestions/{id}` | `Suggestions` | Verified user + candidate ownership | Connected; application creates checked document version |
| Select job + generate tailored document | `POST /resume-studio/target`, 202 | `DocumentGeneratorPage` or Resume Studio target UI | Verified user; job ownership and uploaded file ownership checked | Connected; selected resume facts now included after review |
| Poll generation task | `GET /tasks/{task_id}` | generator/Resume Studio polling | Authenticated user + task ownership | Connected |
| Read generated document | `GET /documents/{id}` | document editor | Verified user + document ownership | Connected |
| Save edited version | `POST /documents/{id}/versions` | document editor / Resume Studio editor | Verified user + document ownership | Connected; rechecks claims |
| Approve | `POST /documents/{id}/approve` | document editor / Resume Studio | Verified user + document ownership | Connected; blocked unless claims pass |
| Export generated file | `GET /documents/{id}/download?format=pdf|docx` | `downloadDocument` | Verified user + document ownership; approval and clean claims required | Connected; private response, no public object URL |
| Delete all account data/files | `DELETE /privacy/account` | Settings → Privacy | Verified user + password/confirmation as applicable | Connected; storage errors no longer swallowed |

There is no route to download the original uploaded resume. The export endpoint downloads generated/approved documents, which is a separate workflow.

## 4. Upload, validation and storage

- Supported extensions are `.pdf` and `.docx`; backend requires a matching MIME type (or octet-stream) and validates PDF magic bytes or DOCX ZIP/document XML structure.
- Backend enforces `UPLOAD_MAX_BYTES` and now rejects zero-byte uploads. The frontend gives early extension, empty and size feedback; it is UX only.
- Storage keys are generated UUID paths under `resumes/{candidate_id}/`; keys and credentials are not returned to the browser. Local storage resolves paths under its configured root; S3 uses server credentials and does not generate public URLs.
- Duplicate contents use SHA-256 idempotency; new distinct uploads receive the next candidate resume version and are retained as older versions.
- DOCX content structure is checked, but full parser validity is ultimately determined by extraction. Corrupt/parser errors become failed processing state. The original record/object remains available for retry or deletion.
- S3/MinIO bucket policy and network exposure must still be validated in the deployment environment; code configuration alone does not prove infrastructure privacy.

## 5. Extraction and verification

`process_resume_parse_task` fetches the private file, then `_extract_text` uses pypdf for PDF pages and python-docx paragraphs/tables for DOCX. It rejects text extraction shorter than 20 characters. OCR is **not implemented or claimed**; scanned/image-only PDFs fail with `resume_text_unreadable`. Multi-page PDF text is joined page-by-page. Multi-column reading order and layout reconstruction are not guaranteed by plain text extraction.

When the AI gateway is configured, extraction requests structured career facts, treats resume text as untrusted, checks model output against source text, and validates the structured response. A deterministic parser is the fallback. Extracted entries store type, label, structured data, source text, confidence, source file, verification state and timestamps. Raw full-document text is not persisted as a separate UploadedFile field; source excerpts for structured facts are stored.

All extracted facts start unverified. The UI enables confirm/edit/reject decisions. The API generation route and service reject generation for a selected upload with pending facts. Confirmed upload details join other already verified profile facts; no unverified extracted facts are passed to the generation content builder.

## 6. Tailored generation, claim check and export

The frontend submits target job ID, document type, theme and selected uploaded resume ID. The target job is ownership-checked. The upload is ownership-checked and must have completed parsing and review. The generation task gets verified profile and selected-upload entries, produces an AI resume when configured or the existing deterministic fallback, then runs `verify_document_claims`. New content and `source_entry_ids` are persisted with the upload provenance and selected template.

Document editing creates a new immutable version and reruns the claim check against verified profile facts and, where present, verified facts from its source upload. Unsupported claims keep the document blocked. Approval and PDF/DOCX download require a passed report with zero unsupported claims; generation does not silently approve content.

The current interaction is review-before-generation for all facts extracted from the selected upload. This was preserved intentionally as the project’s evidence safeguard. Representative human resumes and target jobs were not supplied in this phase, so output quality/completeness across real-world layouts has not been empirically accepted.

## 7. Authentication and ownership

- Resume endpoints depend on `require_verified_user`; session resolution checks signed access token, live refresh-session record, active account and email verification.
- Resume/file/fact/suggestion/document routes scope IDs to the authenticated user’s candidate and return 404 for cross-account resources.
- Frontend dashboard is wrapped by `AuthGuard`; backend ownership is the security boundary.
- Focused existing tests exercise cross-account status/fact/delete denial. No full two-browser/two-account end-to-end session scenario was run.

## 8. Tests and build results

| Command | Result |
|---|---|
| `docker-compose --profile test run --build --rm backend-tests python -m pytest tests/test_resume_studio.py tests/test_profile_resume.py tests/test_ai_document_generation.py -q` | **10 passed** |
| `docker-compose --profile test run --build --rm backend-tests python -m pytest -q` | **41 passed, 11 failed**. All 11 failures stop at `POST /api/v1/jobs/manual` with 405 because the current job router removed that endpoint while unrelated workflow test fixtures still depend on it. This is outside the resume scope and is already identified in the project audit. |
| `docker-compose --profile test run --build --rm frontend-tests` | **8 passed** after adding missing provider wrapper and test cleanup |
| `npm.cmd run typecheck` | **Passed before latest small test-harness edits**; rerun after final build below |
| `npm.cmd run build` | **Passed earlier**, then rerun after final edits; see final command status in project audit |
| `docker-compose build api` | **Passed**; runtime stage copies app/migrations, not `tests/` |
| Real PDF/DOCX matrix A–G | **Not fully run**. Existing backend tests exercise a generated DOCX and malformed PDF. No supplied realistic multi-page, multi-column, scanned, encrypted or corrupt-document samples were available. |
| Full browser acceptance workflow | **Not run**. No live test account or realistic external job provider credentials were supplied. |

The frontend Vitest runner can now be invoked on this Windows workstation via the test profile, avoiding the host esbuild parent-directory sandbox issue. The backend suite can likewise run in its separate Docker test target, without shipping tests in the API runtime image.

## 9. Remaining blockers and limitations

1. The complete backend suite remains red due to 11 existing non-resume tests/fixtures calling the removed `/jobs/manual` route. Restore the intended contract or update those fixtures in the job scope.
2. Production S3 privacy, cleanup failure/retry behavior, MinIO bucket policy, SMTP, AI provider, worker deployment and real job providers require deployment-level integration testing.
3. Scanned PDFs need OCR support to extract facts; currently they fail text extraction. Complex columns may read in a different order.
4. No realistic resume/job set or live account was supplied, so we cannot claim full human-quality/e2e acceptance.
5. Original upload download is not implemented; only approved generated document PDF/DOCX export is supported.
6. Resume deletion removes linked profile facts; it does not delete generated documents. Those documents retain their own content and source entry ID snapshot while the uploaded-file foreign key is nulled by database relationship semantics.

**Assessment:** Core upload → extracted facts → candidate review → job-tailored generation → claim check → approval → generated-document export is implemented and the focused test set passes. Production completion remains conditional on resolving the wider test-suite breakage and verifying private storage, worker/AI integrations, realistic documents, and the complete browser acceptance flow.
