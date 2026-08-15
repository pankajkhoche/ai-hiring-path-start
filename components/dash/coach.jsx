'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, MessagesSquare, Plus, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import Markdown from '@/components/ui/markdown';

export default function Coach({ provider }) {
  const { t } = useI18n();
  const SUGGESTIONS = t('dashboard.coach.suggestions');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { api('/ai/chat/sessions').then(setSessions).catch(() => {}); }, []);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, loading]);

  async function loadSession(id) {
    setSessionId(id);
    const msgs = await api('/ai/chat/session/' + id).catch(() => []);
    setMessages(msgs);
  }
  function newChat() { setSessionId(null); setMessages([]); }

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const data = await api('/ai/chat', { method: 'POST', body: { message: msg, sessionId, provider } });
      if (!sessionId) { setSessionId(data.sessionId); api('/ai/chat/sessions').then(setSessions).catch(() => {}); }
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (e) { toast.error(e.message); setMessages((m) => m.slice(0, -1)); } finally { setLoading(false); }
  }

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 h-[calc(100vh-9rem)]">
      <div className="glass rounded-2xl p-3 hidden lg:flex flex-col">
        <Button onClick={newChat} variant="outline" className="w-full mb-3"><Plus className="h-4 w-4 mr-2" /> {t('dashboard.coach.newChat')}</Button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.map((s) => (<button key={s.id} onClick={() => loadSession(s.id)} className={`w-full text-left rounded-lg px-3 py-2 text-sm truncate transition ${sessionId === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-muted-foreground'}`}>{s.title}</button>))}
          {!sessions.length && <p className="text-xs text-muted-foreground px-3 py-4">{t('dashboard.coach.noConversations')}</p>}
        </div>
      </div>

      <div className="glass rounded-2xl flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {!messages.length && (
            <div className="h-full grid place-items-center text-center">
              <div className="max-w-md">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-amber-300 grid place-items-center mx-auto mb-4"><Sparkles className="h-7 w-7" /></div>
                <h3 className="text-xl font-semibold">{t('dashboard.coach.heading')}</h3>
                <p className="text-muted-foreground text-sm mt-2">{t('dashboard.coach.subtitle')}</p>
                <div className="mt-6 grid gap-2">{SUGGESTIONS.map((s) => (<button key={s} onClick={() => send(s)} className="text-left text-sm rounded-lg border border-border px-4 py-3 hover:border-primary/50 hover:bg-secondary transition">{s}</button>))}</div>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-amber-300 grid place-items-center shrink-0"><Sparkles className="h-4 w-4" /></div>}
              <div className={`rounded-2xl px-4 py-3 max-w-[80%] ${m.role === 'user' ? 'bg-primary text-primary-foreground text-sm whitespace-pre-wrap' : 'bg-secondary'}`}>
                {m.role === 'assistant' ? <Markdown content={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {loading && <div className="flex gap-3"><div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-amber-300 grid place-items-center"><Sparkles className="h-4 w-4" /></div><div className="rounded-2xl px-4 py-3 bg-secondary"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
        </div>
        <div className="border-t border-border p-4 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={t('dashboard.coach.inputPlaceholder')} />
          <Button onClick={() => send()} disabled={loading} className=""><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
