/*
SFS ENQUIRY MAILBOX READER  —  paste this into the Apps Script project of the ENQUIRIES GMAIL
(sfs.enquiries2k26@gmail.com): open script.google.com while logged in to THAT Gmail > New project.
It reads new mails in the Inbox and sends each one to the ERP, where it becomes an Enquiry.

SETUP (once):
 1. Fill in ERP_URL and ERP_KEY below.
 2. Select  importEmails  in the function list > Run > Allow the permissions (Gmail + external request).
 3. Select  setupEmailTrigger  > Run   (it then checks the inbox every 5 minutes by itself).
*/

const ERP_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';   // same URL as in config.js (ends with /exec)
const ERP_KEY = 'PASTE_THE_KEY_FROM_createEmailImportKey_HERE';

const DONE_LABEL = 'ERP-Imported';     // mails already sent to the ERP
const SKIP_LABEL = 'ERP-Skipped';      // automatic mails that were ignored
const SEARCH_WINDOW = 'newer_than:7d'; // only look at mails of the last 7 days (change to 30d for the first run if you wish)
const MAX_PER_RUN = 5;          // fewer per run because each mail may be read by the AI (PDF / photo)

/* Attachments sent to the ERP so the AI can read them */
const MAX_ATTACHMENTS = 4;                 // per mail
const MAX_PDF_BYTES   = 10 * 1024 * 1024;  // a PDF bigger than this is not sent
const MAX_IMG_BYTES   = 4 * 1024 * 1024;   // a photo bigger than this is not sent
const MIN_IMG_BYTES   = 20 * 1024;         // smaller images are signature logos / icons -> ignored
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;  // all attachments of one mail together

/* Automatic / system senders that must never become enquiries */
const SKIP_SENDERS = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|notifications?@|newsletter|@accounts\.google\.com|@google\.com)/i;

/* OPTIONAL filter: leave empty [] to import every mail. Example: ['quotation','price','enquiry','inquiry','rate'] */
const KEYWORDS = [];

/* PDFs and photos/screenshots are sent to the ERP; other files (Word, Excel...) are only listed by name */
function collectAttachments_(msg) {
  const out = [], other = [];
  let total = 0;
  msg.getAttachments({includeInlineImages: true, includeAttachments: true}).forEach(a => {
    const type = String(a.getContentType() || '').toLowerCase().split(';')[0].trim();
    const size = a.getSize();
    const isPdf = type === 'application/pdf';
    const isImg = /^image\/(jpeg|jpg|png|gif|webp)$/.test(type);
    if (!isPdf && !isImg) { if (!/^image\//.test(type) && !/^text\/calendar/.test(type) && a.getName()) other.push(a.getName()); return; }
    if (isImg && size < MIN_IMG_BYTES) return;
    if (isImg && size > MAX_IMG_BYTES) { other.push(a.getName() + ' (too large)'); return; }
    if (isPdf && size > MAX_PDF_BYTES) { other.push(a.getName() + ' (too large)'); return; }
    if (out.length >= MAX_ATTACHMENTS || total + size > MAX_TOTAL_BYTES) { other.push(a.getName() + ' (not sent)'); return; }
    out.push({name: a.getName() || (isPdf ? 'file.pdf' : 'image'), type: type === 'image/jpg' ? 'image/jpeg' : type, data: Utilities.base64Encode(a.getBytes())});
    total += size;
  });
  return {files: out, other: other};
}

function importEmails() {
  const doneLabel = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  const skipLabel = GmailApp.getUserLabelByName(SKIP_LABEL) || GmailApp.createLabel(SKIP_LABEL);
  const me = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const threads = GmailApp.search('in:inbox -label:' + DONE_LABEL + ' -label:' + SKIP_LABEL + ' ' + SEARCH_WINDOW, 0, MAX_PER_RUN);

  let sent = 0, skipped = 0, failed = 0;
  const t0 = Date.now();
  threads.reverse().forEach(thread => {   // oldest first
    if (Date.now() - t0 > 270000) return;   // stay inside Apps Script's 6-minute limit; the rest is done in the next run
    const msg = thread.getMessages()[0];
    const from = String(msg.getFrom() || '');
    const mm = from.match(/^(.*?)\s*<([^>]+)>$/);
    const fromEmail = (mm ? mm[2] : from).trim().toLowerCase();
    const fromName = mm ? mm[1] : '';
    const subject = msg.getSubject() || '';
    const body = msg.getPlainBody() || '';

    const text = (subject + ' ' + body).toLowerCase();
    const keywordOk = !KEYWORDS.length || KEYWORDS.some(k => text.indexOf(String(k).toLowerCase()) !== -1);
    if (!fromEmail || fromEmail === me || SKIP_SENDERS.test(fromEmail) || !keywordOk) {
      thread.addLabel(skipLabel); skipped++; return;
    }
    try {
      const att = collectAttachments_(msg);
      const res = UrlFetchApp.fetch(ERP_URL, {
        method: 'post', contentType: 'text/plain;charset=utf-8', followRedirects: true, muteHttpExceptions: true,
        payload: JSON.stringify({action: 'emailEnquiry', key: ERP_KEY, mailId: 'gm-' + msg.getId(),
          fromEmail: fromEmail, fromName: fromName, subject: subject, body: body, html: String(msg.getBody() || '').slice(0, 150000), date: msg.getDate().toISOString(),
          attachments: att.files, otherFiles: att.other})
      });
      let out = null;
      try { out = JSON.parse(res.getContentText()); } catch (e) {}
      if (out && out.ok && out.skipped) { thread.addLabel(skipLabel); skipped++; Logger.log('Not an enquiry, skipped: "' + subject + '" (' + out.reason + ')'); }
      else if (out && out.ok) { thread.addLabel(doneLabel); sent++; }
      else { failed++; Logger.log('ERP rejected "' + subject + '": ' + (out ? out.error : res.getContentText().slice(0, 200))); }
    } catch (e) {
      failed++; Logger.log('Send failed for "' + subject + '": ' + e);
    }
  });
  Logger.log('Imported: ' + sent + ', skipped: ' + skipped + ', failed (will retry): ' + failed);
}

/* Run once: check the inbox every 5 minutes */
function setupEmailTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'importEmails') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('importEmails').timeBased().everyMinutes(5).create();
  Logger.log('Trigger created: importEmails runs every 5 minutes.');
}


/* ------------------------------------------------------------------
   CHECK — run this when mails are not reaching the ERP.
   Select  checkReader  > Run > read the Execution log. Nothing is changed or sent.
   ------------------------------------------------------------------ */
function checkReader() {
  const L = [];
  const urlOk = ERP_URL.indexOf('PASTE') === -1 && /^https:\/\/script\.google\.com\/.+\/exec/.test(ERP_URL);
  const keyOk = ERP_KEY.indexOf('PASTE') === -1 && ERP_KEY.length >= 20;
  L.push('1. ERP_URL filled correctly (…/exec): ' + (urlOk ? 'YES' : 'NO  <-- fix ERP_URL'));
  L.push('2. ERP_KEY filled: ' + (keyOk ? 'YES' : 'NO  <-- fix ERP_KEY'));
  if (urlOk && keyOk) {
    try {
      const res = UrlFetchApp.fetch(ERP_URL, {method: 'post', contentType: 'text/plain;charset=utf-8', followRedirects: true, muteHttpExceptions: true,
        payload: JSON.stringify({action: 'emailEnquiry', key: ERP_KEY})});   // no mailId on purpose: nothing is created
      const txt = res.getContentText();
      let j = null; try { j = JSON.parse(txt); } catch (e) {}
      if (!j) L.push('3. ERP answered, but NOT in the expected format -> wrong ERP_URL, or the web app is not deployed as "Anyone". Answer starts with: ' + txt.replace(/\s+/g, ' ').slice(0, 120));
      else if (j.error === 'Unauthorized') L.push('3. ERP reached, but the KEY does not match -> ERP_KEY here must be exactly the EMAIL_IMPORT_KEY in the ERP project (Script properties).');
      else if (/mailId and fromEmail/i.test(String(j.error))) L.push('3. ERP reached and the key is CORRECT  ✔');
      else if (/Unknown action/i.test(String(j.error))) L.push('3. ERP says "Unknown action" -> Code.gs edit for emailEnquiry is missing, or "New version" was not deployed.');
      else L.push('3. ERP answer: ' + JSON.stringify(j).slice(0, 200));
    } catch (e) { L.push('3. Could not reach the ERP: ' + e); }
  }
  try {
    const win = SEARCH_WINDOW;
    const count = q => GmailApp.search(q, 0, 100).length;
    L.push('4. Mails in Inbox (' + win + '): ' + count('in:inbox ' + win));
    L.push('   already sent to ERP (label ' + DONE_LABEL + '): ' + count('in:inbox label:' + DONE_LABEL + ' ' + win));
    L.push('   ignored (label ' + SKIP_LABEL + '): ' + count('in:inbox label:' + SKIP_LABEL + ' ' + win));
    L.push('   WAITING to be sent: ' + count('in:inbox -label:' + DONE_LABEL + ' -label:' + SKIP_LABEL + ' ' + win));
  } catch (e) { L.push('4. Gmail check failed: ' + e); }
  const trig = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'importEmails').length;
  L.push('5. Automatic 5-minute trigger: ' + (trig === 1 ? 'YES' : trig === 0 ? 'NO  <-- run setupEmailTrigger once' : trig + ' triggers (run setupEmailTrigger once to keep only one)'));
  Logger.log(L.join('\n'));
  return L.join('\n');
}
