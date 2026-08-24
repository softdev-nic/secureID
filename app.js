 import api from "./services/api.js";

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

const showError = (id, message) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden");
};

const setLoading = (button, loading, text = "Please wait...") => {
    if (!button) return;

    button.disabled = loading;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = text;
    } else if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
    }
};


/* =========================
   LOGIN
========================= */

document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors();

    const button = e.submitter;
    const identity = document.getElementById("identity").value.trim();
    const password = document.getElementById("password").value;

    if (!identity || !password) {
        showError(
            "login-error",
            "Please enter your email/username and password."
        );
        return;
    }

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
            state.challengeId = data.challengeId || null;
            state.method = data.method || "email";
            state.destination =
                data.destination ||
                data.email ||
                data.phoneNumber ||
                "";

            showScreen("method-screen");
            syncMethodSelection(state.method);
        } else {
            location.href = data.redirect || "./dashboard.html";
        }
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


/* =========================
   PASSWORD
========================= */

document.getElementById("toggle-password").onclick = () => {
    const input = document.getElementById("password");
    input.type = input.type === "password" ? "text" : "password";
};


/* =========================
   GOOGLE / FORGOT PASSWORD
========================= */

document.getElementById("google-login").onclick = () => {
    alert("Google Sign-In UI is ready.");
};

document.getElementById("forgot-password").onclick = () => {
    alert("Connect your forgot-password flow here.");
};


/* =========================
   NAVIGATION
========================= */

document.getElementById("create-account").onclick = () => {
    showScreen("register-screen");
};

document.querySelectorAll("[data-back]").forEach(button => {
    button.onclick = () => showScreen(button.dataset.back);
});


/* =========================
   MFA METHOD SELECTION
========================= */

document.querySelectorAll(".method-card").forEach(card => {
    card.onclick = () => {
        document.querySelectorAll(".method-card")
            .forEach(c => c.classList.remove("selected"));

        card.classList.add("selected");

        const radio = card.querySelector("input");
        radio.checked = true;
        state.method = radio.value;
    };
});

function syncMethodSelection(method) {
    const radio = document.querySelector(
        `input[name="method"][value="${method}"]`
    );

    if (radio) {
        radio.closest(".method-card").click();
    }
}


/* =========================
   CONTINUE MFA METHOD
========================= */

document.getElementById("continue-method").onclick = async e => {
    clearErrors();

    const button = e.currentTarget;

    if (state.method === "authenticator") {
        showError(
            "method-error",
            "Authenticator App is not defined in the assessment API."
        );
        return;
    }

    setLoading(button, true, "Sending...");

    try {
        const endpoint =
            state.method === "email"
                ? "/send-email-otp"
                : "/send-sms-otp";

        const { data } = await api.post(endpoint, {
            challengeId: state.challengeId,
            identity: state.loginIdentity
        });

        state.challengeId =
            data.challengeId || state.challengeId;

        state.destination =
            data.destination || state.destination;

        openOtpScreen(data);
    } catch (error) {
        showError("method-error", error.message);
    } finally {
        setLoading(button, false);
    }
};


/* =========================
   OTP INPUT
========================= */

const otpInputs = [
    ...document.querySelectorAll("#otp-boxes input")
];

otpInputs.forEach((input, index) => {

    input.addEventListener("input", e => {
        e.target.value = e.target.value
            .replace(/\D/g, "")
            .slice(-1);

        if (
            e.target.value &&
            index < otpInputs.length - 1
        ) {
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener("keydown", e => {

        if (
            e.key === "Backspace" &&
            !input.value &&
            index > 0
        ) {
            otpInputs[index - 1].focus();
        }

        if (
            e.key === "ArrowLeft" &&
            index > 0
        ) {
            otpInputs[index - 1].focus();
        }

        if (
            e.key === "ArrowRight" &&
            index < otpInputs.length - 1
        ) {
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener("paste", e => {
        const text = e.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);

        if (!text) return;

        e.preventDefault();

        [...text].forEach((digit, i) => {
            if (otpInputs[i]) {
                otpInputs[i].value = digit;
            }
        });

        otpInputs[
            Math.min(text.length, 6) - 1
        ]?.focus();
    });
});


const getOtp = () =>
    otpInputs.map(input => input.value).join("");


const clearOtp = () => {
    otpInputs.forEach(input => input.value = "");
    otpInputs[0]?.focus();
};


/* =========================
   OTP SCREEN
========================= */

function openOtpScreen(data = {}) {
    clearErrors();
    clearOtp();

    document.getElementById("otp-title").textContent =
        state.method === "sms"
            ? "SMS Verification"
            : "Email Verification";

    document.getElementById("otp-destination").textContent =
        data.destination ||
        state.destination ||
        (
            state.method === "sms"
                ? "your mobile"
                : "your email"
        );

    state.expiresAt = data.expiresAt
        ? new Date(data.expiresAt).getTime()
        : Date.now() + 165000;

    state.resendAt = Date.now() + 25000;

    document.getElementById("resend-otp").disabled = true;

    showScreen("otp-screen");
    startOtpTimer();

    setTimeout(() => {
        otpInputs[0]?.focus();
    }, 50);
}


/* =========================
   OTP TIMER
========================= */

let timer;

function startOtpTimer() {
    clearInterval(timer);

    timer = setInterval(() => {
        const now = Date.now();

        const expiryLeft =
            Math.max(0, state.expiresAt - now);

        const resendLeft =
            Math.max(0, state.resendAt - now);

        document.getElementById("otp-timer").innerHTML =
            expiryLeft
                ? `Code expires in <b>${formatTime(expiryLeft)}</b>`
                : "<b>Code expired.</b>";

        document.getElementById("resend-otp").disabled =
            resendLeft > 0 || !expiryLeft;

        document.getElementById("resend-timer").textContent =
            resendLeft
                ? `(${formatTime(resendLeft)})`
                : "";

        if (!expiryLeft) {
            clearInterval(timer);

            showScreen("expired-screen");

            document.getElementById(
                "expired-destination"
            ).textContent = state.destination;
        }
    }, 250);
}

const formatTime = milliseconds => {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
};


/* =========================
   OTP VERIFICATION
========================= */

document.getElementById("otp-submit").onclick = verifyOtp;

document.getElementById("resend-otp").onclick = resendOtp;

document.getElementById("expired-resend").onclick = resendOtp;

async function verifyOtp() {
    clearErrors();

    const otp = getOtp();

    if (otp.length !== 6) {
        showError(
            "otp-error",
            "Enter the complete 6-digit code."
        );
        return;
    }

    const button =
        document.getElementById("otp-submit");

    setLoading(button, true, "Verifying...");

    try {
        const endpoint =
            state.mode === "registration"
                ? "/verify-email-otp"
                : "/verify-login-otp";

        const { data } = await api.post(endpoint, {
            challengeId: state.challengeId,
            otp,
            method: state.method
        });

        /*
         * Registration:
         * backend can return next = "sms"
         * while keeping the same challengeId.
         */
        if (
            state.mode === "registration" &&
            data.next === "sms"
        ) {
            state.method = "sms";
            state.destination =
                data.destination ||
                state.destination;

            await sendRegistrationSmsOtp();
            return;
        }

        if (
            state.mode === "registration" &&
            data.registrationComplete
        ) {
            showScreen("register-success");
            return;
        }

        location.href =
            data.redirect || "./dashboard.html";

    } catch (error) {

        document
            .getElementById("otp-boxes")
            .classList.add("error-state");

        showError(
            "otp-error",
            error.message ||
            "Incorrect code. Please try again."
        );

        clearOtp();

    } finally {
        setLoading(button, false);
    }
}


/* =========================
   REGISTRATION SMS
========================= */

async function sendRegistrationSmsOtp() {
    try {
        const { data } = await api.post(
            "/send-sms-otp",
            {
                challengeId: state.challengeId
            }
        );

        state.challengeId =
            data.challengeId ||
            state.challengeId;

        state.destination =
            data.destination ||
            state.destination;

        openOtpScreen(data);

    } catch (error) {
        showError(
            "otp-error",
            error.message
        );
    }
}


/* =========================
   RESEND OTP
========================= */

async function resendOtp() {
    try {
        const endpoint =
            state.method === "email"
                ? "/send-email-otp"
                : "/send-sms-otp";

        const { data } = await api.post(
            endpoint,
            {
                challengeId: state.challengeId,
                identity: state.loginIdentity
            }
        );

        /*
         * Your backend can keep the same
         * challengeId and simply replace:
         *
         * channel
         * otp.hash
         * otp.expiresAt
         * otp.attempts
         */

        state.challengeId =
            data.challengeId ||
            state.challengeId;

        state.destination =
            data.destination ||
            state.destination;

        openOtpScreen(data);

    } catch (error) {
        showError(
            "otp-error",
            error.message
        );
    }
}


/* =========================
   REGISTRATION
========================= */

document
    .getElementById("register-form")
    .addEventListener("submit", async e => {

        e.preventDefault();

        const button = e.submitter;

        clearErrors();
        setLoading(button, true, "Creating...");

        try {

            const { data } = await api.post(
                "/register",
                {
                    username:
                        document
                            .getElementById("reg-username")
                            .value
                            .trim(),

                    email:
                        document
                            .getElementById("reg-email")
                            .value
                            .trim(),

                    phoneNumber:
                        document
                            .getElementById("reg-phone")
                            .value
                            .trim(),

                    password:
                        document
                            .getElementById("reg-password")
                            .value,

                    termsChecked:
                        document
                            .getElementById("terms")
                            .checked
                }
            );

            state.mode = "registration";

            state.challengeId =
                data.challengeId;

            state.method = "email";

            state.destination =
                data.email ||
                document
                    .getElementById("reg-email")
                    .value
                    .trim();

            openOtpScreen(data);

        } catch (error) {

            showError(
                "register-error",
                error.message
            );

        } finally {

            setLoading(
                button,
                false
            );
        }
    });