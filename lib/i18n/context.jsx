'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from './locales';
import en from './dictionaries/en.json';
import hi from './dictionaries/hi.json';
import mr from './dictionaries/mr.json';
import ja from './dictionaries/ja.json';
import zh from './dictionaries/zh.json';
import ko from './dictionaries/ko.json';

const DICTIONARIES = { en, hi, mr, ja, zh, ko };

function lookup(dict, key) {
  let cur = dict;
  for (const part of key.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

const I18nContext = createContext({ locale: DEFAULT_LOCALE, setLocale: () => {}, t: (key) => key });

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && DICTIONARIES[saved]) setLocaleState(saved);
  }, []);

  function setLocale(next) {
    if (!DICTIONARIES[next]) return;
    setLocaleState(next);
    if (typeof window !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }

  const value = useMemo(() => {
    const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
    function t(key, vars) {
      let val = lookup(dict, key);
      if (val === undefined) val = lookup(DICTIONARIES[DEFAULT_LOCALE], key);
      if (val === undefined) return key;
      if (typeof val === 'string' && vars) {
        return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), val);
      }
      return val;
    }
    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
