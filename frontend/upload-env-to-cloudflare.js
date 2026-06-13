// upload-env-to-cloudflare.js
// Run from: D:\CODE JAANI CODE\Telebase\Telebase\frontend
// Command: node upload-env-to-cloudflare.js
//
// This script reads .env.local and uploads every variable to
// Cloudflare Pages as a secret using: wrangler pages secret put

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECT_NAME = 'telebase'; // Your Cloudflare Pages project name
const ENV_FILE = path.join(__dirname, '.env.local');

// Variables to SKIP (not needed on Cloudflare Pages)
const SKIP_VARS = new Set([
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', // SMTP not supported on Edge
  'FROM_EMAIL', // Controlled by RESEND_FROM_EMAIL if needed
]);

// Override values for Cloudflare production (replaces .env.local values)
const PRODUCTION_OVERRIDES = {
  NEXTAUTH_URL: 'https://telebase.pages.dev',
};

// Parse .env file
function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    if (key && value) {
      vars[key] = value;
    }
  }
  return vars;
}

async function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n🚀 Telebase — Cloudflare Pages Secret Uploader\n');
  console.log(`📂 Reading: ${ENV_FILE}`);

  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ .env.local not found!');
    process.exit(1);
  }

  let vars = parseEnvFile(ENV_FILE);

  // Apply production overrides
  for (const [key, value] of Object.entries(PRODUCTION_OVERRIDES)) {
    if (vars[key] !== undefined) {
      console.log(`🔄 Override: ${key} = ${value} (was: ${vars[key]})`);
      vars[key] = value;
    }
  }

  // Check if RESEND_API_KEY is missing
  if (!vars['RESEND_API_KEY'] || vars['RESEND_API_KEY'] === '') {
    console.log('\n⚠️  RESEND_API_KEY is empty in .env.local');
    const resendKey = await askQuestion('📧 Enter your Resend API Key (get free key at https://resend.com) or press Enter to skip: ');
    if (resendKey) {
      vars['RESEND_API_KEY'] = resendKey;
    } else {
      console.log('⏭️  Skipping RESEND_API_KEY — OTP emails will not work until you add it.');
      delete vars['RESEND_API_KEY'];
    }
  }

  // Filter out skipped vars and empty values
  const toUpload = Object.entries(vars).filter(([key, value]) => {
    if (SKIP_VARS.has(key)) {
      console.log(`⏭️  Skipping: ${key} (not needed on Edge Runtime)`);
      return false;
    }
    if (!value) {
      console.log(`⏭️  Skipping: ${key} (empty value)`);
      return false;
    }
    return true;
  });

  console.log(`\n📋 Variables to upload (${toUpload.length} total):`);
  for (const [key] of toUpload) {
    console.log(`   ✓ ${key}`);
  }

  const confirm = await askQuestion('\n▶️  Upload all to Cloudflare Pages? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled.');
    process.exit(0);
  }

  console.log('\n📤 Uploading secrets to Cloudflare Pages...\n');

  let success = 0;
  let failed = 0;

  for (const [key, value] of toUpload) {
    try {
      // wrangler pages secret put reads value from stdin
      execSync(
        `echo ${JSON.stringify(value)} | npx wrangler pages secret put ${key} --project-name ${PROJECT_NAME}`,
        { 
          stdio: ['pipe', 'pipe', 'pipe'],
          input: value + '\n',
          shell: true
        }
      );
      console.log(`✅ ${key} — uploaded`);
      success++;
    } catch (err) {
      // Try alternative method
      try {
        const { spawnSync } = require('child_process');
        const result = spawnSync('npx', ['wrangler', 'pages', 'secret', 'put', key, '--project-name', PROJECT_NAME], {
          input: value + '\n',
          encoding: 'utf-8',
          shell: true
        });
        if (result.status === 0) {
          console.log(`✅ ${key} — uploaded`);
          success++;
        } else {
          console.error(`❌ ${key} — FAILED: ${result.stderr}`);
          failed++;
        }
      } catch (err2) {
        console.error(`❌ ${key} — FAILED: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n🎉 Done! ${success} secrets uploaded, ${failed} failed.`);
  
  if (success > 0) {
    console.log('\n⚡ Triggering a new deployment to apply the secrets...');
    try {
      execSync(`npx wrangler pages deployment create --project-name ${PROJECT_NAME} --branch main`, { 
        stdio: 'inherit', shell: true 
      });
    } catch (e) {
      console.log('ℹ️  Could not trigger deployment automatically.');
      console.log('   Please go to Cloudflare Dashboard and click "Retry deployment" manually.');
    }
  }

  if (failed > 0) {
    console.log('\n⚠️  Some variables failed. Try running wrangler manually:');
    console.log('   echo "VALUE" | npx wrangler pages secret put VARIABLE_NAME --project-name telebase');
  }
}

main().catch(console.error);
