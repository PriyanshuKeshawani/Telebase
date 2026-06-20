# Recovery & WAL Guide

Telebase enforces ACID compliance and transaction durability through an append-only **Write-Ahead Log (WAL)** and an automated **Crash Recovery System**.

---

## 1. What is the Write-Ahead Log (WAL)?

Before any write operations (INSERT, UPDATE, DELETE) are committed to table storage on Cloudflare KV/Telegram, Telebase logs the intent of the mutation in an append-only log array (`walLogs`) inside the master state index.

### WAL Entry Schema
Each entry in the log tracks:
- `id`: Unique transaction identifier (`wal_xxx`).
- `timestamp`: Creation timestamp.
- `operation`: INSERT, UPDATE, or DELETE.
- `recordId`: Target row key/UUID.
- `oldData`: Pre-mutation snapshot (for ROLLBACK support).
- `newData`: Post-mutation snapshot (for REPLAY/REDO support).
- `status`: `PENDING`, `COMMITTED`, or `FAILED`.

---

## 2. The Atomic Transaction Protocol

When executing a write query, Telebase performs the following steps:
1. **Acquire Lock**: Engage a local lock on the table to block concurrency issues.
2. **Log to WAL**: Append a `PENDING` WAL entry describing the modification and save it to the master state (KV + Telegram).
3. **Execute Mutation**: Apply changes to the memory records, and write the updated table file to KV and Telegram.
4. **Commit WAL**: Update the WAL entry status to `COMMITTED` and persist it back to the master state.
5. **Release Lock**: Release the lock.

---

## 3. Crash Recovery (Replay WAL)

If the server crashes, experiences network timeouts, or restarts during Step 3, the database state becomes inconsistent (the WAL entry is `PENDING` but the table records do not reflect the change).

### Automated Recovery
When a query starts, the engine checks for any uncommitted logs on that table:
```typescript
const pending = writeAheadLogs.filter(log => log.status !== 'COMMITTED');
```
If pending logs are found, Telebase automatically initiates **Auto-Recovery**:
1. Replays the uncommitted entries.
2. Applies the missing modifications to the table records.
3. Updates the WAL status to `COMMITTED`.
4. Saves the healed table and state.

This ensures database records are always consistent and fully committed.

### Manual Recovery Execution
You can also trigger recovery manually for a table from the dashboard or through a POST request:
```json
{
  "action": "RECOVER",
  "tableName": "users"
}
```
