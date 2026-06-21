# ⚡ Telebase

<p align="center">
  <img src="https://img.shields.io/badge/Speed-Under_15ms-emerald?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Speed Badge">
  <img src="https://img.shields.io/badge/Storage-Infinite_Free-blue?style=for-the-badge&logo=telegram&logoColor=white" alt="Storage Badge">
  <img src="https://img.shields.io/badge/Framework-Next.js_15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="NextJS Badge">
  <img src="https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge" alt="Security Badge">
</p>

**Telebase** is an open-source backend platform powered by Telegram infrastructure, designed for students, hackathons and side projects. It uses **Telegram as the ultimate, free persistent storage backend** and **Cloudflare KV as an ultra-fast edge cache** to achieve sub-15ms reads, sub-150ms writes, and zero-cost infinite storage.

---

## 🚀 Why Telebase?

Modern serverless databases charge heavily for storage capacity, read/write operations, and database connections. Telebase solves this by transforming a private Telegram channel into a secure, transactional, ACID-compliant database. By sharding data and utilizing Cloudflare's global Edge network, Telebase provides a Firebase-like BaaS platform with:
- **Zero Storage Costs**: Leverages Telegram's infinite media storage capacity.
- **Zero Connection Limits**: No database connection pool issues on serverless functions.
- **Privacy First**: Fully client-side encrypted before any request leaves the isolate.

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

The database consists of a master index (`DatabaseSchema`) containing project metadata, file registries, user registers, and transaction logs. Database tables and user blobs are sharded, compressed, encrypted via AES-256-GCM, and uploaded as documents on Telegram. Pinned channel messages serve as the source of truth, pointing to the latest version of the state index.

---

## ✨ Features Currently Supported

- **Infinite File Storage**: Automatically chunks large files into 10MB segments, compresses them using Gzip/Deflate, encrypts them, and uploads them to Telegram.
- **Ultra-Low Latency Edge Caching**: Replicates query-ready database tables to Cloudflare KV for global sub-15ms read speeds.
- **ACID Compliance & WAL Logs**: Employs an append-only Write-Ahead Log (WAL) to track, commit, and roll back transactions during failures.
- **Distributed Crash Recovery**: Replays WAL entries automatically upon server startups or concurrency conflicts.
- **Dual-Engine Querying**: Query the same dataset using SQL or MongoDB-style NoSQL JSON queries.
- **Project Isolation**: Full multi-tenant configuration allows managing multiple isolated projects through a central dashboard.

---

## 📊 SQL Support Status

Telebase features a custom SQL parser designed for Edge runtime modularity.

| Statement | Supported Syntax / Details | Status |
|---|---|---|
| `SELECT` | Column projections, `AS` aliases, `WHERE` expressions, aggregate `COUNT()`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT` | **Supported** |
| `INNER JOIN` | Equality joins on columns across tables (`ON tableA.id = tableB.ref_id`) | **Supported** |
| `INSERT` | Standard insert values: `INSERT INTO table (col1, col2) VALUES (val1, val2)` | **Supported** |
| `UPDATE` | Set updates with filter conditions: `UPDATE table SET col1 = val1 WHERE id = val2` | **Supported** |
| `DELETE` | Filtered delete: `DELETE FROM table WHERE id = val` | **Supported** |
| `CREATE TABLE` | Create tables with fields: `CREATE TABLE name (col1 TEXT, col2 INT)` | **Supported** |
| `DROP TABLE` | Drop table: `DROP TABLE name` | **Supported** |
| `ALTER TABLE` | Add or drop columns: `ALTER TABLE name ADD COLUMN email TEXT` / `DROP COLUMN email` | **Supported** |
| `CREATE INDEX` | Create single-column indexes for fast pointer lookups: `CREATE INDEX idx ON table (col)` | **Supported** |
| `DROP INDEX` | Drop indexes: `DROP INDEX idx ON table` | **Supported** |
| `SHOW TABLES` | Lists all tables | **Supported** |
| `DESCRIBE` | Describes table schema | **Supported** |

---

## 🗂️ NoSQL Support Status

NoSQL queries use a MongoDB-style query selector.

| Selector | Operator | Description | Status |
|---|---|---|---|
| Exact Match | `{ key: value }` | Checks for equality | **Supported** |
| Equal | `{ key: { $eq: value } }` | Checks for equality | **Supported** |
| Not Equal | `{ key: { $ne: value } }` | Checks for inequality | **Supported** |
| Greater Than | `{ key: { $gt: value } }` | Checks if key is greater than value | **Supported** |
| Greater or Equal| `{ key: { $gte: value } }` | Checks if key is greater/equal to value | **Supported** |
| Less Than | `{ key: { $lt: value } }` | Checks if key is less than value | **Supported** |
| Less or Equal | `{ key: { $lte: value } }` | Checks if key is less/equal to value | **Supported** |
| Regex / Like | `{ key: { $regex: 'pattern' } }`| Regexp matching (case-insensitive) | **Supported** |

---

## 🔐 Authentication Model

All client API requests must authenticate using a Project API Key sent in the headers.

```http
x-api-key: your_telebase_project_api_key
```

Administrative dashboard access is governed by **NextAuth.js** supporting password-based fallbacks, session tokens, and OTP verification via SMTP/Resend.

---

## 💾 Storage Model

Data is organized into **Database Shards** (compressed JSON files) representing tables, and **File Chunks** representing raw uploaded binaries.
1. **Local Disk Backup**: Writes to `/tmp` or `.telebase_data` first for immediate durability.
2. **Cloud Cache Layer**: Cloudflare KV acts as the hot cache, storing state chunks for near-instant access.
3. **Telegram Source of Truth**: Data is uploaded, pinned, and deleted on a private Telegram channel. Pinned messages hold metadata, verifying the cryptographic integrity of the state index.

---

## 📦 Installation & Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/PriyanshuKeshawani/Telebase.git
cd Telebase/frontend
```

### 2. Configure Environment Variables
Copy `.env.example` to create your local configurations:
```bash
cp .env.example .env.local
```
Fill in the `BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, and generate a 32-byte hex `ENCRYPTION_KEY`.

### 3. Install Dependencies & Build
```bash
npm install
npm run build
npm run dev
```
Open `http://localhost:3000` to access the administrator console.

---

## 💡 Example Usage

### JavaScript API Call

```javascript
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': 'your_project_api_key'
};

// SQL Query Execution
const sqlRes = await fetch('/api/db', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    sqlQuery: "SELECT * FROM customers WHERE plan = 'enterprise' LIMIT 10"
  })
});
const { records } = await sqlRes.json();
```

---

## 📁 Project Structure

```text
├── docs/                     # Detailed technical guides and references
├── frontend/                 # Next.js web portal dashboard & backend API
│   ├── src/
│   │   ├── app/api/          # Database, WAL, and file storage Edge routes
│   │   └── lib/              # Custom query parser & Telegram database connector
│   └── .env.example          # Sample environment variables
└── README.md                 # Project entry point
```

---

## 🚀 Current Project Status

### Developer Beta Status: **Ready for Developer Preview**

#### Completed:
- **Authentication**: Project API-key validation and multi-tenant admin login flows.
- **Project Isolation**: Logical namespace partitioning across projects.
- **WAL Recovery**: Automated recovery replaying uncommitted entries from logs on conflicts.
- **Backup & Restore**: Multi-ring snapshot rotation in Cloudflare KV (backup rings 1, 2, 3) and `restoreState` flows.
- **SQL Engine**: Core SELECT/INSERT/UPDATE/DELETE custom parser with joins and aggregations.
- **NoSQL Engine**: Selector-based MongoDB query matches.
- **Schema Management**: Dynamic column additions, drop columns, and indexing.

#### In Progress:
- **Distributed Concurrency Hardening**: Verification of WAL locks across global Cloudflare edge zones.
- **Production Reliability Testing**: End-to-end integration crash simulations.
- **Edge Consistency Improvements**: Stale-while-revalidate KV cache handling.

---

## 🗺️ Future Roadmap

### Phase 1: Developer Beta (Current)
- Public beta rollout for developers.
- Stability testing under concurrent writes.
- Community feedback collection.

### Phase 2: Advanced Concurrency Controls
- Distributed write locking improvements.
- Active/Active Multi-Bot Pooling (to bypass Telegram API rate limit throttle zones).
- Real-time metrics dashboard.

### Phase 3: Production Hardening
- Enterprise schema structures.
- Automatic sharding based on table file sizes.
- Direct streaming integrations.

---

## 🛑 Known Limitations

- **Rate Limits**: Heavy writes are bound by Telegram API rate limiting (max 30 uploads/sec per bot). We recommend using the Cloudflare KV cache to coalesce writes.
- **Eventually Consistent Cache**: Cloudflare KV writes may take up to 60 seconds to propagate globally (though they are immediate locally).

---

## 🔒 Security Notes

- **End-to-End Zero Knowledge**: All data blocks, files, and state logs are encrypted with AES-256-GCM *before* uploading to Telegram.
- **Master Key Security**: Protect your `ENCRYPTION_KEY`. If lost, the encrypted databases on Telegram can never be decrypted.

---

## 🤝 How to Contribute

We welcome contributions to Telebase! Here is how you can help:
1. **Bug Reports**: Open an issue detailing steps to reproduce the bug, expected vs actual behavior, and environment logs.
2. **Testing**: Run query engine edge test scripts and add unit tests for custom query scenarios.
3. **Documentation**: Improve guides in `docs/` or translate docs to other languages.
4. **Feature Proposals**: Submit an issue detailing the feature proposal and architectural design before creating a Pull Request.
5. **Security Reporting**: Please report security vulnerabilities directly to the maintainers rather than opening a public issue.

---

## 📄 License & Support

Telebase is open-source software licensed under the [MIT License](LICENSE).
For support, join our community forums or open a GitHub issue.
