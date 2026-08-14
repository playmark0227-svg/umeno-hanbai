// 請求書・売掛残高・買掛残高・得意先元帳。

import { store, arBalance, buildInvoice, openingDateOf, prevDay } from '../store.js';
import {
  el, yen, num, today, thisMonth, jDate, jMonth, shortDate, billingPeriod,
  dueDate, addMonths, toCSV, download, match, honorific, zipFmt,
} from '../util.js';
import {
  card, table, kpi, note, btn, field, input, select, codePicker,
  toast, confirmBox, busy, modal,
} from '../ui.js';
import { go, setHint } from '../app.js';

const monthOptions = () => {
  const out = [];
  let ym = addMonths(thisMonth(), 2);
  for (let i = 0; i < 40; i++) { out.push({ value: ym, label: jMonth(ym) }); ym = addMonths(ym, -1); }
  return out;
};

/* ==================== 請求書 ==================== */
export async function renderInvoices() {
  setHint('請求する月を選んで<b>集計する</b>を押します。金額を確かめてから<b>確定して印刷</b>します。');

  const ym = select(monthOptions(), { value: thisMonth() });
  const onlyUnzero = el('input', { type: 'checkbox', checked: true });
  const host = el('div', { class: 'empty' }, '月を選んで「集計する」を押してください');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });
  let built = [];

  const run = async () => {
    const targets = store.masters.customers.filter((c) => Number(c.code) !== 0);
    const bar = busy('集計しています');
    built = [];
    try {
      for (let i = 0; i < targets.length; i++) {
        bar.set(i, targets.length, `集計しています　${i + 1} / ${targets.length}　${targets[i].name}`);
        try { built.push(await buildInvoice(targets[i].code, ym.value)); } catch (e) { console.warn(targets[i].code, e); }
      }
    } finally { bar.done(); }
    draw();
  };

  const draw = () => {
    const rows = built.filter((b) => (onlyUnzero.checked
      ? (b.billed !== 0 || b.sales !== 0 || b.receipt !== 0)
      : true));
    kpis.replaceChildren(
      kpi('請求する先', `${rows.filter((r) => r.billed !== 0).length}`, `全${built.length}社中`),
      kpi('当月売上（税抜）', rows.reduce((a, r) => a + r.sales, 0), '', 'kin'),
      kpi('消費税', rows.reduce((a, r) => a + r.tax, 0)),
      kpi('今回請求額', rows.reduce((a, r) => a + r.billed, 0), '税込', 'shu'));

    const cols = [
      { h: '番号', w: '4.5rem', cls: 'num', fmt: (r) => r.customerCode },
      { h: '得意先', fmt: (r) => r.customerName },
      { h: '締', w: '4rem', cls: 'cen', fmt: (r) => (r.closeDay >= 31 ? '末' : r.closeDay) },
      { h: '前回請求（繰越）', cls: 'num', w: '9rem', fmt: (r) => yen(r.carry), sum: (r) => r.carry },
      { h: '入金', cls: 'num', w: '8rem', fmt: (r) => (r.receipt ? yen(r.receipt) : dash()), sum: (r) => r.receipt },
      { h: '当月売上', cls: 'num', w: '8rem', fmt: (r) => (r.sales ? yen(r.sales) : dash()), sum: (r) => r.sales },
      { h: '消費税', cls: 'num', w: '7rem', fmt: (r) => (r.tax ? yen(r.tax) : dash()), sum: (r) => r.tax },
      { h: '今回請求額', cls: 'num', w: '9rem', fmt: (r) => el('b', { style: r.billed > 0 ? 'color:var(--shu)' : '' }, yen(r.billed)), sum: (r) => r.billed },
      { h: '状態', w: '6rem', cls: 'cen', fmt: (r) => (r.existing ? el('span', { class: 'tag tag--credit' }, '確定済') : dash()) },
    ];
    host.className = '';
    host.replaceChildren(table(cols, rows, {
      onRow: (r) => showOne(r),
      empty: 'この月に請求する先はありません',
    }));
  };

  const showOne = async (inv) => {
    await modal({
      title: `${inv.customerName}　${jMonth(inv.ym)}分`,
      width: 900,
      body: el('div', {}, invoiceSheet(inv)),
      buttons: [
        { label: '閉じる', value: null, class: 'btn--ghost' },
        { label: 'この1社を印刷', value: 'p', class: 'btn--primary' },
      ],
    }).then((v) => { if (v === 'p') printInvoices([inv]); });
  };

  const fix = async () => {
    const rows = built.filter((b) => b.billed !== 0 || b.sales !== 0 || b.receipt !== 0);
    if (!rows.length) { toast('確定する内容がありません', 'err'); return; }
    if (!await confirmBox(
      `${jMonth(ym.value)}分の請求を確定します。\n\n${rows.length}社ぶん／請求額の合計 ${yen(rows.reduce((a, r) => a + r.billed, 0))}円\n\n`
      + '確定すると、この金額が来月の「繰越」になります。\nよろしいですか？',
      { ok: '確定する', danger: false, title: '請求の確定' })) return;

    const bar = busy('確定しています');
    try {
      const docs = rows.map((r) => ({
        id: r.id, customerCode: r.customerCode, customerName: r.customerName,
        ym: r.ym, year: r.year, month: r.month, from: r.from, to: r.to, closeDay: r.closeDay,
        carry: r.carry, receipt: r.receipt, receiptDiscount: r.receiptDiscount,
        sales: r.sales, tax: r.tax, discount: r.discount, billed: r.billed,
        fixedAt: new Date().toISOString(),
      }));
      await store.bulk('invoices', docs, (d, t) => bar.set(d, t));
    } finally { bar.done(); }
    toast('請求を確定しました');
    await run();
  };

  onlyUnzero.addEventListener('change', draw);

  return el('div', {},
    el('div', { class: 'toolbar' },
      field('請求する月', ym),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'), btn('集計する', run, 'btn--primary')),
      el('label', { class: 'check' }, onlyUnzero, '動きのある先だけ'),
      el('div', { style: 'flex:1' }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('確定して控えを残す', fix, 'btn--ghost')),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('請求書をまとめて印刷', () => {
          const rows = built.filter((b) => b.billed !== 0);
          if (!rows.length) { toast('印刷する請求書がありません', 'err'); return; }
          printInvoices(rows);
        }, 'btn--primary'))),
    note('締日は得意先ごとの設定に従います（既定 23日）。'
      + `${jMonth(ym.value)}分は ${billingPeriod(ym.value, store.company?.closeDay || 23).from} 〜 ${billingPeriod(ym.value, store.company?.closeDay || 23).to} の売上が対象です。`),
    kpis, card(null, host));
}

const dash = () => el('span', { class: 'muted' }, '—');

/* ---------- 請求書の見た目 ---------- */
function invoiceSheet(inv) {
  const c = store.company || {};
  const cust = store.customer(inv.customerCode) || {};
  const due = dueDate(inv.ym, inv.closeDay, cust.payMonth ?? 1, cust.payDay ?? 20);

  const lines = [];
  for (const s of inv.lines) {
    const ls = s.lines?.length ? s.lines : [{ name: s.note || 'お品代', qty: '', unit: '', price: '', amount: s.subtotal }];
    ls.forEach((l, i) => lines.push({
      date: i === 0 ? s.date : '', name: l.name || '', qty: l.qty, unit: l.unit,
      price: l.price, amount: l.amount, note: i === 0 ? s.note : '',
    }));
  }
  for (const r of inv.receiptRows) {
    lines.push({ date: r.date, name: `　ご入金${r.bank ? `（${r.bank}）` : ''}`, amount: -r.total, isPay: true });
  }
  lines.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const row = (l) => el('tr', {},
    el('td', { style: 'width:11%' }, l.date ? shortDate(l.date).replace(/\(.\)/, '') : ''),
    el('td', {}, l.name + (l.note && l.name !== l.note ? `　${l.note}` : '')),
    el('td', { class: 'n', style: 'width:8%' }, l.qty || ''),
    el('td', { style: 'width:7%' }, l.unit || ''),
    el('td', { class: 'n', style: 'width:12%' }, l.price ? yen(l.price) : ''),
    el('td', { class: 'n', style: 'width:14%' }, l.amount != null ? yen(l.amount) : ''));

  const sumRow = (k, v, strong) => el('tr', {}, el('th', {}, k), el('td', { class: 'n' }, strong ? el('b', {}, yen(v)) : yen(v)));

  return el('div', { class: 'sheet' },
    el('h1', { class: 'sheet__title' }, '御請求書'),
    el('div', { class: 'sheet__top' },
      el('div', { class: 'sheet__to' },
        el('div', { class: 'nm' }, `${cust.name || inv.customerName}　${honorific(cust.honorific)}`),
        el('div', { class: 'ad' },
          cust.zip ? `〒${zipFmt(cust.zip)}　` : '', cust.addr || '',
          cust.dept || cust.person ? el('div', {}, `${cust.dept || ''} ${cust.person || ''}`) : null)),
      el('div', { class: 'sheet__from' },
        el('div', {}, `請求日　${jDate(inv.to, { weekday: false })}`),
        el('div', {}, `締切日　${jDate(inv.to, { weekday: false })}`),
        el('div', { style: 'margin-bottom:6px' }, `お支払期日　${jDate(due, { weekday: false })}`),
        el('div', { class: 'nm' }, c.name || ''),
        el('div', {}, c.zip ? `〒${zipFmt(c.zip)}` : ''),
        el('div', {}, `${c.pref || ''}${c.addr || ''}`),
        el('div', {}, `TEL ${c.tel || ''}　FAX ${c.fax || ''}`),
        el('div', {}, c.owner || ''),
        c.taxId ? el('div', { style: 'margin-top:3px' }, `登録番号 ${c.taxId}`) : null)),

    el('div', { class: 'sheet__amt' },
      el('span', {}, '御請求金額'),
      el('b', {}, `¥ ${yen(inv.billed)} －`)),

    el('table', {},
      el('thead', {}, el('tr', {},
        el('th', {}, '日付'), el('th', {}, '品名・摘要'), el('th', {}, '数量'),
        el('th', {}, '単位'), el('th', {}, '単価'), el('th', {}, '金額'))),
      el('tbody', {},
        lines.length ? lines.map(row) : el('tr', {}, el('td', { colspan: 6, style: 'text-align:center;color:#777' }, '当月のお取引はありません'))),
    ),

    el('table', { class: 'sheet__sum', style: 'width:52%' },
      sumRow('前回御請求額', inv.carry),
      sumRow('御入金額', inv.receipt + inv.receiptDiscount),
      sumRow('繰越金額', inv.carry - inv.receipt - inv.receiptDiscount),
      sumRow('当月御買上額', inv.sales),
      sumRow(`消費税（${store.company?.taxRate ?? 10}％）`, inv.tax),
      inv.discount ? sumRow('値引', -inv.discount) : null,
      sumRow('今回御請求額', inv.billed, true)),

    el('div', { class: 'sheet__note' },
      (c.banks || []).length ? `お振込先\n${(c.banks || []).map((b) => `　${b}`).join('\n')}\n` : '',
      c.invoiceNote || '',
      cust.msg ? `\n${cust.msg}` : ''));
}

function printInvoices(list) {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) { toast('印刷用の画面を開けませんでした（ポップアップを許可してください）', 'err'); return; }
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  w.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>御請求書</title>
<link rel="stylesheet" href="${base}css/app.css"></head><body style="background:#fff"><div id="p"></div>
<script>window.onload=()=>setTimeout(()=>window.print(),450)<\/script></body></html>`);
  w.document.close();
  const put = () => {
    const host = w.document.getElementById('p');
    if (!host) return setTimeout(put, 60);
    list.forEach((inv) => host.append(w.document.importNode(invoiceSheet(inv), true)));
  };
  setTimeout(put, 120);
}

/* ==================== 売掛残高一覧 ==================== */
export async function renderAR() { return balanceList('customers', '売掛残高一覧', '得意先', 'sales', 'receipts', 'customerCode'); }
export async function renderAP() {
  const box = await balanceList('suppliers', '買掛残高一覧', '仕入先', 'purchases', 'payments', 'supplierCode');
  box.prepend(note('Access では仕入の入力が2003年、出金が2005年で止まっていました。'
    + 'そのため当時の買掛残高は計算が合わなくなっており、引き継がずに 0円 から始めています。'
    + '当時の伝票そのものは「仕入伝票」「出金伝票」で見られます。', 'warn'));
  return box;
}

async function balanceList(masterColl, title, label, debitColl, creditColl, key) {
  setHint('残っている金額の大きい順に並んでいます。');
  const host = el('div', { class: 'empty' }, '計算しています…');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });
  const box = el('div', {}, kpis, card(title, host));

  (async () => {
    const targets = store.masters[masterColl].filter((c) => Number(c.code) !== 0);
    const [debits, credits] = await Promise.all([
      store.list(debitColl, { from: '1900-01-01', to: today() }),
      store.list(creditColl, { from: '1900-01-01', to: today() }),
    ]);
    // 移行時残高は「起点日の前日」時点のもの。起点日より前の伝票は数え直さない。
    const openFrom = new Map(targets.map((c) => [Number(c.code), openingDateOf(c)]));
    const dm = new Map(); const cm = new Map(); const lastM = new Map();
    for (const d of debits) {
      if (d.void) continue;
      if (debitColl === 'sales' && Number(d.kind) !== 1) continue;
      const k = Number(d[key]);
      if (!lastM.has(k) || d.date > lastM.get(k)) lastM.set(k, d.date);
      if (d.date < (openFrom.get(k) || '1900-01-01')) continue;
      dm.set(k, (dm.get(k) || 0) + num(d.subtotal) + num(d.tax));
    }
    for (const r of credits) {
      if (r.void) continue;
      const k = Number(r[key]);
      if (r.date < (openFrom.get(k) || '1900-01-01')) continue;
      cm.set(k, (cm.get(k) || 0) + num(r.total));
    }

    const rows = targets.map((c) => {
      const opening = num(c.openingBalance);
      const k = Number(c.code);
      const bal = opening + (dm.get(k) || 0) - (cm.get(k) || 0);
      return { ...c, opening, debit: dm.get(k) || 0, credit: cm.get(k) || 0, bal, last: lastM.get(k) || '' };
    }).filter((r) => r.bal !== 0 || r.debit || r.credit);
    rows.sort((a, b) => b.bal - a.bal);

    // 「未回収」はプラス残高だけ。マイナスは前受け（もらいすぎ）なので分けて出す。
    const plus = rows.filter((r) => r.bal > 0);
    const minus = rows.filter((r) => r.bal < 0);
    const isAR = masterColl === 'customers';
    kpis.replaceChildren(...[
      kpi(isAR ? '未回収の合計' : '未払の合計', plus.reduce((a, r) => a + r.bal, 0), `${plus.length}社`, 'shu'),
      minus.length
        ? kpi(isAR ? '前受け（もらいすぎ）' : '払いすぎ', Math.abs(minus.reduce((a, r) => a + r.bal, 0)), `${minus.length}社`, 'midori')
        : null,
      kpi('差引', rows.reduce((a, r) => a + r.bal, 0), 'プラスとマイナスの合計', 'kin'),
      kpi('取引のある先', `${rows.length}`, `全${store.masters[masterColl].length}社中`),
    ].filter(Boolean));

    const cols = [
      { h: '番号', w: '4.5rem', cls: 'num', k: 'code' },
      { h: label, fmt: (r) => r.name },
      { h: '移行時残高', cls: 'num', w: '8rem', fmt: (r) => (r.opening ? yen(r.opening) : dash()) },
      { h: masterColl === 'customers' ? '売上（税込）' : '仕入（税込）', cls: 'num', w: '9rem', fmt: (r) => yen(r.debit), sum: (r) => r.debit },
      { h: masterColl === 'customers' ? '入金' : '支払', cls: 'num', w: '8rem', fmt: (r) => yen(r.credit), sum: (r) => r.credit },
      { h: '残高', cls: 'num', w: '9rem', fmt: (r) => el('b', { style: r.bal > 0 ? 'color:var(--shu)' : (r.bal < 0 ? 'color:var(--midori)' : '') }, yen(r.bal)), sum: (r) => r.bal },
      { h: '最終取引', w: '7rem', fmt: (r) => (r.last ? shortDate(r.last) : dash()) },
    ];
    host.className = '';
    host.replaceChildren(table(cols, rows, {
      onRow: masterColl === 'customers' ? (r) => go(`motocho/${r.code}`) : null,
      empty: '残高のある先はありません',
    }));

    box.append(el('div', { class: 'btnrow btnrow--end', style: 'margin-top:-.6rem' },
      btn('CSVで書き出す', () => {
        download(`${title}_${today()}.csv`, toCSV([
          ['番号', label, '移行時残高', '売上・仕入', '入金・支払', '残高', '最終取引'],
          ...rows.map((r) => [r.code, r.name, r.opening, r.debit, r.credit, r.bal, r.last]),
        ]), 'text/csv');
        toast('CSVを書き出しました');
      }, 'btn--ghost btn--sm')));
  })().catch((e) => { host.replaceChildren(note(String(e.message || e), 'err')); });

  return box;
}

/* ==================== 得意先元帳 ==================== */
export async function renderLedger(parts) {
  setHint('一社ぶんの売上と入金を、日付順に並べます。');
  const picker = codePicker({
    value: parts?.[0] ?? '',
    getRows: () => store.masters.customers.filter((c) => Number(c.code) !== 0)
      .map((c) => ({ code: c.code, name: c.name, kana: c.kana, sub: c.addr })),
    title: '得意先を選ぶ',
  });
  const from = input({ type: 'date', value: store.company?.migrationFrom || `${Number(today().slice(0, 4)) - 1}-01-01` });
  const to = input({ type: 'date', value: today() });
  const host = el('div', { class: 'empty' }, '得意先を選んでください');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });

  const load = async () => {
    const code = picker.getValue();
    if (code == null) { host.className = 'empty'; host.replaceChildren('得意先を選んでください'); kpis.replaceChildren(); return; }
    host.className = 'empty'; host.replaceChildren('読み込んでいます…');
    const c = store.customer(code) || {};
    const [sales, recs] = await Promise.all([
      store.list('sales', { eq: { customerCode: Number(code) }, from: from.value, to: to.value }),
      store.list('receipts', { eq: { customerCode: Number(code) }, from: from.value, to: to.value }),
    ]);

    // 残高が追えるのは移行の起点日から。それより前の伝票は記録として並べるだけにする。
    const openIso = openingDateOf(c);
    const balFrom = from.value > openIso ? from.value : openIso;
    const opening = await arBalance(code, prevDay(balFrom));
    let bal = opening;

    const evts = [
      ...sales.filter((x) => !x.void && Number(x.kind) === 1).map((x) => ({
        date: x.date, no: x.no, kind: '売上', name: (x.lines || []).map((l) => l.name).join('／') || x.note,
        debit: num(x.subtotal) + num(x.tax), credit: 0, id: x.id, path: 'uriage',
      })),
      ...recs.filter((x) => !x.void).map((x) => ({
        date: x.date, no: x.no, kind: '入金', name: [x.bank, x.note].filter(Boolean).join('　'),
        debit: 0, credit: num(x.total), id: x.id, path: 'nyukin',
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === '入金' ? 1 : -1));

    const rows = evts.filter((e) => e.date < balFrom).map((e) => ({ ...e, bal: null, archive: true }));
    rows.push({
      date: balFrom, kind: '繰越',
      name: balFrom === openIso
        ? `Accessから引き継いだ残高（${jDate(openIso, { weekday: false })} 時点）`
        : '前期からの繰越',
      debit: 0, credit: 0, bal: opening, opening: true,
    });
    const live = evts.filter((e) => e.date >= balFrom);
    for (const e of live) { bal += e.debit - e.credit; rows.push({ ...e, bal }); }

    kpis.replaceChildren(
      kpi('起点の残高', opening, jDate(balFrom, { weekday: false })),
      kpi('その後の売上', live.reduce((a, e) => a + e.debit, 0), '', 'kin'),
      kpi('その後の入金', live.reduce((a, e) => a + e.credit, 0), '', 'midori'),
      kpi('現在残高', bal, c.name, 'shu'));

    const cols = [
      { h: '日付', w: '7.5rem', fmt: (r) => (r.opening ? '' : shortDate(r.date)) },
      { h: '伝票', w: '5.5rem', cls: 'num', fmt: (r) => r.no ?? '' },
      { h: '区分', w: '5rem', cls: 'cen', fmt: (r) => el('span', { class: 'tag ' + (r.kind === '入金' ? 'tag--cash' : 'tag--credit') }, r.kind) },
      { h: '摘要', fmt: (r) => r.name || '' },
      { h: '売上（借方）', cls: 'num', w: '9rem', fmt: (r) => (r.debit ? yen(r.debit) : dash()), sum: (r) => (r.archive ? 0 : r.debit) },
      { h: '入金（貸方）', cls: 'num', w: '9rem', fmt: (r) => (r.credit ? yen(r.credit) : dash()), sum: (r) => (r.archive ? 0 : r.credit) },
      { h: '残高', cls: 'num', w: '9rem', fmt: (r) => (r.bal === null ? el('span', { class: 'muted', title: '移行前の記録です' }, '記録のみ') : el('b', {}, yen(r.bal))) },
    ];
    host.className = '';
    host.replaceChildren(...[
      rows.some((r) => r.archive)
        ? note(`${jDate(openIso, { weekday: false })} より前は Access 時代の記録です。伝票は残っていますが、残高の積み上げはこの日から始まります。`)
        : null,
      table(cols, rows, {
        onRow: (r) => (r.id ? go(`${r.path}/${r.id}`) : null),
        empty: 'この期間の取引はありません', foot: true,
      }),
    ].filter(Boolean));
  };

  picker.codeEl.addEventListener('change', load);
  picker.addEventListener('picked', load);
  [from, to].forEach((n) => n.addEventListener('change', load));
  if (parts?.[0]) setTimeout(load, 0);

  const range = (label, f) => btn(label, () => { from.value = f; load(); }, 'btn--ghost btn--sm');
  return el('div', {},
    el('div', { class: 'toolbar' },
      field('得意先', picker), field('開始日', from), field('終了日', to)),
    el('div', { class: 'btnrow', style: 'margin-bottom:1rem' },
      range('移行後だけ', store.company?.migrationFrom || today()),
      range('今年', `${today().slice(0, 4)}-01-01`),
      range('去年から', `${Number(today().slice(0, 4)) - 1}-01-01`),
      range('全部', '2001-01-01')),
    kpis, card(null, host));
}

