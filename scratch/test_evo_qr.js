const EVO_URL = 'https://evo.nattotecnologia.cloud';
const API_KEY = 'FFB66FA54123-48D8-80A1-8BEB91EE0E44';
const INSTANCE_NAME = 'education';

async function testQR() {
  try {
    console.log(`Testing QR for instance: ${INSTANCE_NAME}`);
    const res = await fetch(`${EVO_URL}/instance/connect/${INSTANCE_NAME}`, {
      headers: { 'apikey': API_KEY }
    });
    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));

    console.log('\nTesting Status for instance:', INSTANCE_NAME);
    const statusRes = await fetch(`${EVO_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      headers: { 'apikey': API_KEY }
    });
    const statusData = await statusRes.json();
    console.log('Status Response Status:', statusRes.status);
    console.log('Status Response Data:', JSON.stringify(statusData, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testQR();
