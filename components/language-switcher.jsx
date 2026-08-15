'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n/context';
import { LOCALES } from '@/lib/i18n/locales';

export default function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale } = useI18n();
  return (
    <Select value={locale} onValueChange={setLocale}>
      <SelectTrigger className={`h-8 w-[92px] text-xs ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code}>{l.native}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
