# Telebase CLI ⚡

Interactive Command-Line Interface to connect, query, upload, and manage your Telebase serverless database and Telegram storage channel directly from the terminal.

---

## 🏗️ Installation & Setup

### Local Installation (during development)
You can link and install the CLI binary locally:
```bash
cd cli
npm install
npm link
```
*After running `npm link`, the `telebase` command will be globally registered on your machine!*

### Production Installation (after NPM publish)
```bash
npm install -g telebase-cli
```

---

## ⚡ Command Usage Reference

### 1. Initialize Connection
Configure your connection URL and project API key:
```bash
telebase init
```
This prompts for config values and saves them securely in a local `.env` file inside your working directory.

### 2. Check Connection Status
Verify if the target server is online:
```bash
telebase status
```

### 3. Run SQL Queries
Query tables directly from the command line. Results are printed in a clean console table:
```bash
telebase query "SELECT id, name, age FROM users ORDER BY age DESC LIMIT 5"
```

### 4. Upload Files
Upload documents or media files to the Telegram storage channel:
```bash
telebase upload ./my_media_file.zip
```
Prints parameters like filename, size, download URL, and unique **Asset UUID**.

### 5. Download Files
Download files back to your local folder by UUID:
```bash
telebase download <asset-uuid> [custom-output-filename]
```

---

## 🚢 Publishing to NPM
When you are ready to publish `telebase-cli` for public consumption:
1. Log in to your NPM account:
   ```bash
   npm login
   ```
2. Publish the package:
   ```bash
   npm publish --access public
   ```
