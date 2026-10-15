// UK Organist — mobile menu.
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
})();

// Enquiry form. Each enquiry is sent to the "UKO Website Enquiries" Google Apps
// Script (logs it in the UKO Enquiries sheet and emails James). "Send on WhatsApp"
// also opens a ready-written WhatsApp message; if the script can't be reached,
// "Send enquiry" falls back to opening the visitor's email app.
(function () {
  var form = document.getElementById("enquiry-form");
  if (!form) return;
  var ENQUIRY_ENDPOINT = "https://script.google.com/macros/s/AKfycbxP6mw-dR38Zk1iTub7OEGnXwhRzoIgUuKeJxZCbIXjkyAiozOI6Q9Brz2eP0QUkpeh/exec"; // Apps Script web app
  var WA = "447359670332";
  var EMAIL = "jb@ukorganist.com";
  var status = form.querySelector(".form-status");
  var service = form.querySelector("#eq-service");
  var date = form.querySelector("#eq-date");
  var buttons = form.querySelectorAll("button[type=submit]");
  var choice = "whatsapp";

  var want = new URLSearchParams(location.search).get("service");
  if (want && service.querySelector('option[value="' + want + '"]')) service.value = want;
  var t = new Date();
  date.min = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");

  buttons.forEach(function (b) {
    b.addEventListener("click", function () { choice = b.value; });
  });

  function show(msg, kind) {
    status.hidden = false;
    status.textContent = msg;
    status.className = "form-status is-" + kind;
  }

  function send(channel) {
    if (!ENQUIRY_ENDPOINT) return Promise.reject(new Error("no endpoint"));
    var data = new URLSearchParams(new FormData(form));
    data.set("channel", channel);
    return fetch(ENQUIRY_ENDPOINT, { method: "POST", body: data, keepalive: true })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || "failed"); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.hidden = true;
    var bad = Array.prototype.find.call(form.elements, function (el) {
      return el.required && (el.value.trim() === "" || !el.checkValidity());
    });
    if (!bad && form.elements.email.value && !form.elements.email.checkValidity()) bad = form.elements.email;
    if (bad) {
      var label = form.querySelector('label[for="' + bad.id + '"]').firstChild.textContent.trim();
      show(bad.type === "email" ? "Please check your email address." : label + " is needed so James can check the date.", "error");
      bad.focus();
      return;
    }
    var v = function (n) { return form.elements[n].value.trim(); };
    var when = new Date(v("date") + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    var type = service.options[service.selectedIndex].text;
    var lines = [
      "Hi James, I'd like to check your availability.",
      "",
      "Service: " + type,
      "Date: " + when + (v("time") ? " at " + v("time") : ""),
      "Venue: " + v("venue"),
      "Name: " + v("name"),
      "Phone: " + v("phone"),
    ];
    if (v("email")) lines.push("Email: " + v("email"));
    if (v("message")) lines.push("", v("message"));
    lines.push("", "(Sent from ukorganist.com)");
    var text = lines.join("\n");

    if (choice === "whatsapp") {
      // Log it in the background, and open WhatsApp straight away (popup blockers
      // only allow this inside the click).
      send("WhatsApp").catch(function () {});
      window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(text), "_blank", "noopener");
      show("Thank you — James has your enquiry. WhatsApp should also have opened with your message ready; press send there if you'd like to chat.", "success");
      return;
    }

    buttons.forEach(function (b) { b.disabled = true; });
    show("Sending…", "info");
    send("Website")
      .then(function () {
        form.reset();
        show("Thank you — your enquiry has been sent. James will be in touch soon, usually by phone or WhatsApp.", "success");
      })
      .catch(function () {
        var subject = type + " enquiry – " + when;
        location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
        show("We couldn't send that automatically, so your email app should open with the message ready — just press send. Or WhatsApp 07359 670332.", "error");
      })
      .then(function () { buttons.forEach(function (b) { b.disabled = false; }); });
  });
})();
