import Link from "next/link";

export default function CrudDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">CRUD Operations</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Telebase offers a unified REST endpoint <code>/api/db</code> that natively parses both SQL and NoSQL syntaxes for full CRUD operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/docs/sql" className="group bg-[#0a0a0d] border border-zinc-800/50 hover:border-blue-500/50 rounded-2xl p-6 space-y-3 transition-colors">
          <h3 className="text-xl font-bold text-blue-400 group-hover:text-blue-300">SQL Paradigm ➔</h3>
          <p className="text-zinc-400 text-sm">
            Use standard SQL queries like <code>SELECT * FROM users WHERE age &gt; 18</code> to fetch, update, and insert data.
          </p>
        </Link>
        
        <Link href="/docs/nosql" className="group bg-[#0a0a0d] border border-zinc-800/50 hover:border-emerald-500/50 rounded-2xl p-6 space-y-3 transition-colors">
          <h3 className="text-xl font-bold text-emerald-400 group-hover:text-emerald-300">NoSQL Paradigm ➔</h3>
          <p className="text-zinc-400 text-sm">
            Use MongoDB-style operators like <code>{`{ age: { $gte: 18 } }`}</code> and JSON payloads for schema-less data manipulation.
          </p>
        </Link>
      </div>
    </div>
  );
}
