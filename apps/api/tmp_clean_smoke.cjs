/**
 * Deletes any credentials that reference the smoke request so the next
 * smoke run starts with a clean credential lifecycle. Also resets
 * delivery_records and custody_records tied to those credentials.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const p = new PrismaClient({ adapter });

(async () => {
  // Smell: identify the request by its reason marker
  const reqs = await p.$queryRawUnsafe(
    "SELECT id FROM requests WHERE reason = 'SMOKE-APPROVED' AND status = 'APPROVED'"
  );
  for (const r of reqs) {
    const creds = await p.$queryRawUnsafe(
      "SELECT id FROM credentials WHERE request_id = ?", r.id
    );
    for (const c of creds) {
      await p.$executeRawUnsafe(
        "DELETE FROM custody_records WHERE credential_id = ?", c.id
      );
      await p.$executeRawUnsafe(
        "DELETE FROM delivery_records WHERE credential_id = ?", c.id
      );
      await p.$executeRawUnsafe(
        "DELETE FROM credential_events WHERE credential_id = ?", c.id
      );
      await p.$executeRawUnsafe(
        "DELETE FROM credentials WHERE id = ?", c.id
      );
      console.log('deleted credential', c.id, 'for request', r.id);
    }
  }
})().then(() => p.$disconnect())
  .catch((e) => { console.error('CLEAN_ERR', e.message); p.$disconnect(); process.exit(1); });
