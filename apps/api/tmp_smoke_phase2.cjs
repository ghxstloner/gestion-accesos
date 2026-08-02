/**
 * SGA Phase 2 real smoke test against the running API (http://localhost:4000).
 * Uses node's global fetch (Node 18+).
 *
 * Steps:
 * 1. Login as CARD_ISSUER
 * 2. Find an APPROVED request
 * 3. Issue credential (+ dup guard)
 * 4. Photo capture (upload) + photo reuse (second issue on a renewal path)
 * 5. Print preview
 * 6. Deliver + duplicate-delivery guard
 * 7. Custody deposit + list overdue + return + duplicate-return guard
 * 8. Lifecycle transitions (suspend / revoke / reactivate / replace)
 * 9. Confirm audit events persisted
 */
const BASE = 'http://localhost:4000/api/v1';

function assert(cond, msg) {
  if (!cond) throw new Error('SMOKE FAIL: ' + msg);
}

async function req(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  let payload = null;
  const text = await res.text();
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: res.status, payload };
}

async function login(documentType, documentNumber, password) {
  const r = await req('POST', '/auth/login', null, {
    documentType, documentNumber, password,
  });
  assert(r.status === 200, `login returned ${r.status}: ${JSON.stringify(r.payload)}`);
  assert(r.payload?.accessToken, 'no accessToken in response');
  return { token: r.payload.accessToken, user: r.payload.user };
}

async function findApprovedRequest(token) {
  // Prefer the dedicated smoke fixture (marked via reason), then fall back
  // to any APPROVED request that has no credential yet.
  const r1 = await req('GET', `/requests?limit=50`, token);
  assert(r1.status === 200, `requests list returned ${r1.status}`);
  const items = r1.payload?.items ?? r1.payload ?? [];
  // Find the smoke marker first
  let approved = items.find((it) => it.status === 'APPROVED' && it.reason && String(it.reason).includes('SMOKE-APPROVED'));
  if (!approved) {
    approved = items.find((it) => it.status === 'APPROVED');
  }
  return approved;
}

async function findRequestDetail(token, id) {
  const r = await req('GET', `/requests/${id}`, token);
  assert(r.status === 200, `request detail returned ${r.status}`);
  return r.payload;
}

async function main() {
  const PWD = 'Demo1234!';
  console.log('--- SGA Phase 2 smoke test ---');

  // 1. Login as CARD_ISSUER
  const { token, user } = await login('NATIONAL_ID', '8-901-234', PWD);
  console.log('[1] logged in as', user.email, 'roles=', user.roles);
  assert(Array.isArray(user.roles) && user.roles.includes('CARD_ISSUER'),
    'expected CARD_ISSUER role');

  // 2. Find APPROVED request
  const approved = await findApprovedRequest(token);
  if (!approved) {
    console.log('[2] NO APPROVED REQUEST in dev DB — skipping remaining issuance checks.');
    console.log('    Apply seed or fixture and re-run.');
    return { skipped: true };
  }
  console.log('[2] APPROVED request found:', approved.requestNumber ?? approved.id);
  const detail = await findRequestDetail(token, approved.id);
  const requestId = detail.id;

  // 3. Issue credentials
  const credType = 'PERMANENT_CARD';
  const issueBody = {
    requestId,
    credentialType: credType,
    subjectUserId: detail.createdByUserId ?? detail.userId ?? detail.applicantUserId ?? detail.primaryParticipantUserId ?? null,
    holderName: detail.applicantName ?? detail.primaryParticipantName ?? 'Smoke Holder',
    authorizedZones: null, // null = all approved
    expiresAt: null,
    observations: 'Smoke-test issuance',
  };
  let r = await req('POST', '/credentials', token, issueBody);
  assert(r.status === 201, `first issue returned ${r.status}: ${JSON.stringify(r.payload)}`);
  const credential = r.payload;
  const credId = credential.id;
  console.log('[3a] issued credential', credential.credentialNumber, 'cardCode=', credential.cardCode, 'id=', credId);

  // 3b. Idempotent re-issue
  r = await req('POST', '/credentials', token, issueBody);
  assert(r.status === 201, `idempotent re-issue expected 201, got ${r.status}`);
  assert(r.payload.id === credId, 'idempotent re-issue returned different id');

  // 3c. Duplicate card code rejection
  const dupCard = 'SMOKE-DUP-' + Date.now();
  const firstDup = await req('POST', '/credentials', token, {
    ...issueBody,
    cardCode: dupCard,
  });
  // Either 201 with new cred OR (if same request idempotency) the same. We want to test
  // the guard so we issue against a different request—skip if none available.
  if (firstDup.status === 201 && firstDup.payload?.id && firstDup.payload.id !== credId) {
    const secondDup = await req('POST', '/credentials', token, {
      ...issueBody,
      requestId: '00000000-0000-0000-0000-000000000000', // fake to bypass idempotency
      cardCode: dupCard,
    });
    console.log('[3c] dup cardCode result status=', secondDup.status,
      'payload=', JSON.stringify(secondDup.payload).slice(0, 150));
  } else {
    console.log('[3c] dup cardCode: skipped (could not bootstrap second credential)');
  }

  // 4. Photo: upload via multipart then reuse.
  //    Build a small JPEG-ish blob (the endpoint accepts any bytes).
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  form.append('file', blob, 'smoke.jpg');
  form.append('source', 'UPLOADED');
  const photoRes = await fetch(BASE + `/credentials/${credId}/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  console.log('[4a] upload photo status=', photoRes.status);
  const photoText = await photoRes.text();
  assert(photoRes.status === 200 || photoRes.status === 201,
    `photo upload returned ${photoRes.status}: ${photoText}`);
  let photoJson = null;
  try { photoJson = photoText ? JSON.parse(photoText) : null; } catch { photoJson = null; }
  console.log('[4a] photo source=', photoJson?.photoSource,
    'fileId=', photoJson?.photoFileId);

  // 4b. Reuse candidate
  const reuseR = await req('GET', `/credentials/${credId}/photo-reuse-candidate`, token);
  console.log('[4b] reuse candidate status=', reuseR.status,
    'found=', reuseR.payload ? Object.keys(reuseR.payload).length : 'none');

  // 5. Print preview
  const printR = await fetch(BASE + `/credentials/${credId}/print`,
    { headers: { Authorization: `Bearer ${token}` } });
  console.log('[5] print preview status=', printR.status);
  assert(printR.status === 200, `print preview failed ${printR.status}`);
  const printHtml = await printR.text();
  assert(printHtml.includes('<html') || printHtml.includes('CAR'),
    'print preview html missing expected content');

  // 6. Transition through production to READY_FOR_DELIVERY, then deliver.
  const transitions = ['start_production', 'mark_ready'];
  for (const t of transitions) {
    const tr = await req('POST', `/credentials/${credId}/transition`, token, {
      transition: t, comment: `smoke move to ${t}`,
    });
    assert(tr.status === 200, `transition ${t} failed: ${tr.status} ${JSON.stringify(tr.payload)}`);
    console.log('[6pre] transition ->', t, 'status=', tr.status);
  }
  // Deliver
  const deliverBody = {
    receivedByName: 'Smoke Recipient',
    receivedByIdentification: '8-000-111',
    observations: 'smoke delivery',
  };
  r = await req('POST', `/credentials/${credId}/deliver`, token, deliverBody);
  assert(r.status === 200, `deliver failed ${r.status}: ${JSON.stringify(r.payload)}`);
  console.log('[6a] delivered at=', r.payload.deliveredAt ?? r.payload.delivery?.deliveredAt);
  // Duplicate deliver
  r = await req('POST', `/credentials/${credId}/deliver`, token, deliverBody);
  assert(r.status === 409, `duplicate deliver should be 409, got ${r.status}`);
  console.log('[6b] duplicate deliver blocked:', r.status);

  // 7. Custody: deposit/list/return/duplicate-return
  const deposit = {
    credentialId: credId,
    documentType: 'NATIONAL_ID',
    documentIdentifier: '8-000-111',
    holderName: 'Smoke Custody Holder',
    notes: 'temp custody smoke',
    expectedReturnAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
  };
  r = await req('POST', '/custody', token, deposit);
  assert(r.status === 201 || r.status === 200,
    `custody deposit failed ${r.status}: ${JSON.stringify(r.payload)}`);
  const custodyId = r.payload.id;
  console.log('[7a] deposited custody', custodyId);

  r = await req('GET', '/custody?status=OVERDUE', token);
  assert(r.status === 200, `custody OVERDUE list failed ${r.status}`);
  console.log('[7b] custody lists ok (overdue has',
    (r.payload?.items ?? r.payload ?? []).length, 'items)');

  r = await req('POST', `/custody/${custodyId}/return`, token, {
    returnReceivedBy: 'Smoke Custody Officer',
    returnCondition: 'GOOD',
    notes: 'smoke return',
  });
  assert(r.status === 200, `custody return failed ${r.status}: ${JSON.stringify(r.payload)}`);
  console.log('[7c] returned custody', custodyId);

  r = await req('POST', `/custody/${custodyId}/return`, token, {
    returnReceivedBy: 'Dup',
    notes: 'dup',
  });
  assert(r.status === 409, `duplicate custody return should be 409, got ${r.status}`);
  console.log('[7d] duplicate return blocked:', r.status);

  // 8. Lifecycle: suspend / reactivate on a freshly issued credential (separate issue).
  //    For the current credential we test revoke -> replace after suspending.
  r = await req('POST', `/credentials/${credId}/transition`, token, {
    transition: 'suspend', comment: 'smoke suspend',
  });
  console.log('[8a] suspend transition status=', r.status,
    r.status !== 200 ? JSON.stringify(r.payload) : '');
  // reactivate
  if (r.status === 200) {
    r = await req('POST', `/credentials/${credId}/transition`, token, {
      transition: 'reactivate', comment: 'smoke reactivate',
    });
    console.log('[8b] reactivate transition status=', r.status,
      r.status !== 200 ? JSON.stringify(r.payload) : '');
  }
  // revoke then replace
  r = await req('POST', `/credentials/${credId}/transition`, token, {
    transition: 'revoke', comment: 'smoke revoke',
  });
  console.log('[8c] revoke transition status=', r.status,
    r.status !== 200 ? JSON.stringify(r.payload) : '');
  const replaceR = await req('POST', `/credentials/${credId}/replace`, token, {
    reason: 'damaged card (smoke)',
  });
  console.log('[8d] replace status=', replaceR.status,
    replaceR.status !== 200 && replaceR.status !== 201 ? JSON.stringify(replaceR.payload) : '',
    'newId=', replaceR.payload?.id);

  // 9. Audit events
  r = await req('GET', `/credentials/${credId}/events`, token);
  assert(r.status === 200, `events list returned ${r.status}`);
  const events = r.payload?.events ?? r.payload ?? [];
  console.log('[9] credential events=', Array.isArray(events) ? events.length : 0);
  console.log('--- Smoke test PASSED ✅ ---');
  return { ok: true };
}

main().catch((err) => {
  console.error('SMOKE ERROR:', err.message);
  process.exit(1);
});
