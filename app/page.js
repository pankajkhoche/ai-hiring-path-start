'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getToken } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';
import Intro from '@/components/intro';
import { LogoMark } from '@/components/logo';
import ThemeToggle from '@/components/theme-toggle';
import LanguageSwitcher from '@/components/language-switcher';

const Reveal = ({ children, delay = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, delay }}>{children}</motion.div>
);

function ScoreGauge({ value = 92 }) {
  const r = 62, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg viewBox="0 0 160 160" className="h-36 w-36 md:h-40 md:w-40">
      <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
      <circle cx="80" cy="80" r={r} fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 80 80)" />
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2a93c" />
          <stop offset="100%" stopColor="#f6d38a" />
        </linearGradient>
      </defs>
      <text x="80" y="90" textAnchor="middle" className="font-display" fontSize="38" fill="hsl(var(--foreground))">{value}</text>
    </svg>
  );
}

const STAT_VALUES = ['3.2x', '92%', '50k+', '4.9/5'];
const STAT_KEYS = ['callbacks', 'atsImprovement', 'interviewsTaken', 'rating'];
const PLAN_PRICES = [0, 399, 599];
const SKILL_ROW_KEYS = ['keywordMatch', 'formatting', 'impactMetrics', 'interviewReadiness'];
const SKILL_ROW_VALUES = [88, 95, 74, 81];

export default function Landing() {
  const { t } = useI18n();
  useEffect(() => {}, []);
  const loggedIn = typeof window !== 'undefined' && !!getToken();
  const primaryHref = loggedIn ? '/dashboard' : '/register';

  const features = t('features.items');
  const howSteps = t('how.steps');
  const plans = t('pricing.plans');
  const testimonials = t('testimonials.items');
  const faqs = t('faq.items');

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AI Hiring Path',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'AI-powered ATS resume analysis, mock interviews, timed aptitude/communication/technical assessments, and a personalized career roadmap.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', description: '3 months free Premium trial' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '50000' },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Intro />
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 backdrop-blur-xl bg-background/70">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight font-display text-lg">
            <LogoMark className="h-8 w-8" />
            AI Hiring Path
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">{t('nav.features')}</a>
            <a href="#how" className="hover:text-foreground transition">{t('nav.how')}</a>
            <a href="#pricing" className="hover:text-foreground transition">{t('nav.pricing')}</a>
            <a href="#faq" className="hover:text-foreground transition">{t('nav.faq')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:flex" />
            <ThemeToggle />
            <Link href="/login"><Button variant="ghost" size="sm">{t('nav.login')}</Button></Link>
            <Link href={primaryHref}><Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">{t('nav.startTrial')} <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-36 pb-24">
        <div className="absolute inset-0 grid-bg radial-fade opacity-40" />
        <div className="absolute top-24 left-1/2 -translate-x-1/2 h-[420px] w-[820px] bg-primary/10 blur-[140px] rounded-full" />
        <div className="container relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">{t('hero.badge')}</Badge>
            <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.08]">
              {t('hero.titlePrefix')} <span className="gradient-text italic">{t('hero.titleEmphasis')}</span> {t('hero.titleSuffix')}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={primaryHref}><Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 text-base glow">{t('hero.cta')} <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <a href="#how"><Button size="lg" variant="outline" className="h-12 px-8 text-base">{t('hero.secondaryCta')}</Button></a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t('hero.disclaimer')}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative mt-16 max-w-4xl mx-auto">
            <div className="glass rounded-2xl p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div className="flex flex-col items-center md:items-start">
                  <ScoreGauge value={92} />
                  <p className="mt-4 text-sm text-muted-foreground text-center md:text-left">{t('hero.gaugeCaption')}</p>
                </div>
                <div className="space-y-4 w-full">
                  {SKILL_ROW_KEYS.map((key, i) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5"><span>{t(`skillRows.${key}`)}</span><span>{SKILL_ROW_VALUES[i]}%</span></div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full" style={{ width: `${SKILL_ROW_VALUES[i]}%`, background: 'linear-gradient(90deg, #f2a93c, #f6d38a)' }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 py-12">
          {STAT_KEYS.map((key, i) => (
            <Reveal key={key}><div className="text-center"><div className="font-display text-3xl md:text-4xl gradient-text">{STAT_VALUES[i]}</div><div className="mt-1 text-sm text-muted-foreground">{t(`stats.${key}`)}</div></div></Reveal>
          ))}
        </div>
      </section>

      {/* Features — editorial list, no icon-box grid */}
      <section id="features" className="py-24">
        <div className="container max-w-4xl">
          <Reveal><div className="mb-16"><Badge variant="outline" className="mb-4">{t('features.eyebrow')}</Badge><h2 className="font-display text-3xl md:text-4xl">{t('features.title')}</h2><p className="mt-4 text-muted-foreground max-w-xl">{t('features.subtitle')}</p></div></Reveal>
          <div className="border-t border-border/60">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.04}>
                <div className="grid md:grid-cols-[4rem_1fr] gap-4 md:gap-10 py-8 border-b border-border/60 items-baseline">
                  <span className="font-display text-2xl text-primary/60">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-xl">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xl">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 bg-card/30 border-y border-border/60">
        <div className="container">
          <Reveal><div className="max-w-2xl mx-auto text-center mb-16"><Badge variant="outline" className="mb-4">{t('how.eyebrow')}</Badge><h2 className="font-display text-3xl md:text-4xl">{t('how.title')}</h2></div></Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {howSteps.map((s, i) => (
              <Reveal key={s.t} delay={i * 0.08}><div className="glass rounded-2xl p-8"><div className="font-display text-5xl text-primary/25">{String(i + 1).padStart(2, '0')}</div><h3 className="mt-4 font-display text-xl">{s.t}</h3><p className="mt-2 text-sm text-muted-foreground">{s.d}</p></div></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container">
          <Reveal><div className="max-w-2xl mx-auto text-center mb-6"><Badge variant="outline" className="mb-4 border-accent/40 bg-accent/10 text-accent">{t('pricing.badge')}</Badge><h2 className="font-display text-3xl md:text-4xl">{t('pricing.title')}</h2><p className="mt-4 text-muted-foreground">{t('pricing.subtitle')}</p></div></Reveal>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-12">
            {plans.map((p, i) => {
              const popular = i === 2;
              return (
                <Reveal key={p.name} delay={i * 0.06}>
                  <div className={`relative rounded-2xl p-8 h-full flex flex-col ${popular ? 'border-2 border-primary bg-primary/5 glow' : 'glass'}`}>
                    {popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">{t('pricing.mostPopular')}</Badge>}
                    <h3 className="font-display text-lg">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.tagline}</p>
                    <div className="mt-4 flex items-end gap-1">{PLAN_PRICES[i] === 0 ? <span className="font-display text-4xl">{t('pricing.free')}</span> : <><span className="font-display text-4xl">₹{PLAN_PRICES[i]}</span><span className="text-muted-foreground mb-1">{t('pricing.perMonth')}</span></>}</div>
                    <ul className="mt-6 space-y-3 flex-1">
                      {p.features.map((f) => (<li key={f} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />{f}</li>))}
                    </ul>
                    <Link href={primaryHref} className="mt-8"><Button className={`w-full ${popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`} variant={popular ? 'default' : 'outline'}>{t('pricing.cta')}</Button></Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-card/30 border-y border-border/60">
        <div className="container">
          <Reveal><div className="max-w-2xl mx-auto text-center mb-16"><Badge variant="outline" className="mb-4">{t('testimonials.eyebrow')}</Badge><h2 className="font-display text-3xl md:text-4xl">{t('testimonials.title')}</h2></div></Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((tst, i) => (
              <Reveal key={tst.name} delay={i * 0.06}><div className="glass rounded-2xl p-6 h-full"><div className="flex gap-1 mb-4">{[...Array(5)].map((_, k) => <Star key={k} className="h-4 w-4 fill-primary text-primary" />)}</div><p className="text-sm text-muted-foreground">“{tst.quote}”</p><div className="mt-5 flex items-center gap-3"><div className="h-10 w-10 rounded-full grid place-items-center font-display text-lg" style={{ background: 'linear-gradient(135deg, #f2a93c, #f6d38a)', color: '#1a1310' }}>{tst.name[0]}</div><div><div className="font-medium text-sm">{tst.name}</div><div className="text-xs text-muted-foreground">{tst.role}</div></div></div></div></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="container max-w-3xl">
          <Reveal><div className="text-center mb-12"><Badge variant="outline" className="mb-4">{t('faq.eyebrow')}</Badge><h2 className="font-display text-3xl md:text-4xl">{t('faq.title')}</h2></div></Reveal>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (<AccordionItem key={i} value={`item-${i}`} className="glass rounded-xl px-5 mb-3 border"><AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{f.a}</AccordionContent></AccordionItem>))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <Reveal><div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card p-12 md:p-16 text-center"><div className="absolute inset-0 grid-bg opacity-30" /><div className="relative"><h2 className="font-display text-3xl md:text-5xl">{t('cta.titlePrefix')} <span className="gradient-text italic">{t('cta.titleEmphasis')}</span></h2><p className="mt-4 text-muted-foreground max-w-xl mx-auto">{t('cta.subtitle')}</p><Link href={primaryHref}><Button size="lg" className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 glow">{t('cta.button')} <ArrowRight className="ml-2 h-4 w-4" /></Button></Link></div></div></Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-lg"><LogoMark className="h-8 w-8" /> AI Hiring Path</div>
          <p className="text-sm text-muted-foreground">{t('footer.tagline')}</p>
          <div className="flex gap-6 text-sm text-muted-foreground"><a href="#" className="hover:text-foreground">{t('footer.privacy')}</a><a href="#" className="hover:text-foreground">{t('footer.terms')}</a><a href="#pricing" className="hover:text-foreground">{t('footer.pricing')}</a></div>
        </div>
      </footer>
    </div>
  );
}
