// データの保管庫。
//   cloud … Firebase Firestore（複数のパソコンで同じデータ／自動でクラウド保存）
//   local … このパソコンの中だけ（Firebaseを設定する前でも一通り触れる）
// 画面側は store.list / store.save / store.remove だけ見ればよい。

import { uid, today, billingPeriod, addMonths } from './util.js';

const FBVER = '10.12.2';                       // Firebase SDK の版。上げるならここだけ。
const FB = `https://www.gstatic.com/firebasejs/${FBVER}/`;
const CFG_KEY = 'umeno.firebase.config';

/** 伝票・マスタのコレクション一覧（バックアップもこの順で回す） */
export const COLLECTIONS = [
  'customers', 'products', 'productCats', 'suppliers', 'cashPartners', 'employees',
  'sales', 'receipts', 'purchases', 'payments', 'cashbook', 'invoices', 'timesheets',
];
/** 日付で範囲検索する（＝伝票系）コレクション */
export const DATED = new Set(['sales', 'receipts', 'purchases', 'payments', 'cashbook']);

export const store = {
  mode: 'local',
  user: null,
  company: null,
  codeLists: { units: [], areas: [], custTypes: [], cashNotes: [], receiptNotes: [] },
  masters: { customers: [], products: [], productCats: [], suppliers: [], cashPartners: [], employees: [] },
  _fb: null,
  _idb: null,
  _listeners: new Set(),

  /* ============ 設定 ============ */
  get config() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; }
  },
  set config(v) {
    if (v) localStorage.setItem(CFG_KEY, JSON.stringify(v));
    else localStorage.removeItem(CFG_KEY);
  },

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  _emit() { for (const f of this._listeners) { try { f(); } catch (e) { console.error(e); } } },

  /* ============ 起動 ============ */
  async init() {
    const cfg = this.config;
    if (cfg && cfg.apiKey && cfg.projectId) {
      await this._initCloud(cfg);
      this.mode = 'cloud';
    } else {
      await this._initLocal();
      this.mode = 'local';
    }
  },

  async _initCloud(cfg) {
    const [appM, fsM, auM] = await Promise.all([
      import(FB + 'firebase-app.js'),
      import(FB + 'firebase-firestore.js'),
      import(FB + 'firebase-auth.js'),
    ]);
    const app = appM.initializeApp(cfg);
    let db;
    try {
      db = fsM.initializeFirestore(app, {
        localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
      });
    } catch {
      db = fsM.getFirestore(app);            // 既に初期化済み等
    }
    this._fb = { app, db, fs: fsM, auth: auM.getAuth(app), au: auM };
  },

  async _initLocal() {
    this._idb = await openIDB();
  },

  /* ============ ログイン ============ */
  async signIn(email, pass) {
    const { au, auth } = this._fb;
    const cr = await au.signInWithEmailAndPassword(auth, email, pass);
    this.user = { email: cr.user.email, uid: cr.user.uid };
    return this.user;
  },
  async signOut() {
    if (this._fb) await this._fb.au.signOut(this._fb.auth);
    this.user = null;
  },
  watchAuth(cb) {
    if (!this._fb) { cb(null); return () => {}; }
    return this._fb.au.onAuthStateChanged(this._fb.auth, (u) => {
      this.user = u ? { email: u.email, uid: u.uid } : null;
      cb(this.user);
    });
  },

  /* ============ 読み込み ============
     opt: { from, to, field, eq, order, limit }
  */
  async list(coll, opt = {}) {
    if (this.mode === 'cloud') return this._listCloud(coll, opt);
    return this._listLocal(coll, opt);
  },

  async _listCloud(coll, opt) {
    const { fs, db } = this._fb;
    const cons = [];
    if (opt.eq) for (const [k, v] of Object.entries(opt.eq)) cons.push(fs.where(k, '==', v));
    const df = opt.field || 'date';
    if (opt.from) cons.push(fs.where(df, '>=', opt.from));
    if (opt.to) cons.push(fs.where(df, '<=', opt.to));
    if (opt.from || opt.to) cons.push(fs.orderBy(df, opt.order === 'desc' ? 'desc' : 'asc'));
    else if (opt.order) cons.push(fs.orderBy(df, opt.order === 'desc' ? 'desc' : 'asc'));
    if (opt.limit) cons.push(fs.limit(opt.limit));
    const snap = await fs.getDocs(fs.query(fs.collection(db, coll), ...cons));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  },

  async _listLocal(coll, opt) {
    let rows = await idbAll(this._idb, coll);
    const df = opt.field || 'date';
    if (opt.eq) rows = rows.filter((r) => Object.entries(opt.eq).every(([k, v]) => r[k] === v));
    if (opt.from) rows = rows.filter((r) => (r[df] ?? '') >= opt.from);
    if (opt.to) rows = rows.filter((r) => (r[df] ?? '') <= opt.to);
    rows.sort((a, b) => String(a[df] ?? '').localeCompare(String(b[df] ?? '')) || (a.no ?? 0) - (b.no ?? 0));
    if (opt.order === 'desc') rows.reverse();
    if (opt.limit) rows = rows.slice(0, opt.limit);
    return rows;
  },

  /** 中身を丸ごと。日付を持たない台帳もそのまま取れる（バックアップ用） */
  async all(coll) {
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      const snap = await fs.getDocs(fs.collection(db, coll));
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    }
    return idbAll(this._idb, coll);
  },

  async get(coll, id) {
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      const s = await fs.getDoc(fs.doc(db, coll, String(id)));
      return s.exists() ? { ...s.data(), id: s.id } : null;
    }
    return idbGet(this._idb, coll, String(id));
  },

  /* ============ 書き込み ============ */
  async save(coll, doc) {
    const id = String(doc.id || uid());
    const body = { ...doc, id, updatedAt: new Date().toISOString(), updatedBy: this.user?.email || 'local' };
    if (!body.createdAt) body.createdAt = body.updatedAt;
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      await fs.setDoc(fs.doc(db, coll, id), body, { merge: false });
    } else {
      await idbPut(this._idb, coll, body);
    }
    if (this.masters[coll]) await this.loadMasters();
    this._emit();
    return body;
  },

  async remove(coll, id) {
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      await fs.deleteDoc(fs.doc(db, coll, String(id)));
    } else {
      await idbDel(this._idb, coll, String(id));
    }
    if (this.masters[coll]) await this.loadMasters();
    this._emit();
  },

  /** まとめ書き（移行・復元用）。onProgress(done, total) */
  async bulk(coll, rows, onProgress) {
    // id が無い行は「番号」から作る。それも無ければ止めて理由を伝える。
    const docs = rows.map((r, i) => {
      const id = r.id ?? (r.code !== undefined && r.code !== null ? String(r.code) : null);
      if (id === null || id === '') {
        throw new Error(`${coll} の ${i + 1}行目に id も 番号 もありません`);
      }
      return { ...r, id: String(id) };
    });
    const total = docs.length;
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      const SIZE = 400;
      for (let i = 0; i < total; i += SIZE) {
        const batch = fs.writeBatch(db);
        for (const d of docs.slice(i, i + SIZE)) {
          batch.set(fs.doc(db, coll, String(d.id)), d, { merge: false });
        }
        await batch.commit();
        onProgress?.(Math.min(i + SIZE, total), total);
      }
    } else {
      await idbBulk(this._idb, coll, docs);
      onProgress?.(total, total);
    }
    if (this.masters[coll]) await this.loadMasters();
    this._emit();
  },

  async clearCollection(coll) {
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      for (;;) {
        const snap = await fs.getDocs(fs.query(fs.collection(db, coll), fs.limit(400)));
        if (snap.empty) break;
        const batch = fs.writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        if (snap.size < 400) break;
      }
    } else {
      await idbClear(this._idb, coll);
    }
  },

  /* ============ 伝票番号 ============ */
  async nextNo(kind) {
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      const ref = fs.doc(db, 'meta', 'counters');
      return fs.runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        const c = s.exists() ? s.data() : {};
        const n = (Number(c[kind]) || 0) + 1;
        tx.set(ref, { ...c, [kind]: n }, { merge: true });
        return n;
      });
    }
    const c = (await idbGet(this._idb, 'meta', 'counters')) || { id: 'counters' };
    const n = (Number(c[kind]) || 0) + 1;
    await idbPut(this._idb, 'meta', { ...c, id: 'counters', [kind]: n });
    return n;
  },
  async setCounters(obj) {
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      await fs.setDoc(fs.doc(db, 'meta', 'counters'), obj, { merge: true });
    } else {
      const c = (await idbGet(this._idb, 'meta', 'counters')) || {};
      await idbPut(this._idb, 'meta', { ...c, ...obj, id: 'counters' });
    }
  },

  /* ============ 自社情報・区分表 ============ */
  async loadCompany() {
    const d = (await this.getMeta('company')) || {};
    this.company = {
      name: '梅乃寿司', zip: '', pref: '', addr: '', tel: '', fax: '', owner: '',
      banks: [], taxId: '', taxRate: 10, closeDay: 23, closingMonth: 3, printRows: 16,
      invoiceNote: '', migrationFrom: '1900-01-01', ...d,
    };
    this.codeLists = { units: [], areas: [], custTypes: [], cashNotes: [], receiptNotes: [], ...(await this.getMeta('codeLists') || {}) };
    return this.company;
  },
  async saveCompany(c) {
    await this.setMeta('company', c);
    this.company = { ...this.company, ...c };
    this._emit();
  },
  async getMeta(id) {
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      const s = await fs.getDoc(fs.doc(db, 'meta', id));
      return s.exists() ? s.data() : null;
    }
    return idbGet(this._idb, 'meta', id);
  },
  async setMeta(id, data) {
    const body = { ...data, id };
    if (this.mode === 'cloud') {
      const { fs, db } = this._fb;
      await fs.setDoc(fs.doc(db, 'meta', id), body, { merge: true });
    } else {
      await idbPut(this._idb, 'meta', body);
    }
  },

  /* ============ マスタ（小さいので丸ごと持つ） ============ */
  async loadMasters() {
    const names = Object.keys(this.masters);
    const got = await Promise.all(names.map((n) => this.all(n).catch(() => [])));
    names.forEach((n, i) => {
      this.masters[n] = got[i].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    });
    return this.masters;
  },
  customer(code) { return this.masters.customers.find((c) => Number(c.code) === Number(code)) || null; },
  product(code) { return this.masters.products.find((p) => Number(p.code) === Number(code)) || null; },
  supplier(code) { return this.masters.suppliers.find((s) => Number(s.code) === Number(code)) || null; },
  catName(code) { return this.masters.productCats.find((c) => Number(c.code) === Number(code))?.name || ''; },

  /** 得意先の締日（無ければ自社の締日） */
  closeDayOf(code) {
    return Number(this.customer(code)?.closeDay) || Number(this.company?.closeDay) || 23;
  },
};

/* ================= IndexedDB（localモード） ================= */
const IDB_NAME = 'umeno-hanbai';
const IDB_VER = 1;
const IDB_STORES = [...COLLECTIONS, 'meta'];

function openIDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(IDB_NAME, IDB_VER);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      for (const s of IDB_STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
const tx = (db, store, mode) => db.transaction(store, mode).objectStore(store);
const wrap = (rq) => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
const idbAll = (db, s) => wrap(tx(db, s, 'readonly').getAll());
const idbGet = (db, s, id) => wrap(tx(db, s, 'readonly').get(String(id)));
const idbPut = (db, s, v) => wrap(tx(db, s, 'readwrite').put(v));
const idbDel = (db, s, id) => wrap(tx(db, s, 'readwrite').delete(String(id)));
const idbClear = (db, s) => wrap(tx(db, s, 'readwrite').clear());
function idbBulk(db, s, docs) {
  return new Promise((res, rej) => {
    const t = db.transaction(s, 'readwrite');
    const os = t.objectStore(s);
    for (const d of docs) os.put(d);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

/* ================= 業務ロジック ================= */

/**
 * 売掛残高。
 *   移行時残高（openingBalance＝openingDate の前日時点）＋ それ以降の掛売 − 入金
 * openingDate より前の伝票は、すでに openingBalance に含まれているので数えない。
 */
export async function arBalance(customerCode, asOf = today()) {
  const c = store.customer(customerCode);
  if (!c) return 0;
  const from = openingDateOf(c);
  if (asOf < from) return Number(c.openingBalance) || 0;
  const [sales, recs] = await Promise.all([
    store.list('sales', { eq: { customerCode: Number(customerCode) }, from, to: asOf }),
    store.list('receipts', { eq: { customerCode: Number(customerCode) }, from, to: asOf }),
  ]);
  return (Number(c.openingBalance) || 0)
    + sales.filter((x) => !x.void && Number(x.kind) === 1).reduce((a, x) => a + num0(x.subtotal) + num0(x.tax), 0)
    - recs.filter((x) => !x.void).reduce((a, x) => a + num0(x.total), 0);
}

/** 買掛残高（仕入 − 支払）。使い方は arBalance と同じ。 */
export async function apBalance(supplierCode, asOf = today()) {
  const s = store.supplier(supplierCode);
  if (!s) return 0;
  const from = openingDateOf(s);
  if (asOf < from) return Number(s.openingBalance) || 0;
  const [pur, pay] = await Promise.all([
    store.list('purchases', { eq: { supplierCode: Number(supplierCode) }, from, to: asOf }),
    store.list('payments', { eq: { supplierCode: Number(supplierCode) }, from, to: asOf }),
  ]);
  return (Number(s.openingBalance) || 0)
    + pur.filter((x) => !x.void).reduce((a, x) => a + num0(x.subtotal) + num0(x.tax), 0)
    - pay.filter((x) => !x.void).reduce((a, x) => a + num0(x.total), 0);
}

/** 移行の起点日。Access から引き継いだ残高は、この日の前日時点のもの。 */
export function openingDateOf(row) {
  return row?.openingDate || store.company?.migrationFrom || '1900-01-01';
}
const num0 = (v) => Number(v) || 0;
export const prevDay = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const invoiceId = (code, ym) => `${Number(code)}_${String(ym).replace('-', '')}`;

/**
 * 一ヶ月分の請求内容を組み立てる（保存はしない）。
 * 繰越 − 入金 − 入金値引 ＋ 当月売上 ＋ 消費税 − 値引 ＝ 今回請求額
 * 繰越は「前月に確定した請求額」。前月が無ければ Access から引き継いだ移行時残高。
 */
export async function buildInvoice(customerCode, ym) {
  const code = Number(customerCode);
  const c = store.customer(code);
  if (!c) throw new Error('得意先が見つかりません');
  const closeDay = store.closeDayOf(code);
  const { from, to } = billingPeriod(ym, closeDay);

  // 繰越は必ず伝票から積み直す。「確定」を押し忘れても金額がずれない。
  const [existing, prevInv, carry, sales, recs] = await Promise.all([
    store.get('invoices', invoiceId(code, ym)),
    store.get('invoices', invoiceId(code, addMonths(ym, -1))),
    arBalance(code, prevDay(from)),
    store.list('sales', { eq: { customerCode: code }, from, to }),
    store.list('receipts', { eq: { customerCode: code }, from, to }),
  ]);

  const live = sales.filter((x) => !x.void && Number(x.kind) === 1);
  const lrec = recs.filter((x) => !x.void);
  const salesAmt = live.reduce((a, x) => a + (Number(x.subtotal) || 0), 0);
  const taxAmt = live.reduce((a, x) => a + (Number(x.tax) || 0), 0);
  const receipt = lrec.reduce((a, x) => a + (Number(x.cash) || 0) + (Number(x.transfer) || 0) + (Number(x.bill) || 0) + (Number(x.offset) || 0), 0);
  const recDisc = lrec.reduce((a, x) => a + (Number(x.discount) || 0), 0);
  const discount = Number(existing?.discount) || 0;
  const billed = carry - receipt - recDisc + salesAmt + taxAmt - discount;

  return {
    id: invoiceId(code, ym),
    customerCode: code, customerName: c.name, ym,
    year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)),
    from, to, closeDay, carry, receipt, receiptDiscount: recDisc,
    sales: salesAmt, tax: taxAmt, discount, billed,
    lines: live, receiptRows: lrec, prev: prevInv || null, existing: existing || null,
  };
}
