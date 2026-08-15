// 給料計算。Excel「給料計算◯月.xls」をそのまま置き換えたもの。
//
//   1回目（昼）の時間 ＝ 終業 − 始業
//   2回目（夜）の時間 ＝ 終業 − 始業
//   22時以降の時間     ＝ 終業 − 始業
//   時給①の金額 ＝（1回目 ＋ 2回目）× 時給①
//   時給②の金額 ＝  22時以降       × 時給②
//   支給額 ＝ 日ごとの合計 ＋ 交通費
//
// 締めは月初〜月末（Excel と同じ）。控除は扱わない。

import { store } from '../store.js';
import {
  el, yen, num, int, today, thisMonth, jMonth, jDate, addMonths,
  lastDayOf, WD, toCSV, download, enterMovesNext,
} from '../util.js';
import { card, table, kpi, note, btn, field, input, select, toast, alertBox } from '../ui.js';
import { go, setHint } from '../app.js';

export const sheetId = (code, ym) => `${Number(code)}_${String(ym).replace('-', '')}`;

/* ---------- 時間の計算 ---------- */
/** "18:00" → 分。空なら null */
const mins = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** 始業〜終業の時間数。日をまたいだら翌日として数える */
export function span(from, to) {
  const a = mins(from); const b = mins(to);
  if (a === null || b === null) return 0;
  return ((b - a + 1440) % 1440) / 60;
}
/** 1日ぶんの計算 */
export function calcDay(d, emp) {
  const day = span(d?.d1s, d?.d1e);          // 1回目（昼）
  const night = span(d?.d2s, d?.d2e);        // 2回目（夜）
  const late = span(d?.lts, d?.lte);         // 22時以降
  const r1 = num(emp.rate1);
  const r2 = num(emp.rate2 ?? emp.rate1);
  const pay1 = (day + night) * r1;
  const pay2 = late * r2;
  // 22時をまたいで入れているのに「22時以降」欄が空だと、時給②ぶんが落ちる。
  // ただし時給①と時給②が同額なら金額は変わらないので、黙っておく。
  const crosses = r1 !== r2 && [[d?.d1s, d?.d1e], [d?.d2s, d?.d2e]]
    .some(([s, e]) => mins(s) !== null && mins(e) !== null && mins(e) > 22 * 60 && mins(e) > mins(s));
  return {
    day, night, late, before22: day + night, pay1, pay2, total: pay1 + pay2,
    warnLate: crosses && late === 0,
  };
}
/** 1か月ぶん */
export function calcMonth(sheet, emp, ym) {
  const [y, m] = ym.split('-').map(Number);
  const days = [];
  for (let i = 1; i <= lastDayOf(y, m); i++) {
    const d = (sheet?.days || []).find((x) => Number(x.d) === i) || { d: i };
    days.push({ ...d, d: i, wd: new Date(y, m - 1, i).getDay(), calc: calcDay(d, emp) });
  }
  const sum = (k) => days.reduce((a, x) => a + x.calc[k], 0);
  const subtotal = sum('total');
  const commute = num(sheet?.commute ?? emp.commute);
  return {
    days, hoursBefore22: sum('before22'), hoursLate: sum('late'),
    hours: sum('before22') + sum('late'),
    workDays: days.filter((x) => x.calc.total > 0).length,
    warnDays: days.filter((x) => x.calc.warnLate).length,
    pay1: sum('pay1'), pay2: sum('pay2'),
    subtotal, commute, total: subtotal + commute,
  };
}
/** 3.5 → "3時間30分" */
export const hm = (h) => {
  const t = Math.round(h * 60);
  return t ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : '—';
};

/* ==================== 一覧（月ごと・全員） ==================== */
export async function render(parts) {
  if (parts?.[0]) return sheetView(parts[0], parts[1] || thisMonth());
  setHint('名前をクリックすると、その人の出退勤を入れる画面が開きます。');

  const ymSel = select(monthOptions(), { value: thisMonth() });
  const host = el('div');
  const kpis = el('div', { class: 'kpis', style: 'margin-bottom:1rem' });
  const emps = () => store.masters.employees.filter((e) => e.active !== false);

  const load = async () => {
    const ym = ymSel.value;
    host.replaceChildren(el('div', { class: 'empty' }, '計算しています…'));
    const list = emps();
    const sheets = await Promise.all(list.map((e) => store.get('timesheets', sheetId(e.code, ym)).catch(() => null)));
    const rows = list.map((e, i) => ({ emp: e, id: e.id, ...calcMonth(sheets[i], e, ym) }));

    kpis.replaceChildren(
      kpi('支給額の合計', rows.reduce((a, r) => a + r.total, 0), jMonth(ym), 'shu'),
      kpi('人数', `${rows.filter((r) => r.workDays).length}`, `登録 ${list.length}人`),
      kpi('総勤務時間', hm(rows.reduce((a, r) => a + r.hours, 0)), '', 'kin'),
      kpi('交通費の合計', rows.reduce((a, r) => a + r.commute, 0), '', 'midori'));

    const cols = [
      { h: '番号', w: '4.5rem', cls: 'num', fmt: (r) => r.emp.code },
      { h: '名前', fmt: (r) => r.emp.name },
      { h: '時給', w: '6rem', cls: 'num', fmt: (r) => yen(r.emp.rate1) },
      { h: '出勤', w: '5rem', cls: 'num', fmt: (r) => (r.workDays ? `${r.workDays}日` : el('span', { class: 'muted' }, '—')) },
      { h: '22時まで', w: '7rem', cls: 'num', fmt: (r) => hm(r.hoursBefore22) },
      { h: '22時以降', w: '7rem', cls: 'num', fmt: (r) => hm(r.hoursLate) },
      { h: '', w: '5rem', cls: 'cen',
        fmt: (r) => (r.warnDays ? el('span', { class: 'warn-late', title: `${r.warnDays}日ぶん、終業が22時を過ぎているのに「22時以降」欄が空です` }, `⚠ ${r.warnDays}`) : '') },
      { h: '小計', w: '8rem', cls: 'num', fmt: (r) => yen(r.subtotal), sum: (r) => r.subtotal },
      { h: '交通費', w: '7rem', cls: 'num', fmt: (r) => (r.commute ? yen(r.commute) : el('span', { class: 'muted' }, '—')), sum: (r) => r.commute },
      { h: '支給額', w: '8.5rem', cls: 'num', fmt: (r) => el('b', {}, yen(r.total)), sum: (r) => r.total },
    ];
    host.replaceChildren(table(cols, rows, {
      onRow: (r) => go(`kyuryo/${r.emp.code}/${ym}`),
      empty: '従業員が登録されていません',
    }));
    window.__payroll = { ym, rows };
  };

  ymSel.addEventListener('change', load);
  await load();

  return el('div', {},
    !emps().length
      ? note('まず「従業員」の画面で、名前と時給を登録してください。', 'warn')
      : null,
    el('div', { class: 'toolbar' },
      field('計算する月', ymSel),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('従業員の登録', () => go('jugyoin'), 'btn--ghost')),
      el('div', { style: 'flex:1' }),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('CSVで書き出す', () => exportCSV(), 'btn--ghost')),
      el('div', { class: 'f' }, el('span', { class: 'f__label' }, '　'),
        btn('明細をまとめて印刷', () => printAll(), 'btn--primary'))),
    kpis,
    card('給料計算', host));
}

/* ==================== 出退勤の入力 ==================== */
async function sheetView(code, ym) {
  const emp = store.masters.employees.find((e) => Number(e.code) === Number(code));
  if (!emp) { toast('その従業員は見つかりません', 'err'); go('kyuryo'); return el('div'); }
  setHint('時刻は <b>1800</b> のように4桁で打てます。　空けた日は休みとして扱います。');

  const [y, m] = ym.split('-').map(Number);
  const saved = await store.get('timesheets', sheetId(code, ym)).catch(() => null);
  const commute = input({ type: 'text', inputmode: 'numeric', value: num(saved?.commute ?? emp.commute) || '', class: 'in--num', style: 'max-width:9rem' });
  const memo = input({ value: saved?.note || '' });

  const tbody = el('tbody');
  const rowsRef = [];
  const foot = {
    b22: el('td', { class: 'num' }, '—'), late: el('td', { class: 'num' }, '—'),
    pay: el('td', { class: 'num' }, '0'),
  };
  const box = {
    sub: el('div', { class: 'kpi__v' }, '0'),
    tot: el('div', { class: 'kpi__v' }, '0'),
    hrs: el('div', { class: 'kpi__v' }, '0:00'),
    days: el('div', { class: 'kpi__v' }, '0'),
  };

  const recalc = () => {
    let b22 = 0; let late = 0; let sub = 0; let wd = 0;
    for (const r of rowsRef) {
      const c = calcDay(r.read(), emp);
      r.out.b22.textContent = hm(c.before22);
      r.out.late.replaceChildren(c.warnLate
        ? el('span', {
          class: 'warn-late',
          title: '終業が22時を過ぎています。22時以降のぶんは右の欄に分けて入れてください。',
        }, '⚠ 要確認')
        : document.createTextNode(hm(c.late)));
      r.out.pay.textContent = c.total ? yen(Math.round(c.total)) : '';
      r.tr.classList.toggle('is-worked', c.total > 0);
      b22 += c.before22; late += c.late; sub += c.total; if (c.total > 0) wd++;
    }
    foot.b22.textContent = hm(b22);
    foot.late.textContent = hm(late);
    foot.pay.textContent = yen(Math.round(sub));
    const com = num(commute.value);
    box.sub.textContent = yen(Math.round(sub));
    box.tot.textContent = yen(Math.round(sub + com));
    box.hrs.textContent = hm(b22 + late);
    box.days.textContent = String(wd);
  };

  for (let i = 1; i <= lastDayOf(y, m); i++) {
    const d = (saved?.days || []).find((x) => Number(x.d) === i) || {};
    const wd = new Date(y, m - 1, i).getDay();
    const t = (v) => {
      const n = input({ type: 'time', value: v || '' });
      n.addEventListener('input', recalc);
      n.addEventListener('change', recalc);
      return n;
    };
    const f = { d1s: t(d.d1s), d1e: t(d.d1e), d2s: t(d.d2s), d2e: t(d.d2e), lts: t(d.lts), lte: t(d.lte) };
    const out = { b22: el('td', { class: 'num' }, '—'), late: el('td', { class: 'num' }, '—'), pay: el('td', { class: 'num' }, '') };
    const tr = el('tr', { class: wd === 0 ? 'is-sun' : wd === 6 ? 'is-sat' : '' },
      el('td', { class: 'cen', style: 'width:3rem' }, el('b', {}, String(i))),
      el('td', { class: 'cen', style: 'width:2.6rem' }, WD[wd]),
      el('td', {}, f.d1s), el('td', {}, f.d1e),
      el('td', {}, f.d2s), el('td', {}, f.d2e),
      el('td', {}, f.lts), el('td', {}, f.lte),
      out.b22, out.late, out.pay);
    tbody.append(tr);
    rowsRef.push({
      tr, out,
      read: () => ({
        d: i, d1s: f.d1s.value, d1e: f.d1e.value,
        d2s: f.d2s.value, d2e: f.d2e.value, lts: f.lts.value, lte: f.lte.value,
      }),
    });
  }
  commute.addEventListener('input', recalc);
  recalc();

  const save = async () => {
    const days = rowsRef.map((r) => r.read())
      .filter((d) => d.d1s || d.d1e || d.d2s || d.d2e || d.lts || d.lte);
    await store.save('timesheets', {
      id: sheetId(code, ym), empCode: Number(code), empName: emp.name, ym,
      days, commute: int(commute.value), note: memo.value.trim(),
      rate1: num(emp.rate1), rate2: num(emp.rate2 ?? emp.rate1),
    });
    toast('保存しました');
  };

  const move = async (n) => {
    await save();
    go(`kyuryo/${code}/${addMonths(ym, n)}`);
  };

  const grid = el('div', { class: 'tablewrap' },
    el('table', { class: 't t--tight t--payroll' },
      el('thead', {},
        el('tr', {},
          el('th', { rowspan: 2, class: 'cen' }, '日'),
          el('th', { rowspan: 2, class: 'cen' }, '曜'),
          el('th', { colspan: 2, class: 'cen' }, '1回目（昼）'),
          el('th', { colspan: 2, class: 'cen' }, '2回目（夜）'),
          el('th', { colspan: 2, class: 'cen' }, '22時以降'),
          el('th', { rowspan: 2, class: 'num' }, '22時まで'),
          el('th', { rowspan: 2, class: 'num' }, '22時以降'),
          el('th', { rowspan: 2, class: 'num' }, '日額')),
        el('tr', {},
          el('th', { class: 'cen' }, '始業'), el('th', { class: 'cen' }, '終業'),
          el('th', { class: 'cen' }, '始業'), el('th', { class: 'cen' }, '終業'),
          el('th', { class: 'cen' }, '始業'), el('th', { class: 'cen' }, '終業'))),
      tbody,
      el('tfoot', {}, el('tr', {},
        el('td', { colspan: 8, class: 'num' }, '合計'),
        foot.b22, foot.late, foot.pay))));

  const form = el('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
    card(`${emp.name}　${jMonth(ym)}`, el('div', { class: 'grid grid--2' },
      field('時給①（22時まで）', input({ value: `${yen(emp.rate1)} 円`, readonly: true })),
      field('時給②（22時以降）', input({ value: `${yen(emp.rate2 ?? emp.rate1)} 円`, readonly: true })),
      field('交通費（1か月）', commute, { hint: '毎月同じなら従業員の登録に入れておけます' }),
      field('メモ', memo)), [
      btn('◀ 前の月', () => move(-1), 'btn--ghost btn--sm'),
      btn('次の月 ▶', () => move(1), 'btn--ghost btn--sm'),
      btn('一覧へ戻る', () => go('kyuryo'), 'btn--ghost btn--sm'),
    ]),
    card('出退勤', grid),
    el('div', { class: 'card' }, el('div', { class: 'card__body' },
      el('div', { class: 'kpis', style: 'margin-bottom:1rem' },
        el('div', { class: 'kpi' }, el('div', { class: 'kpi__k' }, '出勤日数'), box.days),
        el('div', { class: 'kpi kpi--kin' }, el('div', { class: 'kpi__k' }, '勤務時間'), box.hrs),
        el('div', { class: 'kpi' }, el('div', { class: 'kpi__k' }, '小計'), box.sub),
        el('div', { class: 'kpi kpi--shu' },
          el('div', { class: 'kpi__k' }, '支給額（交通費こみ）'), box.tot,
          el('div', { class: 'kpi__s' }, '円未満は四捨五入'))),
      el('div', { class: 'btnrow btnrow--end' },
        btn('給与明細を印刷', async () => { await save(); printOne(emp, ym); }, 'btn--ghost'),
        el('button', { type: 'submit', class: 'btn btn--primary', 'data-key': 'save' },
          '保存する', el('kbd', {}, 'F1'))))));

  enterMovesNext(form);
  return form;
}

/* ==================== 明細の印刷 ==================== */
async function printOne(emp, ym) {
  const sheet = await store.get('timesheets', sheetId(emp.code, ym)).catch(() => null);
  openPrint([{ emp, ym, r: calcMonth(sheet, emp, ym) }]);
}
async function printAll() {
  const ym = window.__payroll?.ym || thisMonth();
  const list = store.masters.employees.filter((e) => e.active !== false);
  const sheets = await Promise.all(list.map((e) => store.get('timesheets', sheetId(e.code, ym)).catch(() => null)));
  const pages = list.map((e, i) => ({ emp: e, ym, r: calcMonth(sheets[i], e, ym) }))
    .filter((p) => p.r.total > 0);
  if (!pages.length) { alertBox('この月は、まだ出退勤が入っていません。', '印刷するものがありません'); return; }
  openPrint(pages);
}

function openPrint(pages) {
  const c = store.company || {};
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');

  const body = pages.map(({ emp, ym, r }) => `
<div class="sheet">
  <h1 class="sheet__title">給与明細書</h1>
  <div class="sheet__top">
    <div class="sheet__to">
      <div class="nm">${esc(emp.name)} 様</div>
      <div class="ad">${jMonth(ym)}分　（${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月1日〜${lastDayOf(+ym.slice(0, 4), +ym.slice(5, 7))}日）</div>
    </div>
    <div class="sheet__from">
      <div class="nm">${esc(c.name || '')}</div>
      <div>${esc(c.addr || '')}</div>
      <div>TEL ${esc(c.tel || '')}</div>
    </div>
  </div>
  <div class="sheet__amt"><span>支給額</span><b>￥${yen(Math.round(r.total))}</b></div>
  <table>
    <tr><th style="width:38%">出勤日数</th><td class="n">${r.workDays} 日</td></tr>
    <tr><th>勤務時間（22時まで）</th><td class="n">${hm(r.hoursBefore22)}</td></tr>
    <tr><th>勤務時間（22時以降）</th><td class="n">${hm(r.hoursLate)}</td></tr>
    <tr><th>時給①</th><td class="n">${yen(emp.rate1)} 円</td></tr>
    <tr><th>時給②（22時以降）</th><td class="n">${yen(emp.rate2 ?? emp.rate1)} 円</td></tr>
    <tr><th>時給①ぶん</th><td class="n">${yen(Math.round(r.pay1))} 円</td></tr>
    <tr><th>時給②ぶん</th><td class="n">${yen(Math.round(r.pay2))} 円</td></tr>
    <tr><th>小計</th><td class="n">${yen(Math.round(r.subtotal))} 円</td></tr>
    <tr><th>交通費</th><td class="n">${yen(r.commute)} 円</td></tr>
    <tr><th style="background:#ddd">支給額</th><td class="n"><b>${yen(Math.round(r.total))} 円</b></td></tr>
  </table>
  <h2 style="font-size:13px;margin:14px 0 6px">勤務の内訳</h2>
  <table>
    <thead><tr><th>日</th><th>曜</th><th>1回目</th><th>2回目</th><th>22時以降</th><th>時間</th><th>日額</th></tr></thead>
    <tbody>${r.days.filter((d) => d.calc.total > 0).map((d) => `<tr>
      <td class="n">${d.d}</td><td>${WD[d.wd]}</td>
      <td>${d.d1s ? `${d.d1s}–${d.d1e}` : ''}</td>
      <td>${d.d2s ? `${d.d2s}–${d.d2e}` : ''}</td>
      <td>${d.lts ? `${d.lts}–${d.lte}` : ''}</td>
      <td class="n">${hm(d.calc.before22 + d.calc.late)}</td>
      <td class="n">${yen(Math.round(d.calc.total))}</td></tr>`).join('')}</tbody>
  </table>
</div>`).join('');

  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) { toast('印刷用の画面を開けませんでした（ポップアップを許可してください）', 'err'); return; }
  w.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>給与明細書</title>
<link rel="stylesheet" href="${base}css/app.css"></head><body style="background:#fff">${body}
<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);
  w.document.close();
}

/* ==================== CSV ==================== */
function exportCSV() {
  const { ym, rows } = window.__payroll || {};
  if (!rows?.length) { toast('書き出すものがありません', 'err'); return; }
  const out = [['月', '番号', '名前', '時給①', '時給②', '出勤日数', '22時までの時間', '22時以降の時間',
    '時給①ぶん', '時給②ぶん', '小計', '交通費', '支給額']];
  for (const r of rows) {
    out.push([ym, r.emp.code, r.emp.name, r.emp.rate1, r.emp.rate2 ?? r.emp.rate1,
      r.workDays, r.hoursBefore22.toFixed(2), r.hoursLate.toFixed(2),
      Math.round(r.pay1), Math.round(r.pay2), Math.round(r.subtotal), r.commute, Math.round(r.total)]);
  }
  download(`給料計算_${ym}.csv`, toCSV(out), 'text/csv');
  toast('CSVを書き出しました');
}

function monthOptions() {
  const out = [];
  let ym = addMonths(thisMonth(), 2);
  for (let i = 0; i < 40; i++) { out.push({ value: ym, label: jMonth(ym) }); ym = addMonths(ym, -1); }
  return out;
}
