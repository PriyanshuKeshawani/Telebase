export default function NoSqlDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">NoSQL Queries</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Use MongoDB-like JSON query structures for highly flexible data manipulation.
        </p>
      </div>

      <div className="space-y-8">
        {/* SELECT */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">SELECT</h2>
          <p className="text-sm text-zinc-400">Use operators like <code>$eq, $ne, $gt, $gte, $lt, $lte, $regex</code>.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('http://https://telebase.pages.dev//api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    action: 'SELECT',
    noSqlQuery: {
      age: { $gte: 18 },
      status: 'active'
    }
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
    action: 'INSERT',
    insertData: {
      name: 'Emma',
      age: 28,
      status: 'active'
    }
  })
});`}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
}
