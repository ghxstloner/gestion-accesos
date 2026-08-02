require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const p = new PrismaClient({ adapter });

(async () => {
  const out = [];
  const reqs = await p.$queryRawUnsafe(
    "SELECT id, request_number, status, request_type_id, created_by_user_id, company_id, created_at FROM requests ORDER BY created_at DESC LIMIT 20"
  );
  out.push('REQUESTS: ' + JSON.stringify(reqs, null, 2));

  const creds = await p.$queryRawUnsafe(
    "SELECT id, credential_number, status, request_id, subject_user_id FROM credentials LIMIT 50"
  );
  out.push('--- credentials ---');
  out.push(JSON.stringify(creds, null, 2));

  // APPROVED requests without any credential yet
  const clean = await p.$queryRawUnsafe(
    "SELECT r.id, r.request_number FROM requests r LEFT JOIN credentials c ON c.request_id = r.id WHERE r.status = 'APPROVED' AND c.id IS NULL"
  );
  out.push('--- APPROVED w/o credential ---');
  out.push(JSON.stringify(clean, null, 2));

  fs.writeFileSync('tmp_requests_dump.txt', out.join('\n'));
  await p.$disconnect();
})().catch((e) => {
  fs.writeFileSync('tmp_requests_dump_err.txt', String(e && e.stack || e));
  process.exit(1);
});
