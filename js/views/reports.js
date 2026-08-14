// 日報・月報・現金出納帳。

import { store } from '../store.js';
import {
  el, yen, num, int, today, thisMonth, jDate, jMonth, shortDate, addDays,
  addMonths, billingPeriod, toCSV, download, enterMovesNext, match,
} from '../util.js';
import {
  card, table, kpi, note, btn, field, input, numInput, select,
  toast, confirmBox, modal, codePicker,
} from '../ui.js';
import { setHint, go } from '../app.js';

/* ==================== 日報 ==================== */
export async function renderDaily() {
  setHint('日付を変えると、その日の売上がすぐ出ます。');
  const date = input({ type: 'date', value: today() });
  const host = el('div');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });
  const byCat = el('div');

  const load = async () => {
    host.replaceChildren(el('div', { class: 'empty' }, '読み込んでいます…'));
    const [sales, recs, cash] = await Promise.all([
      store.list('sales', { from: date.value, to: date.value }),
      store.list('receipts', { from: date.value, to: date.value }),
      store.list('cashbook', { from: date.value, to: date.value }),
    ]);
    const live = sales.filter((s) => !s.void);
    const inc = (k) => live.filter((s) => Number(s.kind) === k).reduce((a, s) => a + num(s.subtotal) + num(s.tax), 0);
    const total = inc(0) + inc(1);

    kpis.replaceChildren(
      kpi('売上合計（税込）', total, `${live.length}件　${jDate(date.value)}`, 'kin'),
      kpi('現金売', inc(0), `${live.filter((s) => Number(s.kind) === 0).length}件`, 'midori'),
      kpi('掛売', inc(1), `${live.filter((s) => Number(s.kind) === 1).length}件`, 'shu'),
      kpi('入金', recs.filter((r) => !r.void).reduce((a, r) => a + num(r.total), 0), `${recs.filter((r) => !r.void).length}件`));

    // 部門別
    const cat = new Map();
    for (const s of live) {
      for (const l of (s.lines || [])) {
        const p = store.product(l.code);
        const key = p ? store.catName(p.cat) || 'その他' : 'その他';
        cat.set(key, (cat.get(key) || 0) + num(l.amount));
      }
    }
    const catRows = [...cat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    byCat.replaceChildren(catRows.length
      ? table([{ h: '部門', fmt: (r) => r.name }, { h: '金額（税抜）', cls: 'num', fmt: (r) => yen(r.amount), sum: (r) => r.amount }], catRows, { empty: '—' })
      : el('div', { class: 'empty' }, 'この日の明細はありません'));

    const cols = [
      { h: '伝票', w: '5.5rem', cls: 'num', fmt: (r) => r.no ?? '' },
      { h: '区分', w: '5rem', cls: 'cen', fmt: (r) => el('span', { class: 'tag ' + (Number(r.kind) === 0 ? 'tag--cash' : 'tag--credit') }, Number(r.kind) === 0 ? '現金' : '掛') },
      { h: '得意先', fmt: (r) => r.customerName || store.customer(r.customerCode)?.name || '現金' },
      { h: '内容', fmt: (r) => (r.lines || []).map((l) => `${l.name}${l.qty ? ` ${l.qty}${l.unit || ''}` : ''}`).join('／') },
      { h: '備考', fmt: (r) => el('span', { class: 'muted' }, r.note || '') },
      { h: '税抜', cls: 'num', w: '7rem', fmt: (r) => yen(r.subtotal), sum: (r) => (r.void ? 0 : r.subtotal) },
      { h: '消費税', cls: 'num', w: '6rem', fmt: (r) => yen(r.tax), sum: (r) => (r.void ? 0 : r.tax) },
      { h: '税込', cls: 'num', w: '7.5rem', fmt: (r) => el('b', {}, yen(num(r.subtotal) + num(r.tax))), sum: (r) => (r.void ? 0 : num(r.subtotal) + num(r.tax)) },
    ];
    host.replaceChildren(table(cols, sales, { onRow: (r) => go(`uriage/${r.id}`), empty: 'この日の売上はありません' }));

    cashHost.replaceChildren(cash.length
      ? table([
        { h: '摘要', fmt: (r) => r.note || r.party || '' },
        { h: '相手先', fmt: (r) => el('span', { class: 'muted' }, r.party || '') },
        { h: '入金', cls: 'num', w: '8rem', fmt: (r) => (Number(r.dc) === 0 ? yen(r.amount) : '—') },
        { h: '出金', cls: 'num', w: '8rem', fmt: (r) => (Number(r.dc) === 1 ? yen(r.amount) : '—') },
      ], cash, { foot: false })
      : el('div', { class: 'empty' }, 'この日の現金の出入りはありません'));
  };

  const cashHost = el('div');
  date.addEventListener('change', load);
  await load();

  return el('div', {},
    el('div', { class: 'toolbar' },
      field('日付', date),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('前の日', () => { date.value = addDays(date.value, -1); load(); }, 'btn--ghost')),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('次の日', () => { date.value = addDays(date.value, 1); load(); }, 'btn--ghost')),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('今日', () => { date.value = today(); load(); }, 'btn--ghost')),
      el('div', { style: 'flex:1' }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('印刷する', () => window.print(), 'btn--ghost'))),
    kpis,
    card('売上の明細', host),
    el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.2rem' },
      card('部門別', byCat),
      card('現金の出入り', cashHost)));
}

/* ==================== 月報 ==================== */
export async function renderMonthly() {
  setHint('得意先ごと・月ごとの売上です。前年と見比べられます。');
  const year = select([...Array(26)].map((_, i) => {
    const y = Number(today().slice(0, 4)) - i;
    return { value: y, label: `${y}年` };
  }), { value: Number(today().slice(0, 4)) });
  const mode = select([
    { value: 'customer', label: '得意先ごと' },
    { value: 'cat', label: '部門ごと' },
    { value: 'kind', label: '現金売・掛売' },
  ], { value: 'customer' });

  const host = el('div', { class: 'empty' }, '読み込んでいます…');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });

  const load = async () => {
    host.className = 'empty'; host.replaceChildren('集計しています…');
    const y = Number(year.value);
    const [cur, prev] = await Promise.all([
      store.list('sales', { from: `${y}-01-01`, to: `${y}-12-31` }),
      store.list('sales', { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }),
    ]);
    const live = (a) => a.filter((s) => !s.void);

    const bucket = new Map();     // key -> {name, m:[12], total}
    const add = (key, name, mi, amt) => {
      if (!bucket.has(key)) bucket.set(key, { key, name, m: Array(12).fill(0), total: 0 });
      const b = bucket.get(key); b.m[mi] += amt; b.total += amt;
    };

    for (const s of live(cur)) {
      const mi = Number(s.date.slice(5, 7)) - 1;
      const amt = num(s.subtotal) + num(s.tax);
      if (mode.value === 'customer') {
        const c = store.customer(s.customerCode);
        add(String(s.customerCode), c?.name || s.customerName || '現金', mi, amt);
      } else if (mode.value === 'kind') {
        add(String(s.kind), Number(s.kind) === 0 ? '現金売' : '掛売', mi, amt);
      } else {
        const shares = s.lines?.length ? s.lines : [{ code: 0, amount: s.subtotal }];
        const base = shares.reduce((a, l) => a + num(l.amount), 0) || 1;
        for (const l of shares) {
          const p = store.product(l.code);
          add(String(p?.cat ?? 0), p ? (store.catName(p.cat) || 'その他') : 'その他', mi, amt * (num(l.amount) / base));
        }
      }
    }
    const rows = [...bucket.values()].sort((a, b) => b.total - a.total).map((r) => ({ ...r, m: r.m.map(Math.round), total: Math.round(r.total) }));

    // 今年がまだ途中なら、前年も同じ月までで比べる（そうしないと必ず「減った」ように見える）
    const lastMonth = live(cur).reduce((m, s) => Math.max(m, Number(s.date.slice(5, 7))), 0);
    const amt = (s) => num(s.subtotal) + num(s.tax);
    const sumCur = live(cur).reduce((a, s) => a + amt(s), 0);
    const prevSame = live(prev).filter((s) => Number(s.date.slice(5, 7)) <= (lastMonth || 12));
    const sumPrev = prevSame.reduce((a, s) => a + amt(s), 0);
    const sumPrevAll = live(prev).reduce((a, s) => a + amt(s), 0);
    const diff = sumPrev ? ((sumCur - sumPrev) / sumPrev) * 100 : 0;
    const partial = lastMonth > 0 && lastMonth < 12;
    kpis.replaceChildren(
      kpi(`${y}年の売上`, sumCur, `${live(cur).length}件${partial ? `　1〜${lastMonth}月` : ''}`, 'kin'),
      kpi(`${y - 1}年の売上`, sumPrevAll, `${live(prev).length}件　通年`),
      kpi('前年同期比', sumPrev ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}％` : '—',
        sumPrev ? `前年同期 ${yen(sumPrev)}円との差 ${yen(sumCur - sumPrev)}円` : '前年のデータなし',
        diff >= 0 ? 'midori' : 'shu'));

    const cols = [
      { h: mode.value === 'customer' ? '得意先' : mode.value === 'cat' ? '部門' : '区分', fmt: (r) => r.name, w: '14rem', cls: 'nowrap' },
      ...[...Array(12)].map((_, i) => ({
        h: `${i + 1}月`, cls: 'num', w: '6rem',
        fmt: (r) => (r.m[i] ? yen(r.m[i]) : el('span', { class: 'muted' }, '—')),
        sum: (r) => r.m[i],
      })),
      { h: '年計', cls: 'num', w: '8rem', fmt: (r) => el('b', {}, yen(r.total)), sum: (r) => r.total },
    ];
    host.className = '';
    host.replaceChildren(table(cols, rows, {
      empty: 'この年の売上はありません',
      onRow: mode.value === 'customer' ? (r) => go(`motocho/${r.key}`) : null,
    }));

    dl.onclick = () => {
      download(`月報_${y}年_${mode.options[mode.selectedIndex].text}.csv`, toCSV([
        [cols[0].h, ...[...Array(12)].map((_, i) => `${i + 1}月`), '年計'],
        ...rows.map((r) => [r.name, ...r.m, r.total]),
        ['合計', ...[...Array(12)].map((_, i) => rows.reduce((a, r) => a + r.m[i], 0)), rows.reduce((a, r) => a + r.total, 0)],
      ]), 'text/csv');
      toast('CSVを書き出しました');
    };
  };

  const dl = btn('CSVで書き出す', () => {}, 'btn--ghost');
  year.addEventListener('change', load);
  mode.addEventListener('change', load);
  await load();

  return el('div', {},
    el('div', { class: 'toolbar' },
      field('年', year), field('まとめ方', mode),
      el('div', { style: 'flex:1' }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'), dl),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'), btn('印刷する', () => window.print(), 'btn--ghost'))),
    kpis, card(null, host));
}

/* ==================== 現金出納帳 ==================== */
export async function renderCashbook() {
  setHint('日々の現金の出入りです。<b>＋ 記入</b>で新しい行を足せます。');
  const cd = store.company?.closeDay || 23;
  const p = billingPeriod(thisMonth(), cd);
  const from = input({ type: 'date', value: p.from });
  const to = input({ type: 'date', value: p.to });
  const q = input({ type: 'search', placeholder: '摘要・相手先で探す' });
  const host = el('div');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });

  const load = async () => {
    host.replaceChildren(el('div', { class: 'empty' }, '読み込んでいます…'));
    let rows = await store.list('cashbook', { from: from.value, to: to.value });
    if (q.value.trim()) rows = rows.filter((r) => match(`${r.note || ''} ${r.party || ''}`, q.value));

    const inSum = rows.filter((r) => Number(r.dc) === 0).reduce((a, r) => a + num(r.amount), 0);
    const outSum = rows.filter((r) => Number(r.dc) === 1).reduce((a, r) => a + num(r.amount), 0);
    kpis.replaceChildren(
      kpi('入金', inSum, `${rows.filter((r) => Number(r.dc) === 0).length}件`, 'midori'),
      kpi('出金', outSum, `${rows.filter((r) => Number(r.dc) === 1).length}件`, 'shu'),
      kpi('差引', inSum - outSum, '期間中の増減', 'kin'));

    let run = 0;
    const withBal = rows.map((r) => { run += (Number(r.dc) === 0 ? 1 : -1) * num(r.amount); return { ...r, run }; });

    const cols = [
      { h: '日付', w: '7.5rem', fmt: (r) => shortDate(r.date) },
      { h: '相手先', w: '14rem', fmt: (r) => r.party || '' },
      { h: '摘要', fmt: (r) => r.note || '' },
      { h: '入金', cls: 'num', w: '8rem', fmt: (r) => (Number(r.dc) === 0 ? yen(r.amount) : el('span', { class: 'muted' }, '—')), sum: (r) => (Number(r.dc) === 0 ? r.amount : 0) },
      { h: '出金', cls: 'num', w: '8rem', fmt: (r) => (Number(r.dc) === 1 ? yen(r.amount) : el('span', { class: 'muted' }, '—')), sum: (r) => (Number(r.dc) === 1 ? r.amount : 0) },
      { h: '差引', cls: 'num', w: '8rem', fmt: (r) => yen(r.run) },
      { h: '', w: '3rem', cls: 'cen', fmt: (r) => (r.src === 'access' || r.link ? el('span', { class: 'muted', title: '売上・入金から自動で作られた行' }, '自') : '') },
    ];
    host.replaceChildren(table(cols, withBal, { onRow: (r) => entry(r, load), empty: 'この期間の記録はありません' }));
  };

  [from, to].forEach((n) => n.addEventListener('change', load));
  q.addEventListener('input', debounce(load, 250));
  await load();

  return el('div', {},
    el('div', { class: 'toolbar' },
      field('開始日', from), field('終了日', to), field('探す', q, { wide: true }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('＋ 記入', () => entry(null, load), 'btn--primary')),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('CSVで書き出す', async () => {
          const rows = await store.list('cashbook', { from: from.value, to: to.value });
          download(`現金出納帳_${from.value}_${to.value}.csv`, toCSV([
            ['日付', '相手先', '摘要', '入金', '出金'],
            ...rows.map((r) => [r.date, r.party || '', r.note || '', Number(r.dc) === 0 ? num(r.amount) : '', Number(r.dc) === 1 ? num(r.amount) : '']),
          ]), 'text/csv');
          toast('CSVを書き出しました');
        }, 'btn--ghost'))),
    kpis, card(null, host));
}

async function entry(row, after) {
  const isNew = !row;
  const date = input({ type: 'date', value: row?.date || today() });
  const dc = select([{ value: 0, label: '入金（お金が入った）' }, { value: 1, label: '出金（お金を払った）' }], { value: row ? Number(row.dc) : 1 });
  const party = input({ value: row?.party || '', list: 'cashParty' });
  const note1 = input({ value: row?.note || '', list: 'cashNote' });
  const amount = numInput({ value: row?.amount || '' });

  const body = el('div', {},
    el('div', { class: 'grid grid--2' },
      field('日付', date, { req: true }),
      field('入金か出金か', dc, { req: true }),
      field('相手先', party),
      field('金額', amount, { req: true }),
      field('摘要', note1, { wide: true })),
    el('datalist', { id: 'cashParty' }, store.masters.cashPartners.map((p) => el('option', { value: p.name }))),
    el('datalist', { id: 'cashNote' }, (store.codeLists.cashNotes || []).map((n) => el('option', { value: n }))));

  const form = el('form', {}, body);
  enterMovesNext(form);

  const v = await modal({
    title: isNew ? '現金出納の記入' : '記入を直す',
    width: 620, body: form,
    buttons: [
      { label: 'やめる', value: null, class: 'btn--ghost' },
      !isNew && !row.link ? { label: '削除', value: 'del', class: 'btn--danger' } : null,
      { label: isNew ? '記入する' : '保存する', value: 'ok', class: 'btn--primary', before: () => {
        if (!int(amount.value)) { toast('金額を入れてください', 'err'); return false; }
        return true;
      } },
    ].filter(Boolean),
  });

  if (v === 'ok') {
    const rate = num(store.company?.taxRate) || 10;
    const amt = int(amount.value);
    await store.save('cashbook', {
      ...(row || {}),
      id: row?.id, no: row?.no ?? await store.nextNo('cash'),
      date: date.value, ym: date.value.slice(0, 7),
      dc: Number(dc.value), amount: amt,
      taxRate: row?.taxRate ?? 0, tax: row?.tax ?? 0, net: amt,
      party: party.value.trim(), note: note1.value.trim(),
    });
    toast(isNew ? '記入しました' : '保存しました');
    after();
  }
  if (v === 'del') {
    if (await confirmBox('この記入を消します。よろしいですか？', { ok: '消す', danger: true })) {
      await store.remove('cashbook', row.id);
      toast('消しました'); after();
    }
  }
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
