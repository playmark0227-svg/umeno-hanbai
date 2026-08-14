// お試し用のサンプルデータ。
// 得意先名・住所・電話・金額はすべて架空。実在の店・人とは関係ありません。
// 本番のデータには一切触れません（読み込む前に必ず確認画面が出ます）。

const CUSTOMERS = [
  ['アオイ商事株式会社', 'ｱｵｲｼｮｳｼﾞ', 2, '函館市本町1-2-3', '0138-00-0001', 23],
  ['さくら内科クリニック', 'ｻｸﾗﾅｲｶｸﾘﾆｯｸ', 2, '函館市美原2-4-5', '0138-00-0002', 23],
  ['まつかぜ建設株式会社', 'ﾏﾂｶｾﾞｹﾝｾﾂ', 2, '函館市昭和3-1-8', '0138-00-0003', 23],
  ['ひまわり保育園', 'ﾋﾏﾜﾘﾎｲｸｴﾝ', 2, '函館市石川町7-2', '0138-00-0004', 20],
  ['株式会社みなと運輸', 'ﾐﾅﾄｳﾝﾕ', 2, '函館市港町4-6-1', '0138-00-0005', 23],
  ['やまびこ電機工業', 'ﾔﾏﾋﾞｺﾃﾞﾝｷ', 2, '函館市桔梗5-3-2', '0138-00-0006', 23],
  ['株式会社ふじや商店', 'ﾌｼﾞﾔｼｮｳﾃﾝ', 2, '函館市松風町2-9', '0138-00-0007', 23],
  ['あさひ設備サービス', 'ｱｻﾋｾﾂﾋﾞ', 2, '函館市亀田町6-4', '0138-00-0008', 23],
  ['こまち総合病院', 'ｺﾏﾁｿｳｺﾞｳﾋﾞｮｳｲﾝ', 2, '函館市中道1-1-1', '0138-00-0009', 23],
  ['株式会社きたかぜ水産', 'ｷﾀｶｾﾞｽｲｻﾝ', 2, '函館市大手町8-3', '0138-00-0010', 23],
  ['みどり自動車販売', 'ﾐﾄﾞﾘｼﾞﾄﾞｳｼｬ', 2, '函館市西桔梗9-7', '0138-00-0011', 23],
  ['しおかぜホテル', 'ｼｵｶｾﾞﾎﾃﾙ', 2, '函館市湯川町3-5-2', '0138-00-0012', 23],
  ['株式会社もみじ印刷', 'ﾓﾐｼﾞｲﾝｻﾂ', 2, '函館市高盛町4-1', '0138-00-0013', 25],
  ['つばき法律事務所', 'ﾂﾊﾞｷﾎｳﾘﾂ', 2, '函館市五稜郭町2-2', '0138-00-0014', 23],
  ['のぞみ興業株式会社', 'ﾉｿﾞﾐｺｳｷﾞｮｳ', 2, '函館市赤川町7-8', '0138-00-0015', 23],
  ['田中　一郎', 'ﾀﾅｶｲﾁﾛｳ', 1, '函館市柏木町1-1', '0138-00-0016', 23],
  ['佐藤　花子', 'ｻﾄｳﾊﾅｺ', 1, '函館市深堀町2-2', '0138-00-0017', 23],
  ['鈴木　次郎', 'ｽｽﾞｷｼﾞﾛｳ', 1, '函館市杉並町3-3', '0138-00-0018', 23],
];

const PRODUCTS = [
  [1, 1, 'お寿司', 'ｽｼ', '', 0],
  [2, 1, 'お刺身', 'ｻｼﾐ', '人前', 0],
  [3, 1, 'お寿司　お刺身　お飲物', '', '件', 0],
  [5, 1, 'お寿司　お刺身　お料理', '', '件', 0],
  [10, 1, '食事代', 'ｼｮｸｼﾞﾀﾞｲ', '', 0],
  [12, 1, '出前　お寿司(松)', '', '人前', 900],
  [13, 1, '出前　お寿司(竹)', '', '人前', 1000],
  [14, 1, '出前　お寿司(梅)', '', '人前', 1200],
  [15, 1, '出前　お寿司(桜)', '', '人前', 1800],
  [18, 1, '折詰', 'ｵﾘﾂﾞﾒ', '', 0],
  [111, 101, '生ビール(中)', 'ﾋﾞｰﾙ', '', 500],
  [112, 101, '生ビール(小)', '', '', 300],
  [113, 101, 'お酒(一合)', '', '合', 400],
  [115, 101, '冷酒', 'ﾚｲｼｭ', '', 0],
  [151, 102, 'ジュース', 'ｼﾞｭｰｽ', '本', 200],
  [152, 102, 'ウーロン茶', 'ｳｰﾛﾝﾁｬ', '本', 200],
  [211, 21, '宴会料理(3千円)', '', '人前', 3000],
  [213, 21, '宴会料理(5千円)', '', '人前', 5000],
  [221, 22, '法事膳(5千円)', '', '人前', 5000],
  [222, 22, '法事膳(6千円)', '', '人前', 6000],
];

const CATS = [[1, '寿司'], [21, '宴会'], [22, '法事'], [99, 'その他'], [101, '飲物(ﾋﾞｰﾙ・酒等)'], [102, '飲物(ｼﾞｭｰｽ等)']];
const NOTES = ['三回忌', '七回忌', '一周忌', '新年会', '歓送迎会', 'ご法事', '会合', '打合せ', '祝賀会', ''];

/* 同じ画面を何度開いても同じ数字が出るように、乱数は種から作る */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * 直近15か月ぶんの伝票をこしらえる。
 * 締日は23日なので、起点日（今月の締め期間の初日）より前は「移行時残高」に丸める。
 */
export function buildDemoData(todayIso) {
  const R = rng(20260814);
  const today = new Date(`${todayIso}T00:00:00`);
  const start = new Date(today); start.setMonth(start.getMonth() - 15); start.setDate(1);

  // 起点日＝今月の締め期間の初日（締日23日）
  const closeDay = 23;
  const openBase = new Date(today.getFullYear(), today.getMonth(), 1);
  if (today.getDate() > closeDay) openBase.setMonth(openBase.getMonth() + 1);
  const openStart = new Date(openBase.getFullYear(), openBase.getMonth() - 1, closeDay + 1);
  const migrationFrom = iso(openStart);

  const customers = CUSTOMERS.map(([name, kana, hon, addr, tel, cd], i) => ({
    id: String(i + 1), code: i + 1, billTo: i + 1, name, kana, honorific: hon,
    type: hon === 1 ? 0 : 1, dept: '', person: '', zip: '0400000', addr, tel, fax: '',
    closeDay: cd, payMonth: 1, payDay: 20, taxType: 2, taxRound: 1,
    bank: '', msg: '', openingBalance: 0, openingDate: migrationFrom, active: true,
  }));
  customers.unshift({
    id: '0', code: 0, billTo: 0, name: '現金', kana: 'ｹﾞﾝｷﾝ', honorific: 2, type: 0,
    dept: '', person: '', zip: '', addr: '', tel: '', fax: '', closeDay: 23,
    payMonth: 1, payDay: 20, taxType: 2, taxRound: 1, bank: '', msg: '',
    openingBalance: 0, openingDate: migrationFrom, active: true,
  });

  const products = PRODUCTS.map(([code, cat, name, kana, unit, price]) => ({
    id: String(code), code, cat, name, kana, unit, price, cost: 0, active: true,
  }));
  const productCats = CATS.map(([code, name]) => ({ id: String(code), code, name }));

  const sales = []; const receipts = [];
  let no = 10000; let rno = 5000;
  const credit = customers.filter((c) => c.code !== 0);
  const owed = new Map(credit.map((c) => [c.code, 0]));

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const busy = dow === 5 || dow === 6 ? 1 : 0;
    const n = Math.floor(R() * (2 + busy * 2)) + (busy ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const isCash = R() < 0.62;
      const cust = isCash ? customers[0] : credit[Math.floor(R() * credit.length)];
      const lines = [];
      const kinds = Math.random === null ? 1 : (R() < 0.45 ? 2 : 1);
      for (let j = 0; j < kinds; j++) {
        const p = products[Math.floor(R() * products.length)];
        if (p.price) {
          const qty = Math.floor(R() * 14) + 2;
          lines.push({ code: p.code, name: p.name, qty, unit: p.unit, price: p.price, amount: qty * p.price, tax: 0 });
        } else {
          const amount = (Math.floor(R() * 45) + 5) * 1000 + Math.floor(R() * 10) * 100;
          const qty = R() < 0.5 ? Math.floor(R() * 8) + 1 : 0;
          lines.push({ code: p.code, name: p.name, qty, unit: qty ? (p.unit || '件') : '', price: 0, amount, tax: 0 });
        }
      }
      const subtotal = lines.reduce((a, l) => a + l.amount, 0);
      const tax = Math.round(subtotal * 0.1);
      const date = iso(d);
      sales.push({
        id: `S${String(++no).padStart(7, '0')}`, no, date, ym: date.slice(0, 7),
        customerCode: cust.code, customerName: cust.name,
        kind: isCash ? 0 : 1, custType: cust.type,
        subtotal, tax, total: subtotal + tax,
        note: NOTES[Math.floor(R() * NOTES.length)], note2: '',
        memorial: 0, groups: Math.floor(R() * 3) + 1, lines, src: 'demo',
      });
      if (!isCash) owed.set(cust.code, owed.get(cust.code) + subtotal + tax);
    }

    // 月に一度くらい、掛の得意先から入金がある
    if (d.getDate() === 28) {
      for (const c of credit) {
        const bal = owed.get(c.code);
        if (bal > 0 && R() < 0.72) {
          const amt = Math.round(bal);
          const date = iso(d);
          receipts.push({
            id: `R${String(++rno).padStart(7, '0')}`, no: rno, date, ym: date.slice(0, 7),
            customerCode: c.code, customerName: c.name,
            cash: 0, transfer: amt, bill: 0, offset: 0, discount: 0, total: amt,
            bank: ['北洋銀行', 'みずほ銀行', '道南うみ街信金'][Math.floor(R() * 3)],
            fee: 0, note: '', src: 'demo',
          });
          owed.set(c.code, 0);
        }
      }
    }
  }

  // 起点日より前のぶんは「Accessから引き継いだ残高」に丸めて、伝票は捨てる
  const keep = (r) => r.date >= migrationFrom;
  const oldSales = sales.filter((s) => !keep(s) && s.kind === 1);
  const oldRecs = receipts.filter((r) => !keep(r));
  for (const c of customers) {
    if (!c.code) continue;
    const s = oldSales.filter((x) => x.customerCode === c.code).reduce((a, x) => a + x.total, 0);
    const r = oldRecs.filter((x) => x.customerCode === c.code).reduce((a, x) => a + x.total, 0);
    c.openingBalance = s - r;
  }

  const cashbook = sales.filter(keep).filter((s) => s.kind === 0).map((s, i) => ({
    id: `C${String(i + 1).padStart(7, '0')}`, no: i + 1, date: s.date, ym: s.ym,
    dc: 0, amount: s.total, taxRate: 10, tax: s.tax, net: s.subtotal,
    party: '現金', note: '現金売上', link: 0, src: 'demo',
  }));

  return {
    company: {
      id: 'company', name: '梅乃寿司（サンプル）', zip: '0400000', pref: '北海道',
      addr: '函館市○○町1-2-3', tel: '0138-00-0000', fax: '0138-00-0000',
      owner: '見本　太郎', banks: ['○○銀行　△△支店(普)0000000'],
      taxId: 'T0000000000000', taxRate: 10, closeDay: 23, closingMonth: 3,
      printRows: 16, invoiceNote: 'これはサンプルです。実在の取引ではありません。',
      migrationFrom, demo: true,
    },
    codeLists: {
      id: 'codeLists',
      units: ['皿', '人前', 'kg', 'g', '本', '合', '件'],
      areas: [], custTypes: [],
      cashNotes: ['現金売上', '仕入代', '水道光熱費', '給料', '家賃'],
      receiptNotes: ['売掛金', '売上金'],
    },
    counters: { id: 'counters', sales: no, receipt: rno, purchase: 0, payment: 0, cash: cashbook.length },
    customers,
    products,
    productCats,
    suppliers: [],
    cashPartners: [{ id: '1', code: 1, name: '現金', kana: 'ｹﾞﾝｷﾝ', type: 1 }],
    sales: sales.filter(keep),
    receipts: receipts.filter(keep),
    purchases: [],
    payments: [],
    cashbook,
    invoices: [],
  };
}
