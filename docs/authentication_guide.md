# Authentication Guide

Telebase handles authentication at two distinct levels:
1. **Administrative Portal Authentication**: Secures the dashboard panel.
2. **Client Project Authentication**: Secures API REST endpoint interactions.

---

## 1. Administrative Portal Access

The Telebase dashboard portal uses **NextAuth.js** to manage administrative session credentials.

### Configuration (`.env.local`)
The primary administrator account details are defined in environment configurations:
```env
# NextAuth Secret Token (for session signature validation)
NEXTAUTH_SECRET=generate_a_secure_token

# Fallback Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
```

### One-Time Password (OTP) Support
When adding email registers, Telebase uses SMTP or Resend API configurations to dispatch 6-digit numeric OTP validation codes to admin users.
- **SMTP**: Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`.
- **Resend**: Configure `RESEND_API_KEY` and `FROM_EMAIL`.

---

## 2. Client Project API Key Access

Every isolated tenant project generated in the dashboard is assigned a unique, cryptographically strong `x-api-key`. 

### Authenticating REST API Requests
Your applications must pass the API key in one of the following formats:

#### Method A: Headers (Recommended)
Include `x-api-key` in the request headers:
```javascript
const response = await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'tb_proj_prod_a7c8...'
  },
  body: JSON.stringify({ ... })
});
```

#### Method B: Query Parameter
Useful for embedding raw assets (e.g. images) directly into html templates:
```html
<img src="https://telebase.pages.dev/api/data/file-uuid?apiKey=tb_proj_prod_a7c8..." />
```

---

## 3. Cryptographic Master Security

All records and shards are encrypted on-the-fly using the database master encryption key:
```env
ENCRYPTION_KEY=64_character_hex_master_key
```
If omitted, a key is deterministically derived from `BOT_TOKEN`.
> [!WARNING]
> If you rotate the `ENCRYPTION_KEY` or change your `BOT_TOKEN` without migrating existing states, you will lose access to all historically encrypted data.
