// バックアップ・復元と、Access からの引っ越し。

import { store, COLLECTIONS } from '../store.js';
import { el, yen, num, today, jDate, download, toCSV } from '../util.js';
import { card, table, kpi, note, btn, field, input, toast, confirmBox, alertBox, busy, modal } from '../ui.js';
import { setHint, go } from '../app.js';
import { buildDemoData } from '../demo.js';

const LAST_KEY = 'umeno.lastBackup';
const META_FILES = { company: 'company', codeLists: 'codeLists' };

/* ==================== バックアップ ==================== */
export async function render() {
  setHint('控えのファイルは、Googleドライブや USBメモリなど、パソコンとは別の場所にも置いてください。');

  const last = localStorage.getItem(LAST_KEY);
  const days = last ? Math.floor((Date.now() - Number(last)) / 86400000) : null;

  const counts = el('div', { class: 'kpis', style: 'margin-bottom:1rem' },
    el('div', { class: 'empty' }, '件数を数えています…'));

  (async () => {
    const rows = [];
    for (const c of COLLECTIONS) {
      const n = (await store.all(c).catch(() => [])).length;
      rows.push({ name: LABEL[c] || c, n });
    }
    counts.replaceChildren(table(
      [{ h: '種類', fmt: (r) => r.name }, { h: '件数', cls: 'num', w: '8rem', fmt: (r) => r.n.toLocaleString() }],
      rows, { foot: false }));
    counts.className = '';
  })();

  const doBackup = async () => {
    const bar = busy('控えを作っています');
    const out = { app: '梅乃寿司 販売管理', version: 1, exportedAt: new Date().toISOString(), data: {} };
    try {
      out.data.company = await store.getMeta('company');
      out.data.codeLists = await store.getMeta('codeLists');
      out.data.counters = await store.getMeta('counters');
      for (let i = 0; i < COLLECTIONS.length; i++) {
        const c = COLLECTIONS[i];
        bar.set(i, COLLECTIONS.length, `読み出しています　${LABEL[c] || c}`);
        out.data[c] = await store.all(c);
      }
    } finally { bar.done(); }
    download(`梅乃寿司_控え_${today()}.json`, JSON.stringify(out));
    localStorage.setItem(LAST_KEY, String(Date.now()));
    toast('控えを書き出しました');
    setTimeout(() => go('backup'), 300);
  };

  const doCSV = async () => {
    const bar = busy('CSVを作っています');
    try {
      for (const c of ['sales', 'receipts', 'customers', 'products']) {
        bar.set(0, 1, `${LABEL[c]} を書き出しています`);
        const rows = await store.all(c).catch(() => []);
        if (!rows.length) continue;
        const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => k !== 'lines');
        const body = rows.map((r) => keys.map((k) => (typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k] ?? '')));
        download(`梅乃寿司_${LABEL[c]}_${today()}.csv`, toCSV([keys, ...body]), 'text/csv');
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally { bar.done(); }
    toast('CSVを書き出しました');
  };

  const file = el('input', { type: 'file', accept: '.json', style: 'display:none' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return;
    let json;
    try { json = JSON.parse(await f.text()); } catch { alertBox('このファイルは読み取れませんでした。', 'エラー'); return; }
    if (!json?.data) { alertBox('このソフトの控えファイルではないようです。', 'エラー'); return; }

    const summary = COLLECTIONS.map((c) => `　${LABEL[c] || c}　${(json.data[c] || []).length.toLocaleString()}件`).join('\n');
    if (!await confirmBox(
      `${f.name}\n作成日時：${json.exportedAt ? jDate(json.exportedAt.slice(0, 10)) : '不明'}\n\n${summary}\n\n`
      + '⚠ 今のデータはすべて置き換わります。\n元に戻せません。よろしいですか？',
      { ok: '復元する', danger: true, title: '控えから復元' })) { file.value = ''; return; }

    const bar = busy('復元しています');
    try {
      for (const c of COLLECTIONS) {
        const rows = json.data[c] || [];
        bar.set(0, 1, `${LABEL[c] || c} を戻しています`);
        await store.clearCollection(c);
        if (rows.length) await store.bulk(c, rows, (d, t) => bar.set(d, t, `${LABEL[c] || c}　${d}/${t}`));
      }
      if (json.data.company) await store.setMeta('company', json.data.company);
      if (json.data.codeLists) await store.setMeta('codeLists', json.data.codeLists);
      if (json.data.counters) await store.setCounters(json.data.counters);
      await store.loadCompany(); await store.loadMasters();
    } finally { bar.done(); }
    toast('復元しました');
    setTimeout(() => location.reload(), 800);
  });

  return el('div', {},
    days !== null && days >= 7
      ? note(`前回の控えから ${days} 日たっています。念のため書き出しておきましょう。`, 'warn')
      : days !== null ? note(`前回の控え：${days === 0 ? '今日' : `${days}日前`}`, 'ok') : null,

    store.mode === 'cloud'
      ? note('データはFirebaseに保存されています。パソコンが壊れてもデータは残りますが、'
        + '「間違えて消した」ときのために、月に一度は控えを書き出してください。')
      : note('いまはこのパソコンの中だけに保存しています。パソコンを替えるときは、'
        + '必ず控えを書き出して、新しいパソコンで復元してください。', 'warn'),

    card('いま入っているデータ', counts),

    card('控えを書き出す', el('div', {},
      el('p', {}, '全部のデータを1つのファイルにまとめます。Googleドライブや USBメモリに保存してください。'),
      el('div', { class: 'btnrow' },
        btn('控えを書き出す（JSON）', doBackup, 'btn--primary'),
        btn('Excel用に書き出す（CSV）', doCSV, 'btn--ghost')))),

    card('控えから復元する', el('div', {},
      note('復元すると、今のデータはすべて置き換わります。よく確かめてから行ってください。', 'warn'),
      el('div', { class: 'btnrow' },
        btn('控えのファイルを選ぶ', () => file.click(), 'btn--danger'), file))),

    card('Accessからの引っ越し', el('div', {},
      el('p', {}, '「移行データ」フォルダの中の JSON ファイルを読み込みます。'),
      el('div', { class: 'btnrow' }, btn('引っ越し画面をひらく', () => go('ikou'), 'btn--ghost')))),

    card('お試し用のサンプル', el('div', {},
      el('p', {}, '架空の得意先・商品・売上を入れて、操作を試せます。'
        + '本番で使いはじめたあとは押さないでください。'),
      el('div', { class: 'btnrow' },
        btn('サンプルデータを入れる', async () => {
          if (await loadDemo()) { toast('サンプルデータを入れました'); setTimeout(() => location.reload(), 700); }
        }, 'btn--ghost')))));
}

/* ==================== サンプルデータ ==================== */
/**
 * 架空のデータを入れて、操作を試せるようにする。
 * 中身は今あるものを全部消して入れ替えるので、必ず断りを入れる。
 */
export async function loadDemo({ silent = false } = {}) {
  if (!silent) {
    const has = (await store.all('sales').catch(() => [])).length
      + (await store.all('customers').catch(() => [])).length;
    const warn = store.mode === 'cloud'
      ? '⚠ いまクラウド保存につながっています。本番のデータが消えます。\n\n'
      : '';
    const now = has ? `いま ${has.toLocaleString()}件のデータが入っています。\n\n` : '';
    if (!await confirmBox(
      `${warn}${now}架空の得意先・商品・売上を入れて、操作を試せるようにします。\n`
      + '（得意先名・住所・金額はすべて作り物です）\n\n'
      + '今のデータはすべて置き換わります。よろしいですか？',
      { ok: 'サンプルを入れる', danger: true, title: 'サンプルデータ' })) return false;
  }

  const bar = busy('サンプルを作っています');
  try {
    const d = buildDemoData(today());
    for (const c of COLLECTIONS) {
      bar.set(0, 1, `${LABEL[c] || c} を入れています`);
      await store.clearCollection(c);
      if (d[c]?.length) await store.bulk(c, d[c], (x, t) => bar.set(x, t, `${LABEL[c] || c}　${x}/${t}`));
    }
    await store.setMeta('company', d.company);
    await store.setMeta('codeLists', d.codeLists);
    await store.setCounters(d.counters);
    await store.loadCompany();
    await store.loadMasters();
  } finally { bar.done(); }
  return true;
}

const LABEL = {
  customers: '得意先', products: '商品', productCats: '商品部門', suppliers: '仕入先',
  cashPartners: '出納取引先', sales: '売上伝票', receipts: '入金伝票',
  purchases: '仕入伝票', payments: '出金伝票', cashbook: '現金出納', invoices: '請求履歴',
  company: '自社の情報', codeLists: '単位・摘要など', counters: '伝票番号の続き',
};

/* ==================== Access からの引っ越し ==================== */
export async function renderImport() {
  setHint('「移行データ」フォルダの中身をまとめて選んでください。');

  const file = el('input', { type: 'file', accept: '.json', multiple: true, style: 'display:none' });
  const picked = el('div', { class: 'empty' }, 'まだファイルが選ばれていません');
  const runBtn = btn('この内容で取り込む', () => start(), 'btn--primary');
  runBtn.disabled = true;
  const wipe = el('input', { type: 'checkbox', checked: true });
  let plan = [];

  file.addEventListener('change', async () => {
    plan = [];
    const files = [...(file.files || [])];
    for (const f of files) {
      const key = f.name.replace(/\.json$/i, '');
      let json;
      try { json = JSON.parse(await f.text()); } catch { plan.push({ key, f, err: '読み取れません' }); continue; }
      if (key === 'counters') { plan.push({ key, f, kind: 'counters', data: json, n: 1 }); continue; }
      if (META_FILES[key]) { plan.push({ key, f, kind: 'meta', data: json, n: 1 }); continue; }
      if (!COLLECTIONS.includes(key)) { plan.push({ key, f, err: '使い道がわかりません' }); continue; }
      if (!Array.isArray(json)) { plan.push({ key, f, err: '一覧の形ではありません' }); continue; }
      plan.push({ key, f, kind: 'coll', data: json, n: json.length });
    }
    plan.sort((a, b) => COLLECTIONS.indexOf(a.key) - COLLECTIONS.indexOf(b.key));

    picked.className = '';
    picked.replaceChildren(table([
      { h: 'ファイル', fmt: (r) => r.f.name },
      { h: '入れる先', fmt: (r) => (r.err ? el('span', { style: 'color:var(--shu)' }, r.err) : (LABEL[r.key] || r.key)) },
      { h: '件数', cls: 'num', w: '8rem', fmt: (r) => (r.err ? '—' : r.n.toLocaleString()) },
    ], plan, { foot: false }));
    runBtn.disabled = !plan.some((p) => !p.err);
  });

  const start = async () => {
    const good = plan.filter((p) => !p.err);
    const total = good.reduce((a, p) => a + p.n, 0);
    if (!await confirmBox(
      `${good.length}個のファイル・あわせて ${total.toLocaleString()}件 を取り込みます。\n\n`
      + (wipe.checked ? '⚠ 同じ種類の今のデータは、先にすべて消してから入れ直します。\n\n' : '')
      + 'よろしいですか？', { ok: '取り込む', danger: true, title: 'Accessデータの取り込み' })) return;

    const bar = busy('取り込んでいます');
    const done = [];
    try {
      for (const p of good) {
        if (p.kind === 'meta') { await store.setMeta(p.key, p.data); done.push([LABEL[p.key] || p.key, 1]); continue; }
        if (p.kind === 'counters') { await store.setCounters(p.data); done.push([LABEL.counters, 1]); continue; }
        bar.set(0, p.n, `${LABEL[p.key] || p.key} を入れています`);
        if (wipe.checked) await store.clearCollection(p.key);
        const rows = p.data.map((r) => ({ ...r, id: String(r.id ?? r.code ?? '') || undefined }))
          .filter((r) => r.id !== undefined);
        await store.bulk(p.key, rows, (d, t) => bar.set(d, t, `${LABEL[p.key] || p.key}　${d.toLocaleString()} / ${t.toLocaleString()}`));
        done.push([LABEL[p.key] || p.key, rows.length]);
      }
      await store.loadCompany();
      await store.loadMasters();
    } catch (e) {
      bar.done();
      alertBox(`途中で止まりました。\n${e.message || e}\n\nもう一度やり直してください。`, 'エラー');
      return;
    }
    bar.done();
    await modal({
      title: '取り込みが終わりました', width: 520,
      body: el('div', {},
        el('p', {}, '次のとおり取り込みました。'),
        table([{ h: '種類', fmt: (r) => r[0] }, { h: '件数', cls: 'num', fmt: (r) => r[1].toLocaleString() }], done, { foot: false })),
      buttons: [{ label: 'メインメニューへ', value: 1, class: 'btn--primary' }],
    });
    location.hash = '';
    location.reload();
  };

  return el('div', {},
    note('Accessの「梅乃寿司_D.mdb」から書き出した JSON を読み込みます。'
      + 'このパソコンの「報酬計算ソフト／移行データ」フォルダにあります。'),
    card('手順', el('div', {},
      el('ol', { class: 'steps' },
        el('li', {}, '下の「ファイルを選ぶ」を押す'),
        el('li', {}, '「移行データ」フォルダを開く'),
        el('li', {}, el('b', {}, 'Ctrl＋A'), '（Macは ', el('b', {}, '⌘＋A'), '）で全部選んで「開く」'),
        el('li', {}, '内容を確かめて「この内容で取り込む」を押す')),
      el('div', { class: 'btnrow' },
        btn('ファイルを選ぶ', () => file.click(), 'btn--ghost'), file,
        el('label', { class: 'check' }, wipe, '入れる前に同じ種類の今のデータを消す')))),
    card('選ばれたファイル', picked),
    el('div', { class: 'btnrow btnrow--end' }, runBtn));
}
