// 入金伝票・出金伝票（明細のない、お金の受け払い）。

import { store, arBalance } from '../store.js';
import {
  el, yen, num, int, today, thisMonth, jDate, shortDate, billingPeriod,
  enterMovesNext, toCSV, download, match,
} from '../util.js';
import {
  card, table, kpi, note, btn, field, input, numInput,
  codePicker, toast, confirmBox, alertBox,
} from '../ui.js';
import { go, setHint } from '../app.js';

const SPEC = {
  receipts: {
    title: '入金伝票', path: 'nyukin', counter: 'receipt', prefix: 'R',
    partyLabel: '得意先', partyColl: 'customers', partyKey: 'customerCode',
    verb: '入金', notes: 'receiptNotes', showBalance: true,
  },
  payments: {
    title: '出金伝票', path: 'shukkin', counter: 'payment', prefix: 'O',
    partyLabel: '仕入先', partyColl: 'suppliers', partyKey: 'supplierCode',
    verb: '支払', notes: 'cashNotes', showBalance: false,
  },
};

const WAYS = [
  { k: 'cash', label: '現金' },
  { k: 'transfer', label: '振込' },
  { k: 'bill', label: '手形' },
  { k: 'offset', label: '相殺' },
  { k: 'discount', label: '値引' },
];

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
  const cd = store.company?.closeDay || 23;
  const st = JSON.parse(sessionStorage.getItem(`umeno.${coll}.filter`) || 'null')
    || { ...billingPeriod(thisMonth(), cd), q: '', party: '' };

  const from = input({ type: 'date', value: st.from });
  const to = input({ type: 'date', value: st.to });
  const q = input({ type: 'search', placeholder: '相手先・備考で探す', value: st.q });
  const party = codePicker({
    value: st.party, getRows: () => rowsOf(spec.partyColl), title: `${spec.partyLabel}を選ぶ`,
  });

  const host = el('div');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });

  const reload = async () => {
    sessionStorage.setItem(`umeno.${coll}.filter`, JSON.stringify({
      from: from.value, to: to.value, q: q.value, party: party.getValue() ?? '',
    }));
    host.replaceChildren(el('div', { class: 'empty' }, '読み込んでいます…'));
    const eq = party.getValue() != null ? { [spec.partyKey]: party.getValue() } : undefined;
    let rows = await store.list(coll, { from: from.value, to: to.value, eq, order: 'desc' });
    if (q.value.trim()) rows = rows.filter((r) => match(`${partyName(spec, r)} ${r.note || ''} ${r.bank || ''}`, q.value));
    draw(rows);
  };

  const draw = (rows) => {
    const live = rows.filter((r) => !r.void);
    kpis.replaceChildren(
      kpi('件数', `${live.length}`),
      kpi(`${spec.verb}合計`, live.reduce((a, r) => a + num(r.total), 0), '', 'midori'),
      ...WAYS.slice(0, 2).map((w) => kpi(`うち${w.label}`, live.reduce((a, r) => a + num(r[w.k]), 0))));

    const cols = [
      { h: '日付', w: '7.5rem', fmt: (r) => shortDate(r.date) },
      { h: '伝票番号', w: '6rem', cls: 'num', fmt: (r) => r.no ?? '' },
      { h: spec.partyLabel, fmt: (r) => partyName(spec, r) || el('span', { class: 'muted' }, '（未設定）') },
      ...WAYS.map((w) => ({ h: w.label, cls: 'num', w: '6.5rem', fmt: (r) => (num(r[w.k]) ? yen(r[w.k]) : el('span', { class: 'muted' }, '—')), sum: (r) => (r.void ? 0 : r[w.k]) })),
      { h: '合計', cls: 'num', w: '7.5rem', fmt: (r) => el('b', {}, yen(r.total)), sum: (r) => (r.void ? 0 : r.total) },
      { h: '備考', fmt: (r) => r.note || '' },
      { h: '', w: '4rem', cls: 'cen', fmt: (r) => (r.void ? el('span', { class: 'tag tag--void' }, '取消') : '') },
    ];
    host.replaceChildren(table(cols, rows, { onRow: (r) => go(`${spec.path}/${r.id}`), empty: 'この期間の伝票はありません' }));
  };

  [from, to].forEach((n) => n.addEventListener('change', reload));
  q.addEventListener('input', debounce(reload, 250));
  party.codeEl.addEventListener('change', reload);
  party.addEventListener('picked', reload);
  await reload();

  const quick = (label, fn) => btn(label, () => { const p = fn(); from.value = p.from; to.value = p.to; reload(); }, 'btn--ghost btn--sm');

  return el('div', {},
    el('div', { class: 'toolbar' },
      field('開始日', from), field('終了日', to),
      field(spec.partyLabel, party),
      field('探す', q, { wide: true }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('＋ 新規', () => go(`${spec.path}/new`), 'btn--primary'))),
    el('div', { class: 'btnrow', style: 'margin-bottom:1rem' },
      quick('今月の締め期間', () => billingPeriod(thisMonth(), cd)),
      quick('今年', () => ({ from: `${today().slice(0, 4)}-01-01`, to: `${today().slice(0, 4)}-12-31` })),
      el('div', { style: 'flex:1' }),
      btn('CSVで書き出す', async () => {
        const eq = party.getValue() != null ? { [spec.partyKey]: party.getValue() } : undefined;
        const rows = await store.list(coll, { from: from.value, to: to.value, eq });
        const out = [['日付', '伝票番号', spec.partyLabel, ...WAYS.map((w) => w.label), '合計', '振込先', '手数料', '備考']];
        rows.forEach((r) => out.push([r.date, r.no, partyName(spec, r), ...WAYS.map((w) => num(r[w.k])), num(r.total), r.bank || '', num(r.fee), (r.void ? '取消 ' : '') + (r.note || '')]));
        download(`${spec.title}_${today()}.csv`, toCSV(out), 'text/csv');
        toast('CSVを書き出しました');
      }, 'btn--ghost btn--sm')),
    kpis, card(null, host));
}

/* ==================== 入力 ==================== */
function editView(coll, spec, doc) {
  const isNew = !doc;
  setHint('<b>Enter</b>で次の欄へ／<b>F4</b>で一覧から選ぶ／<b>F1</b>で登録／<b>F12</b>でメニューへ');

  const date = input({ type: 'date', value: doc?.date || today() });
  const balanceBox = el('div', { class: 'note', style: 'margin:0' }, '得意先を選ぶと残高が出ます');

  const party = codePicker({
    value: doc ? doc[spec.partyKey] ?? '' : '',
    getRows: () => rowsOf(spec.partyColl),
    title: `${spec.partyLabel}を選ぶ`,
    onPick: (row) => showBalance(row?.code),
  });

  const ways = {};
  WAYS.forEach((w) => { ways[w.k] = numInput({ value: doc?.[w.k] || '' }); });
  const bank = input({ value: doc?.bank || '', list: 'bankList' });
  const fee = numInput({ value: doc?.fee || '' });
  const note1 = input({ value: doc?.note || '', list: 'noteList' });

  const totalOut = el('div', { class: 'kpi__v' }, yen(doc?.total || 0));
  const recalc = () => {
    const t = WAYS.reduce((a, w) => a + num(ways[w.k].value), 0);
    totalOut.textContent = yen(t);
    return t;
  };
  WAYS.forEach((w) => ways[w.k].addEventListener('input', recalc));

  async function showBalance(code) {
    if (!spec.showBalance || code == null) { balanceBox.textContent = ''; balanceBox.hidden = true; return; }
    balanceBox.hidden = false;
    balanceBox.textContent = '残高を調べています…';
    try {
      const bal = await arBalance(code);
      balanceBox.replaceChildren(
        el('b', {}, '現在の売掛残高　'),
        el('span', { style: `font-size:1.4rem;font-weight:700;color:${bal > 0 ? 'var(--shu)' : 'var(--midori)'}` }, `${yen(bal)} 円`),
        el('span', { style: 'margin-left:1rem;color:var(--sumi-3);font-size:.85rem' },
          bal > 0 ? 'この金額がまだ回収できていません' : '未回収はありません'));
      balanceBox.className = 'note ' + (bal > 0 ? 'note--warn' : 'note--ok');
      if (bal > 0 && !doc && !WAYS.some((w) => num(ways[w.k].value))) {
        ways.transfer.placeholder = String(Math.round(bal));
        ways.transfer.title = `全額入金なら ${yen(bal)}`;
      }
    } catch { balanceBox.textContent = '残高を出せませんでした'; }
  }
  if (doc) showBalance(doc[spec.partyKey]);
  else balanceBox.hidden = !spec.showBalance;

  const save = async () => {
    const code = party.getValue();
    if (code === null) { toast(`${spec.partyLabel}を選んでください`, 'err'); party.focus(); return; }
    const total = recalc();
    if (!total) { toast('金額を入れてください', 'err'); ways.cash.focus(); return; }
    const row = store.masters[spec.partyColl].find((r) => Number(r.code) === Number(code));

    const body = {
      id: doc?.id, no: doc?.no ?? await store.nextNo(spec.counter),
      date: date.value, ym: date.value.slice(0, 7),
      [spec.partyKey]: code,
      [coll === 'receipts' ? 'customerName' : 'supplierName']: row?.name || '',
      ...Object.fromEntries(WAYS.map((w) => [w.k, int(ways[w.k].value)])),
      total, bank: bank.value.trim(), fee: int(fee.value),
      note: note1.value.trim(), void: !!doc?.void,
    };
    if (!body.id) body.id = `${spec.prefix}${String(body.no).padStart(7, '0')}-${Date.now().toString(36)}`;
    try {
      await store.save(coll, body);
      toast(isNew ? `伝票 ${body.no} を登録しました` : '保存しました');
      if (isNew) go(`${spec.path}/new`); else go(spec.path);
    } catch (e) {
      alertBox(`保存できませんでした。\n${e.message || e}`, '保存の失敗');
    }
  };

  const del = async () => {
    if (!await confirmBox(`この伝票を取り消します。\n\n伝票番号 ${doc.no}\n${jDate(doc.date)}　${yen(doc.total)}円\n\nよろしいですか？`,
      { ok: '取り消す', danger: true, title: '伝票の取消' })) return;
    await store.save(coll, { ...doc, void: true });
    toast('取り消しました');
    go(spec.path);
  };

  const form = el('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
    card(isNew ? `${spec.title}　新規` : `${spec.title}　No.${doc.no}`,
      el('div', {},
        el('div', { class: 'grid grid--2', style: 'margin-bottom:1rem' },
          field(`${spec.verb}日`, date, { req: true }),
          field(spec.partyLabel, party, { req: true, hint: '番号を入れるか「探す」を押す' })),
        spec.showBalance ? balanceBox : null),
      [doc?.void ? el('span', { class: 'tag tag--void' }, '取消済み') : null,
        btn('一覧へ戻る', () => go(spec.path), 'btn--ghost btn--sm')]),

    card(`${spec.verb}の内訳`, el('div', {},
      el('div', { class: 'grid' }, WAYS.map((w) => field(w.label, ways[w.k]))),
      el('div', { class: 'grid grid--2', style: 'margin-top:1rem' },
        field('振込先の銀行', bank),
        field('振込手数料', fee),
        field('備考', note1, { wide: true })))),

    el('div', { class: 'card' }, el('div', { class: 'card__body' },
      el('div', { style: 'display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap' },
        el('div', { class: 'kpi', style: 'flex:1;min-width:220px;border-top-color:var(--midori)' },
          el('div', { class: 'kpi__k' }, `${spec.verb}合計`), totalOut),
        el('div', { class: 'btnrow', style: 'flex:2;justify-content:flex-end' },
          !isNew && !doc.void ? btn('この伝票を取り消す', del, 'btn--danger') : null,
          el('button', { type: 'submit', class: 'btn btn--primary', 'data-key': 'save' },
            isNew ? '登録する' : '保存する', el('kbd', {}, 'F1')))))),

    el('datalist', { id: 'noteList' }, (store.codeLists[spec.notes] || []).map((n) => el('option', { value: n }))),
    el('datalist', { id: 'bankList' }, [...new Set(store.masters.customers.map((c) => c.bank).filter(Boolean))].map((b) => el('option', { value: b }))));

  enterMovesNext(form);
  setTimeout(() => (isNew ? party : date).focus(), 60);
  recalc();
  return form;
}

/* ==================== 小物 ==================== */
function rowsOf(coll) {
  return store.masters[coll].map((r) => ({
    code: r.code, name: r.name, kana: r.kana, sub: [r.addr, r.tel].filter(Boolean).join('　'),
  }));
}
function partyName(spec, r) {
  return r.customerName || r.supplierName
    || store.masters[spec.partyColl].find((x) => Number(x.code) === Number(r[spec.partyKey]))?.name || '';
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
