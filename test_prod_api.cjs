const fetch = require('node-fetch'); // wait, let's use global fetch if available, or dynamic import

async function run() {
  console.log('Sending request to Vercel production API...');
  try {
    const resp = await fetch('https://college-times-two.vercel.app/', {
      method: 'GET',
    });
    console.log('Status Code:', resp.status);
    const text = await resp.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Error fetching production API:', err);
  }
}
run();
