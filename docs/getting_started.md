# Getting Started with Telebase

This guide walks you through setting up a Telebase database instance from scratch.

## Prerequisites

Before starting, make sure you have:
- Node.js v18+ installed.
- A Telegram account.
- A Cloudflare account (optional, required for edge caching).

---

## Step 1: Set Up Your Telegram Storage Backend

Telegram acts as your permanent database and binary storage layer.

1. **Create a Private Channel**:
   - Open Telegram and create a new channel. Set it to **Private**.
   - Note the **Channel ID** (e.g., `-1002345678901`).

2. **Create a Bot**:
   - Open Telegram and chat with [@BotFather](https://t.me/BotFather).
   - Use `/newbot` to create a new bot.
   - Save the **Bot Token** (e.g., `8216712040:AAFw...`).

3. **Add Bot to Channel**:
   - Go to your channel settings, click **Administrators**, and add your bot as an administrator.
   - Ensure the bot has permissions to **Post Messages**, **Edit Messages**, and **Delete Messages**.

---

## Step 2: Set Up Cloudflare KV (Optional but Recommended)

Cloudflare KV serves as a hot caching layer to give you sub-15ms reads.

1. Log into your Cloudflare Dashboard.
2. Go to **KV** under the **Workers & Pages** menu.
3. Click **Create a Namespace** and name it `TELEBASE_KV`.
4. Copy the following keys from your Cloudflare account profile settings:
   - **Account ID**
   - **KV Namespace ID**
   - **API Token** (Make sure the token has permissions to read/write KV).

---

## Step 3: Run Telebase Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/PriyanshuKeshawani/Telebase.git
   cd Telebase/frontend
   ```

2. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. Fill in the environment keys:
   ```env
   BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHANNEL_ID=your_telegram_channel_id
   ENCRYPTION_KEY=your_generated_32_byte_hex_key
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   CLOUDFLARE_KV_NAMESPACE_ID=your_kv_namespace_id
   CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   ```

4. Install dependencies and start development server:
   ```bash
   npm install
   npm run dev
   ```

5. Visit `http://localhost:3000` to log in with your administrative credentials (`ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env.local`).

---

## Step 4: Create Your First Project

1. From the dashboard UI, click **Create Project**.
2. Give your project a name and click **Generate API Key**.
3. Copy your project's `x-api-key`. This key is used to authenticate all subsequent client/API requests.
4. Create a table (e.g., `users`) from the UI. You are now ready to read/write data!
