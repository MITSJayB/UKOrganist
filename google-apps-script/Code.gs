/**
 * James Robert Berry – Organist — website enquiry logger.
 *
 * A standalone Apps Script project ("UKO Website Enquiries") in the jb@ukorganist.com
 * account, writing to the "UKO Enquiries" Google Sheet (SHEET_ID below). The website's enquiry form posts each enquiry here:
 * it is added as a row on the "Enquiries" tab and Jay gets an email alert.
 *
 * Deploy: Deploy > New deployment > Web app, Execute as "Me",
 * Who has access "Anyone". The /exec URL goes in ENQUIRY_ENDPOINT in site.js.
 * After editing this file: Deploy > Manage deployments > edit > New version.
 */

var NOTIFY = "jb@ukorganist.com";
var SHEET_ID = "1Eg7IehHSawSS_tZqzYspQ_zP-YoYfQwXHYjzb7OX3M4";
function book_() { return SpreadsheetApp.openById(SHEET_ID); }
var SHEET = "Enquiries";
var HEADERS = [
  "Received", "Name", "Phone", "Email", "Service", "Date of service", "Start time",
  "Venue", "Details", "Sent via", "Status", "Quote (£)", "Deposit paid", "Music confirmed", "Notes",
];
var STATUSES = ["New", "Quoted", "Booked", "Completed", "Declined", "Not available"];
var SERVICES = {
  wedding: "Wedding", funeral: "Funeral", memorial: "Memorial service",
  church: "Church service / deputy cover", concert: "Concert / recital / accompaniment", other: "Other",
};

/** Run once from the editor: sets up the tab, headers, dropdowns and formatting. */
function setup() {
  var ss = book_();
  ss.rename("UKO Enquiries");
  ss.setSpreadsheetTimeZone("Europe/London");
  var sh = ss.getSheetByName(SHEET) || ss.getSheets()[0].setName(SHEET);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight("bold").setBackground("#16283a").setFontColor("#ffffff");
  sh.setFrozenRows(1);
  var widths = [140, 150, 120, 190, 170, 120, 80, 220, 300, 90, 110, 80, 100, 120, 220];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  var rows = sh.getMaxRows() - 1;
  sh.getRange(2, 1, rows, 1).setNumberFormat("dd/mm/yyyy hh:mm");
  sh.getRange(2, 6, rows, 1).setNumberFormat("ddd dd/mm/yyyy");
  sh.getRange(2, 12, rows, 1).setNumberFormat("£#,##0.00");
  sh.getRange(2, 9, rows, 1).setWrap(true);
  sh.getRange(2, 11, rows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
  sh.getRange(2, 13, rows, 2).insertCheckboxes();
  var status = sh.getRange(2, 11, rows, 1);
  var colour = { New: "#fde7c4", Quoted: "#d9e8f6", Booked: "#d6efdd", Declined: "#eeeeee", "Not available": "#eeeeee" };
  sh.setConditionalFormatRules(Object.keys(colour).map(function (k) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(k).setBackground(colour[k]).setRanges([status]).build();
  }));
  // Touch Gmail once so the authorisation screen asks for email permission too.
  MailApp.getRemainingDailyQuota();
}

/** Web form endpoint. */
function doPost(e) {
  var p = (e && e.parameter) || {};
  // Spam trap: real visitors never fill the hidden "website" field.
  if (p.website) return reply_({ ok: true });
  var name = clean_(p.name, 120), phone = clean_(p.phone, 40).replace(/^'/, "");
  if (!name || !phone || !p.date) return reply_({ ok: false, error: "missing fields" });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = book_().getSheetByName(SHEET);
    var service = SERVICES[p.service] || clean_(p.service, 60) || "Other";
    var dateParts = String(p.date).split("-");
    // Midday UTC keeps the calendar date right whatever time zone the script runs in.
    var serviceDate = dateParts.length === 3
      ? new Date(Date.UTC(+dateParts[0], +dateParts[1] - 1, +dateParts[2], 12)) : clean_(p.date, 20);
    // First empty row in column A (appendRow would go below the pre-filled checkboxes).
    var col = sh.getRange(2, 1, sh.getMaxRows() - 1, 1).getValues();
    var free = col.findIndex(function (r) { return r[0] === ""; });
    var row = free < 0 ? sh.getMaxRows() + 1 : free + 2;
    if (row > sh.getMaxRows()) {
      sh.insertRowsAfter(sh.getMaxRows(), 50);
      sh.getRange(row, 13, 50, 2).insertCheckboxes();
    }
    sh.getRange(row, 1, 1, HEADERS.length).setValues([[
      new Date(), name, "'" + phone, clean_(p.email, 120), service, serviceDate, clean_(p.time, 10),
      clean_(p.venue, 200), clean_(p.message, 2000), clean_(p.channel, 20) || "Website", "New", "", false, false, "",
    ]]);
  } finally {
    lock.releaseLock();
  }

  var when = serviceDate instanceof Date
    ? Utilities.formatDate(serviceDate, "Europe/London", "EEEE d MMMM yyyy") : serviceDate;
  var body = [
    "New website enquiry",
    "",
    "Service: " + service,
    "Date: " + when + (p.time ? " at " + clean_(p.time, 10) : ""),
    "Venue: " + clean_(p.venue, 200),
    "Name: " + name,
    "Phone: " + phone,
    p.email ? "Email: " + clean_(p.email, 120) : "",
    "Sent via: " + (clean_(p.channel, 20) || "Website"),
    "",
    clean_(p.message, 2000),
    "",
    "WhatsApp them: https://wa.me/" + phone.replace(/\D/g, "").replace(/^0/, "44"),
    "Enquiries sheet: " + book_().getUrl(),
  ].filter(function (l, i, a) { return l !== "" || a[i - 1] !== ""; }).join("\n");
  var opts = { name: "UKO Website" };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || "")) opts.replyTo = p.email;
  MailApp.sendEmail(NOTIFY, service + " enquiry – " + when + " – " + name, body, opts);
  return reply_({ ok: true });
}

function doGet() {
  return ContentService.createTextOutput("James Robert Berry – Organist enquiry endpoint is running.");
}

function clean_(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim()
    .replace(/^[=+\-@]/, "'$&").slice(0, max);
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
