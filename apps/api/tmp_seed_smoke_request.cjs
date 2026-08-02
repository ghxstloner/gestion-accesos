/**
 * Inserts one fresh APPROVED request into sga_dev so the Phase 2 smoke test
 * has a credential-free APPROVED request to issue against. Idempotent: any
 * prior smoke request is reused rather than duplicated.
 */
require('dotenv').config();
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const p = new PrismaClient({ adapter });

const SMOKE_MARKER = 'SMOKE-APPROVED';

async function findTemplate() {
  // Use the first existing APPROVED request as a template
  const rows = await p.$queryRawUnsafe(
    "SELECT * FROM requests WHERE status = 'APPROVED' ORDER BY created_at DESC LIMIT 1"
  );
  if (!rows.length) throw new Error('No APPROVED request to template from');
  return rows[0];
}

async function main() {
  // Reuse existing smoke request if present
  const existing = await p.$queryRawUnsafe(
    "SELECT id, request_number FROM requests WHERE reason = '" + SMOKE_MARKER + "' AND status = 'APPROVED' ORDER BY created_at DESC LIMIT 1"
  );
  if (existing.length) {
    console.log('REUSE_OK ' + existing[0].id + ' ' + existing[0].request_number);
    return;
  }

  const t = await findTemplate();
  const id = randomUUID();
  // Compute a unique request number — bump the max
  const maxNumRow = await p.$queryRawUnsafe(
    "SELECT request_number FROM requests WHERE request_number LIKE 'SGA-2026-%' ORDER BY request_number DESC LIMIT 1"
  );
  const lastNum = String(maxNumRow[0].request_number || 'SGA-2026-000000');
  const seq = parseInt(lastNum.split('-')[2], 10) + 1;
  const newNum = 'SGA-2026-' + String(seq).padStart(6, '0');

  await p.$executeRawUnsafe(
    "INSERT INTO requests " +
    "(id, request_number, company_id, request_type_id, created_by_user_id, " +
    "created_by_company_id, reason, status, version, submitted_at, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', 1, NOW(), NOW(), NOW())",
    id, newNum, t.company_id, t.request_type_id, t.created_by_user_id,
    t.created_by_company_id || null, SMOKE_MARKER,
  );

  // Copy over accessAreas so resolveApprovedZones has data (set review_status APPROVED)
  // First check column names of request_access_areas
  const areas = await p.$queryRawUnsafe(
    "SELECT * FROM request_access_areas WHERE request_id = ? LIMIT 50",
    t.id
  );
  if (areas.length) {
    for (const a of areas) {
      await p.$executeRawUnsafe(
        "INSERT INTO request_access_areas (id, request_id, access_area_id, review_status, created_at) " +
        "VALUES (?, ?, ?, 'APPROVED', NOW())",
        randomUUID(), id, a.access_area_id,
      );
    }
  }

  console.log('CREATED_OK ' + id + ' ' + newNum);
}

main().then(() => p.$disconnect())
  .catch((e) => { console.error('FIXTURE_ERR', e.message); p.$disconnect(); process.exit(1); });
