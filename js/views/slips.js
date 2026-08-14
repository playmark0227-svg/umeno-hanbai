// 売上伝票・仕入伝票（明細のある伝票）。

import { store } from '../store.js';
import {
  el, yen, num, int, today, thisMonth, jDate, shortDate, billingPeriod,
  calcTax, enterMovesNext, toCSV, download, match,
} from '../util.js';
import {
  card, table, kpi, note, btn, field, input, numInput, select,
  codePicker, toast, confirmBox, alertBox, pickFrom,
} from '../ui.js';
import { go, setHint } from '../app.js';

const SPEC = {
  sales: {
    title: '売上伝票', path: 'uriage', counter: 'sales',
    partyLabel: '得意先', partyColl: 'customers', partyKey: 'customerCode', partyName: 'customerName',
    dateLabel: '売上日', kinds: [{ value: 0, label: '現金売' }, { value: 1, label: '掛売' }],
  },
  purchases: {
    title: '仕入伝票', path: 'shiire', counter: 'purchase',
    partyLabel: '仕入先', partyColl: 'suppliers', partyKey: 'supplierCode', partyName: 'supplierName',
    dateLabel: '仕入日', kinds: null,
  },
};

export async function render(coll, parts) {
  const spec = SPEC[coll];
  if (parts[0] === 'new') return editView(coll, spec, null);
  if (parts[0]) {
    const doc = await store.get(coll, parts[0]);
    if (!doc) { toast('その伝票は見つかりませんでした', 'err'); go(spec.path); return el('div'); }
    return editView(coll, spec, doc);
  }
  return listView(coll, spec);
}

/* ==================== 一覧 ==================== */
async function listView(coll, spec) {
  setHint('行をクリックすると開きます。　<b>新規</b>で新しい伝票を作れます。');

  const st = JSON.parse(sessionStorage.getItem(`umeno.${coll}.filter`) || 'null')
    || (() => { const p = billingPeriod(thisMonth(), store.company?.closeDay || 23); return { from: p.from, to: p.to, q: '', party: '' }; })();

  const from = input({ type: 'date', value: st.from });
  const to = input({ type: 'date', value: st.to });
  const q = input({ type: 'search', placeholder: '相手先・備考・品名で探す', value: st.q });
  const partySel = codePicker({
    value: st.party,
    getRows: () => rowsOf(spec.partyColl),
    title: `${spec.partyLabel}を選ぶ`,
  });

  const host = el('div');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });

  const reload = async () => {
    sessionStorage.setItem(`umeno.${coll}.filter`, JSON.stringify({
      from: from.value, to: to.value, q: q.value, party: partySel.getValue() ?? '',
    }));
    host.replaceChildren(el('div', { class: 'empty' }, '読み込んでいます…'));
    const eq = partySel.getValue() != null ? { [spec.partyKey]: partySel.getValue() } : undefined;
    let rows = await store.list(coll, { from: from.value, to: to.value, eq, order: 'desc' });
    if (q.value.trim()) {
      rows = rows.filter((r) => match(
        `${r[spec.partyName] || ''} ${nameOfParty(spec, r)} ${r.note || ''} ${r.note2 || ''} ${(r.lines || []).map((l) => l.name).join(' ')}`,
        q.value));
    }
    draw(rows);
  };

  const draw = (rows) => {
    const live = rows.filter((r) => !r.void);
    const total = live.reduce((a, r) => a + num(r.subtotal) + num(r.tax), 0);
    const cash = live.filter((r) => Number(r.kind) === 0).reduce((a, r) => a + num(r.subtotal) + num(r.tax), 0);
    kpis.replaceChildren(...[
      kpi('件数', `${live.length}`, rows.length !== live.length ? `取消 ${rows.length - live.length}件` : ''),
      kpi('合計（税込）', total, '', 'kin'),
      coll === 'sales' ? kpi('うち現金売', cash, '', 'midori') : null,
      coll === 'sales' ? kpi('うち掛売', total - cash, '', 'shu') : null,
    ].filter(Boolean));

    const cols = [
      { h: '日付', w: '7.5rem', fmt: (r) => shortDate(r.date) },
      { h: '伝票番号', w: '6rem', cls: 'num', fmt: (r) => r.no ?? '' },
      { h: spec.partyLabel, fmt: (r) => nameOfParty(spec, r) || el('span', { class: 'muted' }, '（未設定）') },
      coll === 'sales' ? {
        h: '区分', w: '5.5rem', cls: 'cen',
        fmt: (r) => el('span', { class: 'tag ' + (Number(r.kind) === 0 ? 'tag--cash' : 'tag--credit') }, Number(r.kind) === 0 ? '現金' : '掛'),
      } : null,
      { h: '内容', fmt: (r) => (r.lines || []).map((l) => l.name).filter(Boolean).join('／') || el('span', { class: 'muted' }, '—') },
      { h: '税抜', cls: 'num', w: '7rem', fmt: (r) => yen(r.subtotal), sum: (r) => (r.void ? 0 : r.subtotal) },
      { h: '消費税', cls: 'num', w: '6rem', fmt: (r) => yen(r.tax), sum: (r) => (r.void ? 0 : r.tax) },
      { h: '税込合計', cls: 'num', w: '7.5rem', fmt: (r) => el('b', {}, yen(num(r.subtotal) + num(r.tax))), sum: (r) => (r.void ? 0 : num(r.subtotal) + num(r.tax)) },
      { h: '', w: '4rem', cls: 'cen', fmt: (r) => (r.void ? el('span', { class: 'tag tag--void' }, '取消') : '') },
    ].filter(Boolean);

    host.replaceChildren(table(cols, rows, {
      onRow: (r) => go(`${spec.path}/${r.id}`),
      empty: 'この期間の伝票はありません',
    }));
  };

  [from, to].forEach((n) => n.addEventListener('change', reload));
  q.addEventListener('input', debounce(reload, 250));
  partySel.codeEl.addEventListener('change', reload);
  partySel.addEventListener('picked', reload);

  const quick = (label, fn) => btn(label, () => { const p = fn(); from.value = p.from; to.value = p.to; reload(); }, 'btn--ghost btn--sm');
  const cd = store.company?.closeDay || 23;

  await reload();

  return el('div', {},
    el('div', { class: 'toolbar' },
      field('開始日', from), field('終了日', to),
      field(spec.partyLabel, partySel),
      field('探す', q, { wide: true }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('＋ 新規', () => go(`${spec.path}/new`), 'btn--primary'))),
    el('div', { class: 'btnrow', style: 'margin-bottom:1rem' },
      quick('今月の締め期間', () => billingPeriod(thisMonth(), cd)),
      quick('先月の締め期間', () => billingPeriod(prevYm(thisMonth()), cd)),
      quick('今日', () => ({ from: today(), to: today() })),
      quick('今年', () => ({ from: `${today().slice(0, 4)}-01-01`, to: `${today().slice(0, 4)}-12-31` })),
      el('div', { style: 'flex:1' }),
      btn('CSVで書き出す', async () => {
        const eq = partySel.getValue() != null ? { [spec.partyKey]: partySel.getValue() } : undefined;
        const rows = await store.list(coll, { from: from.value, to: to.value, eq });
        exportCSV(spec, rows);
      }, 'btn--ghost btn--sm')),
    kpis, card(null, host));
}

/* ==================== 入力 ==================== */
function editView(coll, spec, doc) {
  const isNew = !doc;
  const c = store.company || {};
  const rate = num(c.taxRate) || 10;
  setHint('<b>Enter</b>で次の欄へ／<b>F4</b>で一覧から選ぶ／<b>F1</b>で登録／<b>F12</b>でメニューへ');

  const d = {
    id: doc?.id, no: doc?.no, date: doc?.date || today(),
    kind: doc ? Number(doc.kind) || 0 : 1,
    party: doc ? doc[spec.partyKey] : null,
    note: doc?.note || '', note2: doc?.note2 || '',
    groups: doc?.groups ?? 1,
    lines: (doc?.lines?.length ? doc.lines : [blankLine()]).map((l) => ({ ...l })),
    void: !!doc?.void,
  };

  const date = input({ type: 'date', value: d.date });
  const kindSel = spec.kinds ? select(spec.kinds, { value: String(d.kind) }) : null;
  const party = codePicker({
    value: d.party ?? '',
    getRows: () => rowsOf(spec.partyColl),
    title: `${spec.partyLabel}を選ぶ`,
  });
  const groups = numInput({ value: d.groups, style: 'max-width:6rem' });
  const note1 = input({ value: d.note, placeholder: '例）法事 三回忌／〇〇様宅' });
  const note2 = input({ value: d.note2 });

  const tbody = el('tbody');
  const sumSub = el('td', { class: 'num' }, '0');
  const sumTax = el('td', { class: 'num' }, '0');
  const sumAll = el('div', { class: 'kpi__v' }, '0');

  const recalc = () => {
    let sub = 0;
    [...tbody.children].forEach((tr) => { sub += num(tr.dataset.amount); });
    const tax = calcTax(sub, rate, 1);
    sumSub.textContent = yen(sub);
    sumTax.textContent = yen(tax);
    sumAll.textContent = yen(sub + tax);
    return { sub, tax };
  };

  const addRow = (line = blankLine(), focus = false) => {
    const prod = codePicker({
      value: line.code ?? '',
      getRows: () => store.masters.products.map((p) => ({
        code: p.code, name: p.name, kana: p.kana, unit: p.unit, price: p.price,
        sub: [store.catName(p.cat), num(p.price) ? `${yen(p.price)}円` : ''].filter(Boolean).join('　'),
      })),
      title: '商品を選ぶ',
      onPick: (p) => {
        if (!p) return;
        nameIn.value = p.name;
        unitIn.value = p.unit || '';
        if (num(p.price)) priceIn.value = p.price;
        if (!num(qtyIn.value)) qtyIn.value = 1;
        calcRow();
        // 単価が決まっていない品（お寿司・食事代など）は金額を直接打つ
        setTimeout(() => (num(p.price) ? qtyIn : amtIn).focus(), 0);
      },
    });
    const nameIn = input({ value: line.name || '' });
    const qtyIn = numInput({ value: line.qty || '', style: 'max-width:6rem' });
    const unitIn = input({ value: line.unit || '', style: 'max-width:5rem', list: 'unitList' });
    const priceIn = numInput({ value: line.price || '', style: 'max-width:8rem' });
    const amtIn = numInput({ value: line.amount || '', style: 'max-width:9rem' });

    const tr = el('tr', {},
      el('td', { style: 'width:15rem' }, prod),
      el('td', {}, nameIn),
      el('td', {}, qtyIn),
      el('td', {}, unitIn),
      el('td', {}, priceIn),
      el('td', {}, amtIn),
      el('td', { class: 'cen', style: 'width:3rem' },
        el('button', {
          type: 'button', class: 'btn btn--sm btn--danger', title: 'この行を消す',
          onclick: () => { tr.remove(); if (!tbody.children.length) addRow(); recalc(); },
        }, '×')));

    const calcRow = () => {
      const q = num(qtyIn.value), p = num(priceIn.value);
      if (q && p) amtIn.value = Math.round(q * p);
      tr.dataset.amount = num(amtIn.value);
      recalc();
      if (tr === tbody.lastElementChild && (nameIn.value || num(amtIn.value))) addRow();
    };
    qtyIn.addEventListener('input', calcRow);
    priceIn.addEventListener('input', calcRow);
    amtIn.addEventListener('input', () => { tr.dataset.amount = num(amtIn.value); recalc(); });
    nameIn.addEventListener('input', () => {
      if (tr === tbody.lastElementChild && nameIn.value) addRow();
    });

    tr._read = () => ({
      code: prod.getValue() ?? 0,
      name: nameIn.value.trim(),
      qty: num(qtyIn.value), unit: unitIn.value.trim(),
      price: num(priceIn.value), amount: int(amtIn.value),
      tax: 0,
    });
    tr.dataset.amount = num(line.amount);
    tbody.append(tr);
    if (focus) prod.focus();
    recalc();
  };

  d.lines.forEach((l) => addRow(l));
  if (!tbody.children.length) addRow();

  const linesTable = el('div', { class: 'tablewrap' },
    el('table', { class: 't t--tight' },
      el('thead', {}, el('tr', {},
        el('th', {}, '商品'), el('th', {}, '品名'), el('th', {}, '数量'),
        el('th', {}, '単位'), el('th', {}, '単価'), el('th', {}, '金額'), el('th', {}, ''))),
      tbody,
      el('tfoot', {},
        el('tr', {}, el('td', { colspan: 5, class: 'num' }, '税抜合計'), sumSub, el('td')),
        el('tr', {}, el('td', { colspan: 5, class: 'num' }, `消費税（${rate}％・四捨五入）`), sumTax, el('td')))));

  /* --- 保存 --- */
  const save = async () => {
    const lines = [...tbody.children].map((tr) => tr._read()).filter((l) => l.name || l.amount);
    if (!date.value) { toast('日付を入れてください', 'err'); date.focus(); return; }
    if (!lines.length) { toast('明細を1行は入れてください', 'err'); return; }
    const kind = kindSel ? Number(kindSel.value) : 1;
    const partyCode = party.getValue();
    if (coll === 'sales' && kind === 1 && (partyCode === null || partyCode === 0)) {
      toast('掛売のときは得意先を選んでください', 'err'); party.focus(); return;
    }
    const { sub, tax } = recalc();
    const partyRow = partyCode !== null ? findParty(spec, partyCode) : null;

    const body = {
      id: d.id, no: d.no ?? await store.nextNo(spec.counter),
      date: date.value, ym: date.value.slice(0, 7),
      [spec.partyKey]: partyCode ?? (coll === 'sales' ? 0 : null),
      [spec.partyName]: partyRow?.name || (coll === 'sales' && kind === 0 ? '現金' : ''),
      kind, subtotal: sub, tax, total: sub + tax,
      note: note1.value.trim(), note2: note2.value.trim(),
      groups: int(groups.value) || 1,
      lines, void: d.void, taxRate: rate,
    };
    if (!body.id) body.id = `${coll === 'sales' ? 'S' : 'P'}${String(body.no).padStart(7, '0')}-${Date.now().toString(36)}`;

    try {
      await store.save(coll, body);
      toast(isNew ? `伝票 ${body.no} を登録しました` : '保存しました');
      if (isNew) go(`${spec.path}/new`); else go(spec.path);
    } catch (e) {
      console.error(e);
      alertBox(`保存できませんでした。\n${e.message || e}`, '保存の失敗');
    }
  };

  const del = async () => {
    if (!await confirmBox(`この伝票を取り消します。\n\n伝票番号 ${d.no}\n${jDate(d.date)}\n\nよろしいですか？`,
      { ok: '取り消す', danger: true, title: '伝票の取消' })) return;
    await store.save(coll, { ...doc, void: true });
    toast('取り消しました');
    go(spec.path);
  };

  const head = el('div', { class: 'grid grid--2' },
    field(spec.dateLabel, date, { req: true }),
    kindSel ? field('売区分', kindSel, { hint: '現金売＝その場で受け取り／掛売＝月末に請求' }) : null,
    field(spec.partyLabel, party, { hint: '番号を入れるか「探す」を押す' }),
    coll === 'sales' ? field('組数', groups, { hint: '法事・宴会などの組数' }) : null,
    field('備考', note1, { wide: true }),
    field('備考2', note2));

  const form = el('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
    card(isNew ? `${spec.title}　新規` : `${spec.title}　No.${d.no}`, el('div', {}, head), [
      d.void ? el('span', { class: 'tag tag--void' }, '取消済み') : null,
      btn('一覧へ戻る', () => go(spec.path), 'btn--ghost btn--sm'),
    ]),
    card('明細', linesTable),
    el('div', { class: 'card' }, el('div', { class: 'card__body' },
      el('div', { style: 'display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap' },
        el('div', { class: 'kpi', style: 'flex:1;min-width:220px;border-top-color:var(--shu)' },
          el('div', { class: 'kpi__k' }, '税込合計'), sumAll),
        el('div', { class: 'btnrow', style: 'flex:2;justify-content:flex-end' },
          !isNew && !d.void ? btn('この伝票を取り消す', del, 'btn--danger') : null,
          !isNew ? btn('印刷する', () => printSlip(spec, { ...d, no: d.no }, tbody, recalc()), 'btn--ghost') : null,
          el('button', { type: 'submit', class: 'btn btn--primary', 'data-key': 'save' },
            isNew ? '登録する' : '保存する', el('kbd', {}, 'F1')))))),
    el('datalist', { id: 'unitList' }, (store.codeLists.units || []).map((u) => el('option', { value: u }))));

  enterMovesNext(form);
  setTimeout(() => (isNew ? date : party).focus(), 60);
  recalc();
  return form;
}

/* ==================== 伝票の印刷 ==================== */
function printSlip(spec, d, tbody, sums) {
  const c = store.company || {};
  const party = d.party != null ? findParty(spec, d.party) : null;
  const rows = [...tbody.children].map((tr) => tr._read()).filter((l) => l.name || l.amount);

  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) { toast('印刷用の画面を開けませんでした（ポップアップを許可してください）', 'err'); return; }
  w.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>${spec.title}</title>
<link rel="stylesheet" href="${location.origin}${location.pathname.replace(/[^/]*$/, '')}css/app.css"></head><body style="background:#fff">
<div class="sheet">
  <h1 class="sheet__title">納品書</h1>
  <div class="sheet__top">
    <div class="sheet__to">
      <div class="nm">${esc(party?.name || d.customerName || '現金')} ${party ? (Number(party.honorific) === 1 ? '様' : '御中') : '様'}</div>
      <div class="ad">${esc(d.note || '')}</div>
    </div>
    <div class="sheet__from">
      <div>No. ${d.no ?? ''}　${jDate(d.date)}</div>
      <div class="nm">${esc(c.name || '')}</div>
      <div>${esc(c.addr || '')}</div>
      <div>TEL ${esc(c.tel || '')}</div>
    </div>
  </div>
  <table><thead><tr><th style="width:45%">品名</th><th style="width:12%">数量</th><th style="width:10%">単位</th><th style="width:16%">単価</th><th style="width:17%">金額</th></tr></thead>
  <tbody>${rows.map((l) => `<tr><td>${esc(l.name)}</td><td class="n">${l.qty || ''}</td><td>${esc(l.unit)}</td><td class="n">${l.price ? yen(l.price) : ''}</td><td class="n">${yen(l.amount)}</td></tr>`).join('')}
  ${Array.from({ length: Math.max(0, 8 - rows.length) }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
  <table class="sheet__sum" style="width:46%">
    <tr><th>税抜合計</th><td class="n">${yen(sums.sub)}</td></tr>
    <tr><th>消費税</th><td class="n">${yen(sums.tax)}</td></tr>
    <tr><th>合計</th><td class="n"><b>${yen(sums.sub + sums.tax)}</b></td></tr>
  </table>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);
  w.document.close();
}

/* ==================== 小物 ==================== */
const blankLine = () => ({ code: '', name: '', qty: '', unit: '', price: '', amount: '' });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const prevYm = (ym) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

function rowsOf(coll) {
  return store.masters[coll].map((r) => ({
    code: r.code, name: r.name, kana: r.kana,
    sub: [r.addr, r.tel].filter(Boolean).join('　'),
    honorific: r.honorific,
  }));
}
function findParty(spec, code) {
  return store.masters[spec.partyColl].find((r) => Number(r.code) === Number(code)) || null;
}
function nameOfParty(spec, r) {
  return r[spec.partyName] || findParty(spec, r[spec.partyKey])?.name || '';
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function exportCSV(spec, rows) {
  const out = [[spec.dateLabel, '伝票番号', spec.partyLabel, '区分', '品名', '数量', '単位', '単価', '金額', '税抜合計', '消費税', '税込合計', '備考']];
  for (const r of rows) {
    const base = [r.date, r.no, nameOfParty(spec, r), Number(r.kind) === 0 ? '現金' : '掛'];
    const ls = r.lines?.length ? r.lines : [{}];
    ls.forEach((l, i) => out.push([
      ...base, l.name || '', l.qty || '', l.unit || '', l.price || '', l.amount || '',
      i === 0 ? r.subtotal : '', i === 0 ? r.tax : '', i === 0 ? num(r.subtotal) + num(r.tax) : '',
      i === 0 ? (r.void ? '取消 ' : '') + (r.note || '') : '',
    ]));
  }
  download(`${spec.title}_${today()}.csv`, toCSV(out), 'text/csv');
  toast('CSVを書き出しました');
}
