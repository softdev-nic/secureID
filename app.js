 import api from "./API.js";

const state = {
    challengeId: null,
    method: "email",
    destination: "",
    expiresAt: null,
    resetToken: null
};

const screens = [...document.querySelectorAll(".screen")];
const otpInputs = [...document.querySelectorAll("#otp-boxes input")];
let timer;

const showScreen = id => {
    screens.forEach(s => s.classList.toggle("active", s.id === id));
    clearErrors();
};

const clearErrors = () => {
    document.querySelectorAll(".error").forEach(e => {
        e.textContent = "";
        e.classList.add("hidden");
    });

    document.getElementById("otp-boxes")?.classList.remove("error-state");
};

const showError = (id, msg) => {
    const e = document.getElementById(id);
    if (!e) return;

    e.textContent = msg;
    e.classList.remove("hidden");
};

const loading = (btn, value, text) => {
    if (!btn) return;

    btn.disabled = value;

    if (value) {
        btn.dataset.text = btn.textContent;
        btn.textContent = text;
    } else if (btn.dataset.text) {
        btn.textContent = btn.dataset.text;
    }
};

document.getElementById("login-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors();

    const btn = e.submitter;
    const email = document.getElementById("identity").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        showError("login-error", "Please enter your email and password.");
        return;
    }

    loading(btn, true, "Logging in...");

    try {
        const { data } = await api.post("/login", {
            email,
            password
        });

        localStorage.setItem("auth-token", data.token);

        if (data.user?.isVerified === false) {
            showError("login-error", "Account is not verified.");
            return;
        }

        window.location.href = data.redirect || "./dashboard.html";
    } catch (err) {
        showError("login-error", err.message || "Login failed.");
    } finally {
        loading(btn, false);
    }
});

document.getElementById("register-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors();

    const btn = e.submitter;

    loading(btn, true, "Creating...");

    try {
        const { data } = await api.post("/register", {
            username: document.getElementById("reg-username").value.trim(),
            email: document.getElementById("reg-email").value.trim(),
            phoneNumber: document.getElementById("reg-phone").value.trim(),
            password: document.getElementById("reg-password").value,
            termsChecked: document.getElementById("terms").checked
        });

        state.challengeId = data.challengeId;
        state.method = "email";
        state.destination =
            document.getElementById("reg-email").value.trim();

        openOtpScreen();
    } catch (err) {
        showError("register-error", err.message);
    } finally {
        loading(btn, false);
    }
});

otpInputs.forEach((input, i) => {
    input.addEventListener("input", e => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(-1);

        if (e.target.value && i < otpInputs.length - 1)
            otpInputs[i + 1].focus();
    });

    input.addEventListener("keydown", e => {
        if (e.key === "Backspace" && !input.value && i > 0)
            otpInputs[i - 1].focus();

        if (e.key === "ArrowLeft" && i > 0)
            otpInputs[i - 1].focus();

        if (e.key === "ArrowRight" && i < otpInputs.length - 1)
            otpInputs[i + 1].focus();

        if (e.key === "Enter")
            verifyOtp();
    });

    input.addEventListener("paste", e => {
        const text = e.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);

        if (!text) return;

        e.preventDefault();

        [...text].forEach((digit, n) => {
            if (otpInputs[n])
                otpInputs[n].value = digit;
        });

        otpInputs[Math.min(text.length, 6) - 1]?.focus();
    });
});

const getOtp = () => otpInputs.map(i => i.value).join("");

const clearOtp = () => {
    otpInputs.forEach(i => i.value = "");
    otpInputs[0]?.focus();
};

function openOtpScreen() {
    clearErrors();
    clearOtp();

    document.getElementById("otp-title").textContent =
        state.method === "sms"
            ? "SMS Verification"
            : "Email Verification";

    document.getElementById("otp-destination").textContent =
        state.destination;

    state.expiresAt = Date.now() + 5 * 60 * 1000;

    showScreen("otp-screen");
    startTimer();
}

function startTimer() {
    clearInterval(timer);

    timer = setInterval(() => {
        const left = Math.max(0, state.expiresAt - Date.now());

        document.getElementById("otp-timer").innerHTML =
            left
                ? `Code expires in <b>${formatTime(left)}</b>`
                : "<b>Code expired.</b>";

        if (!left) {
            clearInterval(timer);
            showScreen("expired-screen");

            document.getElementById("expired-destination").textContent =
                state.destination;
        }
    }, 250);
}

const formatTime = ms => {
    const seconds = Math.ceil(ms / 1000);

    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

document.getElementById("otp-submit")?.addEventListener("click", verifyOtp);

async function verifyOtp() {
    clearErrors();

    const otp = getOtp();

    if (otp.length !== 6) {
        showError("otp-error", "Enter the complete 6-digit code.");
        return;
    }

    const btn = document.getElementById("otp-submit");

    loading(btn, true, "Verifying...");

    try {
        const { data } = await api.post("/otp/verify", {
            otp,
            challengeId: state.challengeId
        });

        if (data.challengeId) {
            state.challengeId = data.challengeId;
            state.method = "sms";
            state.destination =
                document.getElementById("reg-phone")?.value.trim() ||
                state.destination;

            openOtpScreen();
            return;
        }

        if (data.message === "User verified") {
            clearInterval(timer);
            showScreen("success-screen");
        }
    } catch (err) {
        document.getElementById("otp-boxes")?.classList.add("error-state");

        showError(
            "otp-error",
            err.message || "Invalid OTP. Try again."
        );

        clearOtp();
    } finally {
        loading(btn, false);
    }
}

document.getElementById("forgot-password")?.addEventListener("click", () => {
    showScreen("forgot-password-screen");
});

document.getElementById("forgot-password-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors();

    const btn = e.submitter;
    const email = document.getElementById("forgot-email").value.trim();

    if (!email) {
        showError("forgot-error", "Enter your email.");
        return;
    }

    loading(btn, true, "Sending...");

    try {
        const { data } = await api.post("/password/forgot", {
            email
        });

        state.resetToken = data.resetToken;

        showScreen("reset-password-screen");
    } catch (err) {
        showError(
            "forgot-error",
            err.message || "Unable to generate reset link."
        );
    } finally {
        loading(btn, false);
    }
});

document.getElementById("reset-password-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors();

    const btn = e.submitter;
    const password = document.getElementById("new-password").value;
    const confirmPassword =
        document.getElementById("confirm-password").value;

    if (!password || !confirmPassword) {
        showError("reset-error", "Please enter both passwords.");
        return;
    }

    if (password !== confirmPassword) {
        showError("reset-error", "Passwords do not match.");
        return;
    }

    loading(btn, true, "Resetting...");

    try {
        await api.post(
            `/password/reset/${state.resetToken}`,
            { password }
        );

        state.resetToken = null;

        showScreen("login-screen");
    } catch (err) {
        showError(
            "reset-error",
            err.message || "Password reset failed."
        );
    } finally {
        loading(btn, false);
    }
});

document.getElementById("create-account")?.addEventListener("click", () => {
    showScreen("register-screen");
});

document.querySelectorAll("[data-back]").forEach(btn => {
    btn.addEventListener("click", () => {
        showScreen(btn.dataset.back);
    });
});

document.getElementById("toggle-password")?.addEventListener("click", () => {
    const input = document.getElementById("password");

    input.type =
        input.type === "password"
            ? "text"
            : "password";
});

document.getElementById("google-login")?.addEventListener("click", () => {
    alert("Google Sign-In is not connected yet.");
});