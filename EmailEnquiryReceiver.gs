/*
SFS BUSINESS MANAGEMENT — EMAIL ENQUIRY RECEIVER  (goes in the ERP Apps Script project)
--------------------------------------------------------------------------------------
Add as a NEW file (File > + > Script, name: EmailEnquiryReceiver), then apply the 3 edits in
"Code.gs-email-edits.txt".

How it works: a small script running inside the enquiries Gmail (EmailReader.gs) sends every new
mail here, protected by a secret key. Each mail becomes one row in the Enquiries sheet
(Source = Email). The same mail can never create two enquiries (Mail ID is checked).

STEP A (once): select  createEmailImportKey  in the function list and press Run.
               Open View > Logs (or Execution log) and COPY the long key. You will paste it into EmailReader.gs.
*/

const EMAIL_KEY_PROP = 'EMAIL_IMPORT_KEY';

function createEmailImportKey() {
  const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(EMAIL_KEY_PROP, key);
  Logger.log('YOUR EMAIL IMPORT KEY (copy it):\n' + key);
  return key;
}

const FREE_MAIL_DOMAINS_ = ['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com','aol.com','msn.com','proton.me','protonmail.com','ymail.com'];
const DOMAIN_TAILS_ = ['com','pk','net','org','co','edu','gov','biz','info','ltd','int'];

/* Pure function (no sheet access): turns a mail into enquiry fields. */
function buildEmailEnquiry_(p, customers) {
  const email = String(p.fromEmail || '').trim().toLowerCase();
  const display = String(p.fromName || '').replace(/["<>]/g, '').trim();
  const subject = String(p.subject || '').replace(/\s+/g, ' ').trim().slice(0, 200);

  // body: drop quoted replies / signatures noise, keep it readable
  let body = String(p.body || '').replace(/\r/g, '');
  const cut = body.search(/^(On .+ wrote:|From:\s.+|-{2,}\s*Original Message\s*-{2,}|_{5,}|>.*)$/m);
  if (cut > 0) body = body.slice(0, cut);
  body = body.replace(/\n{3,}/g, '\n\n').trim().slice(0, 2500);

  // phone number from the mail text (Pakistani formats first)
  let phone = '';
  const m = body.match(/(?:\+?92|0)[\s\-]?\(?\d{2,3}\)?[\s\-]?\d{6,8}/) || body.match(/\+?\d[\d\s\-()]{8,16}\d/);
  if (m) phone = m[0].replace(/\s+/g, ' ').trim();

  // existing customer? (matched by e-mail address)
  const known = (customers || []).find(c =>
    String(c['Email'] || '').toLowerCase().split(/[;,\s]+/).indexOf(email) !== -1);

  let customerName, contact;
  if (known) {
    customerName = known['Customer Name'];
    contact = String(known['Contact Person'] || '').trim() || display;
    if (!phone) phone = String(known['Phone'] || '').trim();
  } else {
    const domain = email.split('@')[1] || '';
    contact = display;
    if (!domain || FREE_MAIL_DOMAINS_.indexOf(domain) !== -1) {
      customerName = display || email.split('@')[0] || 'Unknown sender';
    } else {
      const parts = domain.split('.');
      while (parts.length > 1 && DOMAIN_TAILS_.indexOf(parts[parts.length - 1]) !== -1) parts.pop();
      const company = (parts[parts.length - 1] || domain).replace(/[-_]+/g, ' ');
      customerName = company.charAt(0).toUpperCase() + company.slice(1);
    }
  }
  return {
    email: email, customerName: customerName, contactPerson: contact, phone: phone, subject: subject,
    requirement: body || subject || '(empty mail)'
  };
}


/* ---------- ITEM TABLE PARSER (mail -> list of items) ---------- */

function decodeEntities_(s) {
  const named = {nbsp:' ', amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", frac12:'½', frac14:'¼', frac34:'¾', rdquo:'”', ldquo:'“', rsquo:'’', lsquo:'‘', ndash:'–', mdash:'—', deg:'°'};
  return String(s).replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, function (m, e) {
    if (e.charAt(0) === '#') {
      const n = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isNaN(n) ? m : String.fromCodePoint(n);
    }
    const v = named[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

function cellText_(h) {
  return decodeEntities_(String(h).replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|div)>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function tableRowsFromHtml_(html) {
  const clean = String(html || '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, '');
  const rows = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trRe.exec(clean))) {
    const cells = [], tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c;
    while ((c = tdRe.exec(m[0]))) cells.push(cellText_(c[1]));
    if (cells.filter(x => x !== '').length >= 3) rows.push(cells);
  }
  return rows;
}

function tableRowsFromText_(text) {
  const rows = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const cells = line.trim().split(/\t+| {2,}/).map(x => x.trim()).filter(x => x !== '');
    if (cells.length >= 3) rows.push(cells);
  });
  return rows;
}

function normUnit_(u) {
  const t = String(u || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
}

function itemsFromRows_(rows) {
  const qtyNum = v => { const t = String(v == null ? '' : v).replace(/,/g, '').trim(); return /^\d+(?:\.\d+)?$/.test(t) && Number(t) > 0 ? Number(t) : 0; };
  const items = [];
  let ref = '', hi = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.some(c => /desc|particular|material|product|item name/i.test(c)) && r.some(c => /qty|quantity/i.test(c))) { hi = i; break; }
  }
  if (hi >= 0) {
    const H = rows[hi];
    const idx = re => H.findIndex(c => re.test(c));
    const di = idx(/desc|particular|material|product|item name/i), qi = idx(/qty|quantity/i), ui = idx(/uom|\bunit\b/i);
    const si = idx(/^(s\.?\s*no\.?|sr\.?(\s*no\.?)?|#|sn|serial.*)$/i);
    const ri = idx(/^p\.?\s*r\b|p\.?\s*r\.?\s*no|rfq|indent|requisition|\bref/i);
    rows.slice(hi + 1).forEach(r => {
      const desc = String(r[di] || '').trim(), q = qtyNum(r[qi]);
      if (!desc || !q) return;
      const notes = [];
      H.forEach((h, k) => {
        if ([di, qi, ui, si].indexOf(k) !== -1) return;
        const v = String(r[k] || '').trim();
        if (v && h) notes.push(h + ': ' + v);
      });
      if (!ref && ri >= 0 && r[ri]) ref = String(r[ri]).trim();
      items.push({sn: si >= 0 ? String(r[si] || '').trim() : String(items.length + 1), desc: desc, qty: q, unit: ui >= 0 ? normUnit_(r[ui]) : '', note: notes.join(' | ')});
    });
  }
  if (!items.length) {   // no recognisable header: guess "serial ... description ... UOM qty"
    rows.forEach(r => {
      if (r.length < 4 || !/^\d{1,3}$/.test(r[0]) || !qtyNum(r[r.length - 1]) || !/^[A-Za-z.]{2,8}$/.test(r[r.length - 2])) return;
      const mid = r.slice(1, r.length - 2);
      if (!mid.length) return;
      let longest = 0;
      mid.forEach((c, k) => { if (c.length > mid[longest].length) longest = k; });
      items.push({sn: r[0], desc: mid[longest], qty: qtyNum(r[r.length - 1]), unit: normUnit_(r[r.length - 2]), note: mid.filter((c, k) => k !== longest).join(' | ')});
    });
  }
  return {items: items.slice(0, 100), ref: ref};
}

function parseEmailItems_(html, text) {
  let res = {items: [], ref: ''};
  if (html && /<tr[\s>]/i.test(html)) res = itemsFromRows_(tableRowsFromHtml_(html));
  if (!res.items.length) res = itemsFromRows_(tableRowsFromText_(text));
  return res;
}

function parseItemsJson_(v) {
  try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

/* Called from doPost with action "emailEnquiry" (no login session — protected by the secret key). */
function emailEnquiry_(p) {
  const key = PropertiesService.getScriptProperties().getProperty(EMAIL_KEY_PROP);
  if (!key || String(p.key || '') !== key) return {ok: false, error: 'Unauthorized'};
  const mailId = String(p.mailId || '').trim();
  if (!mailId || !String(p.fromEmail || '').trim()) return {ok: false, error: 'mailId and fromEmail are required.'};

  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return {ok: false, error: 'System busy. Please try again.'}; }
  try {
    ensureSheet('Enquiries', HEADERS.Enquiries);
    if (objectsFromSheet_('Enquiries').some(r => String(r['Mail ID'] || '').trim() === mailId)) {
      return {ok: true, duplicate: true};
    }
    const f = buildEmailEnquiry_(p, objectsFromSheet_('Customers'));
    const parsed = parseEmailItems_(p.html, p.body);
    let when = new Date(String(p.date || ''));
    if (isNaN(when)) when = new Date();
    const id = nextSafeId_('ENQ-', 'Enquiries', 1);
    appendByHeaders_('Enquiries', [{
      'Enquiry ID': id, 'Date': when, 'Customer Name': f.customerName, 'Contact Person': f.contactPerson, 'Phone': f.phone,
      'Requirement': f.requirement, 'Status': 'New', 'Quotation No.': '', 'Loss Reason': '', 'Created By': 'Email',
      'Email': f.email, 'Subject': f.subject, 'Source': 'Email', 'Mail ID': mailId,
      'Items': parsed.items.length ? JSON.stringify(parsed.items).slice(0, 45000) : '', 'Customer Ref': parsed.ref
    }]);
    try { SpreadsheetApp.getActive().getSheetByName('Audit Log').appendRow([new Date(), 'Email', 'emailEnquiry', 'id=' + id + '; from=' + f.email + '; items=' + parsed.items.length]); } catch (ignore) {}
    return {ok: true, id: id};
  } finally {
    lock.releaseLock();
  }
}
