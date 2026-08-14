// 共通の小さな道具。日付・金額・かな・消費税・締日の計算。

export const YEN = new Intl.NumberFormat('ja-JP');
export const WD = ['日', '月', '火', '水', '木', '金', '土'];

/* ---------- 数 ---------- */
export const yen = (n) => YEN.format(Math.round(Number(n) || 0));
export const yenSigned = (n) => (Number(n) < 0 ? '△' + yen(Math.abs(n)) : yen(n));
export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[,\s￥¥]/g, '').replace(/[０-９．－]/g, (c) => '0123456789.-'['０１２３４５６７８９．－'.indexOf(c)]));
  return Number.isFinite(n) ? n : 0;
};
export const int = (v) => Math.round(num(v));

/** 端数処理 0=切捨 1=四捨五入 2=切上（Access の税端数と同じ並び） */
export function round(v, mode = 1) {
  if (mode === 0) return Math.floor(v);
  if (mode === 2) return Math.ceil(v);
  return Math.round(v);
}
/** 消費税（外税）。梅乃寿司は伝票ごとに税率をかけて四捨五入。 */
export const calcTax = (base, rate = 10, mode = 1) => round((num(base) * num(rate)) / 100, mode);

/* ---------- 日付 ---------- */
export const today = () => toISO(new Date());
export function toISO(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const parseISO = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
/** 2026-08-14 → 2026年8月14日(金) */
export function jDate(iso, opt = {}) {
  if (!iso) return '';
  const d = parseISO(iso);
  const w = opt.weekday === false ? '' : `(${WD[d.getDay()]})`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日${w}`;
}
/** 2026-08-14 → 8/14(金)。今年でなければ年も付ける（2024/3/2）。 */
export function shortDate(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  const y = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}/`;
  return `${y}${d.getMonth() + 1}/${d.getDate()}${y ? '' : `(${WD[d.getDay()]})`}`;
}
export const jMonth = (ym) => {
  const [y, m] = String(ym).split('-');
  return `${y}年${Number(m)}月`;
};
export const ymOf = (iso) => String(iso).slice(0, 7);
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const lastDayOf = (y, m) => new Date(y, m, 0).getDate();
export const thisMonth = () => ymOf(today());

/**
 * 締日から請求対象期間を出す。
 * 締日23 / 対象年月2026-08 → 2026-07-24 〜 2026-08-23
 * 締日31（月末締）→ 2026-08-01 〜 2026-08-31
 */
export function billingPeriod(ym, closeDay = 23) {
  const [y, m] = ym.split('-').map(Number);
  const cd = Math.min(Number(closeDay) || 23, 31);
  const end = new Date(y, m - 1, Math.min(cd, lastDayOf(y, m)));
  if (cd >= 31 || cd >= lastDayOf(y, m)) {
    return { from: toISO(new Date(y, m - 1, 1)), to: toISO(end) };
  }
  const pm = new Date(y, m - 2, 1);
  const from = new Date(pm.getFullYear(), pm.getMonth(), Math.min(cd + 1, lastDayOf(pm.getFullYear(), pm.getMonth() + 1)));
  return { from: toISO(from), to: toISO(end) };
}
/** 請求日（締めの翌日）と入金予定日 */
export function dueDate(ym, closeDay, payMonth = 1, payDay = 20) {
  const { to } = billingPeriod(ym, closeDay);
  const d = parseISO(to);
  const t = new Date(d.getFullYear(), d.getMonth() + (Number(payMonth) || 1), 1);
  const day = Math.min(Number(payDay) || 20, lastDayOf(t.getFullYear(), t.getMonth() + 1));
  return toISO(new Date(t.getFullYear(), t.getMonth(), day));
}

/* ---------- 文字 ---------- */
/** ひらがな→カタカナ、全角英数→半角、大文字化。検索用のゆるい正規化。 */
export function norm(s) {
  return String(s || '')
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ｦ-ﾟ]/g, (c) => {
      const t = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ';
      const f = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
      const i = t.indexOf(c); return i < 0 ? c : f[i];
    })
    .replace(/[\s　・（）()株式会社有限会社㈱㈲]/g, '')
    .toUpperCase();
}
/** 語をすべて含むか（あいまい検索） */
export function match(haystack, query) {
  const h = norm(haystack), q = norm(query);
  if (!q) return true;
  return q.split(/[\s　]+/).filter(Boolean).every((w) => h.includes(w));
}
export const honorific = (k) => (Number(k) === 1 ? '様' : '御中');
/** 0401234 → 040-1234 */
export function zipFmt(z) {
  const s = String(z || '').replace(/[^0-9]/g, '');
  return s.length === 7 ? `${s.slice(0, 3)}-${s.slice(3)}` : String(z || '');
}

/* ---------- DOM ---------- */
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 入力欄で Enter を押したら次の欄へ（Access と同じ感覚） */
export function enterMovesNext(root) {
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.dataset.enterOk) return;
    if (!['INPUT', 'SELECT'].includes(t.tagName)) return;
    e.preventDefault();
    const f = [...root.querySelectorAll('input:not([type=hidden]):not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled])')]
      .filter((x) => x.offsetParent !== null);
    const i = f.indexOf(t);
    const next = f[i + 1];
    if (next) { next.focus(); if (next.select) next.select(); }
  });
}

/** ファイルを保存させる */
export function download(name, text, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/** Excel が文字化けしないようBOM付きCSV */
export function toCSV(rows) {
  const q = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
