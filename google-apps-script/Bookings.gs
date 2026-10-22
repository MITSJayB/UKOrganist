/**
 * James Robert Berry – Organist — bookings toolkit (second file in the "UKO Website Enquiries" project).
 *
 * Run setupBookings() once from the editor. It creates, in music@jamesrobert.co.uk (formerly jb@ukorganist.com):
 *   - a "UKO Bookings" Google Calendar, with Sunday mornings blocked as busy (St John's, Worsthorne)
 *   - a "UKO Bookings" Drive folder (one sub-folder per booking is added automatically)
 *   - two music-planning Google Forms (wedding and funeral) whose answers land in new tabs
 *     of the UKO Enquiries sheet
 *   - an "on edit" trigger on the UKO Enquiries sheet
 *
 * Then, whenever a row's Status is changed to "Booked", the script:
 *   - adds the booking to the UKO Bookings calendar (email reminders 14 and 7 days before,
 *     i.e. music deadline and balance due, plus a pop-up the day before)
 *   - creates a Drive folder for the booking
 *   - writes both links into the row, and emails Jay the right music form link to send on
 *
 * Running setupBookings() again is safe: it reuses what already exists.
 */

var BOOKINGS = "UKO Bookings";
var COL = { name: 2, phone: 3, email: 4, service: 5, date: 6, time: 7, venue: 8, details: 9, status: 11, notes: 15, folder: 16, calendar: 17 };
var SUNDAY_BLOCK = { start: "08:00", end: "12:30", title: "St John's, Worsthorne – not available" };

function props_() { return PropertiesService.getScriptProperties(); }

function setupBookings() {
  var p = props_();

  // Calendar
  var cal = p.getProperty("CAL_ID") && CalendarApp.getCalendarById(p.getProperty("CAL_ID"));
  if (!cal) {
    cal = CalendarApp.getCalendarsByName(BOOKINGS)[0] ||
      CalendarApp.createCalendar(BOOKINGS, { color: CalendarApp.Color.BLUE, timeZone: "Europe/London" });
    p.setProperty("CAL_ID", cal.getId());
  }
  if (!p.getProperty("SUNDAY_SERIES")) {
    var first = nextSunday_();
    var start = at_(first, SUNDAY_BLOCK.start), end = at_(first, SUNDAY_BLOCK.end);
    var series = cal.createEventSeries(SUNDAY_BLOCK.title, start, end,
      CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekday(CalendarApp.Weekday.SUNDAY),
      { description: "Organist and Choir Master, St John the Evangelist, Worsthorne. Not available for bookings." });
    series.removeAllReminders();
    p.setProperty("SUNDAY_SERIES", series.getId());
  }

  // Drive folder
  var folder = p.getProperty("FOLDER_ID") && tryFolder_(p.getProperty("FOLDER_ID"));
  if (!folder) {
    var found = DriveApp.getFoldersByName(BOOKINGS);
    folder = found.hasNext() ? found.next() : DriveApp.createFolder(BOOKINGS);
    p.setProperty("FOLDER_ID", folder.getId());
  }

  // Music forms
  if (!p.getProperty("WEDDING_FORM")) p.setProperty("WEDDING_FORM", weddingForm_().getId());
  if (!p.getProperty("FUNERAL_FORM")) p.setProperty("FUNERAL_FORM", funeralForm_().getId());
  [p.getProperty("WEDDING_FORM"), p.getProperty("FUNERAL_FORM")].forEach(function (id) {
    var f = DriveApp.getFileById(id);
    if (f.getParents().hasNext() && f.getParents().next().getId() !== folder.getId()) f.moveTo(folder);
  });

  // Extra columns on the Enquiries tab
  var sh = book_().getSheetByName(SHEET);
  sh.getRange(1, COL.folder, 1, 2).setValues([["Booking folder", "Calendar"]])
    .setFontWeight("bold").setBackground("#16283a").setFontColor("#ffffff");
  sh.setColumnWidth(COL.folder, 120);
  sh.setColumnWidth(COL.calendar, 120);

  // On-edit trigger (installable, so it can use Calendar and Drive)
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "onBookingEdit"; });
  if (!has) ScriptApp.newTrigger("onBookingEdit").forSpreadsheet(SHEET_ID).onEdit().create();

  var msg = [
    "UKO bookings toolkit is set up.",
    "Calendar: " + BOOKINGS,
    "Drive folder: " + folder.getUrl(),
    "Wedding music form (send to couples): " + FormApp.openById(p.getProperty("WEDDING_FORM")).getPublishedUrl(),
    "Funeral music form (send to families / funeral directors): " + FormApp.openById(p.getProperty("FUNERAL_FORM")).getPublishedUrl(),
  ].join("\n");
  Logger.log(msg);
  return msg;
}

/** Installable on-edit trigger: Status -> Booked creates the calendar event and folder. */
function onBookingEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== SHEET || e.range.getColumn() > COL.status || e.range.getLastColumn() < COL.status) return;
  for (var r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    if (r < 2) continue;
    if (String(sh.getRange(r, COL.status).getValue()) === "Booked") createBooking_(sh, r);
  }
}

/** Also usable by hand: select a Booked row's number and run createBookingForRow(n). */
function createBookingForRow(row) {
  createBooking_(book_().getSheetByName(SHEET), row);
}

function createBooking_(sh, row) {
  var v = sh.getRange(row, 1, 1, COL.calendar).getValues()[0];
  if (v[COL.calendar - 1]) { pushBookingToNotion_(sh, row); return; } // calendar done; make sure Notion has it
  var name = v[COL.name - 1], service = v[COL.service - 1] || "Booking", venue = v[COL.venue - 1];
  var date = v[COL.date - 1];
  if (!(date instanceof Date)) return;
  var p = props_();
  var cal = CalendarApp.getCalendarById(p.getProperty("CAL_ID"));
  var parent = DriveApp.getFolderById(p.getProperty("FOLDER_ID"));

  var day = Utilities.formatDate(date, "Europe/London", "yyyy-MM-dd");
  var folder = parent.createFolder(day + " " + service + " – " + name);
  var isFuneral = /funeral|memorial/i.test(service);
  var formId = p.getProperty(isFuneral ? "FUNERAL_FORM" : "WEDDING_FORM");
  var formUrl = formId ? FormApp.openById(formId).getPublishedUrl() : "";

  var description = [
    service + " – " + name,
    "Phone: " + String(v[COL.phone - 1]).replace(/^'/, ""),
    v[COL.email - 1] ? "Email: " + v[COL.email - 1] : "",
    v[COL.details - 1] ? "\n" + v[COL.details - 1] : "",
    "\nBooking folder: " + folder.getUrl(),
    formUrl ? "Music form: " + formUrl : "",
    "Enquiries sheet: " + book_().getUrl(),
  ].filter(String).join("\n");

  var title = service + " – " + name + (venue ? " – " + venue : "");
  var rawTime = v[COL.time - 1];
  var t = rawTime instanceof Date ? Utilities.formatDate(rawTime, "Europe/London", "HH:mm") : String(rawTime || "");
  var event;
  if (/^\d{1,2}:\d{2}/.test(t)) {
    var start = at_(date, t);
    // Arrive 45 minutes early (terms of booking); allow an hour for the service.
    var arrive = new Date(start.getTime() - 45 * 60000), end = new Date(start.getTime() + 60 * 60000);
    event = cal.createEvent(title, arrive, end, { location: venue || "", description: "Service starts " + t + " (arrive 45 min early)\n\n" + description });
  } else {
    event = cal.createAllDayEvent(title, date, { location: venue || "", description: description });
  }
  event.removeAllReminders();
  event.addEmailReminder(14 * 24 * 60); // music deadline (weddings) / two-week check
  event.addEmailReminder(7 * 24 * 60);  // balance due
  event.addPopupReminder(24 * 60);      // the day before

  var eventUrl = "https://calendar.google.com/calendar/r/eventedit/" +
    Utilities.base64Encode(event.getId().split("@")[0] + " " + cal.getId()).replace(/=+$/, "");
  sh.getRange(row, COL.folder, 1, 2).setFormulas([[
    '=HYPERLINK("' + folder.getUrl() + '","Folder")',
    '=HYPERLINK("' + eventUrl + '","Event")',
  ]]);
  pushBookingToNotion_(sh, row, { folder: folder.getUrl(), event: eventUrl }); // Notion.gs

  var when = Utilities.formatDate(date, "Europe/London", "EEEE d MMMM yyyy");
  MailApp.sendEmail(NOTIFY, "Booked: " + service + " – " + when + " – " + name, [
    "Added to the UKO Bookings calendar, with reminders 14 and 7 days before.",
    "Booking folder: " + folder.getUrl(),
    "",
    formUrl ? "Music form to send to " + (isFuneral ? "the family / funeral director" : "the couple") + ":\n" + formUrl : "",
  ].join("\n"), { name: "UKO Bookings" });
}

// ------------------------------------------------------------ music forms

function weddingForm_() {
  var f = FormApp.create("James Robert Berry – Wedding music planner");
  f.setDescription("Thank you for booking James Robert Berry for your wedding. Please fill this in at least 14 days " +
    "before the ceremony so the music can be prepared. Not sure about something? Leave it blank or choose " +
    "\"Please suggest\" and James will help. Questions: WhatsApp 07408 637432 or email bookings@jamesrobert.co.uk.");
  f.setCollectEmail(false).setAllowResponseEdits(true).setLimitOneResponsePerUser(false);
  f.addTextItem().setTitle("Your names").setRequired(true);
  f.addTextItem().setTitle("Your email address").setRequired(true);
  f.addTextItem().setTitle("Your phone number").setRequired(true);
  f.addDateItem().setTitle("Wedding date").setRequired(true);
  f.addTimeItem().setTitle("Ceremony start time").setRequired(true);
  f.addParagraphTextItem().setTitle("Church or venue (name and address)").setRequired(true);
  f.addTextItem().setTitle("Minister or vicar taking the service").setHelpText("Name, and a phone number or email if you have one.");
  f.addSectionHeaderItem().setTitle("Music").setHelpText("Pick from the list or choose Other and type your own.");
  var pre = f.addMultipleChoiceItem().setTitle("Music while guests arrive");
  pre.setChoices([pre.createChoice("Classical and light organ music (James's choice)"), pre.createChoice("A list of our favourites (tell us below)")]).showOtherOption(true);
  var entrance = f.addMultipleChoiceItem().setTitle("Entrance music").setRequired(true);
  entrance.setChoices(["Bridal Chorus – Wagner", "Trumpet Voluntary (Prince of Denmark's March) – Clarke",
    "Arrival of the Queen of Sheba – Handel", "Canon in D – Pachelbel", "Trumpet Tune – Purcell", "Please suggest"]
    .map(function (c) { return entrance.createChoice(c); })).showOtherOption(true);
  f.addParagraphTextItem().setTitle("Hymns").setHelpText("Up to three, in the order they're sung. Include the hymn book or tune name if you know it.");
  var signing = f.addMultipleChoiceItem().setTitle("Music during the signing of the register");
  signing.setChoices(["Air on the G String – Bach", "Jesu, Joy of Man's Desiring – Bach", "Ave Maria – Schubert",
    "Salut d'Amour – Elgar", "Please suggest"].map(function (c) { return signing.createChoice(c); })).showOtherOption(true);
  var exit = f.addMultipleChoiceItem().setTitle("Recessional (leaving the church)").setRequired(true);
  exit.setChoices(["Toccata (Symphony No. 5) – Widor", "Wedding March – Mendelssohn", "Hornpipe (Water Music) – Handel",
    "Pomp and Circumstance March No. 4 – Elgar", "Crown Imperial – Walton", "Please suggest"]
    .map(function (c) { return exit.createChoice(c); })).showOtherOption(true);
  f.addParagraphTextItem().setTitle("Soloists, choir or other musicians").setHelpText("Who they are and what they're performing. Rehearsals are charged at £80 per hour.");
  var film = f.addMultipleChoiceItem().setTitle("Will the ceremony be filmed or live-streamed?").setRequired(true);
  film.setHelpText("A recording fee (normally 50% of the performance fee) applies to professional filming or live-streaming, in line with UK performance rights.");
  film.setChoices(["No", "Guests' phones only", "Professionally filmed", "Live-streamed"].map(function (c) { return film.createChoice(c); }));
  f.addParagraphTextItem().setTitle("Anything else James should know?").setHelpText("Links to recordings of special pieces, timings, cues, order of service changes…");
  f.setConfirmationMessage("Thank you — James has your music choices and will be in touch if anything needs checking.");
  f.setDestination(FormApp.DestinationType.SPREADSHEET, SHEET_ID);
  renameResponseTab_(f, "Wedding music");
  return f;
}

function funeralForm_() {
  var f = FormApp.create("James Robert Berry – Funeral music planner");
  f.setDescription("Thank you for asking James Robert Berry to play. This form helps plan the music for the service. " +
    "Answer whatever you can; if you're unsure, choose \"Please suggest\" and James will help. For anything " +
    "urgent, call or WhatsApp 07408 637432.");
  f.setCollectEmail(false).setAllowResponseEdits(true);
  f.addTextItem().setTitle("Your name").setRequired(true);
  var who = f.addMultipleChoiceItem().setTitle("You are…").setRequired(true);
  who.setChoices(["Family or friend", "Funeral director", "Minister or celebrant"].map(function (c) { return who.createChoice(c); })).showOtherOption(true);
  f.addTextItem().setTitle("Your phone number").setRequired(true);
  f.addTextItem().setTitle("Your email address");
  f.addTextItem().setTitle("Name of the person who has died").setRequired(true);
  f.addDateItem().setTitle("Date of the service").setRequired(true);
  f.addTimeItem().setTitle("Service start time").setRequired(true);
  f.addParagraphTextItem().setTitle("Church, chapel or crematorium (name and address)").setRequired(true);
  f.addTextItem().setTitle("Funeral director").setHelpText("Company name and contact number.");
  f.addTextItem().setTitle("Minister or celebrant");
  f.addSectionHeaderItem().setTitle("Music");
  var arrive = f.addMultipleChoiceItem().setTitle("Music as people arrive");
  arrive.setChoices(["Quiet reflective organ music (James's choice)", "Please suggest"].map(function (c) { return arrive.createChoice(c); })).showOtherOption(true);
  f.addParagraphTextItem().setTitle("Hymns").setHelpText("In order. For example: The Lord's My Shepherd (Crimond), Abide With Me, How Great Thou Art.");
  f.addParagraphTextItem().setTitle("Music for reflection or the committal").setHelpText("A favourite song or piece? Add a link to a recording if you can.");
  var close = f.addMultipleChoiceItem().setTitle("Music at the end of the service");
  close.setChoices(["Nimrod – Elgar", "Largo – Handel", "Air on the G String – Bach", "Please suggest"].map(function (c) { return close.createChoice(c); })).showOtherOption(true);
  var stream = f.addMultipleChoiceItem().setTitle("Will the service be live-streamed or recorded?");
  stream.setChoices(["No", "Yes", "Not sure"].map(function (c) { return stream.createChoice(c); }));
  f.addParagraphTextItem().setTitle("Anything else James should know?");
  f.setConfirmationMessage("Thank you. James has the details and will be in touch if anything needs checking.");
  f.setDestination(FormApp.DestinationType.SPREADSHEET, SHEET_ID);
  renameResponseTab_(f, "Funeral music");
  return f;
}

function renameResponseTab_(form, name) {
  SpreadsheetApp.flush();
  book_().getSheets().forEach(function (s) {
    var linked = s.getFormUrl && s.getFormUrl();
    if (linked && linked.indexOf(form.getId()) > -1 && s.getName() !== name) s.setName(name);
  });
}

// ------------------------------------------------------------ helpers

function nextSunday_() {
  var d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d;
}

function at_(date, hhmm) {
  var ymd = Utilities.formatDate(date, "Europe/London", "yyyy-MM-dd");
  var parts = hhmm.split(":");
  // Build the instant for that wall-clock time in London.
  var guess = new Date(ymd + "T" + ("0" + parts[0]).slice(-2) + ":" + parts[1] + ":00Z");
  var offset = Utilities.formatDate(guess, "Europe/London", "Z"); // e.g. +0100
  var sign = offset[0] === "-" ? -1 : 1;
  var mins = sign * (parseInt(offset.slice(1, 3), 10) * 60 + parseInt(offset.slice(3), 10));
  return new Date(guess.getTime() - mins * 60000);
}

function tryFolder_(id) {
  try { return DriveApp.getFolderById(id); } catch (e) { return null; }
}
