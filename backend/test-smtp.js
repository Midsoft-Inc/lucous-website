/**
 * Sends a REAL test email with the same code path your app uses for OTP emails.
 * Put this file in the backend folder (next to server.js) and run:
 *     node test-smtp.js yourname@gmail.com
 * It reads SMTP_USER / SMTP_PASS from backend/.env and never prints the password.
 */
require("dotenv").config();
const { isEmailConfigured, sendOtpEmail } = require("./services/email-service");

const to = (process.argv[2] || process.env.SMTP_USER || "").trim();

if (!isEmailConfigured()) {
  console.error("Email is OFF. Add these two lines to backend/.env, then run again:\n");
  console.error("  SMTP_USER=yourapp@gmail.com");
  console.error("  SMTP_PASS=abcdefghijklmnop      (16-character Gmail App Password, not your normal password)");
  process.exit(1);
}
if (!to) {
  console.error("Usage: node test-smtp.js recipient@gmail.com");
  process.exit(1);
}

console.log(`Sending a test code from ${process.env.SMTP_USER} to ${to} ...`);

sendOtpEmail(to, "123456", "VERIFY", 10)
  .then(() => {
    console.log("\nSUCCESS. Check the inbox (and the Spam folder) of " + to + " for the code 123456.");
  })
  .catch((err) => {
    console.error("\nFAILED:", err.message);
    if (err.responseCode === 535 || /Invalid login|Username and Password/i.test(err.message)) {
      console.error("-> Google rejected the login. Use a Gmail APP PASSWORD (16 characters), not your normal password.");
      console.error("   Turn on 2-Step Verification first, then create it at https://myaccount.google.com/apppasswords");
    } else if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ESOCKET/i.test(err.code || err.message)) {
      console.error("-> Could not reach Gmail. Check your internet / firewall / VPN (port 465).");
    }
    process.exit(1);
  });