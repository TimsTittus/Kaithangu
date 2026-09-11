# Accounts

`bun run db:seed` writes reference data only: states, trades, and pricing.
It does not create login users.

Sign in with a real Indian mobile number. A 6-digit OTP is sent by Twilio SMS.
The first successful login creates an account for that phone using the profile
chosen on the login screen (`user`, `worker`, or `corporate`).
