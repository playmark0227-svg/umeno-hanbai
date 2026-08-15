// 起動と画面の切り替え。

import { store } from './store.js';
import { el, $, $$, jDate, today } from './util.js';
import { toast, modal, alertBox, note, btn, field, input, closeAllModals } from './ui.js';

import * as Home from './views/home.js';
import * as Slips from './views/slips.js';
import * as Money from './views/money.js';
import * as Masters from './views/masters.js';
import * as Billing from './views/billing.js';
import * as Reports from './views/reports.js';
import * as Backup from './views/backup.js';
import * as Payroll from './views/payroll.js';

/* ---------- 画面の一覧 ---------- */
export const ROUTES = {
  '': { title: 'メインメニュー', render: Home.render, crumb: false },

  uriage: { title: '売上伝票', render: (p) => Slips.render('sales', p) },
  shiire: { title: '仕入伝票', render: (p) => Slips.render('purchases', p) },
  nyukin: { title: '入金伝票', render: (p) => Money.render('receipts', p) },
  shukkin: { title: '出金伝票', render: (p) => Money.render('payments', p) },

  seikyu: { title: '請求書', render: Billing.renderInvoices },
  urikake: { title: '売掛残高一覧', render: Billing.renderAR },
  kaikake: { title: '買掛残高一覧', render: Billing.renderAP },
  motocho: { title: '得意先元帳', render: Billing.renderLedger },

  nippo: { title: '日報', render: Reports.renderDaily },
  geppo: { title: '月報', render: Reports.renderMonthly },
  suito: { title: '現金出納帳', render: Reports.renderCashbook },

  kyuryo: { title: '給料計算', render: Payroll.render },
  jugyoin: { title: '従業員', render: (p) => Masters.render('employees', p) },

  tokui: { title: '得意先', render: (p) => Masters.render('customers', p) },
  shohin: { title: '商品', render: (p) => Masters.render('products', p) },
  shiiresaki: { title: '仕入先', render: (p) => Masters.render('suppliers', p) },
  settei: { title: '自社の設定', render: Masters.renderCompany },

  backup: { title: 'バックアップと復元', render: Backup.render },
  ikou: { title: 'Accessからの引っ越し', render: Backup.renderImport },
};

/* ---------- 起動 ---------- */
const bootMsg = (t) => { const n = $('#bootMsg'); if (n) n.textContent = t; };

async function main() {
  applyFontSize(localStorage.getItem('umeno.size') || '2');

  try {
    bootMsg('保存先を確認しています…');
    await store.init();
  } catch (e) {
    console.error(e);
    return showFatal('保存先につなげませんでした。', e);
  }

  if (store.mode === 'cloud') {
    bootMsg('ログインを確認しています…');
    const ok = await waitAuth();
    if (!ok) return showLogin();
  }
  await boot();
}

function waitAuth() {
  return new Promise((res) => {
    let done = false;
    const off = store.watchAuth((u) => {
      if (done) { if (!u) location.reload(); return; }
      done = true; off?.(); res(!!u);
    });
    setTimeout(() => { if (!done) { done = true; res(false); } }, 8000);
  });
}

async function boot() {
  bootMsg('データを読み込んでいます…');
  try {
    await store.loadCompany();
    await store.loadMasters();
  } catch (e) {
    console.error(e);
    return showFatal('データの読み込みに失敗しました。', e);
  }

  $('#boot').hidden = true;
  $('#shell').hidden = false;

  $('#today').textContent = jDate(today());
  $('#conn').textContent = store.mode === 'cloud' ? 'クラウド保存' : 'このPC内';
  $('#conn').dataset.mode = store.mode;
  $('#conn').title = store.mode === 'cloud'
    ? 'データはFirebaseに保存され、どのパソコンからでも同じものが見えます'
    : 'データはこのパソコンの中だけにあります。「バックアップ」で書き出してください';

  $('#btnHome').onclick = () => go('');
  $('#btnUser').textContent = store.mode === 'cloud' ? (store.user?.email || 'ログイン') : 'この端末';
  $('#btnUser').onclick = userMenu;

  $$('.fontsize button').forEach((b) => {
    b.onclick = () => { applyFontSize(b.dataset.size); localStorage.setItem('umeno.size', b.dataset.size); };
  });

  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', globalKeys);
  route();

  if (store.mode === 'local' && !store.masters.customers.length && !store.masters.employees.length) {
    setTimeout(() => firstRunHint(), 400);
  }
}

function applyFontSize(s) {
  document.documentElement.dataset.size = s;
  $$('.fontsize button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.size === s));
}

/* ---------- ルーティング ---------- */
export function go(path) {
  if (location.hash.slice(1) === path) route();
  else location.hash = path;
}
export const currentPath = () => decodeURIComponent(location.hash.slice(1));

async function route() {
  closeAllModals();
  const path = currentPath();
  const [key, ...rest] = path.split('/');
  const r = ROUTES[key] ?? ROUTES[''];

  const crumbs = $('#crumbs');
  crumbs.replaceChildren();
  if (r.crumb !== false) {
    crumbs.append(el('span', {}, 'メインメニュー'), el('span', {}, '›'), el('b', {}, r.title));
  }
  document.title = (r.crumb === false ? '' : r.title + ' ｜ ') + '梅乃寿司 販売管理';

  const view = $('#view');
  view.replaceChildren(el('div', { class: 'empty' }, '読み込んでいます…'));
  try {
    const content = await r.render(rest, view);
    if (content) view.replaceChildren(content);
  } catch (e) {
    console.error(e);
    view.replaceChildren(note(`画面を開けませんでした。\n${e.message || e}`, 'err'));
  }
  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
  setHint(r.hint || (r.crumb === false ? '各ボタンを押すと画面が開きます' : 'F12 または Esc でメインメニューに戻ります'));
}

export function setHint(html) { $('#footHint').innerHTML = html; }

function globalKeys(e) {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (e.key === 'F12') { e.preventDefault(); go(''); return; }
  if (e.key === 'Escape' && !typing && !$('.mask')) { go(''); return; }
  if (e.key === 'F1' && !$('.mask')) {
    const save = $('[data-key="save"]');
    if (save) { e.preventDefault(); save.click(); }
  }
}

/* ---------- ログイン画面 ---------- */
function showLogin() {
  $('#boot').hidden = true;
  $('#shell').hidden = false;
  $('#crumbs').replaceChildren();
  $('#today').textContent = jDate(today());
  $('#btnUser').textContent = '未ログイン';

  const mail = input({ type: 'email', autocomplete: 'username', placeholder: 'you@example.com' });
  const pass = input({ type: 'password', autocomplete: 'current-password' });
  const msg = el('div');

  const doLogin = async () => {
    msg.replaceChildren();
    if (!mail.value || !pass.value) { msg.append(note('メールアドレスとパスワードを入れてください', 'warn')); return; }
    try {
      await store.signIn(mail.value.trim(), pass.value);
      $('#shell').hidden = true; $('#boot').hidden = false;
      await boot();
    } catch (e) {
      msg.replaceChildren(note(loginError(e), 'err'));
    }
  };

  const form = el('form', { class: 'card gate', onsubmit: (e) => { e.preventDefault(); doLogin(); } },
    el('div', { class: 'card__body' },
      el('h2', {}, 'ログイン'),
      el('p', { style: 'color:#4a545e;margin-bottom:1.2rem' }, '梅乃寿司 販売管理'),
      field('メールアドレス', mail),
      field('パスワード', pass),
      msg,
      el('button', { type: 'submit', class: 'btn btn--primary btn--wide' }, 'ログイン'),
      el('div', { style: 'margin-top:1.2rem;text-align:center' },
        btn('保存先の設定をやり直す', setupDialog, 'btn--ghost btn--sm'))));

  $('#view').replaceChildren(form);
  mail.focus();
}

const loginError = (e) => ({
  'auth/invalid-credential': 'メールアドレスかパスワードが違います。',
  'auth/invalid-email': 'メールアドレスの形が正しくありません。',
  'auth/user-not-found': 'このメールアドレスは登録されていません。',
  'auth/wrong-password': 'パスワードが違います。',
  'auth/too-many-requests': '何度も失敗したため、しばらく待ってからお試しください。',
  'auth/network-request-failed': 'インターネットにつながっていないようです。',
}[e?.code] || `ログインできませんでした（${e?.code || e?.message || e}）`);

/* ---------- 保存先の設定 ---------- */
export async function setupDialog() {
  const ta = el('textarea', {
    class: 'in', rows: 9, spellcheck: 'false',
    style: 'font-family:var(--mono);font-size:.82rem;min-height:11rem',
    placeholder: '{\n  "apiKey": "AIza…",\n  "authDomain": "xxx.firebaseapp.com",\n  "projectId": "xxx",\n  "storageBucket": "xxx.appspot.com",\n  "messagingSenderId": "…",\n  "appId": "1:…"\n}',
  });
  const cur = store.config;
  if (cur) ta.value = JSON.stringify(cur, null, 2);
  const msg = el('div');

  const body = el('div', {},
    el('p', {}, 'Firebase（グーグルの無料のデータ置き場）につなぐと、どのパソコンからでも同じデータが見え、保存と同時にクラウドに控えが残ります。'),
    el('ol', { class: 'steps' },
      el('li', {}, 'ブラウザで ', el('code', {}, 'console.firebase.google.com'), ' を開く'),
      el('li', {}, 'プロジェクトを作る（名前は umeno-sushi など）'),
      el('li', {}, '「ウェブアプリを追加」を押す'),
      el('li', {}, '表示された ', el('code', {}, 'firebaseConfig'), ' の { } の中身を、下の枠に貼り付ける')),
    field('Firebase の設定（JSON）', ta),
    msg);

  const v = await modal({
    title: '保存先の設定', width: 640, body,
    buttons: [
      { label: 'やめる', value: null, class: 'btn--ghost' },
      {
        label: 'このパソコンだけで使う', value: 'local', class: 'btn--ghost',
        before: async () => (await import('./ui.js')).confirmBox(
          'このパソコンの中だけにデータを保存します。\n（あとから設定し直せます）\n\nよろしいですか？'),
      },
      {
        label: '設定して開き直す', value: 'cloud', class: 'btn--primary',
        before: () => {
          msg.replaceChildren();
          try {
            const cfg = parseFirebaseConfig(ta.value);
            ta.dataset.parsed = JSON.stringify(cfg);
            return true;
          } catch (e) {
            msg.replaceChildren(note(`設定を読み取れませんでした：${e.message}`, 'err'));
            return false;
          }
        },
      },
    ],
  });

  if (v === 'local') { store.config = null; location.reload(); }
  if (v === 'cloud') { store.config = JSON.parse(ta.dataset.parsed); location.reload(); }
}

/**
 * Firebase コンソールからコピーしたものを、なるべく何でも受け取る。
 *   const firebaseConfig = { … };  /  { … }  /  中身だけ  /  正しいJSON
 */
export function parseFirebaseConfig(text) {
  let raw = String(text || '').trim()
    .replace(/^(const|let|var)\s+\w+\s*=\s*/, '')
    .replace(/;\s*$/, '')
    .trim();
  if (!raw) throw new Error('空です');
  if (!raw.startsWith('{')) raw = `{${raw}}`;
  const json = raw
    .replace(/\/\/[^\n]*/g, '')                       // 行コメント
    .replace(/([{,]\s*)([A-Za-z0-9_$]+)\s*:/g, '$1"$2":')  // 裸のキーに引用符
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');                   // 末尾のカンマ
  let cfg;
  try { cfg = JSON.parse(json); } catch { throw new Error('形が読み取れません。{ } ごと貼り付けてみてください'); }
  if (!cfg.apiKey) throw new Error('apiKey が見当たりません');
  if (!cfg.projectId) throw new Error('projectId が見当たりません');
  return cfg;
}

/* ---------- ユーザーメニュー ---------- */
async function userMenu() {
  const rows = [
    store.mode === 'cloud' ? { label: 'ログアウト', v: 'out', class: 'btn--danger' } : null,
    { label: '保存先の設定', v: 'setup', class: 'btn--ghost' },
    { label: 'バックアップ画面へ', v: 'backup', class: 'btn--ghost' },
  ].filter(Boolean);

  const v = await modal({
    title: store.mode === 'cloud' ? (store.user?.email || 'アカウント') : 'この端末で使用中',
    width: 420,
    body: el('div', {},
      el('p', {}, store.mode === 'cloud'
        ? 'データはFirebaseに保存されています。ほかのパソコンからも同じデータが開けます。'
        : 'データはこのパソコンの中だけにあります。定期的にバックアップを書き出してください。')),
    buttons: [{ label: '閉じる', value: null, class: 'btn--ghost' }, ...rows.map((r) => ({ label: r.label, value: r.v, class: r.class }))],
  });
  if (v === 'out') { await store.signOut(); location.reload(); }
  if (v === 'setup') setupDialog();
  if (v === 'backup') go('backup');
}

/* ---------- はじめて起動したとき ---------- */
async function firstRunHint() {
  const v = await modal({
    title: 'はじめに', width: 580,
    body: el('div', {},
      el('p', {}, 'まだデータが入っていません。'),
      el('p', {}, 'Access から書き出した ', el('b', {}, '「移行データ」フォルダ'),
        ' の中身を読み込むと、得意先101社・商品・過去の売上 15,374件がそのまま入ります。'),
      el('p', { style: 'color:var(--sumi-2);font-size:.92rem' },
        'いつでも「バックアップ」の画面からやり直せます。')),
    buttons: [
      { label: 'あとで', value: null, class: 'btn--ghost' },
      { label: 'Accessのデータを読み込む', value: 'go', class: 'btn--primary' },
    ],
  });
  if (v === 'go') go('ikou');
}

function showFatal(msg, e) {
  $('#boot').hidden = true;
  $('#shell').hidden = false;
  $('#view').replaceChildren(el('div', { class: 'card gate' }, el('div', { class: 'card__body' },
    el('h2', {}, '起動できませんでした'),
    note(msg + '\n' + (e?.message || ''), 'err'),
    el('div', { class: 'btnrow', style: 'margin-top:1rem' },
      btn('保存先の設定', setupDialog, 'btn--primary'),
      btn('開き直す', () => location.reload())))));
}

main();
