# Backup & Restore Guide

Telebase ensures durability and recovery correctness through an automated, multi-ring backup rotation system in Cloudflare KV.

---

## 1. Automated Snapshot Rotation

Every time `saveDatabaseState()` is called (during table mutations, schema modifications, index updates, etc.), Telebase shifts snapshot backup rings inside Cloudflare KV:

1. **Rotation Cycle**:
   - `telebase_state_backup_2` is copied to `telebase_state_backup_3`.
   - `telebase_state_backup_1` is copied to `telebase_state_backup_2`.
   - The current active state `telebase_state_current` is copied to `telebase_state_backup_1`.
   - The new state payload is saved as the active `telebase_state_current`.

2. **Ring Retentions**:
   This gives you three layers of historical rollback checkpoints (`backup_1`, `backup_2`, `backup_3`) to recover from accidental deletions or logical corruption.

---

## 2. Triggering a State Rollback

If a table is dropped accidentally, or data corruption is introduced, you can roll back your database state to one of the snapshot backups using the `restoreState` endpoint.

### Restore Endpoint Action
You can trigger a restoration by making a request to `/api/db` with the `restoreState` query parameters, or calling the private method `restoreState(backupIndex)`:

```javascript
// Example API rollback execution
const res = await fetch('/api/db', {
  method: 'POST',
  headers: {
    'x-api-key': 'admin_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'RESTORE',
    backupIndex: 1 // Choose from 1, 2, or 3
  })
});
```

### Under the Hood: The Restore Flow
When `restoreState(backupIndex)` is executed, the following atomic steps are performed:
1. **Retrieve**: Read the raw encrypted bytes from the requested backup ring (e.g. `telebase_state_backup_1`) in Cloudflare KV.
2. **Decrypt**: Decrypt the payload using your master `ENCRYPTION_KEY`.
3. **Monotonic Version Bump**: Increment the version ID (e.g., `restoredState.version = currentVersion + 1`) to ensure replica indexes advance.
4. **Telegram Sync & Pin**:
   - Upload the restored state as a new document to your Telegram storage channel.
   - Pinned the new upload.
   - Delete the old Telegram message pointer to keep the channel clean.
   - Edit the uploaded document media to embed the finalized `last_pinned_message_id`.
5. **KV Overwrite**: Overwrite the `telebase_state_current` key with the updated state containing the new pinned message ID.
6. **Local Sync**: Overwrite `local_state.json` on the local file system.
