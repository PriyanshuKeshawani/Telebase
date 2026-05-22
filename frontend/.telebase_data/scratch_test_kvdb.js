async function test() {
  try {
    console.log('🔄 Provisioning new bucket on kvdb.io with NO email...');
    const res = await fetch('https://kvdb.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    console.log('POST Response status:', res.status);
    const bucketId = (await res.text()).trim();
    console.log('Provisioned Bucket ID:', bucketId);

    if (res.ok && bucketId) {
      const url = `https://kvdb.io/${bucketId}/test_key`;
      console.log('Testing PUT to:', url);
      const putRes = await fetch(url, {
        method: 'PUT',
        body: 'hello_from_no_email_bucket'
      });
      console.log('PUT Response status:', putRes.status);
      const putText = await putRes.text();
      console.log('PUT Response text:', putText);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
