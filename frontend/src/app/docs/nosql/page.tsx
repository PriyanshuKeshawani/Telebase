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
              {`await fetch('https://telebase.pages.dev/api/db', {
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
              {`await fetch('https://telebase.pages.dev/api/db', {
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

        {/* UPDATE */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">UPDATE</h2>
          <p className="text-sm text-zinc-400">Match rows with a query, then set new values with <code>updateSet</code>.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    action: 'UPDATE',
    noSqlQuery: { id: 'some-uuid' },
    updateSet: { status: 'inactive' }
  })
});`}
            </pre>
          </div>
        </div>

        {/* DELETE */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">DELETE</h2>
          <p className="text-sm text-zinc-400">Rows matching the query are permanently removed.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    action: 'DELETE',
    noSqlQuery: { id: 'some-uuid' }
  })
});`}
            </pre>
          </div>
        </div>

      </div>

      {/* Roadmap Note */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-2 mt-8">
        <h4 className="font-bold text-white text-base">Roadmap: Expanded NoSQL Support</h4>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Telebase is expanding its document query engine to support complete NoSQL operations. Future releases will support all query formats and filters including:
        </p>
        <ul className="list-disc pl-5 text-zinc-400 text-xs space-y-1 mt-2">
          <li>Nested object and subdocument queries (e.g. <code>{"{ \"profile.age\": { \"$gte\": 18 } }"}</code>)</li>
          <li>Array filters and manipulation operators (e.g. <code>$in, $all, $size, $elemMatch</code>)</li>
          <li>Logical combinators for complex structures (e.g. <code>$or, $and, $not, $nor</code>)</li>
          <li>Field projection masks, advanced sorting limits, and multi-stage aggregation aggregation pipelines</li>
        </ul>
      </div>
    </div>
  );
}
