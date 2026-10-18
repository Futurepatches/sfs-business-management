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
const MAX_PER_RUN = 20;

/* Automatic / system senders that must never become enquiries */
const SKIP_SENDERS = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|notifications?@|newsletter|@accounts\.google\.com|@google\.com)/i;

/* OPTIONAL filter: leave empty [] to import every mail. Example: ['quotation','price','enquiry','inquiry','rate'] */
const KEYWORDS = [];

function importEmails() {
  const doneLabel = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  const skipLabel = GmailApp.getUserLabelByName(SKIP_LABEL) || GmailApp.createLabel(SKIP_LABEL);
  const me = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const threads = GmailApp.search('in:inbox -label:' + DONE_LABEL + ' -label:' + SKIP_LABEL + ' ' + SEARCH_WINDOW, 0, MAX_PER_RUN);

  let sent = 0, skipped = 0, failed = 0;
  threads.reverse().forEach(thread => {   // oldest first
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
      const res = UrlFetchApp.fetch(ERP_URL, {
        method: 'post', contentType: 'text/plain;charset=utf-8', followRedirects: true, muteHttpExceptions: true,
        payload: JSON.stringify({action: 'emailEnquiry', key: ERP_KEY, mailId: 'gm-' + msg.getId(),
          fromEmail: fromEmail, fromName: fromName, subject: subject, body: body, html: String(msg.getBody() || '').slice(0, 150000), date: msg.getDate().toISOString()})
      });
      let out = null;
      try { out = JSON.parse(res.getContentText()); } catch (e) {}
      if (out && out.ok) { thread.addLabel(doneLabel); sent++; }
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
