# Accounts

`bun run db:seed` writes reference data only: states, trades, and pricing.
It does not create login users.

Sign in with a real Indian mobile number. A 6-digit OTP is sent by Twilio SMS.
The first successful login creates a customer account for that phone.
