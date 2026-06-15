export default function FileDownloadDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">File Downloads</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Stream securely encrypted files directly into the browser.
        </p>
      </div>

      <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">Direct URL Streaming</h2>
        <p className="text-zinc-400 text-sm mb-4">
          You can use the endpoint <code>/api/data/[uuid]</code> directly in your HTML tags like <code>&lt;img&gt;</code>, <code>&lt;video&gt;</code>, or generic anchor tags.
          The backend fetches the chunks, decrypts them, recompresses, and streams them on the fly.
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
            {`// Using inside an Image tag
<img 
  src="http://https://telebase.pages.dev//api/data/YOUR_FILE_UUID?apiKey=YOUR_KEY" 
  alt="Encrypted Telegram Media"
/>

// Using for direct download
<a 
  href="http://https://telebase.pages.dev//api/data/YOUR_FILE_UUID?apiKey=YOUR_KEY&download=true"
>
  Download Secure File
</a>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
