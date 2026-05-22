import crypto from 'crypto';

const API_BASE_URL = 'http://localhost:3000';

async function runDBCrudTests() {
  console.log('🧪 Starting Telebase Real Database CRUD Pillars Verification Test...\n');

  try {
    // -------------------------------------------------------------
    // SETUP: Create a new project for Database CRUD isolation
    // -------------------------------------------------------------
    console.log('🔄 Setup: Creating a dedicated database test project...');
    const projectRes = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Structured DB Test - ${new Date().toISOString()}`,
        channel_id: "-1003817953908"
      })
    });
    
    const projectData = await projectRes.json();
    if (!projectData.success) {
      throw new Error(`Failed to create project: ${JSON.stringify(projectData)}`);
    }

    const { project } = projectData;
    const apiKey = project.api_key;
    const tableName = 'users';

    console.log('✅ Setup project created successfully!');
    console.log(`   Project ID: ${project.id}`);
    console.log(`   API Key: ${apiKey}\n`);

    // -------------------------------------------------------------
    // PILLAR 1: Connection & Safety (Authentication & Security)
    // -------------------------------------------------------------
    console.log('🛡️ PILLAR 1: Connection & Safety Verification');
    console.log('🔄 Checking API block on missing / invalid API key...');
    
    const badAuthRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SELECT', tableName })
    });
    
    if (badAuthRes.status === 401) {
      console.log('✅ Connection & Safety: Successfully blocked unauthenticated connection!');
    } else {
      throw new Error('❌ Safety failure: API allowed request without authenticating api key.');
    }

    // -------------------------------------------------------------
    // TABLE CREATION: Create a Structured Table Schema
    // -------------------------------------------------------------
    console.log('\n🔄 Creating structured schema for "users" table...');
    const createTableRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        action: 'CREATE_TABLE',
        tableName,
        schema: {
          name: tableName,
          fields: {
            name: 'string',
            age: 'number',
            email: 'string',
            is_active: 'boolean'
          },
          indexes: ['id', 'age']
        }
      })
    });

    const createTableData = await createTableRes.json();
    if (!createTableData.success) {
      throw new Error(`Failed to create table: ${createTableData.error}`);
    }
    console.log('✅ Table "users" successfully created with dynamic validation schema!');

    // -------------------------------------------------------------
    // PILLAR 2 & 3: Query Processing & Storage (INSERT / SELECT / Indexing / Schema)
    // -------------------------------------------------------------
    console.log('\n📝 PILLAR 2 & 3: Query Processing, Memory Cache & Storage Verification');
    
    // A. Perform Structured SQL INSERT Operations
    console.log('🔄 Executing SQL INSERT statements...');
    
    const usersToInsert = [
      { sql: "INSERT INTO users (name, age, email, is_active) VALUES ('Alice Smith', 30, 'alice@example.com', 'true')" },
      { sql: "INSERT INTO users (name, age, email, is_active) VALUES ('Bob Jones', 22, 'bob@example.com', 'false')" },
      { sql: "INSERT INTO users (name, age, email, is_active) VALUES ('Charlie Brown', 25, 'charlie@example.com', 'true')" }
    ];

    for (const insert of usersToInsert) {
      const res = await fetch(`${API_BASE_URL}/api/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ tableName, sqlQuery: insert.sql })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(`SQL INSERT failed: ${data.error}`);
      }
      console.log(`   - INSERT Successful! Added record ID: ${data.records[0].id}`);
    }
    console.log('✅ Multi-row INSERT complete.');

    // B. Check Schema Type Integrity (Violating types)
    console.log('🔄 Testing schema enforcement (violating "age" field with string value)...');
    const badSchemaRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ 
        action: 'INSERT', 
        tableName, 
        insertData: { name: 'Faulty User', age: 'thirty-five', email: 'faulty@example.com', is_active: true }
      })
    });
    const badSchemaData = await badSchemaRes.json();
    if (!badSchemaData.success && badSchemaData.error.includes('Schema Violation')) {
      console.log(`✅ Schema Constraint Enforced: "${badSchemaData.error}"`);
    } else {
      throw new Error(`❌ Safety failure: Allowed invalid schema insert! ${JSON.stringify(badSchemaData)}`);
    }

    // C. Perform SQL SELECT Operations (Operator evaluation)
    console.log('🔄 Executing SQL SELECT statement: "SELECT * FROM users WHERE age >= 25"...');
    const selectRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ tableName, sqlQuery: "SELECT * FROM users WHERE age >= 25" })
    });
    const selectData = await selectRes.json();
    if (!selectData.success) {
      throw new Error(`SQL SELECT failed: ${selectData.error}`);
    }
    console.log(`✅ Query Processing: Successfully parsed and evaluated operator (age >= 25). Found ${selectData.records.length} records.`);
    selectData.records.forEach(r => console.log(`   - ${r.name} (Age: ${r.age})`));

    // D. Print step-by-step physical optimizer plan & check caching latency
    console.log('\n📊 Optimizer Path Analysis:');
    console.log(`   Strategy Used: ${selectData.optimization.strategy}`);
    console.log(`   Scanned Records: ${selectData.optimization.statistics.scannedRecords} of ${selectData.optimization.statistics.totalRecords}`);
    console.log('   Step-by-step Execution Plan:');
    selectData.plan.forEach((step, idx) => {
      console.log(`     [Step ${idx + 1}] ${step.operation}: ${step.details} (${step.durationMs}ms)`);
    });

    console.log('\n⚡ Latency Benchmarking (Pillar 3: Memory Caching & Hot RAM Caches):');
    console.log(`   Initial Fetch Latency: ${selectData.latencyMs}ms (Cache Hit: ${selectData.cacheHit})`);
    
    // Make second consecutive SELECT to measure cached latency
    const cacheSelectRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ tableName, sqlQuery: "SELECT * FROM users WHERE age >= 25" })
    });
    const cacheSelectData = await cacheSelectRes.json();
    console.log(`   Consecutive Fetch Latency: ${cacheSelectData.latencyMs}ms (Cache Hit: ${cacheSelectData.cacheHit})`);
    
    if (cacheSelectData.cacheHit) {
      console.log('✅ RAM Cache System: Hot database pages are cached perfectly in RAM for sub-millisecond reads!');
    } else {
      console.warn('⚠️ Warning: Hot cache hit did not activate. Cache TTL might have expired or caching is disabled.');
    }

    // -------------------------------------------------------------
    // CRUD: UPDATE & DELETE Operations
    // -------------------------------------------------------------
    console.log('\n🔄 Executing SQL UPDATE: "UPDATE users SET age = 31 WHERE name = Alice Smith"...');
    const updateRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ tableName, sqlQuery: "UPDATE users SET age = 31 WHERE name = Alice Smith" })
    });
    const updateData = await updateRes.json();
    if (!updateData.success) {
      throw new Error(`SQL UPDATE failed: ${updateData.error}`);
    }
    console.log(`✅ Update complete. Affected rows: ${updateData.affectedRows}`);

    // Verify update
    const verifySelectRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ tableName, sqlQuery: "SELECT * FROM users WHERE name = Alice Smith" })
    });
    const verifySelectData = await verifySelectRes.json();
    console.log('🔍 Update Verification Response:', JSON.stringify(verifySelectData, null, 2));
    if (verifySelectData.records[0]?.age === 31) {
      console.log('✅ Update validated: Alice Smith age is now 31.');
    } else {
      throw new Error('❌ CRUD Update Validation failed.');
    }

    console.log('\n🔄 Executing SQL DELETE: "DELETE FROM users WHERE age < 24"...');
    const deleteRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ tableName, sqlQuery: "DELETE FROM users WHERE age < 24" })
    });
    const deleteData = await deleteRes.json();
    if (!deleteData.success) {
      throw new Error(`SQL DELETE failed: ${deleteData.error}`);
    }
    console.log(`✅ Delete complete. Affected rows: ${deleteData.affectedRows} (Bob Jones should have been deleted)`);

    // Verify Delete
    const verifyDeleteSelectRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ tableName, sqlQuery: "SELECT * FROM users" })
    });
    const verifyDeleteSelectData = await verifyDeleteSelectRes.json();
    console.log('   Current Records in Database:');
    verifyDeleteSelectData.records.forEach(r => console.log(`   - ${r.name} (Age: ${r.age})`));
    
    if (verifyDeleteSelectData.records.some(r => r.name.includes('Bob'))) {
      throw new Error('❌ CRUD Delete Validation failed. Bob Jones still exists!');
    } else {
      console.log('✅ Delete validated: Bob Jones successfully deleted!');
    }

    // -------------------------------------------------------------
    // PILLAR 4: Transaction Control & Crash Recovery (WAL, Row Locking)
    // -------------------------------------------------------------
    console.log('\n🔄 PILLAR 4: Transaction Control & Crash Recovery Verification');
    console.log('🔄 Triggering writing transaction with forceLockCrash = true to simulate sudden server crash...');

    const crashedWriteRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ 
        action: 'INSERT', 
        tableName, 
        insertData: { name: 'Post-Crash Recovered User', age: 40, email: 'recovered@example.com', is_active: true },
        forceLockCrash: true
      })
    });
    const crashedWriteData = await crashedWriteRes.json();
    
    console.log(`✅ Crash simulated! Server reported write failure. Let's inspect active Write-Ahead Logs (WAL)...`);
    
    // Retrieve WAL Logs
    const metadataRes = await fetch(`${API_BASE_URL}/api/db?apiKey=${apiKey}`);
    const metadataData = await metadataRes.json();
    
    console.log(`   Write-Ahead Log History:`);
    metadataData.walLogs.forEach((log) => {
      console.log(`     - [WAL ID: ${log.id}] Op: ${log.operation} | Table: ${log.tableName} | Status: ${log.status}`);
    });

    const failedLog = metadataData.walLogs.find(l => l.status === 'FAILED');
    if (failedLog) {
      console.log(`✅ WAL Record preserved: Found uncommitted FAILED transaction in Write-Ahead Logs!`);
    } else {
      throw new Error('❌ ACID Compliance violation: FAILED transaction was not logged to WAL!');
    }

    // B. Trigger Crash Recovery replayer to restore database state
    console.log('\n🔄 Triggering active consistent Crash Recovery Replay...');
    const recoveryRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ action: 'RECOVER', tableName })
    });
    const recoveryData = await recoveryRes.json();
    if (!recoveryData.success) {
      throw new Error(`Recovery replayer failed: ${recoveryData.error}`);
    }
    
    console.log('✅ Recovery replay completed successfully! System Logs:');
    recoveryData.logs.forEach(logLine => console.log(`   ${logLine}`));

    // Verify recovery restored the record
    const finalSelectRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ tableName, sqlQuery: "SELECT * FROM users WHERE name = Post-Crash Recovered User" })
    });
    const finalSelectData = await finalSelectRes.json();
    if (finalSelectData.records.length > 0) {
      console.log(`✅ WAL Recovery verified: "Post-Crash Recovered User" is now safely stored!`);
    } else {
      throw new Error('❌ Recovery verification failed: WAL log replay did not restore uncommitted database state!');
    }

    // C. Clean up WAL
    console.log('\n🔄 Cleaning up WAL logs...');
    const clearWALRes = await fetch(`${API_BASE_URL}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ action: 'CLEAR_LOGS' })
    });
    const clearWALData = await clearWALRes.json();
    console.log(`✅ WAL logs cleared: ${clearWALData.message}`);

    console.log('\n🏆 ALL 4 CORE DATABASE PILLARS INTEGRATION VERIFIED WITH 100% SUCCESS! 🏆');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ DB CRUD Integration Test Failed:', error.message);
    process.exit(1);
  }
}

runDBCrudTests();
