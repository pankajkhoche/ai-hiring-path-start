import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Share-card image using the real brand mark (embedded as a data URI -- ImageResponse/Satori
// can't reliably resolve a relative public/ URL at generation time), on the site's
// warm-charcoal + gold design system instead of a generic screenshot.
export default function OgImage() {
  const logoBase64 = readFileSync(join(process.cwd(), 'public', 'logo-icon.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${logoBase64}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', position: 'relative',
          background: '#171310', color: '#f5efe6', fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,169,60,0.35) 0%, rgba(242,169,60,0) 70%)', display: 'flex' }} />
        <img src={logoSrc} width={110} height={110} style={{ objectFit: 'contain' }} />
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, marginTop: 8, letterSpacing: -0.5 }}>
          AI Hiring Path
        </div>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 600, marginTop: 30, textAlign: 'center', maxWidth: 940, lineHeight: 1.15 }}>
          The Career Intelligence Platform
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#b8ab9a', marginTop: 22, textAlign: 'center', maxWidth: 780, fontFamily: 'sans-serif' }}>
          Beat the ATS, ace every interview, and close your skill gaps
        </div>
      </div>
    ),
    { ...size }
  );
}
