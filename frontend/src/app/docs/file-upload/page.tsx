export default function FileUploadDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">File Uploads</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Upload media of any size. Telebase automatically chunks, compresses (Zlib), encrypts (AES-256), and pushes to Telegram.
        </p>
      </div>

      <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">Uploading via FormData</h2>
        <p className="text-zinc-400 text-sm mb-4">Send an HTTP POST to <code>/api/data/upload</code> using <code>multipart/form-data</code>.</p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
            {`const formData = new FormData();
formData.append('file', document.querySelector('input[type="file"]').files[0]);

const response = await fetch('http://https://telebase.pages.dev//api/data/upload', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_KEY'
  },
  body: formData
});

const data = await response.json();
console.log('Stored File UUID:', data.file.uuid);`}
          </pre>
        </div>
      </div>
    </div>
  );
}
