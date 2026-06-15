# ⚡ Telebase

<p align="center">
  <img src="https://img.shields.io/badge/Speed-Under_15ms-emerald?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Speed Badge">
  <img src="https://img.shields.io/badge/Storage-Infinite_Free-blue?style=for-the-badge&logo=telegram&logoColor=white" alt="Storage Badge">
  <img src="https://img.shields.io/badge/Framework-Next.js_15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="NextJS Badge">
  <img src="https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge" alt="Security Badge">
</p>

---

## 👶 Explain Like I'm 5 (ELI5) — *5-Saal Ke Bacche Ke Liye*

> Imagine **Telegram** is a **giant magical Toy Box 🧸**. You can throw as many toys, pictures, and drawings inside it as you want—it never gets full, and it's completely free!
>
> But finding one specific toy inside a giant box is slow and messy. 
> 
> So, we built a **super-fast Magic Robot 🤖 named Cloudflare**. 
>
> 1. When you give a toy to the robot, it immediately locks it in a safe box, throws a backup into the Telegram Toy Box, and remembers exactly where it is.
> 2. When you ask for the toy back, the Robot hands it to you in the blink of an eye (less than 15 milliseconds)!
>
> **Telebase** is the control panel that lets you talk to this Magic Robot and control your Toy Box from a beautiful screen! ✨

---

## 🚀 What is Telebase?

**Telebase** is a production-grade, secure, and infinitely scalable database and media storage engine that uses **Telegram channels** as its primary storage layer, supercharged by **Cloudflare Workers & KV** as a lightning-fast caching and REST API layer. 

By combining the free, unlimited storage of Telegram with the ultra-low latency of Cloudflare's edge network, Telebase achieves **sub-15ms read speeds** and **sub-150ms write speeds**—all while being 100% free to run!

---

## 🛠️ The Magic Cycle (How it Works)

```
[ Your App / User ] 
       │
       ▼ (Reads <15ms / Writes <150ms)
┌────────────────────────────────┐
│    Cloudflare Edge Worker      │ ◄───► [ Cloudflare KV Cache ]
└──────────────┬─────────────────┘
               │ (Background Sync)
               ▼
┌────────────────────────────────┐
│   Telegram Private Channel     │ (Infinite, Free, Encrypted Storage)
└────────────────────────────────┘
```

---

## ✨ Superpowers (Key Features)

* **💎 100% Free & Infinite Storage:** Leverage Telegram's messaging infrastructure to store files of any size (up to 2GB per chunk) for free.
* **⚡ Sub-15ms Read Latency:** Cloudflare KV caching serves requests directly from the edge, closer to your users.
* **🛡️ Zero-Knowledge Security:** All data is encrypted locally on the server using industry-standard **AES-256-GCM** before being synchronized. Your database is completely unreadable to anyone else, including Telegram!
* **🔄 Active Fallbacks:** If Cloudflare is down, it falls back to Telegram. If Telegram is down, it uses Cloudflare. If both are down, it runs on local persistent storage. High availability guaranteed!
* **📦 Next.js 15 Admin Console:** A premium, modern dashboard to manage your databases, projects, API keys, and uploads in real-time.

---

## ⚙️ Environment Variables Setup

Create a `.env.local` file inside the `frontend` folder and fill in the following variables:

```env
# 🔑 Telegram Configuration
BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_private_channel_id

# 🛡️ Encryption Key (Generate a random 64-character hex string)
ENCRYPTION_KEY=d83d1c1a2d1f7c006b5394ef3425cf26d2e61a6b0c2df8b1ab2512f45c381d6e

# 👤 Admin Credentials
NEXTAUTH_URL=http://https://telebase.pages.dev/
NEXTAUTH_SECRET=generate_any_random_32_character_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose_your_password

# ⚡ Cloudflare Integration (Optional, but highly recommended!)
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_KV_NAMESPACE_ID=your_kv_namespace_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_WORKER_URL=your_worker_url
CLOUDFLARE_WORKER_KEY=your_worker_secret_key

# 📧 Email Notification (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_digit_app_password
```

---

## 🏎️ Running Locally

1. Go to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the magical dashboard:
   ```bash
   npm run dev
   ```
4. Open [http://https://telebase.pages.dev/](http://https://telebase.pages.dev/) in your browser! 🎉

---

## 📜 License

Telebase is open-source and free to use forever. Hack away and build something amazing! 🚀
