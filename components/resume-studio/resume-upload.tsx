'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button, ErrorState, Panel, ProgressBar } from '@/components/ui';
import { useResumeUpload } from '@/hooks/useResumeStudio';
import { studioApi, type StudioResume } from '@/lib/resume-studio';
import { useToast } from '@/components/toast';

const fmt = (n: number) => n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export function ResumeUpload({ resumes, maxBytes, onSelect }: { resumes: StudioResume[]; maxBytes: number; onSelect: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { push } = useToast();
  const [progress, setProgress] = useState(0);
  const [validation, setValidation] = useState('');
  const [busyId, setBusyId] = useState('');
  const upload = useResumeUpload(setProgress);

  function choose(file?: File) {
    if (!file) return;
    setValidation('');
    if (file.size > maxBytes) { setValidation(`File exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit.`); return; }
    if (!/\.(pdf|docx)$/i.test(file.name)) { setValidation('Choose a PDF or DOCX file.'); return; }
    if (!file.size) { setValidation('The selected file is empty.'); return; }
    setProgress(0);
    upload.mutate(file, { onSuccess: r => onSelect(r.id) });
  }

  async function retry(resume: StudioResume) {
    setBusyId(resume.id);
    try {
      await studioApi.retryResume(resume.id);
      await qc.invalidateQueries({ queryKey: ['resume-studio'] });
      push('Resume processing restarted');
    } catch (error) { push(error instanceof Error ? error.message : 'Could not retry processing', 'error'); }
    finally { setBusyId(''); }
  }

  async function remove(resume: StudioResume) {
    if (!window.confirm(`Delete ${resume.filename}? Its uploaded file and extracted facts will be removed.`)) return;
    setBusyId(resume.id);
    try {
      await studioApi.deleteResume(resume.id);
      await qc.invalidateQueries({ queryKey: ['resume-studio'] });
      await qc.invalidateQueries({ queryKey: ['documents'] });
      onSelect('');
      push('Uploaded resume deleted');
    } catch (error) { push(error instanceof Error ? error.message : 'Could not delete resume', 'error'); }
    finally { setBusyId(''); }
  }

  return (
    <section aria-labelledby="resume-upload-title">
      <Panel className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 id="resume-upload-title" className="text-18 font-semibold">Resume uploads</h2><p className="mt-1 text-13 text-text-secondary">PDF or DOCX, up to {Math.floor(maxBytes / 1024 / 1024)} MB. New uploads are saved as versions.</p></div>
          <input ref={input} className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { choose(e.target.files?.[0]); e.currentTarget.value = ''; }}/>
          <Button onClick={() => input.current?.click()} disabled={upload.isPending}><Upload size={15}/>{upload.isPending ? 'Uploading…' : resumes.length ? 'Upload new version' : 'Upload resume'}</Button>
        </div>
        {upload.isPending && <div className="mt-4" aria-live="polite"><ProgressBar value={progress} label="Upload progress"/></div>}
        {(validation || upload.error) && <div className="mt-4"><ErrorState message={validation || upload.error?.message || 'Upload failed'} retry={() => input.current?.click()}/></div>}
        <div className="mt-5 grid gap-2">
          {resumes.map(resume => <div key={resume.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-2 p-3">
            <button type="button" onClick={() => onSelect(resume.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-accent"><FileText size={18}/><span className="min-w-0 flex-1"><span className="block truncate text-13 font-medium">{resume.filename}</span><span className="block text-[12px] text-text-secondary">Version {resume.version} · {fmt(resume.size_bytes)} · {new Date(resume.uploaded_at).toLocaleString()}</span></span><span className="font-mono text-[12px] capitalize text-text-secondary" role="status">{resume.status}{resume.task && resume.status !== 'completed' ? ` ${resume.task.progress}%` : ''}</span></button>
            {resume.status === 'failed' && <Button variant="secondary" disabled={busyId === resume.id} onClick={() => retry(resume)}><RefreshCw size={13}/>{busyId === resume.id ? 'Working…' : 'Retry'}</Button>}
            <Button variant="ghost" aria-label={`Delete ${resume.filename}`} disabled={busyId === resume.id} onClick={() => remove(resume)}><Trash2 size={14}/></Button>
          </div>)}
        </div>
      </Panel>
    </section>
  );
}
