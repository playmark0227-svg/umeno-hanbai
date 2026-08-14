// 台帳（得意先・商品・仕入先）と自社の設定。

import { store, arBalance } from '../store.js';
import { el, yen, num, int, match, today, toCSV, download, enterMovesNext } from '../util.js';
import {
  card, table, note, btn, field, input, numInput, select,
  toast, confirmBox, modal, alertBox,
} from '../ui.js';
import { go, setHint } from '../app.js';

const HONORIFIC = [{ value: 1, label: '様' }, { value: 2, label: '御中' }];
const CLOSEDAYS = [...Array(31)].map((_, i) => ({ value: i + 1, label: i + 1 === 31 ? '末日' : `${i + 1}日` }));

const SPEC = {
  customers: {
    title: '得意先', path: 'tokui', codeLabel: '得意先番号',
    cols: [
      { h: '番号', w: '5.5rem', cls: 'num', k: 'code' },
      { h: '得意先名', fmt: (r) => r.name },
      { h: 'かな', fmt: (r) => el('span', { class: 'muted' }, r.kana || '') },
      { h: '住所', fmt: (r) => el('span', { class: 'muted' }, r.addr || '') },
      { h: '電話', w: '9rem', fmt: (r) => r.tel || '' },
      { h: '締日', w: '5rem', cls: 'cen', fmt: (r) => (Number(r.closeDay) >= 31 ? '末' : `${r.closeDay || 23}日`) },
      { h: '移行時残高', w: '8rem', cls: 'num', fmt: (r) => (num(r.openingBalance) ? yen(r.openingBalance) : el('span', { class: 'muted' }, '—')) },
    ],
    fields: (v) => [
      ['code', '得意先番号', numInput({ value: v.code ?? '' }), { req: true, hint: '売上伝票で打つ番号' }],
      ['name', '得意先名', input({ value: v.name || '' }), { req: true }],
      ['kana', 'かな', input({ value: v.kana || '', placeholder: 'ｱｵｲｼｮｳｼﾞ' }), { hint: '検索で使います' }],
      ['honorific', '敬称', select(HONORIFIC, { value: v.honorific ?? 2 })],
      ['zip', '郵便番号', input({ value: v.zip || '' })],
      ['addr', '住所', input({ value: v.addr || '' }), { wide: true }],
      ['tel', '電話番号', input({ value: v.tel || '', type: 'tel' })],
      ['fax', 'FAX番号', input({ value: v.fax || '', type: 'tel' })],
      ['dept', '部署', input({ value: v.dept || '' })],
      ['person', '担当者', input({ value: v.person || '' })],
      ['closeDay', '締日', select(CLOSEDAYS, { value: v.closeDay ?? 23 }), { hint: 'この日で1か月を締めて請求します' }],
      ['payMonth', '入金予定（何か月後）', numInput({ value: v.payMonth ?? 1 })],
      ['payDay', '入金予定日', numInput({ value: v.payDay ?? 20 })],
      ['bank', '振込先の銀行', input({ value: v.bank || '' })],
      ['openingBalance', '移行時の売掛残高', numInput({ value: v.openingBalance ?? 0 }), { hint: 'Accessから引き継いだ残高。通常は触りません' }],
      ['msg', '請求書に載せる一言', input({ value: v.msg || '' }), { wide: true }],
    ],
  },
  products: {
    title: '商品', path: 'shohin', codeLabel: '商品番号',
    cols: [
      { h: '番号', w: '5.5rem', cls: 'num', k: 'code' },
      { h: '部門', w: '10rem', fmt: (r) => store.catName(r.cat) },
      { h: '品名', fmt: (r) => r.name },
      { h: 'かな', fmt: (r) => el('span', { class: 'muted' }, r.kana || '') },
      { h: '単位', w: '5rem', cls: 'cen', fmt: (r) => r.unit || '' },
      { h: '単価', w: '7rem', cls: 'num', fmt: (r) => (num(r.price) ? yen(r.price) : el('span', { class: 'muted' }, 'その都度')) },
    ],
    fields: (v) => [
      ['code', '商品番号', numInput({ value: v.code ?? '' }), { req: true }],
      ['cat', '部門', select(store.masters.productCats.map((c) => ({ value: c.code, label: `${c.code} ${c.name}` })), { value: v.cat ?? 1 })],
      ['name', '品名', input({ value: v.name || '' }), { req: true, wide: true }],
      ['kana', 'かな', input({ value: v.kana || '' })],
      ['unit', '単位', input({ value: v.unit || '', list: 'unitList2', placeholder: '人前・本・合など' })],
      ['price', '単価', numInput({ value: v.price ?? 0 }), { hint: '0にすると伝票で毎回入力します' }],
      ['cost', '原価', numInput({ value: v.cost ?? 0 })],
    ],
  },
  suppliers: {
    title: '仕入先', path: 'shiiresaki', codeLabel: '仕入先番号',
    cols: [
      { h: '番号', w: '5.5rem', cls: 'num', k: 'code' },
      { h: '仕入先名', fmt: (r) => r.name },
      { h: '住所', fmt: (r) => el('span', { class: 'muted' }, r.addr || '') },
      { h: '電話', w: '9rem', fmt: (r) => r.tel || '' },
      { h: '締日', w: '5rem', cls: 'cen', fmt: (r) => (Number(r.closeDay) >= 31 ? '末' : `${r.closeDay || 31}日`) },
    ],
    fields: (v) => [
      ['code', '仕入先番号', numInput({ value: v.code ?? '' }), { req: true }],
      ['name', '仕入先名', input({ value: v.name || '' }), { req: true }],
      ['kana', 'かな', input({ value: v.kana || '' })],
      ['zip', '郵便番号', input({ value: v.zip || '' })],
      ['addr', '住所', input({ value: v.addr || '' }), { wide: true }],
      ['tel', '電話番号', input({ value: v.tel || '', type: 'tel' })],
      ['fax', 'FAX番号', input({ value: v.fax || '', type: 'tel' })],
      ['closeDay', '締日', select(CLOSEDAYS, { value: v.closeDay ?? 31 })],
      ['bank', '振込先の銀行', input({ value: v.bank || '' })],
      ['branch', '支店', input({ value: v.branch || '' })],
      ['account', '口座番号', input({ value: v.account || '' })],
      ['openingBalance', '移行時の買掛残高', numInput({ value: v.openingBalance ?? 0 })],
    ],
  },
};

export async function render(coll, parts) {
  const spec = SPEC[coll];
  if (parts[0]) return editView(coll, spec, parts[0] === 'new' ? null : store.masters[coll].find((r) => r.id === parts[0]));
  return listView(coll, spec);
}

/* ==================== 一覧 ==================== */
function listView(coll, spec) {
  setHint('行をクリックすると内容を直せます。');
  const q = input({ type: 'search', placeholder: `${spec.title}を探す（番号・名前・かな）` });
  const host = el('div');

  const draw = () => {
    let rows = store.masters[coll];
    if (q.value.trim()) rows = rows.filter((r) => match(`${r.code} ${r.name} ${r.kana || ''} ${r.addr || ''}`, q.value));
    host.replaceChildren(table(spec.cols, rows, {
      onRow: (r) => go(`${spec.path}/${r.id}`),
      empty: q.value ? '見つかりません' : 'まだ登録がありません',
      foot: false,
    }));
  };
  q.addEventListener('input', draw);
  draw();

  return el('div', {},
    el('div', { class: 'toolbar' },
      field('探す', q, { wide: true }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('＋ 新規', () => go(`${spec.path}/new`), 'btn--primary')),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('CSVで書き出す', () => {
          const keys = Object.keys(store.masters[coll][0] || { code: '', name: '' })
            .filter((k) => !['id', 'createdAt', 'updatedAt', 'updatedBy', 'src'].includes(k));
          download(`${spec.title}_${today()}.csv`,
            toCSV([keys, ...store.masters[coll].map((r) => keys.map((k) => r[k] ?? ''))]), 'text/csv');
          toast('CSVを書き出しました');
        }, 'btn--ghost'))),
    card(`${spec.title}　${store.masters[coll].length}件`, host));
}

/* ==================== 編集 ==================== */
function editView(coll, spec, doc) {
  const isNew = !doc;
  const v = doc || {};
  setHint('<b>Enter</b>で次の欄へ／<b>F1</b>で登録／<b>F12</b>でメニューへ');

  const defs = spec.fields(v);
  const nodes = Object.fromEntries(defs.map(([k, , node]) => [k, node]));
  const info = el('div');

  const save = async () => {
    const body = { ...v };
    for (const [k, , nodeEl] of defs) {
      const raw = nodeEl.value;
      body[k] = ['code', 'cat', 'price', 'cost', 'closeDay', 'payMonth', 'payDay', 'honorific', 'openingBalance'].includes(k)
        ? int(raw) : String(raw ?? '').trim();
    }
    if (!body.name) { toast('名前を入れてください', 'err'); nodes.name.focus(); return; }
    if (body.code === 0 && coll !== 'customers') { toast('番号を入れてください', 'err'); nodes.code.focus(); return; }

    const clash = store.masters[coll].find((r) => Number(r.code) === Number(body.code) && r.id !== v.id);
    if (clash) { toast(`番号 ${body.code} は「${clash.name}」で使われています`, 'err'); nodes.code.focus(); return; }

    body.id = v.id || String(body.code);
    body.active = true;
    await store.save(coll, body);
    toast(isNew ? '登録しました' : '保存しました');
    go(spec.path);
  };

  const del = async () => {
    if (!await confirmBox(`「${v.name}」を削除します。\n\n過去の伝票は残りますが、名前が出なくなることがあります。\nよろしいですか？`,
      { ok: '削除する', danger: true, title: `${spec.title}の削除` })) return;
    await store.remove(coll, v.id);
    toast('削除しました');
    go(spec.path);
  };

  if (coll === 'customers' && !isNew) {
    arBalance(v.code).then((bal) => {
      info.replaceChildren(el('div', { class: 'note ' + (bal > 0 ? 'note--warn' : 'note--ok') },
        el('b', {}, '現在の売掛残高　'),
        el('span', { style: `font-size:1.3rem;font-weight:700;color:${bal > 0 ? 'var(--shu)' : 'var(--midori)'}` }, `${yen(bal)} 円`),
        btn('元帳を見る', () => go(`motocho/${v.code}`), 'btn--ghost btn--sm', { style: 'margin-left:1rem' })));
    }).catch(() => {});
  }

  const form = el('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
    card(isNew ? `${spec.title}　新規登録` : `${spec.title}　${v.name}`,
      el('div', {}, info,
        el('div', { class: 'grid grid--2' },
          defs.map(([, label, nodeEl, opt]) => field(label, nodeEl, opt)))),
      [btn('一覧へ戻る', () => go(spec.path), 'btn--ghost btn--sm')]),
    el('div', { class: 'btnrow btnrow--end' },
      !isNew ? btn('削除する', del, 'btn--danger') : null,
      el('button', { type: 'submit', class: 'btn btn--primary', 'data-key': 'save' },
        isNew ? '登録する' : '保存する', el('kbd', {}, 'F1'))),
    el('datalist', { id: 'unitList2' }, (store.codeLists.units || []).map((u) => el('option', { value: u }))));

  enterMovesNext(form);
  setTimeout(() => (isNew ? nodes.code : nodes.name)?.focus(), 60);
  return form;
}

/* ==================== 自社の設定 ==================== */
export async function renderCompany() {
  setHint('請求書に印刷される内容です。');
  const c = store.company || {};
  const f = {
    name: input({ value: c.name || '' }),
    owner: input({ value: c.owner || '' }),
    zip: input({ value: c.zip || '' }),
    addr: input({ value: c.addr || '' }),
    tel: input({ value: c.tel || '', type: 'tel' }),
    fax: input({ value: c.fax || '', type: 'tel' }),
    taxId: input({ value: c.taxId || '', placeholder: 'T0000000000000' }),
    taxRate: numInput({ value: c.taxRate ?? 10 }),
    closeDay: select(CLOSEDAYS, { value: c.closeDay ?? 23 }),
    closingMonth: numInput({ value: c.closingMonth ?? 3 }),
    banks: el('textarea', { class: 'in', rows: 4, value: (c.banks || []).join('\n') }),
    invoiceNote: el('textarea', { class: 'in', rows: 3, value: c.invoiceNote || '' }),
  };
  f.banks.value = (c.banks || []).join('\n');
  f.invoiceNote.value = c.invoiceNote || '';

  const save = async () => {
    await store.saveCompany({
      name: f.name.value.trim(), owner: f.owner.value.trim(),
      zip: f.zip.value.trim(), addr: f.addr.value.trim(),
      tel: f.tel.value.trim(), fax: f.fax.value.trim(),
      taxId: f.taxId.value.trim(),
      taxRate: num(f.taxRate.value) || 10,
      closeDay: int(f.closeDay.value) || 23,
      closingMonth: int(f.closingMonth.value) || 3,
      banks: f.banks.value.split('\n').map((s) => s.trim()).filter(Boolean),
      invoiceNote: f.invoiceNote.value.trim(),
    });
    toast('保存しました');
  };

  const form = el('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
    card('自社の情報', el('div', { class: 'grid grid--2' },
      field('屋号', f.name, { req: true }),
      field('代表者', f.owner),
      field('郵便番号', f.zip),
      field('住所', f.addr, { wide: true }),
      field('電話番号', f.tel),
      field('FAX番号', f.fax))),
    card('請求と税', el('div', { class: 'grid grid--2' },
      field('インボイス登録番号', f.taxId, { hint: '請求書に印刷されます' }),
      field('消費税率（％）', f.taxRate, { hint: '伝票ごとに掛けて四捨五入します' }),
      field('請求の締日', f.closeDay, { hint: '得意先ごとに別の締日も設定できます' }),
      field('決算月', f.closingMonth),
      field('振込先（1行に1つ）', f.banks, { wide: true }),
      field('請求書の下に入れる文', f.invoiceNote, { wide: true }))),
    el('div', { class: 'btnrow btnrow--end' },
      el('button', { type: 'submit', class: 'btn btn--primary', 'data-key': 'save' }, '保存する', el('kbd', {}, 'F1'))));

  enterMovesNext(form);
  return form;
}
