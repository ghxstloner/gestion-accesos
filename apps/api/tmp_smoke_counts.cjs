require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const url = process.env.DATABASE_URL;
const adapter = new PrismaMariaDb(url);
const p = new PrismaClient({ adapter });

(async () => {
  const tables = [
    'users', 'companies', 'requests', 'credentials',
    'credential_events', 'delivery_records', 'custody_records',
    'file_metadata', 'notifications', 'audit_events', 'review_tasks',
  ];
  for (const t of tables) {
    try {
      const rows = await p.$queryRawUnsafe('SELECT COUNT(*) AS c FROM `' + t + '`');
      console.log(t, '=', Number(rows[0].c));
    } catch (e) {
      console.log(t, 'ERR', String(e.message).split('\n')[0]);
    }
  }
  await p.$disconnect();
})();
