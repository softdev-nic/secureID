const API_BASE = "http://localhost:3000/api";

const state = {
  challengeId: null,
  method: "email",
  destination: "",
  expiresAt: null,
  resendAt: null,
  loginIdentity: "",
  mode: "login"
};

const screens = [...document.querySelectorAll(".screen")];

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle("active", screen.id === id));
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll(".error").forEach(el => {
    el.classList.add("hidden");
    el.textContent = "";
  });
  document.getElementById("otp-boxes")?.classList.remove("error-state");
}

function showError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.remove("hidden");
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "include",
    ...options
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function setLoading(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text || "Please wait...";
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
}

/* Login */

document.getElementById("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  clearErrors();

  const button = event.submitter;
  const identity = document.getElementById("identity").value.trim();
  const password = document.getElementById("password").value;

  if (!identity || !password) {
    showError("login-error", "Please enter your email/username and password.");
    return;
  }

  state.loginIdentity = identity;
  setLoading(button, true, "Logging in...");

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        identity,
        email: identity,
        username: identity,
        password,
        rememberMe: document.getElementById("remember-me").checked
      })
    });

    if (data.mfaRequired) {
      state.challengeId = data.challengeId || null;
      state.method = data.method || "email";
      state.destination = data.destination || data.email || data.phone || "";
      showScreen("method-screen");
      syncMethodSelection(state.method);
      return;
    }

    // If your backend returns an authenticated session directly.
    window.location.href = data.redirect || "./dashboard.html";
  } catch (error) {
    showError(
      "login-error",
      error.status === 401
        ? "Invalid email or password. Please try again."
        : error.message
    );
  } finally {
    setLoading(button, false);
  }
});

document.getElementById("toggle-password").addEventListener("click", () => {
  const input = document.getElementById("password");
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
});

document.getElementById("google-login").addEventListener("click", () => {
  // UI only unless your assessment provides a Google OAuth endpoint.
  alert("Google Sign-In UI is ready. Connect your OAuth endpoint here.");
});

document.getElementById("forgot-password").addEventListener("click", () => {
  alert("Connect your forgot-password flow here.");
});

/* Navigation */

document.getElementById("create-account").addEventListener("click", () => {
  showScreen("register-screen");
});

document.querySelectorAll("[data-back]").forEach(button => {
  button.addEventListener("click", () => showScreen(button.dataset.back));
});

/* Method selection */

document.querySelectorAll(".method-card").forEach(card => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".method-card").forEach(x => x.classList.remove("selected"));
    card.classList.add("selected");
    const radio = card.querySelector("input");
    radio.checked = true;
    state.method = radio.value;
  });
});

function syncMethodSelection(method) {
  const radio = document.querySelector(`input[name="method"][value="${method}"]`);
  if (!radio) return;
  radio.checked = true;
  radio.closest(".method-card").click();
}

document.getElementById("continue-method").addEventListener("click", async event => {
  clearErrors();
  const button = event.currentTarget;

  if (state.method === "authenticator") {
    // Screenshot has this option, but the written API specification
    // does not define an authenticator/TOTP endpoint.
    showError("method-error", "Authenticator App is shown in the UI, but no TOTP API is defined in the assessment.");
    return;
  }

  setLoading(button, true, "Sending...");

  try {
    const endpoint = state.method === "email"
      ? "/send-email-otp"
      : "/send-sms-otp";

    const payload = {
      challengeId: state.challengeId,
      identity: state.loginIdentity
    };

    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.challengeId = data.challengeId || state.challengeId;
    state.destination = data.destination || state.destination;

    openOtpScreen(data);
  } catch (error) {
    showError("method-error", error.message);
  } finally {
    setLoading(button, false);
  }
});

/* OTP */

const otpInputs = [...document.querySelectorAll("#otp-boxes input")];

otpInputs.forEach((input, index) => {
  input.addEventListener("input", event => {
    const value = event.target.value.replace(/\D/g, "").slice(-1);
    event.target.value = value;

    if (value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Backspace" && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      otpInputs[index - 1].focus();
    }

    if (event.key === "ArrowRight" && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });

  input.addEventListener("paste", event => {
    const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;

    event.preventDefault();
    text.split("").forEach((digit, i) => {
      if (otpInputs[i]) otpInputs[i].value = digit;
    });

    otpInputs[Math.min(text.length, 6) - 1]?.focus();
  });
});

function getOtp() {
  return otpInputs.map(input => input.value).join("");
}

function clearOtp() {
  otpInputs.forEach(input => input.value = "");
  otpInputs[0].focus();
}

function openOtpScreen(data = {}) {
  clearErrors();
  clearOtp();

  const channelName = state.method === "sms" ? "SMS Verification" : "Email Verification";
  document.getElementById("otp-title").textContent = channelName;
  document.getElementById("otp-destination").textContent =
    data.destination || state.destination || (state.method === "sms" ? "your mobile" : "your email");

  state.expiresAt = data.expiresAt
    ? new Date(data.expiresAt).getTime()
    : Date.now() + 165000;

  state.resendAt = Date.now() + 25000;
  document.getElementById("resend-otp").disabled = true;

  showScreen("otp-screen");
  startOtpTimers();
  setTimeout(() => otpInputs[0].focus(), 50);
}

let timerInterval = null;

function startOtpTimers() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const now = Date.now();
    const expiryLeft = Math.max(0, state.expiresAt - now);
    const resendLeft = Math.max(0, state.resendAt - now);

    document.getElementById("otp-timer").innerHTML =
      expiryLeft > 0
        ? `Code expires in <b>${formatTime(expiryLeft)}</b>`
        : `<b>Code expired.</b>`;

    const resendButton = document.getElementById("resend-otp");
    resendButton.disabled = resendLeft > 0 || expiryLeft <= 0;
    document.getElementById("resend-timer").textContent =
      resendLeft > 0 ? `(${formatTime(resendLeft)})` : "";

    if (expiryLeft <= 0) {
      clearInterval(timerInterval);
      showScreen("expired-screen");
      document.getElementById("expired-destination").textContent =
        state.destination || (state.method === "sms" ? "your mobile" : "your email");
    }
  }, 250);
}

function formatTime(milliseconds) {
  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

document.getElementById("otp-submit").addEventListener("click", verifyOtp);

document.getElementById("resend-otp").addEventListener("click", resendOtp);
document.getElementById("expired-resend").addEventListener("click", resendOtp);

document.getElementById("didnt-receive").addEventListener("click", () => {
  alert("Connect your resend/help flow here.");
});

async function verifyOtp() {
  clearErrors();

  const otp = getOtp();
  if (otp.length !== 6) {
    showError("otp-error", "Enter the complete 6-digit code.");
    return;
  }

  const button = document.getElementById("otp-submit");
  setLoading(button, true, "Verifying...");

  try {
    const data = await api("/verify-login-otp", {
      method: "POST",
      body: JSON.stringify({
        challengeId: state.challengeId,
        otp,
        method: state.method
      })
    });

    // Backend may return a session-created response or redirect.
    window.location.href = data.redirect || "./dashboard.html";
  } catch (error) {
    document.getElementById("otp-boxes").classList.add("error-state");
    showError("otp-error", error.message || "Incorrect code. Please try again.");
    clearOtp();
  } finally {
    setLoading(button, false);
  }
}

async function resendOtp() {
  try {
    const endpoint = state.method === "email"
      ? "/send-email-otp"
      : "/send-sms-otp";

    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({
        challengeId: state.challengeId,
        identity: state.loginIdentity
      })
    });

    state.challengeId = data.challengeId || state.challengeId;
    state.destination = data.destination || state.destination;
    openOtpScreen(data);
  } catch (error) {
    showError("otp-error", error.message);
  }
}

/* Registration */

document.getElementById("register-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;

  clearErrors();
  setLoading(button, true, "Creating...");

  try {
    const data = await api("/register", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("reg-username").value.trim(),
        email: document.getElementById("reg-email").value.trim(),
        phone: document.getElementById("reg-phone").value.trim(),
        password: document.getElementById("reg-password").value,
        termsAccepted: document.getElementById("terms").checked
      })
    });

    state.mode = "registration";
    state.challengeId = data.challengeId;
    state.method = "email";
    state.destination = data.email || document.getElementById("reg-email").value.trim();

    openOtpScreen(data);
  } catch (error) {
    showError("register-error", error.message);
  } finally {
    setLoading(button, false);
  }
});
