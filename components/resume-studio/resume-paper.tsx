'use client';

const colors: Record<string, string> = {
  ats: '#111827',
  modern: '#087e8b',
  minimal: '#52525b',
  professional: '#1d4ed8',
};

const headings = new Set([
  'PROFESSIONAL SUMMARY', 'PROFESSIONAL EXPERIENCE', 'EXPERIENCE',
  'KEY ACHIEVEMENTS', 'SELECTED PROJECTS', 'PROJECTS', 'CORE SKILLS',
  'SKILLS', 'EDUCATION', 'CERTIFICATIONS AND LICENSES', 'CERTIFICATIONS',
  'PUBLICATIONS', 'LANGUAGES', 'ADDITIONAL INFORMATION',
]);

function isBullet(line: string) {
  return /^[•â€¢Ã¢â‚¬Â¢-]\s*/.test(line);
}

function cleanBullet(line: string) {
  return line.replace(/^[•â€¢Ã¢â‚¬Â¢-]\s*/, '');
}

export function ResumePaper({
  content,
  template = 'ats',
  compact = false,
  isResume = true,
}: {
  content: string;
  template?: string;
  compact?: boolean;
  isResume?: boolean;
}) {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const accent = colors[template] || colors.ats;
  const offset = isResume && lines.length ? (headings.has(lines[2]?.toUpperCase()) ? 2 : Math.min(3, lines.length)) : 0;

  return (
    <article
      className={`mx-auto w-full max-w-[760px] bg-white text-slate-800 shadow-[0_18px_50px_rgba(0,0,0,.18)] ${compact ? 'min-h-[360px] p-5' : 'min-h-[720px] px-8 py-9 sm:px-12 sm:py-11'}`}
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {isResume && lines.length > 0 && (
        <header className="border-b pb-4" style={{ borderColor: `${accent}40` }}>
          <h2 className={`${compact ? 'text-[17px]' : 'text-[27px]'} font-bold leading-tight tracking-tight text-slate-900`}>{lines[0]}</h2>
          {lines[1] && <p className={`${compact ? 'mt-1 text-[8px]' : 'mt-2 text-[10px]'} leading-relaxed text-slate-500`}>{lines[1]}</p>}
          {lines[2] && !headings.has(lines[2].toUpperCase()) && <p className={`${compact ? 'mt-1 text-[9px]' : 'mt-2 text-[11px]'} font-semibold`} style={{ color: accent }}>{lines[2]}</p>}
        </header>
      )}
      <div className={`${compact ? 'space-y-2 pt-3 text-[9px] leading-[1.55]' : 'space-y-4 pt-5 text-[11px] leading-[1.65]'}`}>
        {lines.slice(offset).map((line, index) => {
          const heading = headings.has(line.toUpperCase());
          if (heading) return <h3 key={`${index}-${line}`} className="border-b pb-1 font-bold uppercase tracking-[.12em]" style={{ color: accent, borderColor: `${accent}28`, fontSize: compact ? 8 : 10 }}>{line}</h3>;
          if (isBullet(line)) return <p key={`${index}-${line}`} className="relative pl-4 before:absolute before:left-1 before:font-bold before:content-['•']" style={{ ['--tw-content' as string]: accent }}>{cleanBullet(line)}</p>;
          return <p key={`${index}-${line}`} className="whitespace-pre-wrap">{line}</p>;
        })}
      </div>
      <footer className={`${compact ? 'mt-4 pt-2 text-[7px]' : 'mt-8 pt-3 text-[8px]'} border-t text-right tracking-wide text-slate-400`} style={{ borderColor: '#e4e4e7' }}>CAREERPILOT</footer>
    </article>
  );
}
