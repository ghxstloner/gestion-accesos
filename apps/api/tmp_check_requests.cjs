require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const p = new PrismaClient({ adapter });

(async () => {
  const fs = require('fs');
  const out = [];
  const reqs = await p.request.findMany({
    select: {
      id: true, requestNumber: true, status: true, requestType: true,
      primaryParticipantUserId: true, userId: true, companyId: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  out.push('REQUESTS: ' + JSON.stringify(reqs, null, 2));

  // count credentials already
  const creds = await p.credential.findMany({
    select: { id: true, credentialNumber: true, status: true, requestId: true },
    take: 20,
  });
  out.push('--- credentials ---');
  out.push(JSON.stringify(creds, null, 2));

  fs.writeFileSync('tmp_requests_dump.txt', out.join('\n'));
  await p.$disconnect();
})();
