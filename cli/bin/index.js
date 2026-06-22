#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables if local .env exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Custom formatted terminal logging
const log = {
  success: (msg) => console.log(`\x1b[32m✔\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m✖\x1b[0m ${msg}`),
  info: (msg) => console.log(`\x1b[34mℹ\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  header: (msg) => console.log(`\n\x1b[35m⚡ ${msg}\x1b[0m\n`)
};

program
  .name('telebase')
  .description('Telebase Command Line Interface')
  .version('1.0.0');

// Command: init
program
  .command('init')
  .description('Initialize a new Telebase connection config')
  .action(() => {
    log.header('Initializing Telebase Config');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Enter Telebase API Server URL (default: https://telebase.pages.dev): ', (apiUrl) => {
      const formattedApiUrl = apiUrl.trim() || 'https://telebase.pages.dev';
      
      rl.question('Enter Project API Key: ', (apiKey) => {
        if (!apiKey.trim()) {
          log.error('API Key cannot be empty!');
          rl.close();
          return;
        }

        const envContent = `TELEBASE_API_URL="${formattedApiUrl}"\nTELEBASE_API_KEY="${apiKey.trim()}"\n`;
        fs.writeFileSync(envPath, envContent, 'utf-8');
        log.success('Configuration saved to .env file successfully!');
        log.info('You can now run commands like: telebase status');
        rl.close();
      });
    });
  });

// Command: status
program
  .command('status')
  .description('Check connectivity to the Telebase backend server')
  .action(async () => {
    const apiUrl = process.env.TELEBASE_API_URL;
    const apiKey = process.env.TELEBASE_API_KEY;

    if (!apiUrl || !apiKey) {
      log.error('Config not found! Run "telebase init" first.');
      process.exit(1);
    }

    log.info(`Connecting to: ${apiUrl}...`);

    try {
      // Hit status endpoint or execute a dummy ping query
      const response = await fetch(`${apiUrl}/api/db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ sqlQuery: 'SHOW TABLES' })
      });

      if (response.ok) {
        log.success('Connected successfully! Telebase server is online.');
        const result = await response.json();
        const tables = result.records || [];
        log.info(`Tables registered in project: ${tables.length}`);
      } else {
        log.error(`API response failed with status: ${response.status}`);
      }
    } catch (err) {
      log.error(`Failed to connect: ${err.message}`);
    }
  });

// Command: query
program
  .command('query <sqlQuery>')
  .description('Execute SQL queries directly on your database')
  .action(async (sqlQuery) => {
    const apiUrl = process.env.TELEBASE_API_URL;
    const apiKey = process.env.TELEBASE_API_KEY;

    if (!apiUrl || !apiKey) {
      log.error('Config not found! Run "telebase init" first.');
      process.exit(1);
    }

    log.info('Executing query...');

    try {
      const response = await fetch(`${apiUrl}/api/db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ sqlQuery })
      });

      const result = await response.json();
      if (!response.ok) {
        log.error(`Query failed: ${result.error || response.statusText}`);
        process.exit(1);
      }

      log.success('Query executed successfully!');
      
      const records = result.records || [];
      if (records.length === 0) {
        log.info('No records returned.');
      } else {
        console.table(records);
      }
    } catch (err) {
      log.error(`Connection error: ${err.message}`);
    }
  });

// Command: upload
program
  .command('upload <filePath>')
  .description('Upload files of any size directly to your Telegram storage channel')
  .action(async (filePath) => {
    const apiUrl = process.env.TELEBASE_API_URL;
    const apiKey = process.env.TELEBASE_API_KEY;

    if (!apiUrl || !apiKey) {
      log.error('Config not found! Run "telebase init" first.');
      process.exit(1);
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      log.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    log.info(`Reading file: ${path.basename(resolvedPath)}...`);

    try {
      const fileBuffer = fs.readFileSync(resolvedPath);
      const blob = new Blob([fileBuffer]);
      
      // Build FormData
      const formData = new global.FormData();
      formData.append('file', blob, path.basename(resolvedPath));

      log.info('Uploading to Telegram storage channel...');
      const response = await fetch(`${apiUrl}/api/data/upload`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey
        },
        body: formData
      });

      const result = await response.json();
      if (!response.ok) {
        log.error(`Upload failed: ${result.error || response.statusText}`);
        process.exit(1);
      }

      log.success('File uploaded successfully!');
      log.info(`File Name: ${result.file.name}`);
      log.info(`File Size: ${(result.file.size / (1024 * 1024)).toFixed(2)} MB`);
      log.info(`Asset UUID: \x1b[36m${result.file.uuid}\x1b[0m`);
      log.info(`Retrieve URL: ${apiUrl}/api/data/download?uuid=${result.file.uuid}`);
    } catch (err) {
      log.error(`Network error during upload: ${err.message}`);
    }
  });

// Command: download
program
  .command('download <uuid> [outputName]')
  .description('Download asset files by UUID from your Telegram storage channel')
  .action(async (uuid, outputName) => {
    const apiUrl = process.env.TELEBASE_API_URL;
    const apiKey = process.env.TELEBASE_API_KEY;

    if (!apiUrl || !apiKey) {
      log.error('Config not found! Run "telebase init" first.');
      process.exit(1);
    }

    log.info(`Fetching file details for UUID: ${uuid}...`);

    try {
      const response = await fetch(`${apiUrl}/api/data/download?uuid=${uuid}`);
      if (!response.ok) {
        log.error(`Download request failed: status ${response.status}`);
        process.exit(1);
      }

      // Check header parameters to get original file name if outputName isn't provided
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = outputName || `download-${uuid}`;
      if (!outputName && contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const fileBuffer = await response.arrayBuffer();
      const outputPath = path.resolve(process.cwd(), fileName);
      
      fs.writeFileSync(outputPath, Buffer.from(fileBuffer));
      log.success(`File downloaded and saved to: ${outputPath}`);
    } catch (err) {
      log.error(`Network error during download: ${err.message}`);
    }
  });

program.parse(process.argv);
