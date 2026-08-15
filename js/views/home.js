// メインメニュー。今日の数字と、大きなボタン。

import { store, arBalance } from '../store.js';
import { el, yen, today, thisMonth, jDate, jMonth, billingPeriod, addMonths } from '../util.js';
import { kpi, note } from '../ui.js';
import { go } from '../app.js';

const ICON = {
  uriage: 'M4 20V9m5 11V4m5 16v-8m5 8V7',
  nyukin: 'M12 3v13m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16',
  shukkin: 'M12 21V8m0 0L7.5 12.5M12 8l4.5 4.5M4 4h16',
  seikyu: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  urikake: 'M3 6h18M3 12h18M3 18h11',
  nippo: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h4',
  geppo: 'M4 5h16v15H4zM4 10h16M9 5V3M15 5V3',
  tokui: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1',
  shohin: 'M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8',
  suito: 'M3 7h18v11H3zM3 11h18M7 15h4',
  settei: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  backup: 'M4 7a8 3 0 1016 0 8 3 0 10-16 0M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  shiire: 'M6 7h12l1 13H5zM9 7V5a3 3 0 016 0v2',
  motocho: 'M4 4h12l4 4v12H4zM16 4v4h4M8 13h8M8 17h5',
  kyuryo: 'M12 2v20M7 5.5h7a3 3 0 010 6H8a3 3 0 000 6h8',
  jugyoin: 'M9 11a3 3 0 100-6 3 3 0 000 6zM2 20v-1a5 5 0 015-5h4a5 5 0 015 5v1M17 7h5M19.5 4.5v5',
};

const icon = (d) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'tile__icon');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '1.6');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  svg.append(p);
  return svg;
};

const tile = (name, desc, path, ic, cls = '') =>
  el('button', { type: 'button', class: `tile ${cls}`, onclick: () => go(path) },
    icon(ICON[ic] || ICON.uriage),
    el('span', { class: 'tile__name' }, name),
    el('span', { class: 'tile__desc' }, desc));

const section = (title, tiles) => el('section', { style: 'margin-bottom:2rem' },
  el('div', { class: 'noren' }, el('h1', {}, title)),
  el('div', { class: 'tiles' }, tiles));

export async function render() {
  const box = el('div', {});

  /* ---- 今日の数字 ---- */
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:2rem' },
    kpi('本日の売上', '—', jDate(today())),
    kpi('今月の売上', '—', jMonth(thisMonth()), 'kin'),
    kpi('売掛未回収', '—', '掛売の残り', 'shu'),
    kpi('今月の入金', '—', '', 'midori'));
  box.append(kpis);

  box.append(
    section('毎日の入力', [
      tile('売上伝票', '現金売・掛売の入力', 'uriage', 'uriage', 'tile--accent'),
      tile('入金伝票', '得意先からの入金', 'nyukin', 'nyukin'),
      tile('現金出納帳', '日々の現金の出入り', 'suito', 'suito'),
      tile('日報', '一日の売上を確かめる', 'nippo', 'nippo'),
    ]),
    section('月末の締め', [
      tile('請求書', '締めて請求書を印刷する', 'seikyu', 'seikyu', 'tile--accent'),
      tile('売掛残高一覧', '誰にいくら残っているか', 'urikake', 'urikake'),
      tile('得意先元帳', '一社ごとの出入りを追う', 'motocho', 'motocho'),
      tile('月報', '月ごと・得意先ごとの売上', 'geppo', 'geppo'),
    ]),
    section('給料', [
      tile('給料計算', '出退勤を入れて報酬を出す', 'kyuryo', 'kyuryo', 'tile--accent'),
      tile('従業員', '名前・時給・交通費', 'jugyoin', 'jugyoin'),
    ]),
    section('台帳', [
      tile('得意先', '名前・住所・締日', 'tokui', 'tokui'),
      tile('商品', '品名・単価', 'shohin', 'shohin'),
      tile('仕入先', '仕入先の登録', 'shiiresaki', 'tokui', 'tile--quiet'),
      tile('自社の設定', '屋号・振込先・税率', 'settei', 'settei', 'tile--quiet'),
    ]),
    section('その他', [
      tile('仕入伝票', '仕入の記録', 'shiire', 'shiire', 'tile--quiet'),
      tile('出金伝票', '仕入先への支払', 'shukkin', 'shukkin', 'tile--quiet'),
      tile('買掛残高一覧', '仕入先への未払', 'kaikake', 'urikake', 'tile--quiet'),
      tile('バックアップ', '控えの書き出しと復元', 'backup', 'backup'),
    ]));

  if (store.mode === 'local') {
    box.prepend(note('いまはこのパソコンの中だけにデータを保存しています。ほかのパソコンからは見えません。'
      + '「バックアップ」からこまめに控えを書き出すか、右上のボタンから Firebase を設定してください。', 'warn'));
  }

  /* ---- 数字は後から流し込む（画面表示を待たせない） ---- */
  loadNumbers(kpis).catch(console.error);
  return box;
}

async function loadNumbers(host) {
  const t = today();
  const ym = thisMonth();
  const { from, to } = billingPeriod(ym, store.company?.closeDay || 23);

  const [dayRows, monRows, recRows] = await Promise.all([
    store.list('sales', { from: t, to: t }),
    store.list('sales', { from, to }),
    store.list('receipts', { from, to }),
  ]);
  const live = (a) => a.filter((x) => !x.void);
  const sum = (a) => live(a).reduce((s, x) => s + (Number(x.subtotal) || 0) + (Number(x.tax) || 0), 0);

  let unpaid = 0;
  const debtors = store.masters.customers.filter((c) => Number(c.code) !== 0);
  const bal = await Promise.all(debtors.map((c) => arBalance(c.code).catch(() => 0)));
  bal.forEach((b) => { if (b > 0) unpaid += b; });
  const nDebt = bal.filter((b) => b > 0).length;

  host.replaceChildren(
    kpi('本日の売上', sum(dayRows), `${jDate(t)}　${live(dayRows).length}件`),
    kpi('今月の売上', sum(monRows), `${from.slice(5).replace('-', '/')}〜${to.slice(5).replace('-', '/')}　${live(monRows).length}件`, 'kin'),
    kpi('売掛未回収', unpaid, `${nDebt}社`, 'shu'),
    kpi('今月の入金', live(recRows).reduce((s, x) => s + (Number(x.total) || 0), 0), `${live(recRows).length}件`, 'midori'));
}
