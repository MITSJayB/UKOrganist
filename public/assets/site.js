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

// Enquiry form: no server. On submit it builds a message from the fields and opens
// WhatsApp (or the visitor's email app) with it ready to send to James.
(function () {
  var form = document.getElementById("enquiry-form");
  if (!form) return;
  var WA = "447359670332";
  var EMAIL = "jb@ukorganist.com";
  var status = form.querySelector(".form-status");
  var service = form.querySelector("#eq-service");
  var date = form.querySelector("#eq-date");
  var choice = "whatsapp";

  // Pre-select the service from ?service=wedding etc. and stop past dates.
  var want = new URLSearchParams(location.search).get("service");
  if (want && service.querySelector('option[value="' + want + '"]')) service.value = want;
  var t = new Date();
  date.min = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");

  form.querySelectorAll("button[type=submit]").forEach(function (b) {
    b.addEventListener("click", function () { choice = b.value; });
  });

  function show(msg, kind) {
    status.hidden = false;
    status.textContent = msg;
    status.className = "form-status is-" + kind;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.hidden = true;
    var bad = Array.prototype.find.call(form.elements, function (el) {
      return el.required && (el.value.trim() === "" || !el.checkValidity());
    });
    if (bad) {
      var label = form.querySelector('label[for="' + bad.id + '"]').firstChild.textContent.trim();
      show(label + " is needed so James can check the date.", "error");
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
    if (v("message")) lines.push("", v("message"));
    lines.push("", "(Sent from ukorganist.com)");
    var text = lines.join("\n");

    if (choice === "email") {
      var subject = type + " enquiry – " + when;
      location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
      show("Your email app should open with the message ready — just press send. If nothing opens, email " + EMAIL + " or WhatsApp 07359 670332.", "success");
    } else {
      window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(text), "_blank", "noopener");
      show("WhatsApp should open with your message ready — just press send. If it didn't open, message 07359 670332 or use “Send by email”.", "success");
    }
  });
})();
