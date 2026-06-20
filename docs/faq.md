# Frequently Asked Questions (FAQ)

Here are answers to the most common questions regarding Telebase architecture, performance, limits, and security.

---

### Q: Is the storage really infinite and free?
**A**: Yes. Telegram imposes no total size or space limits on private channels. Files up to 2GB can be uploaded directly. Telebase chunking splits larger files into 10MB blocks, allowing you to store infinite amounts of data without paying hosting or storage fees.

---

### Q: Can Telegram or third parties read my data?
**A**: No. Telebase utilizes **zero-knowledge E2E encryption**. All JSON tables, file chunks, and transaction logs are compressed and encrypted locally using **AES-256-GCM** before uploading. Only randomized ciphertext is stored on Telegram servers. Without your private `ENCRYPTION_KEY`, the data is completely unreadable.

---

### Q: What is the read/write latency?
**A**:
- **Reads**: Under 15ms. Reads are fully cached at the global network edge using **Cloudflare KV**.
- **Writes**: Under 150ms. Writes update the Cloudflare KV cache and sync with local backups first, while the Telegram backup runs in the background.

---

### Q: What happens if Cloudflare KV expires my data?
**A**: Cloudflare KV acts strictly as a cache. If a cache miss occurs (e.g. data expires after 24h), Telebase automatically queries the permanent Telegram storage channel, decrypts/re-caches the table, and returns the records to the caller. This ensures zero data loss.

---

### Q: Are transactions supported?
**A**: Yes. Telebase implements a **Write-Ahead Log (WAL)**. Any uncommitted writes are logged, and if a transaction fails halfway, the state is rolled back or replayed automatically on the next request.

---

### Q: What are the main rate limits?
**A**: Writes are bound by Telegram Bot API rate limits (maximum 30 posts per second per bot). To scale beyond this, you can configure Cloudflare KV caching which aggregates multiple writes before pushing them to the Telegram backup.
