'use client';

import { useState } from 'react';
import { Mic, Brain, MessageSquareText, Code2, ChevronLeft } from 'lucide-react';
import Interview from '@/components/dash/interview';
import Aptitude from '@/components/dash/aptitude';
import Communication from '@/components/dash/communication';
import Technical from '@/components/dash/technical';
import { useI18n } from '@/lib/i18n/context';

const TILE_META = [
  { id: 'interview', icon: Mic, color: '#34d399' },
  { id: 'aptitude', icon: Brain, color: '#38bdf8' },
  { id: 'communication', icon: MessageSquareText, color: '#f59e0b' },
  { id: 'technical', icon: Code2, color: '#a78bfa' },
];

export default function JobPrep() {
  const { t } = useI18n();
  const [view, setView] = useState(null);
  const tileText = t('dashboard.jobPrep.tiles');
  const TILES = TILE_META.map((m, i) => ({ ...m, title: tileText[i].title, desc: tileText[i].desc }));

  if (view) {
    return (
      <div className="space-y-4">
        <button onClick={() => setView(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> {t('dashboard.jobPrep.back')}</button>
        {view === 'interview' && <Interview />}
        {view === 'aptitude' && <Aptitude />}
        {view === 'communication' && <Communication />}
        {view === 'technical' && <Technical />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">{t('dashboard.jobPrep.heading')}</h2><p className="text-muted-foreground">{t('dashboard.jobPrep.subtitle')}</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        {TILES.map((tile) => (
          <button key={tile.id} onClick={() => setView(tile.id)} className="group glass rounded-2xl p-6 text-left hover:border-primary/40 transition">
            <div className="h-12 w-12 rounded-xl grid place-items-center mb-4" style={{ background: tile.color + '22' }}><tile.icon className="h-6 w-6" style={{ color: tile.color }} /></div>
            <h3 className="font-semibold text-lg">{tile.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{tile.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
