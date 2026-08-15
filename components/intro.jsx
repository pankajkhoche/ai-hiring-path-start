'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoMark } from '@/components/logo';

const BRAND = 'AI Hiring Path';

export default function Intro() {
  const [show, setShow] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('aihp_intro_seen')) {
      setShow(false);
      return;
    }
    // lock scroll while intro is visible
    document.body.style.overflow = 'hidden';
    const started = Date.now();
    const dur = 2000;
    const tick = setInterval(() => {
      const p = Math.min(100, ((Date.now() - started) / dur) * 100);
      setProgress(p);
      if (p >= 100) clearInterval(tick);
    }, 30);
    const done = setTimeout(() => {
      sessionStorage.setItem('aihp_intro_seen', '1');
      setShow(false);
      document.body.style.overflow = '';
    }, 2300);
    return () => { clearInterval(tick); clearTimeout(done); document.body.style.overflow = ''; };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-background overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
        >
          {/* ambient orb */}
          <motion.div className="absolute h-[520px] w-[520px] rounded-full bg-primary/15 blur-[130px]"
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1.1, opacity: 1 }} transition={{ duration: 1.6, ease: 'easeOut' }} />
          <div className="absolute inset-0 grid-bg opacity-[0.12]" />

          <div className="relative flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 140, damping: 12, delay: 0.1 }}
            >
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
                <LogoMark className="h-20 w-20 drop-shadow-[0_0_35px_rgba(242,169,60,0.5)]" />
              </motion.div>
            </motion.div>

            <div className="mt-7 overflow-hidden">
              <div className="flex text-2xl md:text-3xl font-display tracking-tight">
                {BRAND.split('').map((ch, i) => (
                  <motion.span key={i}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.035, duration: 0.5, ease: 'easeOut' }}
                    className={ch === ' ' ? 'w-2' : ''}
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </motion.span>
                ))}
              </div>
            </div>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }}
              className="mt-3 text-sm text-muted-foreground tracking-[0.25em] uppercase"
            >
              Career Intelligence
            </motion.p>

            <div className="mt-10 h-[3px] w-56 rounded-full bg-foreground/10 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #c97e1f, #f6d38a)' }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
