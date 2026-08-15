'use client';

// Real brand mark (provided by the user), background-removed and cropped to
// the icon graphic only -- the wordmark is rendered separately as text
// wherever this is used, so the source image doesn't duplicate it.
export function LogoMark({ className = 'h-8 w-8' }) {
  return <img src="/logo-icon.png" alt="AI Hiring Path" className={`${className} object-contain`} />;
}

export default function Logo({ className = '', markClass = 'h-8 w-8' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-lg ${className}`}>
      <LogoMark className={markClass} />
      <span>AI Hiring Path</span>
    </span>
  );
}
