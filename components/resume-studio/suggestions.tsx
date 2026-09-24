'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { Button, EmptyState, Panel } from '@/components/ui';
import { studioApi } from '@/lib/resume-studio';
import { useResumeSuggestions } from '@/hooks/useResumeStudio';
import { useToast } from '@/components/toast';

export function Suggestions({ fileId, documentId }: { fileId?: string; documentId?: string }) {
  const q = useResumeSuggestions(fileId);
  const docs = useQuery({
    queryKey: ['resume-studio', 'documents'],
    queryFn: studioApi.documents,
    enabled: !!fileId,
  });
  const qc = useQueryClient();
  const { push } = useToast();
  const [busy, setBusy] = useState('');

  async function analyze() {
    if (!fileId) return;
    setBusy('analyze');
    try {
      const queued = await studioApi.requestSuggestions(fileId);
      let finished = false;
      for (let attempt = 0; attempt < 90; attempt += 1) {
        const task = await studioApi.task(queued.task_id);
        if (task.status === 'succeeded') {
          finished = true;
          break;
        }
        if (task.status === 'failed') {
          throw new Error(task.error_code || 'Resume analysis failed');
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (!finished) throw new Error('Analysis is taking longer than expected. Check again shortly.');
      await q.refetch();
      push('Resume and profile analysis is ready');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Analysis failed', 'error');
    } finally {
      setBusy('');
    }
  }

  async function act(id: string, action: 'apply' | 'dismiss', targetId?: string) {
    setBusy(id);
    try {
      await studioApi.suggestionAction(id, action, targetId);
      push(action === 'apply' ? 'A new claim-checked draft version was created' : 'Suggestion dismissed');
      await qc.invalidateQueries({ queryKey: ['resume-studio', 'suggestions', fileId] });
      await qc.invalidateQueries({ queryKey: ['resume-studio', 'documents'] });
      await qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (e) {
      push(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-18 font-semibold">AI resume and cover-letter review</h2>
          <p className="mt-1 max-w-3xl text-13 text-text-secondary">
            Analyze the uploaded resume, your full profile, and your latest drafts. Review section-by-section edits before they create a new version.
          </p>
        </div>
        <Button onClick={analyze} disabled={!fileId || busy === 'analyze'}>
          <Lightbulb size={15} />
          {busy === 'analyze' ? 'Analyzing...' : 'Analyze all sections'}
        </Button>
      </div>

      {!q.data?.length ? (
        <div className="mt-5">
          <EmptyState
            title="No analysis yet"
            description="Confirm the extracted facts, then analyze your resume and profile for grounded improvements across every section."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {q.data.map((suggestion) => {
            const kind = suggestion.category === 'cover_letter_section' ? 'cover_letter' : 'resume';
            const destination = documentId
              ? docs.data?.find((doc) => doc.id === documentId && doc.document_type === kind)
              : docs.data?.find((doc) =>
                  doc.document_type === kind &&
                  (!doc.source_file_id || doc.source_file_id === fileId),
                );
            const section = suggestion.category.replaceAll('_', ' ');

            return (
              <article key={suggestion.id} className="rounded-card border border-border bg-surface-2 p-4">
                <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase text-text-secondary">
                  <span>{kind === 'resume' ? 'Resume' : 'Cover letter'}</span>
                  <span aria-hidden="true">/</span>
                  <span>{section}</span>
                  <span aria-hidden="true">/</span>
                  <span>{suggestion.priority} priority</span>
                  <span aria-hidden="true">/</span>
                  <span>{suggestion.status}</span>
                </div>
                <p className="mt-2 text-13 font-medium">{suggestion.explanation}</p>
                {suggestion.current_text && (
                  <p className="mt-2 whitespace-pre-wrap text-13 text-text-secondary">
                    <span className="font-medium text-text-primary">Current:</span> {suggestion.current_text}
                  </p>
                )}
                {suggestion.suggested_text && (
                  <p className="mt-2 whitespace-pre-wrap text-13 text-text-secondary">
                    <span className="font-medium text-text-primary">Suggested:</span> {suggestion.suggested_text}
                  </p>
                )}
                <p className="mt-2 text-[12px] text-text-secondary">Why: {suggestion.reason}</p>
                {suggestion.status === 'pending' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => act(suggestion.id, 'apply', destination?.id)}
                      disabled={!suggestion.suggested_text || !destination || busy === suggestion.id}
                    >
                      Apply to {kind === 'resume' ? 'resume' : 'cover letter'} draft
                    </Button>
                    {!destination && (
                      <span className="text-[11px] text-text-secondary">
                        Create a matching draft below before applying this edit.
                      </span>
                    )}
                    <Button variant="ghost" onClick={() => act(suggestion.id, 'dismiss')} disabled={busy === suggestion.id}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
