// upload-env-cf-api.js
// Uses Cloudflare REST API directly — no wrangler needed!
// Run: node upload-env-cf-api.js

const fs = require('fs');
const path = require('path');

// ─── CONFIG ────────────────────────────────────────────
const PROJECT_NAME = 'telebase';
const ENV_FILE     = path.join(__dirname, '.env.local');

// Skip these (not needed on Edge / already hardcoded in worker)
const SKIP = new Set(['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','FROM_EMAIL']);

// Override these values for production
const OVERRIDES = {
  NEXTAUTH_URL: 'https://telebase.pages.dev',
};

// ─── PARSE .env.local ───────────────────────────────────
function parseEnv(file) {
  const vars = {};
  fs.readFileSync(file, 'utf-8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq === -1) return;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k && v) vars[k] = v;
  });
  return vars;
}

// ─── MAIN ───────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Telebase — Cloudflare Pages Env Uploader (via REST API)\n');

  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ .env.local not found!'); process.exit(1);
  }

  const raw = parseEnv(ENV_FILE);
  const ACCOUNT_ID = raw.CLOUDFLARE_ACCOUNT_ID || 'eed43d4c26f429ea9e4bae59cfa9982d';
  const CF_API_TOKEN = raw.CLOUDFLARE_API_TOKEN || '';

  if (!CF_API_TOKEN) {
    console.error('❌ CLOUDFLARE_API_TOKEN not found in .env.local!');
    process.exit(1);
  }

  const vars = {};

  for (const [k, v] of Object.entries(raw)) {
    if (SKIP.has(k)) { console.log(`⏭️  Skip: ${k}`); continue; }
    if (!v)           { console.log(`⏭️  Skip: ${k} (empty)`); continue; }
    vars[k] = OVERRIDES[k] ?? v;
    if (OVERRIDES[k]) console.log(`🔄 Override: ${k} = ${OVERRIDES[k]}`);
  }

  console.log(`\n📋 ${Object.keys(vars).length} variables to upload:`);
  Object.keys(vars).forEach(k => console.log(`   ✓ ${k}`));

  // Build Cloudflare Pages env vars payload
  // All vars go as "plain_text" type (Cloudflare Pages env var format)
  const envPayload = {};
  for (const [k, v] of Object.entries(vars)) {
    envPayload[k] = { type: 'plain_text', value: v };
  }

  // PATCH the Pages project with new env vars for BOTH production and preview
  const body = {
    deployment_configs: {
      production: { env_vars: envPayload },
      preview:    { env_vars: envPayload },
    }
  };

  console.log('\n📤 Uploading to Cloudflare Pages API...');

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`;

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();

  if (!resp.ok || !data.success) {
    console.error('\n❌ Upload FAILED!');
    console.error('Status:', resp.status);
    console.error('Errors:', JSON.stringify(data.errors || data, null, 2));
    process.exit(1);
  }

  console.log('\n✅ ALL VARIABLES UPLOADED SUCCESSFULLY!\n');
  console.log('🎉 Production & Preview environments updated.');
  console.log('⚡ Trigger a new deployment in Cloudflare Pages dashboard to apply changes.');
  console.log(`   👉 https://dash.cloudflare.com/${ACCOUNT_ID}/pages/view/${PROJECT_NAME}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
