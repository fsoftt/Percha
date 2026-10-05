/*
 * Percha · internacionalización
 * Cada idioma vive en assets/js/lang/<código>.js y se registra con PerchaI18n.add().
 * En el HTML:
 *   data-i18n="clave"               → textContent
 *   data-i18n-html="clave"          → innerHTML (solo para textos propios con marcado)
 *   data-i18n-attr="attr:clave,…"   → atributos (aria-label, content, title…)
 *   data-i18n-args='{"n":4}'        → parámetros de interpolación {n}
 */
(function (g) {
  'use strict';

  const FALLBACK = 'es';
  const STORE = 'percha:lang';
  const dicts = {};
  const meta = {};
  const listeners = [];
  let lang = FALLBACK;
  let started = false;

  function add(code, info, dict) {
    dicts[code] = dict;
    meta[code] = info; // { nombre, locale }
  }

  function t(key, params) {
    let s = dicts[lang] && dicts[lang][key];
    if (s === undefined) s = dicts[FALLBACK] && dicts[FALLBACK][key];
    if (s === undefined) s = key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
    return s;
  }

  const locale = () => (meta[lang] && meta[lang].locale) || lang;

  function num(v, decimals = 1) {
    return Number(v).toLocaleString(locale(), { maximumFractionDigits: decimals });
  }

  function detect() {
    const cands = [];
    try { cands.push(new URLSearchParams(location.search).get('lang')); } catch (e) { /* sin location */ }
    try { cands.push(localStorage.getItem(STORE)); } catch (e) { /* almacenamiento bloqueado */ }
    if (typeof navigator !== 'undefined') {
      for (const l of navigator.languages || [navigator.language]) if (l) cands.push(l.slice(0, 2).toLowerCase());
    }
    return cands.find((c) => c && dicts[c]) || FALLBACK;
  }

  function apply(root) {
    if (typeof document === 'undefined') return;
    root = root || document;
    const args = (el) => { try { return JSON.parse(el.dataset.i18nArgs || 'null'); } catch (e) { return null; } };
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n, args(el)); });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml, args(el)); });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(',')) {
        const [attr, key] = pair.split(':').map((x) => x.trim());
        el.setAttribute(attr, t(key, args(el)));
      }
    });
    document.querySelectorAll('select[data-lang-switch]').forEach((s) => { s.value = lang; });
  }

  function setLang(code, opts = {}) {
    if (!dicts[code]) return;
    lang = code;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code;
      if (opts.persist !== false) {
        try { localStorage.setItem(STORE, code); } catch (e) { /* ignorar */ }
        try {
          const u = new URL(location.href);
          if (u.searchParams.has('lang')) { u.searchParams.set('lang', code); history.replaceState(null, '', u); }
        } catch (e) { /* ignorar */ }
      }
      apply();
    }
    listeners.forEach((fn) => fn(code));
  }

  function mountSwitchers() {
    document.querySelectorAll('select[data-lang-switch]').forEach((sel) => {
      sel.innerHTML = Object.keys(dicts).map((c) => `<option value="${c}">${meta[c].nombre}</option>`).join('');
      sel.value = lang;
      sel.addEventListener('change', () => setLang(sel.value));
    });
  }

  // Idempotente: app.js la llama antes de pintar; si no, se ejecuta al cargar el DOM.
  function init() {
    if (started || typeof document === 'undefined') return;
    started = true;
    mountSwitchers();
    setLang(detect(), { persist: false });
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);

  g.PerchaI18n = {
    add, t, num, init, apply, setLang, locale,
    onChange: (fn) => listeners.push(fn),
    get lang() { return lang; },
    get idiomas() { return Object.keys(dicts); },
    _dicts: dicts,
  };
})(typeof window !== 'undefined' ? window : globalThis);
