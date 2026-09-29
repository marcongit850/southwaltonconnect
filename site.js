(function () {
  var details = document.querySelector(".nav-disclosure");
  if (details) {
    function mobileNav() {
      return window.matchMedia("(max-width: 980px)").matches;
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && details.open && mobileNav()) {
        details.removeAttribute("open");
        var summary = details.querySelector("summary");
        if (summary) summary.focus();
      }
    });
    details.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (mobileNav()) details.removeAttribute("open");
      });
    });
  }

  var form = document.getElementById("survey-form");
  if (!form) return;

  var status = document.getElementById("form-status");
  var success = document.getElementById("survey-success");
  var submit = form.querySelector("[type=submit]");
  var issueBoxes = form.querySelectorAll('input[name="issues"]');

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    status.classList.remove("is-error", "is-success");
    if (kind) status.classList.add(kind);
  }

  issueBoxes.forEach(function (box) {
    box.addEventListener("change", function () {
      var checked = form.querySelectorAll('input[name="issues"]:checked');
      if (checked.length > 3) {
        box.checked = false;
        setStatus("Select up to three transportation issues.", "is-error");
      } else if (status && status.textContent.indexOf("three") !== -1) {
        setStatus("", "");
      }
    });
  });

  function checkedValues(name) {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="' + name + '"]:checked'),
      function (el) { return el.value; }
    );
  }

  function radioValue(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var firstName = (form.querySelector("#first-name").value || "").trim();
    var email = (form.querySelector("#survey-email").value || "").trim();
    var concerns = (form.querySelector("#concerns").value || "").trim();
    var honeypot = (form.querySelector("#hp-field").value || "").trim();
    var issues = checkedValues("issues");

    if (honeypot) {
      setStatus("Could not send that response.", "is-error");
      return;
    }
    var answered = firstName || email || concerns || issues.length || checkedValues("connection").length || radioValue("area") || radioValue("congestion") || radioValue("watersound") || radioValue("needs_connector") || radioValue("d2_opinion") || radioValue("protections_required") || radioValue("protections_effect") || radioValue("support_if_prohibited") || radioValue("limited_access_effect") || radioValue("closest_statement");
    if (!answered) {
      setStatus("Please add a response.", "is-error");
      form.querySelector("#first-name").focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("Please enter a valid email address, or leave email blank.", "is-error");
      form.querySelector("#survey-email").focus();
      return;
    }
    if (issues.length > 3) {
      setStatus("Select up to three transportation issues.", "is-error");
      return;
    }
    if (firstName.length > 80 || email.length > 254 || concerns.length > 4000) {
      setStatus("That response is too long.", "is-error");
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Sending…";
    }
    setStatus("Sending your response…", "");

    var payload = {
      first_name: firstName,
      connection: checkedValues("connection"),
      area: radioValue("area"),
      congestion: radioValue("congestion"),
      watersound: radioValue("watersound"),
      needs_connector: radioValue("needs_connector"),
      issues: issues,
      d2_opinion: radioValue("d2_opinion"),
      protections_required: radioValue("protections_required"),
      protections_effect: radioValue("protections_effect"),
      support_if_prohibited: radioValue("support_if_prohibited"),
      limited_access_effect: radioValue("limited_access_effect"),
      closest_statement: radioValue("closest_statement"),
      concerns: concerns,
      email: email,
      hp_field: honeypot
    };

    fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      var data = result.data || {};
      var errorText = typeof data.error === "string" && data.error.length > 0 && data.error.length < 240
        ? data.error
        : "";
      if (result.ok && data.ok) {
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        setStatus("", "");
        return;
      }
      setStatus(errorText || "Could not send that response. Please try again.", "is-error");
    }).catch(function () {
      setStatus("Could not send that response. Please try again.", "is-error");
    }).then(function () {
      if (submit && !form.hidden) {
        submit.disabled = false;
        submit.textContent = "Submit";
      }
    });
  });
})();
