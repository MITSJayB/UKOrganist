/**
 * UK Organist — copy bookings into the Notion CRM (third file in "UKO Website Enquiries").
 *
 * When a row on the Enquiries tab is set to "Booked", createBooking_() (Bookings.gs) calls
 * pushBookingToNotion_() after making the calendar event and Drive folder. A page is added to
 * the Bookings database in the UK Organist teamspace (UKO CRM › Bookings).
 *
 * One-time setup:
 *   1. notion.so/profile/integrations → New integration → name "UKO Sheet", workspace = yours,
 *      type Internal → Save → copy the "Internal Integration Secret".
 *   2. In Notion open UKO CRM › Bookings → ••• → Connections → add "UKO Sheet".
 *   3. Here: Project Settings (cog) → Script Properties → add NOTION_TOKEN = the secret.
 *   4. Run testNotion() once and approve the new "connect to an external service" permission.
 *
 * The sheet stays the master record for enquiries. Notion is where the booking lives once
 * confirmed; link it to a Church or Funeral Director there with one click.
 */

var NOTION_BOOKINGS_DB = "653624954597459f86cafb77b3dba7f5";
var NOTION_VERSION = "2022-06-28";
var COL_EXTRA = { received: 1, via: 10, quote: 12, deposit: 13 };

/** Run from the editor to check the token and connection. */
function testNotion() {
  var res = notion_("get", "/databases/" + NOTION_BOOKINGS_DB);
  Logger.log("Connected to Notion database: " + res.title.map(function (t) { return t.plain_text; }).join(""));
}

/** Backfill: copies every row already marked Booked (skips ones Notion already has). */
function syncBookedRowsToNotion() {
  var sh = book_().getSheetByName(SHEET);
  var last = sh.getLastRow();
  for (var r = 2; r <= last; r++) {
    if (String(sh.getRange(r, COL.status).getValue()) === "Booked") pushBookingToNotion_(sh, r);
  }
}

function pushBookingToNotion_(sh, row, links) {
  if (!props_().getProperty("NOTION_TOKEN")) return; // not set up yet: skip quietly
  try {
    var v = sh.getRange(row, 1, 1, COL.calendar).getValues()[0];
    var date = v[COL.date - 1];
    if (!(date instanceof Date)) return;
    var received = v[COL_EXTRA.received - 1];
    var ref = received instanceof Date
      ? Utilities.formatDate(received, "Europe/London", "yyyy-MM-dd HH:mm:ss") : "row " + row;

    // Don't add the same booking twice.
    var existing = notion_("post", "/databases/" + NOTION_BOOKINGS_DB + "/query", {
      filter: { property: "Enquiry ref", rich_text: { equals: ref } }, page_size: 1,
    });
    if (existing.results && existing.results.length) return;

    links = links || {};
    var name = String(v[COL.name - 1] || "");
    var service = String(v[COL.service - 1] || "Other");
    var venue = String(v[COL.venue - 1] || "");
    var rawTime = v[COL.time - 1];
    var t = rawTime instanceof Date ? Utilities.formatDate(rawTime, "Europe/London", "HH:mm") : String(rawTime || "");
    var when = /^\d{1,2}:\d{2}/.test(t)
      ? { start: Utilities.formatDate(at_(date, t), "Europe/London", "yyyy-MM-dd'T'HH:mm:ssXXX") }
      : { start: Utilities.formatDate(date, "Europe/London", "yyyy-MM-dd") };
    var via = String(v[COL_EXTRA.via - 1] || "");
    var fee = parseFloat(v[COL_EXTRA.quote - 1]);
    var phone = String(v[COL.phone - 1] || "").replace(/^'/, "");
    var email = String(v[COL.email - 1] || "");
    var day = Utilities.formatDate(date, "Europe/London", "d MMM yyyy");

    var props = {
      "Booking": { title: [{ text: { content: service.split(" /")[0] + " – " + name + " – " + day } }] },
      "Service": { select: { name: service } },
      "Date": { date: when },
      "Status": { status: { name: "Booked" } },
      "Client": { rich_text: [{ text: { content: name } }] },
      "Venue": { rich_text: [{ text: { content: venue.slice(0, 1900) } }] },
      "Deposit paid": { checkbox: v[COL_EXTRA.deposit - 1] === true },
      "Source": { select: { name: /whats/i.test(via) ? "WhatsApp" : /phone|call/i.test(via) ? "Phone" : /mail/i.test(via) ? "Email" : "Website" } },
      "Enquiry ref": { rich_text: [{ text: { content: ref } }] },
    };
    if (phone) props["Phone"] = { phone_number: phone };
    if (/@/.test(email)) props["Email"] = { email: email };
    if (!isNaN(fee)) props["Fee"] = { number: fee };
    if (links.folder) props["Drive folder"] = { url: links.folder };
    if (links.event) props["Calendar"] = { url: links.event };

    var details = String(v[COL.details - 1] || "");
    var page = notion_("post", "/pages", {
      parent: { database_id: NOTION_BOOKINGS_DB },
      icon: { type: "emoji", emoji: /funeral|memorial/i.test(service) ? "🕊️" : /wedding/i.test(service) ? "💍" : "🎹" },
      properties: props,
      children: details ? [{ object: "block", type: "paragraph",
        paragraph: { rich_text: [{ text: { content: details.slice(0, 1900) } }] } }] : [],
    });

    // Put the Notion link in the Notes column so it's one click from the sheet.
    var notes = sh.getRange(row, COL.notes);
    if (!notes.getValue()) notes.setValue(page.url);
  } catch (err) {
    // Never let Notion stop the calendar/Drive booking flow; tell Jay instead.
    MailApp.sendEmail(NOTIFY, "UKO: couldn't copy booking to Notion (row " + row + ")",
      "The booking is in the calendar and Drive as normal, but adding it to Notion failed:\n\n" + err +
      "\n\nFix the cause, then run createBookingForRow(" + row + ") or syncBookedRowsToNotion().",
      { name: "UKO Bookings" });
  }
}

function notion_(method, path, body) {
  var opts = {
    method: method,
    headers: {
      Authorization: "Bearer " + props_().getProperty("NOTION_TOKEN"),
      "Notion-Version": NOTION_VERSION,
    },
    contentType: "application/json",
    muteHttpExceptions: true,
  };
  if (body) opts.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch("https://api.notion.com/v1" + path, opts);
  var json = JSON.parse(res.getContentText() || "{}");
  if (res.getResponseCode() >= 300) throw new Error("Notion " + res.getResponseCode() + ": " + (json.message || res.getContentText()));
  return json;
}
