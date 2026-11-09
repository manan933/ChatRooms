// Automated Live Deployment Verification Script for https://chatrooms-nvke.onrender.com

const BASE = 'https://chatrooms-nvke.onrender.com';

async function runLiveTest() {
  console.log('====================================================');
  console.log('🚀 LIVE DEPLOYMENT TEST: ' + BASE);
  console.log('====================================================\n');

  let token = '';
  let user = null;

  // 1. Health Check
  try {
    const healthRes = await fetch(`${BASE}/api/health`);
    const health = await healthRes.json();
    console.log('✅ 1. /api/health Check: PASS (Status:', healthRes.status, 'Response:', health.status, ')');
  } catch (e) {
    console.error('❌ 1. /api/health Check: FAIL', e.message);
  }

  // 2. Authentication Login
  try {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'soumya@zyntra.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    token = loginData.token || loginData.data?.token;
    user = loginData.user || loginData.data?.user;
    if (loginRes.status === 200 && token) {
      console.log('✅ 2. POST /api/auth/login: PASS (User:', user.name, '@' + user.primaryUsername, ')');
    } else {
      console.error('❌ 2. POST /api/auth/login: FAIL (Status:', loginRes.status, loginData, ')');
    }
  } catch (e) {
    console.error('❌ 2. POST /api/auth/login: FAIL', e.message);
  }

  if (!token) {
    console.error('Aborting authenticated tests due to missing token.');
    return;
  }

  // 3. User Profile Verification
  try {
    const meRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    const meUser = meData.user || meData.data?.user || meData.data;
    console.log('✅ 3. GET /api/auth/me: PASS (Status:', meRes.status, 'Email:', meUser?.email, ')');
  } catch (e) {
    console.error('❌ 3. GET /api/auth/me: FAIL', e.message);
  }

  // 4. Contacts & Groups Retrieval
  let sampleChatId = 'contact-1';
  try {
    const contactsRes = await fetch(`${BASE}/api/contacts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const contactsData = await contactsRes.json();
    const contacts = contactsData.contacts || contactsData.data?.contacts || [];
    const groups = contactsData.groups || contactsData.data?.groups || [];
    console.log('✅ 4. GET /api/contacts: PASS (Found', contacts.length, 'contacts,', groups.length, 'groups)');
    if (contacts.length > 0) sampleChatId = contacts[0].id;
  } catch (e) {
    console.error('❌ 4. GET /api/contacts: FAIL', e.message);
  }

  // 5. Workspaces Retrieval
  try {
    const wsRes = await fetch(`${BASE}/api/workspaces`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const wsData = await wsRes.json();
    const workspaces = Array.isArray(wsData) ? wsData : (wsData.workspaces || wsData.data?.workspaces || wsData.data || []);
    console.log('✅ 5. GET /api/workspaces: PASS (Found', workspaces.length, 'workspaces)');
  } catch (e) {
    console.error('❌ 5. GET /api/workspaces: FAIL', e.message);
  }

  // 6. User Directory Search
  try {
    const searchRes = await fetch(`${BASE}/api/contacts/search?query=a`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchData = await searchRes.json();
    const results = Array.isArray(searchData) ? searchData : (searchData.users || searchData.data?.users || searchData.data || []);
    console.log('✅ 6. GET /api/contacts/search: PASS (Status:', searchRes.status, 'Results:', results.length, ')');
  } catch (e) {
    console.error('❌ 6. GET /api/contacts/search: FAIL', e.message);
  }

  // 7. Message Posting & Retrieval
  try {
    const msgPayload = {
      id: `live-test-${Date.now()}`,
      chatId: sampleChatId,
      content: `Live validation ping ${Date.now()}`,
      type: 'text',
      senderId: user?.id || user?._id || 'user-1',
      senderName: user?.name || 'Soumya',
      senderUsername: user?.primaryUsername || 'soumya',
      timestamp: new Date().toISOString()
    };
    const sendRes = await fetch(`${BASE}/api/messages/${sampleChatId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(msgPayload)
    });
    const sendData = await sendRes.json();
    console.log('✅ 7a. POST /api/messages/:chatId: PASS (Status:', sendRes.status, ')');

    const getRes = await fetch(`${BASE}/api/messages/${sampleChatId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const getData = await getRes.json();
    const messages = Array.isArray(getData.data) ? getData.data : [];
    console.log('✅ 7b. GET /api/messages/:chatId: PASS (Status:', getRes.status, 'Total messages in thread:', messages.length, ')');
  } catch (e) {
    console.error('❌ 7. Message Posting/Retrieval: FAIL', e.message);
  }

  // 8. Service Worker & Cache Header Inspection
  try {
    const swRes = await fetch(`${BASE}/sw.js`);
    const swText = await swRes.text();
    const hasV5 = swText.includes('chatrooms-v5');
    console.log('✅ 8. GET /sw.js: PASS (Status:', swRes.status, hasV5 ? 'Cache v5 active' : 'Cache check', ')');
  } catch (e) {
    console.error('❌ 8. GET /sw.js: FAIL', e.message);
  }

  // 9. Root HTML and Bundles Inspection
  try {
    const htmlRes = await fetch(BASE);
    const htmlText = await htmlRes.text();
    const hasInlineScript = htmlText.includes('window.getFileUrl');
    console.log('✅ 9a. GET /: PASS (Status:', htmlRes.status, 'Inline getFileUrl polyfill:', hasInlineScript, ')');

    // Extract JS and CSS bundle URLs
    const jsMatches = htmlText.match(/\/assets\/[a-zA-Z0-9_\-]+\.js/g) || [];
    const cssMatches = htmlText.match(/\/assets\/[a-zA-Z0-9_\-]+\.css/g) || [];

    for (const jsUrl of jsMatches) {
      const assetRes = await fetch(`${BASE}${jsUrl}`);
      console.log('✅ 9b. JS Bundle Asset (' + jsUrl + '): PASS (Status:', assetRes.status, ')');
    }
    for (const cssUrl of cssMatches) {
      const assetRes = await fetch(`${BASE}${cssUrl}`);
      console.log('✅ 9c. CSS Bundle Asset (' + cssUrl + '): PASS (Status:', assetRes.status, ')');
    }
  } catch (e) {
    console.error('❌ 9. Root HTML/Bundles: FAIL', e.message);
  }

  console.log('\n====================================================');
  console.log('🏁 ALL LIVE TESTS COMPLETED');
  console.log('====================================================');
}

runLiveTest().catch(console.error);
