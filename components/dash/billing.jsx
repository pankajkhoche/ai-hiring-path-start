'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

export default function Billing({ user }) {
  const { t } = useI18n();
  const PLANS = t('pricing.plans').map((p, i) => ({ id: ['starter', 'professional', 'premium'][i], name: p.name, price: [0, 399, 599][i], popular: i === 2, features: p.features.slice(0, 5) }));
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState('');
  const refresh = () => api('/billing/me').then(setInfo).catch(() => {});
  useEffect(() => { refresh(); }, []);

  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load Razorpay checkout'));
      document.body.appendChild(script);
    });
  }

  async function checkout(planId) {
    setLoading(planId);
    try {
      const d = await api('/billing/checkout', { method: 'POST', body: { plan: planId } });
      if (d.status === 'payment_not_configured') { toast.info(d.message); setLoading(''); return; }

      await loadRazorpayScript();
      const rzp = new window.Razorpay({
        key: d.keyId,
        order_id: d.orderId,
        amount: d.amount,
        currency: d.currency,
        name: 'AI Hiring Path',
        description: `${d.planName} Plan`,
        prefill: { name: d.userName, email: d.userEmail },
        theme: { color: '#f2a93c' },
        handler: async (response) => {
          try {
            await api('/billing/verify', { method: 'POST', body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
            } });
            toast.success(t('dashboard.billing.checkoutStartedToast'));
            refresh();
          } catch (e) { toast.error(e.message); } finally { setLoading(''); }
        },
        modal: { ondismiss: () => setLoading('') },
      });
      rzp.on('payment.failed', (resp) => { toast.error(resp.error?.description || 'Payment failed'); setLoading(''); });
      rzp.open();
    } catch (e) { toast.error(e.message); setLoading(''); }
  }

  const access = info?.access || user.access || {};

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t('dashboard.billing.currentPlan')}</p>
          <div className="flex items-center gap-2 mt-1"><h2 className="text-2xl font-bold capitalize">{access.tier}</h2><Badge variant="outline" className="border-primary/40 text-primary">{access.label}</Badge></div>
          {access.source === 'trial' && <p className="text-sm text-emerald-400 mt-1">{t('dashboard.billing.trialDaysLeft', { days: access.trialDaysLeft })}</p>}
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm max-w-sm"><Sparkles className="h-4 w-4 text-primary mb-2" />{t('dashboard.billing.promoText')}</div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((p) => (
          <div key={p.id} className={`relative rounded-2xl p-6 flex flex-col ${p.popular ? 'border-2 border-primary bg-primary/5' : 'glass'}`}>
            {p.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">{t('dashboard.billing.mostPopular')}</Badge>}
            <h3 className="font-semibold">{p.name}</h3>
            <div className="mt-2 flex items-end gap-1">{p.price === 0 ? <span className="text-3xl font-extrabold">{t('dashboard.billing.free')}</span> : <><span className="text-3xl font-extrabold">₹{p.price}</span><span className="text-muted-foreground mb-1">{t('dashboard.billing.perMonth')}</span></>}</div>
            <ul className="mt-4 space-y-2 flex-1">{p.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />{f}</li>)}</ul>
            <Button onClick={() => checkout(p.id)} disabled={loading === p.id} className="mt-6 w-full" variant={p.popular ? 'default' : 'outline'}>{loading === p.id ? t('dashboard.billing.pleaseWait') : (p.price === 0 ? t('dashboard.billing.currentFreePlan') : t('dashboard.billing.choosePlan', { plan: p.name }))}</Button>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold mb-4">{t('dashboard.billing.paymentHistory')}</h3>
        {info?.payments?.length ? (
          <div className="space-y-2">{info.payments.map((p, i) => <div key={i} className="flex justify-between text-sm border-b border-border py-2"><span>{p.plan}</span><span>₹{p.amount}</span></div>)}</div>
        ) : <p className="text-sm text-muted-foreground">{t('dashboard.billing.noPayments')}</p>}
      </div>
    </div>
  );
}
