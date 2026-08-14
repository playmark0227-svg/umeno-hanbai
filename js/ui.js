// 画面部品。トースト・確認・一覧から選ぶダイアログ・入力欄・表。

import { el, $, match, yen, num, int } from './util.js';

/* ---------- 知らせ ---------- */
export function toast(msg, kind = 'ok') {
  const host = $('#toaster');
  const t = el('div', { class: 'toast' + (kind === 'ok' ? '' : ` toast--${kind}`), text: msg });
  host.append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; }, kind === 'err' ? 4200 : 2000);
  setTimeout(() => t.remove(), kind === 'err' ? 4600 : 2400);
}

/* ---------- ダイアログ ---------- */
const openModals = new Set();
/** 画面を切り替えるときに開いたままのダイアログを閉じる */
export function closeAllModals() { for (const c of [...openModals]) c(null); }

export function modal({ title, body, buttons = [], width = 560, onOpen }) {
  return new Promise((resolve) => {
    const host = $('#modalHost');
    const close = (v) => {
      openModals.delete(close);
      mask.remove(); document.removeEventListener('keydown', onKey); resolve(v);
    };
    openModals.add(close);
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(null); } };

    const foot = el('div', { class: 'modal__foot' },
      buttons.map((b) => el('button', {
        type: 'button',
        class: 'btn ' + (b.class || 'btn--ghost'),
        onclick: async () => {
          if (b.before) { const ok = await b.before(); if (ok === false) return; }
          close(b.value);
        },
      }, b.label)));

    const box = el('div', { class: 'modal', style: `--mw:${width}px`, role: 'dialog', 'aria-modal': 'true' },
      title && el('div', { class: 'modal__head' }, el('h3', {}, title)),
      el('div', { class: 'modal__body' }, body),
      buttons.length ? foot : null);

    const mask = el('div', { class: 'mask', onclick: (e) => { if (e.target === mask) close(null); } }, box);
    host.append(mask);
    document.addEventListener('keydown', onKey);
    onOpen?.(box, close);
    const f = box.querySelector('input,select,textarea,button');
    f?.focus();
  });
}

export const confirmBox = (msg, { ok = 'はい', cancel = 'いいえ', danger = false, title = '確認' } = {}) =>
  modal({
    title, width: 460,
    body: el('p', { style: 'font-size:1.05rem;line-height:1.7;white-space:pre-wrap' }, msg),
    buttons: [
      { label: cancel, value: false, class: 'btn--ghost' },
      { label: ok, value: true, class: danger ? 'btn--danger' : 'btn--primary' },
    ],
  }).then((v) => v === true);

export const alertBox = (msg, title = 'お知らせ') =>
  modal({
    title, width: 460,
    body: el('p', { style: 'font-size:1.05rem;line-height:1.7;white-space:pre-wrap' }, msg),
    buttons: [{ label: '閉じる', value: true, class: 'btn--primary' }],
  });

/* ---------- 一覧から選ぶ ---------- */
/**
 * rows: [{code, name, sub}] / 返り値は選んだ row（キャンセルは null）
 */
export function pickFrom(rows, { title = '選んでください', placeholder = '番号か名前で探す' } = {}) {
  return new Promise((resolve) => {
    let view = rows.slice(0, 400);
    let cur = 0;
    const list = el('div', { class: 'picker__list' });
    const search = el('input', { class: 'in', type: 'search', placeholder, autocomplete: 'off' });

    const render = () => {
      list.replaceChildren(...(view.length ? view.map((r, i) => el('button', {
        type: 'button', class: 'picker__row' + (i === cur ? ' is-on' : ''),
        onclick: () => done(r),
      }, el('b', {}, r.code ?? ''), el('span', {}, r.name || ''), r.sub ? el('i', {}, r.sub) : null))
        : [el('div', { class: 'empty' }, '見つかりません')]));
      list.querySelector('.is-on')?.scrollIntoView({ block: 'nearest' });
    };
    const filter = () => {
      const q = search.value.trim();
      view = (q ? rows.filter((r) => match(`${r.code} ${r.name} ${r.kana || ''} ${r.sub || ''}`, q)) : rows).slice(0, 400);
      cur = 0; render();
    };
    search.addEventListener('input', filter);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(cur + 1, view.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(cur - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (view[cur]) done(view[cur]); }
    });

    let done = () => {};
    modal({
      title, width: 640,
      body: el('div', {}, el('div', { class: 'picker__search' }, search), list),
      buttons: [{ label: 'やめる', value: null, class: 'btn--ghost' }],
      onOpen: (_box, close) => { done = (r) => { close(null); resolve(r); }; render(); },
    }).then((v) => { if (v === null) resolve(null); });
  });
}

/* ---------- 入力欄 ---------- */
export function field(label, input, { hint, req = false, wide = false } = {}) {
  return el('div', { class: 'f' + (wide ? ' f--grow' : '') },
    el('span', { class: 'f__label' }, label, req ? el('span', { class: 'req' }, '※') : null),
    input,
    hint ? el('span', { class: 'f__hint' }, hint) : null);
}
export const input = ({ class: cls = '', ...attrs } = {}) =>
  el('input', { autocomplete: 'off', ...attrs, class: `in ${cls}`.trim() });
export const numInput = ({ class: cls = '', ...attrs } = {}) =>
  el('input', { inputmode: 'numeric', autocomplete: 'off', ...attrs, class: `in in--num ${cls}`.trim() });
export function select(options, { class: cls = '', ...attrs } = {}) {
  const s = el('select', { ...attrs, class: `in ${cls}`.trim() });
  for (const o of options) {
    const v = typeof o === 'object' ? o.value : o;
    const t = typeof o === 'object' ? o.label : o;
    s.append(el('option', { value: v, selected: String(v) === String(attrs.value) }, t));
  }
  if (attrs.value !== undefined) s.value = attrs.value;
  return s;
}

/**
 * コード欄＋名称表示＋「探す」ボタンの組。
 * getRows() は [{code,name,kana,sub}] を返す。onPick(row|null) が呼ばれる。
 */
export function codePicker({ value = '', getRows, onPick, title = '選んでください', nameOf }) {
  const code = el('input', { class: 'in in--code', inputmode: 'numeric', autocomplete: 'off', value: value ?? '' });
  const name = el('input', { class: 'in pick__name', readonly: true, tabindex: -1 });
  const btn = el('button', { type: 'button', class: 'pick__btn', title: '一覧から探す (F4)' }, '探す');

  const set = (row) => {
    code.value = row ? row.code : '';
    name.value = row ? (nameOf ? nameOf(row) : row.name) : '';
    onPick?.(row);
  };
  const lookup = () => {
    const v = code.value.trim();
    if (v === '') { set(null); return; }
    const row = getRows().find((r) => String(r.code) === String(int(v)));
    if (row) set(row);
    else { name.value = ''; onPick?.(null); }
  };
  const open = async () => {
    const row = await pickFrom(getRows(), { title });
    if (row) { set(row); code.dispatchEvent(new CustomEvent('picked', { bubbles: true })); }
    code.focus();
  };
  code.addEventListener('change', lookup);
  code.addEventListener('blur', lookup);
  code.addEventListener('keydown', (e) => {
    if (e.key === 'F4' || (e.key === 'ArrowDown' && !code.value)) { e.preventDefault(); open(); }
  });
  btn.addEventListener('click', open);

  const wrap = el('div', { class: 'pick' }, code, name, btn);
  wrap.setValue = (v) => {
    const row = getRows().find((r) => String(r.code) === String(v));
    if (row) set(row); else { code.value = v ?? ''; name.value = ''; }
  };
  wrap.getValue = () => (code.value.trim() === '' ? null : int(code.value));
  wrap.focus = () => code.focus();
  wrap.codeEl = code; wrap.nameEl = name;
  if (value !== '' && value !== null && value !== undefined) wrap.setValue(value);
  return wrap;
}

/* ---------- 表 ---------- */
/**
 * cols: [{ k, h, w, cls, fmt(row), sum }]
 */
export function table(cols, rows, { onRow, empty = 'データがありません', foot = true, selectedId } = {}) {
  const thead = el('thead', {}, el('tr', {}, cols.map((c) =>
    el('th', { class: c.cls || '', style: c.w ? `width:${c.w}` : null }, c.h))));

  const body = el('tbody', {}, rows.length ? rows.map((r) => el('tr', {
    class: (onRow ? 'is-click' : '') + (selectedId && r.id === selectedId ? ' is-sel' : ''),
    onclick: onRow ? () => onRow(r) : null,
    tabindex: onRow ? 0 : null,
    onkeydown: onRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRow(r); } } : null,
  }, cols.map((c) => {
    const v = c.fmt ? c.fmt(r) : r[c.k];
    return el('td', { class: c.cls || '' }, v && v.nodeType ? v : String(v ?? ''));
  }))) : [el('tr', {}, el('td', { colspan: cols.length }, el('div', { class: 'empty' }, empty)))]);

  const sums = cols.filter((c) => c.sum);
  const tfoot = foot && sums.length && rows.length
    ? el('tfoot', {}, el('tr', {}, cols.map((c, i) => {
      if (c.sum) return el('td', { class: c.cls || '' }, yen(rows.reduce((a, r) => a + num(c.sum === true ? r[c.k] : c.sum(r)), 0)));
      return el('td', { class: c.cls || '' }, i === 0 ? `${rows.length}件` : '');
    })))
    : null;

  return el('div', { class: 'tablewrap' }, el('table', { class: 't' }, thead, body, tfoot));
}

/* ---------- その他 ---------- */
export const card = (title, body, actions = []) => el('div', { class: 'card' },
  title ? el('div', { class: 'card__head' }, el('h2', {}, title), el('div', { class: 'spacer' }), ...actions) : null,
  el('div', { class: 'card__body' + (body?.dataset?.flush ? ' card__body--flush' : '') }, body));

export const kpi = (label, value, sub, kind = '') => el('div', { class: 'kpi ' + (kind ? `kpi--${kind}` : '') },
  el('div', { class: 'kpi__k' }, label),
  el('div', { class: 'kpi__v' }, typeof value === 'number' ? [yen(value), el('small', {}, '円')] : value),
  sub ? el('div', { class: 'kpi__s' }, sub) : null);

export const note = (text, kind = '') => el('div', { class: 'note ' + (kind ? `note--${kind}` : '') }, text);

export const btn = (label, onclick, cls = 'btn--ghost', attrs = {}) =>
  el('button', { type: 'button', class: 'btn ' + cls, onclick, ...attrs }, label);

export function busy(label = '処理しています…') {
  const bar = el('div', { style: 'height:6px;background:#dfd6c4;border-radius:99px;overflow:hidden' },
    el('div', { style: 'height:100%;width:0%;background:#b5342a;transition:width .2s' }));
  const msg = el('p', { style: 'margin:0 0 .7rem;font-weight:700' }, label);
  const body = el('div', {}, msg, bar);
  let close;
  const p = modal({ title: 'しばらくお待ちください', body, width: 460, onOpen: (_b, c) => { close = c; } });
  return {
    set(done, total, text) {
      bar.firstChild.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
      msg.textContent = text || `${label} ${done.toLocaleString()} / ${total.toLocaleString()}`;
    },
    done() { close?.(true); return p; },
  };
}
