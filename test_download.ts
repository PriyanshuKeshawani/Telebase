import { verifyProjectApiKey, getDatabaseState } from './frontend/src/lib/telegramDatabase';

async function testDownload() {
  const uuid = "951fc523-eb64-408f-85a6-f5023a11bbee";
  const apiKey = "sk_proj_aaf995145f639264d4925318d9a207bd";
  
  // mock request
  const req = new Request(`http://localhost/api/data/${uuid}?apiKey=${apiKey}`);
  const { GET } = await import('./frontend/src/app/api/data/[uuid]/route');
  
  const res = await GET(req as any, { params: Promise.resolve({ uuid }) });
  console.log("Status:", res.status);
  
  if (res.ok) {
    const reader = (res.body as any).getReader();
    try {
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
      }
      console.log("Total bytes downloaded successfully:", total);
    } catch (e: any) {
      console.error("Stream read error:", e);
    }
  } else {
    console.log("Error:", await res.text());
  }
}

testDownload().catch(console.error);
