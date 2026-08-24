# SecureID Frontend

Plain HTML/CSS/JavaScript frontend based on the supplied SecureID login screenshots and the IAM implementation guidelines.

## Run

Serve this folder with any static server, for example:

```bash
npx serve .
```

or VS Code Live Server.

The frontend expects the backend at:

`http://localhost:3000/api`

Change `API_BASE` in `app.js` if needed.

## Connected endpoints

- POST `/api/register`
- POST `/api/send-email-otp`
- POST `/api/verify-email-otp`
- POST `/api/send-sms-otp`
- POST `/api/verify-sms-otp`
- POST `/api/login`
- POST `/api/verify-login-otp`

The UI also includes the Google and Authenticator App elements shown in the screenshot. They are intentionally not wired to invented backend APIs because those implementations are not defined in the supplied written guidelines.

## Notes

- OTP inputs accept digits only.
- Six boxes are combined into one OTP string before submission.
- Backspace/arrow navigation is supported.
- Six-digit OTP paste is supported.
- Expiry and resend timers are handled on the client for UI purposes.
- Backend expiry/attempt checks remain authoritative.
- `credentials: "include"` is enabled for the session-cookie flow.
