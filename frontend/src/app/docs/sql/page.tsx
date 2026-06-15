export default function SqlDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">SQL Queries</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Execute familiar SQL syntax natively via the Telebase REST API.
        </p>
      </div>

      <div className="space-y-8">
        {/* SELECT */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">SELECT</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('http://https://telebase.pages.dev//api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    sqlQuery: "SELECT * FROM users WHERE status = 'active'"
  })
});`}
            </pre>
          </div>
        </div>

        {/* INSERT */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">INSERT</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('http://https://telebase.pages.dev//api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    sqlQuery: "INSERT INTO users (name, age, status) VALUES ('Emma', 28, 'active')"
  })
});`}
            </pre>
          </div>
        </div>

        {/* UPDATE */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">UPDATE</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('http://https://telebase.pages.dev//api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    sqlQuery: "UPDATE users SET status = 'inactive' WHERE age > 60"
  })
});`}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
}
