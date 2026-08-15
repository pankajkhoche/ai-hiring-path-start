'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

// A distinctive, pure-CSS loading state for AI-processing waits, paired with a
// rotating quote/tip for programmers so the wait feels less empty. No external
// assets (matches the app's existing custom-SVG-over-stock-imagery approach).

const QUOTES = [
  { q: "First, solve the problem. Then, write the code.", a: "John Johnson" },
  { q: "Code is like humor. When you have to explain it, it's bad.", a: "Cory House" },
  { q: "The best error message is the one that never shows up.", a: "Thomas Fuchs" },
  { q: "Simplicity is the soul of efficiency.", a: "Austin Freeman" },
  { q: "Programs must be written for people to read, and only incidentally for machines to execute.", a: "Harold Abelson" },
  { q: "Talk is cheap. Show me the code.", a: "Linus Torvalds" },
  { q: "Premature optimization is the root of all evil.", a: "Donald Knuth" },
  { q: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", a: "Martin Fowler" },
  { q: "Debugging is twice as hard as writing the code in the first place.", a: "Brian Kernighan" },
  { q: "Make it work, make it right, make it fast.", a: "Kent Beck" },
  { q: "A good programmer looks both ways before crossing a one-way street.", a: "Doug Linder" },
  { q: "Deleted code is debugged code.", a: "Jeff Sickel" },
  { q: "Tip: read the error message on line 1, not just the last line — that's usually the real cause.", a: "Debugging tip" },
  { q: "Tip: write the test before the fix. It proves the bug existed and that you actually fixed it.", a: "Debugging tip" },
  { q: "Tip: naming things well is half of good design. The other half is naming them again once you understand the problem.", a: "Engineering tip" },
];

function pickQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

export default function AiLoader({ label, className = '' }) {
  const [quote, setQuote] = useState(pickQuote);

  useEffect(() => {
    const id = setInterval(() => setQuote(pickQuote()), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-6 ${className}`}>
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-primary/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.4s' }} />
        <div className="absolute inset-0 grid place-items-center"><Sparkles className="h-5 w-5 text-primary animate-pulse" /></div>
      </div>
      {label && <p className="mt-4 text-sm font-medium text-foreground">{label}</p>}
      <div key={quote.q} className="mt-5 max-w-sm animate-[fadeIn_0.5s_ease-out]">
        <p className="text-sm text-muted-foreground italic">&ldquo;{quote.q}&rdquo;</p>
        <p className="mt-1.5 text-xs text-muted-foreground/70">— {quote.a}</p>
      </div>
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
