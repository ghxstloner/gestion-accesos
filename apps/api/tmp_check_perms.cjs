require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const url = process.env.DATABASE_URL;
const adapter = new PrismaMariaDb(url);
const p = new PrismaClient({ adapter });

(async () => {
  const me = await p.user.findFirst({
    where: { documentNumber: '8-901-234' },
    select: { id: true, firstName: true, documentNumber: true },
  });
  console.log('user:', JSON.stringify(me));

  const roles = await p.$queryRawUnsafe(
    "SELECT * FROM user_roles WHERE user_id = '" + (me && me.id) + "'"
  );
  console.log('user_roles:', JSON.stringify(roles));

  // Try UserRole model
  try {
    const viaModel = await p.userRole.findMany({ where: { userId: me.id } });
    console.log('via model userRole:', JSON.stringify(viaModel));
  } catch (e) {
    console.log('userRole model err:', String(e.message).split('\n')[0]);
  }

  // Now check what compute permissions would do -- look at the role
  try {
    const roleRow = await p.role.findFirst({
      where: { code: 'CARD_ISSUER' },
    });
    console.log('role CARD_ISSUER:', JSON.stringify(roleRow));
  } catch (e) {
    console.log('role lookup err:', String(e.message).split('\n')[0]);
  }

  // permissions table
  try {
    const perms = await p.permission.findMany({
      where: { rolePermissions: { some: { role: { code: 'CARD_ISSUER' } } } },
    });
    console.log('CARD_ISSUER perms:', JSON.stringify(perms.map((x) => x.code)));

    const rpRaw = await p.$queryRawUnsafe(
      "SELECT rp.role_id, rp.permission_id, p.code FROM role_permissions rp " +
      "JOIN permissions p ON p.id = rp.permission_id " +
      "JOIN roles r ON r.id = rp.role_id WHERE r.code = 'CARD_ISSUER'"
    );
    console.log('role_permissions raw:', JSON.stringify(rpRaw));

    const totalRp = await p.$queryRawUnsafe('SELECT COUNT(*) c FROM role_permissions');
    console.log('role_permissions count =', Number(totalRp[0].c));
  } catch (e) {
    console.log('permission lookup err:', String(e.message).split('\n')[0]);
  }

  await p.$disconnect();
})();
