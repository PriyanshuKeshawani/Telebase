import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "SQL Queries Console and Execution - Telebase",
  description: "Run SQL queries, manage table structures, and compile schema migrations in real-time through the Telebase admin dashboard.",
  path: "/docs/sql",
});

export default function SqlDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">SQL Queries</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Execute familiar SQL syntax natively via the Telebase REST API.
        </p>
      </div>

      {/* Currently Supported Features alert */}
      <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Currently Supported SQL Syntax</h3>
        <p className="text-xs text-zinc-300 leading-relaxed">
          Telebase's custom query parser fully supports the following keywords and operations:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-zinc-400 font-mono">
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">SELECT ... FROM</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">INNER JOIN ... ON</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">WHERE (AND, =, !=, &gt;, &lt;, LIKE)</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">GROUP BY / HAVING</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">ORDER BY (ASC / DESC)</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">LIMIT / COUNT(*)</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">INSERT INTO ... VALUES</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">UPDATE ... SET</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">DELETE FROM</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">CREATE / DROP TABLE</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">ALTER TABLE (ADD / DROP)</div>
          <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-zinc-800/40">CREATE / DROP INDEX</div>
        </div>
        <p className="text-[11px] text-zinc-500 italic mt-1">
          * Note: Future updates will bring compatibility for 100% of standard SQL query structures and procedures.
        </p>
      </div>

      <div className="space-y-8">
        
        {/* SELECT */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">SELECT</h2>
          <p className="text-zinc-400 text-sm">Retrieve records from your table. Supports filtering, joins, sorting, and pagination.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    sqlQuery: "SELECT id, name, age FROM users WHERE status = 'active' ORDER BY age DESC LIMIT 10"
  })
});`}
            </pre>
          </div>
        </div>

        {/* INSERT */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">INSERT</h2>
          <p className="text-zinc-400 text-sm">Add new rows to your database table.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('https://telebase.pages.dev/api/db', {
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
          <p className="text-zinc-400 text-sm">Modify existing fields matching the WHERE condition.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('https://telebase.pages.dev/api/db', {
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

        {/* DELETE */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">DELETE</h2>
          <p className="text-zinc-400 text-sm">Remove rows matching the WHERE filter from the table.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    tableName: 'users',
    sqlQuery: "DELETE FROM users WHERE id = 'some-uuid'"
  })
});`}
            </pre>
          </div>
        </div>

        {/* DDL: CREATE, DROP, ALTER */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">DDL Operations (Tables & Columns)</h2>
          <p className="text-zinc-400 text-sm">Manage tables, schemas, and fields programmatically.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`// Create a new table
await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    sqlQuery: "CREATE TABLE customers (id TEXT, name TEXT, age INT, is_active BOOL)"
  })
});

// Alter Table: Add/Drop columns
await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    sqlQuery: "ALTER TABLE customers ADD COLUMN email TEXT"
  })
});

// Drop table
await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({
    sqlQuery: "DROP TABLE IF EXISTS customers"
  })
});`}
            </pre>
          </div>
        </div>

        {/* Meta / Index Operations */}
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Metadata & Indexes</h2>
          <p className="text-zinc-400 text-sm">Interact with schema meta info or manage database indexes.</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
              {`// Show all tables
const resShow = await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({ sqlQuery: "SHOW TABLES" })
});

// Describe table structure
const resDesc = await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({ sqlQuery: "DESCRIBE users" })
});

// Create/Drop index
await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_KEY' },
  body: JSON.stringify({ sqlQuery: "CREATE INDEX age_idx ON users (age)" })
});`}
            </pre>
          </div>
        </div>

      </div>

      {/* Roadmap Note */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-2 mt-8">
        <h4 className="font-bold text-white text-base">Roadmap: Expanded SQL Support</h4>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Telebase is undergoing active development to extend its SQL query parser. Future releases will support all query types, operations, and aggregation techniques including:
        </p>
        <ul className="list-disc pl-5 text-zinc-400 text-xs space-y-1 mt-2">
          <li>Advanced JOIN structures (LEFT/RIGHT OUTER JOIN, FULL OUTER JOIN)</li>
          <li>Subqueries, nested query expressions, and complex set operations (UNION, INTERSECT)</li>
          <li>Expanded Aggregations (SUM, AVG, MIN, MAX with GROUP BY/HAVING)</li>
          <li>Common Table Expressions (CTEs), Transaction queries, and custom query procedures</li>
        </ul>
      </div>
    </div>
  );
}
