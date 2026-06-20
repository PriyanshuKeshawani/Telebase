# Telebase API Reference

This document provides a comprehensive specification for the Telebase HTTP REST API.

All API routes require authentication using the Project API Key.

---

## Headers

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | Must be set to `application/json` (except for file uploads). |
| `x-api-key` | Yes | The API key of the target project. Can also be supplied via URL query parameter `?apiKey=...`. |

---

## 1. Database Operations `/api/db`

### GET: Fetch Table Schema & WAL Logs
Returns metadata about tables associated with the project and active WAL entries.

- **URL**: `/api/db`
- **Method**: `GET`
- **Query Params**: `apiKey=...` (optional fallback for headers)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "tables": [
      {
        "name": "users",
        "uuid": "439cf1ae-281b...",
        "sizeBytes": 1024,
        "updatedAt": "2026-06-20T18:00:00Z",
        "version": 1,
        "schema": {
          "fields": {
            "name": "string",
            "age": "number"
          }
        }
      }
    ],
    "walLogs": []
  }
  ```

### POST: Execute Queries / Actions
Performs query executions (SQL/NoSQL) and database operations.

- **URL**: `/api/db`
- **Method**: `POST`
- **Body Options**:

#### A. Execute SQL Query
```json
{
  "sqlQuery": "SELECT * FROM users WHERE age >= 18 LIMIT 5"
}
```

#### B. Execute NoSQL Selector Query
```json
{
  "tableName": "users",
  "action": "SELECT",
  "noSqlQuery": {
    "age": { "$gte": 18 }
  }
}
```

#### C. Create a Table Schema
```json
{
  "action": "CREATE_TABLE",
  "tableName": "users",
  "schema": {
    "name": "users",
    "fields": {
      "name": "string",
      "age": "number",
      "is_active": "boolean"
    },
    "indexes": []
  }
}
```

#### D. Drop a Table
```json
{
  "action": "DROP_TABLE",
  "tableName": "users"
}
```

#### E. Recover/Replay WAL
```json
{
  "action": "RECOVER",
  "tableName": "users"
}
```

#### F. Clear WAL Logs
```json
{
  "action": "CLEAR_LOGS"
}
```

---

## 2. File Upload `/api/data/upload`

Uploads binaries, automatic sharding into 10MB blocks, zlib compression, and encryption.

- **URL**: `/api/data/upload`
- **Method**: `POST`
- **Headers**:
  - `x-api-key: your_api_key`
- **Body**: `FormData` containing the file field.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "file": {
      "uuid": "file_uuid_here",
      "filename": "document.pdf",
      "size": 542031,
      "chunk_count": 1,
      "created_at": "2026-06-20T18:15:00Z"
    }
  }
  ```

---

## 3. File Download `/api/data/[uuid]`

Reassembles chunk files on-the-fly, decrypts, and decompresses.

- **URL**: `/api/data/[uuid]`
- **Method**: `GET`
- **Query Params**: `apiKey=...` (Required)
- **Response (200 OK)**: Streams raw file content with original content-type.
