import crypto from 'crypto';

const API_BASE_URL = 'https://telebase.pages.dev';

async function runE2ETests() {
  console.log('🧪 Starting Telebase 100% Database-less E2E Integration Test...\n');

  try {
    // Step 1: Create a Project
    console.log('🔄 Step 1: Creating a test project via serverless API...');
    const projectRes = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Automated Test Project - ${new Date().toISOString()}`,
        channel_id: "-1003817953908"
      })
    });

    const projectData = await projectRes.json();
    if (!projectData.success) {
      throw new Error(`Failed to create project: ${JSON.stringify(projectData)}`);
    }

    const { project } = projectData;
    console.log('✅ Project created successfully!');
    console.log(`   ID: ${project.id}`);
    console.log(`   API Key: ${project.api_key}`);
    console.log(`   Channel ID: ${project.channel_id}\n`);

    // Step 2: Register a rotatable Telegram Bot
    console.log('🔄 Step 2: Registering a bot token to the project rotated pool...');
    const addBotRes = await fetch(`${API_BASE_URL}/api/projects/${project.id}/add-bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_token: "8216712040:AAFwcz0_UGnO4YWJPBuUL7CVac8mpc8Nvu8"
      })
    });

    const addBotData = await addBotRes.json();
    if (!addBotData.success) {
      throw new Error(`Failed to add bot token: ${JSON.stringify(addBotData)}`);
    }
    console.log('✅ Bot successfully registered to project rotated pool!\n');

    // Step 3: Generate a mock binary data payload
    console.log('🔄 Step 3: Generating test payload (approx. 500KB JSON archive)...');
    const mockPayload = {};
    for (let i = 0; i < 5000; i++) {
      mockPayload[`record_${i}`] = crypto.randomBytes(48).toString('hex');
    }
    const rawPayloadString = JSON.stringify(mockPayload);
    const originalSize = Buffer.from(rawPayloadString).length;
    console.log(`✅ Payload generated. Size: ${(originalSize / 1024).toFixed(2)} KB\n`);

    // Step 4: Trigger Secure Upload
    console.log('🔄 Step 4: Uploading data payload to Telebase /api/data/upload...');

    // Create multipart form data payload using native Blob & FormData
    const formData = new FormData();
    const fileBlob = new Blob([rawPayloadString], { type: 'application/json' });
    formData.append('file', fileBlob, 'e2e_test_data.json');

    const uploadRes = await fetch(`${API_BASE_URL}/api/data/upload`, {
      method: 'POST',
      headers: {
        'x-api-key': project.api_key
      },
      body: formData
    });

    const uploadData = await uploadRes.json();
    if (!uploadData.success) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
    }

    const { file } = uploadData;
    console.log('✅ Upload successfully registered & backed up in Telegram!');
    console.log(`   File UUID: ${file.uuid}`);
    console.log(`   Expected Hash: ${file.hash}`);
    console.log(`   Total Chunks: ${file.chunks}`);
    console.log(`   Original Size: ${(file.size / 1024).toFixed(2)} KB\n`);

    // Step 5: Download the file and decrypt on-the-fly
    console.log(`🔄 Step 5: Triggering download & decryption stream via /api/data/${file.uuid}...`);

    const downloadRes = await fetch(`${API_BASE_URL}/api/data/${file.uuid}`, {
      headers: {
        'x-api-key': project.api_key
      }
    });

    if (!downloadRes.ok) {
      const errText = await downloadRes.text();
      throw new Error(`Download failed: ${errText}`);
    }

    // Since we stream it back, retrieve the buffer
    const arrayBuffer = await downloadRes.arrayBuffer();
    const downloadedBuffer = Buffer.from(arrayBuffer);
    console.log(`✅ File download and decryptions completed! Received size: ${(downloadedBuffer.length / 1024).toFixed(2)} KB\n`);

    // Step 6: Verify Cryptographic Hash
    console.log('🔄 Step 6: Verifying cryptographic integrity hash (SHA-256)...');
    const downloadedHash = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');

    console.log(`   Expected Zip Hash: ${file.hash}`);
    console.log(`   Received Zip Hash: ${downloadedHash}`);

    if (downloadedHash !== file.hash) {
      throw new Error('❌ Integrity verification failed: Downloaded file hash does not match original uploaded file hash!');
    }
    console.log('🎉 Cryptographic Verification PASSED! SHA-256 hash matches perfectly!\n');

    // Step 7: Clean up test files from index
    console.log('🔄 Step 7: Cleaning up test data from Master Index...');
    const deleteRes = await fetch(`${API_BASE_URL}/api/data/${file.uuid}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': project.api_key
      }
    });
    const deleteData = await deleteRes.json();
    if (!deleteData.success) {
      throw new Error(`Delete failed: ${JSON.stringify(deleteData)}`);
    }
    console.log('✅ Local test index cleanups completed successfully.\n');

    console.log('🏆 AUTOMATED E2E INTEGRATION TEST RESULT: SUCCESS! 🏆');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ E2E Integration Test Failed:', error.message);
    process.exit(1);
  }
}

runE2ETests();
