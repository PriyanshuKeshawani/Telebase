# ⚡ Telebase

<p align="center">
  <img src="https://img.shields.io/badge/Speed-Under_15ms-emerald?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Speed Badge">
  <img src="https://img.shields.io/badge/Storage-Infinite_Free-blue?style=for-the-badge&logo=telegram&logoColor=white" alt="Storage Badge">
  <img src="https://img.shields.io/badge/Framework-Next.js_15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="NextJS Badge">
  <img src="https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge" alt="Security Badge">
</p>

**Telebase** is an infinitely scalable, production-grade serverless database and file storage engine. 
It uses **Telegram as the ultimate, free persistent storage backend** and **Cloudflare KV as an ultra-fast edge cache** to achieve sub-15ms reads and zero-cost infinite storage.

---

## 🚀 What is Telebase?

Telebase transforms a private Telegram channel into an ACID-compliant database and blob storage service. 
By sharding data and utilizing Cloudflare's Edge network, Telebase provides developers with a full HTTP REST API that feels like interacting with Firebase or Supabase—but with absolutely zero storage limits or server costs.

## ✨ Features

- **Infinite Storage Capacity**: Store multi-gigabyte files (chunked automatically) using Telegram's massive infrastructure.
- **Ultra-Low Latency (<15ms)**: Cloudflare KV caches your SQL/NoSQL responses at the network edge globally.
- **Zero-Knowledge Security**: AES-256-GCM encryption is applied *before* data leaves your application. Telegram only sees randomized ciphertext.
- **Hybrid Querying**: Supports both SQL (`SELECT * FROM users`) and NoSQL (`{ age: { $gte: 18 } }`) paradigms over the same data.
- **State Sharding & 24h TTLs**: Cloudflare KV acts strictly as a hot-cache with a 24h TTL, completely eliminating Cloudflare storage bloating while keeping Telegram as your permanent source of truth.

---

## 🏗️ Architecture

```text
[ Client / Web App ] 
        │
        ▼ (Reads <15ms / Writes <150ms via HTTP REST)
┌────────────────────────────────┐
│      Telebase Next.js API      │ ◄───► [ Cloudflare KV Edge Cache ]
└──────────────┬─────────────────┘
               │ (Chunked & Encrypted Background Sync)
               ▼
┌────────────────────────────────┐
│   Telegram Private Channel     │ (Infinite, Permanent Storage)
└────────────────────────────────┘
```

---

## 📦 Installation & Quick Start

1. Clone the repository and navigate to the `frontend` directory.
   ```bash
   git clone https://github.com/PriyanshuKeshawani/Telebase.git
   cd Telebase/frontend
   ```
2. Create `.env.local` based on `.env.example`. You will need a Telegram Bot Token, Channel ID, and an AES-256 Encryption key.
3. Install dependencies and start the Telebase Dashboard.
   ```bash
   npm install
   npm run dev
   ```
4. Log into `http://https://telebase.pages.dev/` using your configured admin credentials. Create a Project to get your `x-api-key`.

---

## 🔐 Authentication

All API requests must include your Project API Key in the headers.

```javascript
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': 'your_project_api_key'
}
```

---

## 🗄️ Database CRUD Examples

Telebase allows interacting with your data using either SQL or NoSQL styles dynamically.

### Insert Record
```javascript
await fetch('http://https://telebase.pages.dev//api/db', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    tableName: 'users',
    action: 'INSERT',
    insertData: { name: 'Emma', age: 28, plan: 'pro' }
  })
});
```

### Fetch Records (SQL)
```javascript
const res = await fetch('http://https://telebase.pages.dev//api/db', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    tableName: 'users',
    sqlQuery: "SELECT * FROM users WHERE plan = 'pro'"
  })
});
const { records } = await res.json();
```

### Fetch Records (NoSQL)
```javascript
const res = await fetch('http://https://telebase.pages.dev//api/db', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    tableName: 'users',
    action: 'SELECT',
    noSqlQuery: { age: { $gte: 18 } }
  })
});
```

---

## 📁 Storage Operations

Files are automatically chunked into 10MB segments to safely stream through Cloudflare limits, compressed via Zlib, encrypted with AES-256, and permanently saved to Telegram.

### Upload a File
```javascript
const formData = new FormData();
formData.append('file', document.querySelector('input[type="file"]').files[0]);

const res = await fetch('http://https://telebase.pages.dev//api/data/upload', {
  method: 'POST',
  headers: { 'x-api-key': 'your_project_api_key' },
  body: formData
});
const data = await res.json();
console.log('Stored File UUID:', data.file.uuid);
```

### Download / Stream File Content
To download or embed an image directly into an `<img>` tag, simply use the download endpoint. Telebase automatically fetches the chunks, decrypts, and recompresses them on-the-fly.

```html
<img src="http://https://telebase.pages.dev//api/data/YOUR_FILE_UUID?apiKey=your_project_api_key" />
```

---

## 🙋 FAQ

**Q: Is it really infinite?**  
A: Yes. Telegram imposes no total storage limits on private channels. Telebase chunks files so you can easily store 100GB+ files seamlessly.

**Q: Can Telegram see my data?**  
A: No. All JSON data and files are strictly encrypted locally with AES-256-GCM before the HTTP request to Telegram is ever made.

**Q: What happens if Cloudflare KV expires my data?**  
A: Telebase treats KV strictly as an edge cache (with a 24h TTL to save you money). If a cache miss occurs, Telebase automatically queries the permanent Telegram backup and re-caches it for the next user.

---

## 🗺️ Roadmap

- [x] AES-256-GCM E2E Encryption
- [x] Automatic File Chunking & Decompression
- [x] State Sharding Foundation
- [ ] Active/Active Multi-Bot Pooling (To bypass Telegram rate limits)
- [ ] Real-time WebSocket Subscriptions

---

### License
Telebase is open-source and free to use forever. Build something massive! 🚀
