 import api from "./API.js";

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

const showScreen = id => {
    screens.forEach(s => s.classList.toggle("active", s.id === id));
    clearErrors();
};

const clearErrors = () => {
    document.querySelectorAll(".error").forEach(e => {
        e.classList.add("hidden");
        e.textContent = "";
    });
    document.getElementById("otp-boxes")?.classList.remove("error-state");
};

const showError = (id, msg) => {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove("hidden");
};

const setLoading = (btn, loading, text = "Please wait...") => {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        btn.textContent = text;
    } else if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
    }
};

/* Login */
document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors();

    const button = e.submitter;
    const identity = document.getElementById("identity").value.trim();
    const password = document.getElementById("password").value;

    if (!identity || !password)
        return showError("login-error", "Please enter your email/username and password.");

    state.loginIdentity = identity;
    setLoading(button, true, "Logging in...");

    try {
        const { data } = await api.post("/login", {
            identity,
            email: identity,
            username: identity,
            password,
            rememberMe: document.getElementById("remember-me").checked
        });

        if (data.mfaRequired) {
            state.challengeId = data.challengeId;
            state.method = data.method || "email";
            state.destination = data.destination || data.email || data.phone || "";
            showScreen("method-screen");
            syncMethodSelection(state.method);
        } else {
            location.href = data.redirect || "./dashboard.html";
        }
    } catch (err) {
        showError(
            "login-error",
            err.status === 401 ? "Invalid email or password. Please try again." : err.message
        );
    } finally {
        setLoading(button, false);
    }
});

/* Password */
document.getElementById("toggle-password").onclick = () => {
    const input = document.getElementById("password");
    input.type = input.type === "password" ? "text" : "password";
};

/* Navigation */
document.getElementById("create-account").onclick = () => showScreen("register-screen");
document.querySelectorAll("[data-back]").forEach(btn =>
    btn.onclick = () => showScreen(btn.dataset.back)
);

/* MFA method */
document.querySelectorAll(".method-card").forEach(card => {
    card.onclick = () => {
        document.querySelectorAll(".method-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector("input");
        radio.checked = true;
        state.method = radio.value;
    };
});

function syncMethodSelection(method) {
    const radio = document.querySelector(`input[name="method"][value="${method}"]`);
    if (radio) radio.closest(".method-card").click();
}

document.getElementById("continue-method").onclick = async e => {
    clearErrors();
    const button = e.currentTarget;

    if (state.method === "authenticator")
        return showError("method-error", "Authenticator App is not defined in the assessment API.");

    setLoading(button, true, "Sending...");

    try {
        const endpoint = state.method === "email" ? "/send-email-otp" : "/send-sms-otp";
        const { data } = await api.post(endpoint, {
            challengeId: state.challengeId,
            identity: state.loginIdentity
        });

        state.challengeId = data.challengeId || state.challengeId;
        state.destination = data.destination || state.destination;
        openOtpScreen(data);
    } catch (err) {
        showError("method-error", err.message);
    } finally {
        setLoading(button, false);
    }
};

/* OTP */
const otpInputs = [...document.querySelectorAll("#otp-boxes input")];

otpInputs.forEach((input, i) => {
    input.oninput = e => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(-1);
        if (e.target.value && i < 5) otpInputs[i + 1].focus();
    };

    input.onkeydown = e => {
        if (e.key === "Backspace" && !input.value && i) otpInputs[i - 1].focus();
        if (e.key === "ArrowLeft" && i) otpInputs[i - 1].focus();
        if (e.key === "ArrowRight" && i < 5) otpInputs[i + 1].focus();
    };

    input.onpaste = e => {
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!text) return;
        e.preventDefault();
        [...text].forEach((d, j) => otpInputs[j] && (otpInputs[j].value = d));
        otpInputs[Math.min(text.length, 6) - 1]?.focus();
    };
});

const getOtp = () => otpInputs.map(i => i.value).join("");

const clearOtp = () => {
    otpInputs.forEach(i => i.value = "");
    otpInputs[0].focus();
};

function openOtpScreen(data = {}) {
    clearErrors();
    clearOtp();

    document.getElementById("otp-title").textContent =
        state.method === "sms" ? "SMS Verification" : "Email Verification";

    document.getElementById("otp-destination").textContent =
        data.destination || state.destination ||
        (state.method === "sms" ? "your mobile" : "your email");

    state.expiresAt = data.expiresAt
        ? new Date(data.expiresAt).getTime()
        : Date.now() + 165000;

    state.resendAt = Date.now() + 25000;
    document.getElementById("resend-otp").disabled = true;

    showScreen("otp-screen");
    startOtpTimer();
    setTimeout(() => otpInputs[0].focus(), 50);
}

let timer;

function startOtpTimer() {
    clearInterval(timer);

    timer = setInterval(() => {
        const now = Date.now();
        const expiry = Math.max(0, state.expiresAt - now);
        const resend = Math.max(0, state.resendAt - now);

        document.getElementById("otp-timer").innerHTML =
            expiry ? `Code expires in <b>${formatTime(expiry)}</b>` : "<b>Code expired.</b>";

        document.getElementById("resend-otp").disabled = resend > 0 || !expiry;
        document.getElementById("resend-timer").textContent =
            resend ? `(${formatTime(resend)})` : "";

        if (!expiry) {
            clearInterval(timer);
            showScreen("expired-screen");
            document.getElementById("expired-destination").textContent =
                state.destination;
        }
    }, 250);
}

const formatTime = ms => {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/* OTP verification */
document.getElementById("otp-submit").onclick = verifyOtp;
document.getElementById("resend-otp").onclick = resendOtp;
document.getElementById("expired-resend").onclick = resendOtp;

async function verifyOtp() {
    clearErrors();

    const otp = getOtp();
    if (otp.length !== 6)
        return showError("otp-error", "Enter the complete 6-digit code.");

    const button = document.getElementById("otp-submit");
    setLoading(button, true, "Verifying...");

    try {
        const { data } = await api.post("/verify-login-otp", {
            challengeId: state.challengeId,
            otp,
            method: state.method
        });

        location.href = data.redirect || "./dashboard.html";
    } catch (err) {
        document.getElementById("otp-boxes").classList.add("error-state");
        showError("otp-error", err.message || "Incorrect code. Please try again.");
        clearOtp();
    } finally {
        setLoading(button, false);
    }
}

async function resendOtp() {
    try {
        const endpoint = state.method === "email" ? "/send-email-otp" : "/send-sms-otp";
        const { data } = await api.post(endpoint, {
            challengeId: state.challengeId,
            identity: state.loginIdentity
        });

        state.challengeId = data.challengeId || state.challengeId;
        state.destination = data.destination || state.destination;
        openOtpScreen(data);
    } catch (err) {
        showError("otp-error", err.message);
    }
}

/* Registration */
document.getElementById("register-form").onsubmit = async e => {
    e.preventDefault();

    const button = e.submitter;
    clearErrors();
    setLoading(button, true, "Creating...");

    try {
        const { data } = await api.post("/register", {
            username: document.getElementById("reg-username").value.trim(),
            email: document.getElementById("reg-email").value.trim(),
            phone: document.getElementById("reg-phone").value.trim(),
            password: document.getElementById("reg-password").value,
            termsAccepted: document.getElementById("terms").checked
        });

        state.mode = "registration";
        state.challengeId = data.challengeId;
        state.method = "email";
        state.destination = data.email ||
            document.getElementById("reg-email").value.trim();

        openOtpScreen(data);
    } catch (err) {
        showError("register-error", err.message);
    } finally {
        setLoading(button, false);
    }
};