import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS } from '../src/modules/identity/domain/permissions.js';
import { CATALOG_SEEDS } from '../src/modules/catalogs/domain/catalog-seeds.js';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

const DEMO_PASSWORD = 'Demo1234!';

const companies = [
  { id: undefined, legalName: 'Administración Aeroportuaria Central, S.A.', tradeName: 'AAC', taxIdentifier: 'AAC-155001-2-2015', email: 'contacto@aac.aero', phone: '+507 275-9000', address: 'Edificio Sede, Aeropuerto Internacional, Ciudad', mainContactName: 'Roberto Méndez', status: 'ACTIVE' as const },
  { id: undefined, legalName: "McDonald's Panamá, S.A.", tradeName: "McDonald's", taxIdentifier: 'MCD-778001-1-2018', email: 'operaciones@mdpanama.com', phone: '+507 269-1100', address: 'Local 14, Terminal 1, Aeropuerto Internacional', mainContactName: 'Laura Fuentes', status: 'ACTIVE' as const },
  { id: undefined, legalName: 'Copa Airlines, S.A.', tradeName: 'Copa Airlines', taxIdentifier: 'CPA-155123-2-2010', email: 'accesos@copaair.com', phone: '+507 304-2000', address: 'Edificio Copa, Hub de las Américas', mainContactName: 'Andrés Pino', status: 'ACTIVE' as const },
  { id: undefined, legalName: 'Empresa Contratista Delta, S.A.', tradeName: 'Contratista Delta', taxIdentifier: 'DLT-778456-1-2020', email: 'rrhh@deltacontratista.com', phone: '+507 321-4400', address: 'Galpón 7, Zona Franca, Aeropuerto', mainContactName: 'Marta Ríos', status: 'ACTIVE' as const },
  { id: undefined, legalName: 'Servicios Aeroportuarios Panamá, S.A.', tradeName: 'SAP', taxIdentifier: 'SAP-155987-2-2012', email: 'carnes@sapaero.com', phone: '+507 275-7788', address: 'Bodega 3, Área de Carga, Aeropuerto', mainContactName: 'Carlos Iturra', status: 'INACTIVE' as const },
];

const users = [
  { firstName: 'Roberto', lastName: 'Méndez', email: 'r.mendez@aac.aero', companyIndex: 0, roleCode: 'SYSTEM_ADMIN' as const, status: 'ACTIVE' as const },
  { firstName: 'Laura', lastName: 'Fuentes', email: 'l.fuentes@mdpanama.com', companyIndex: 1, roleCode: 'COMPANY_ADMIN' as const, status: 'ACTIVE' as const },
  { firstName: 'Andrés', lastName: 'Pino', email: 'a.pino@copaair.com', companyIndex: 2, roleCode: 'COMPANY_ADMIN' as const, status: 'ACTIVE' as const },
  { firstName: 'Marta', lastName: 'Ríos', email: 'm.rios@deltacontratista.com', companyIndex: 3, roleCode: 'COMPANY_ADMIN' as const, status: 'ACTIVE' as const },
  { firstName: 'José', lastName: 'Torres', email: 'j.torres@copaair.com', companyIndex: 2, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const },
  { firstName: 'Daniela', lastName: 'Cruz', email: 'd.cruz@aac.aero', companyIndex: 0, roleCode: 'DOCUMENT_RECEIVER' as const, status: 'ACTIVE' as const },
  { firstName: 'Manuel', lastName: 'Ortega', email: 'm.ortega@aac.aero', companyIndex: 0, roleCode: 'ACCESS_DOCUMENTS_MANAGER' as const, status: 'ACTIVE' as const },
  { firstName: 'Patricia', lastName: 'Salas', email: 'p.salas@aac.aero', companyIndex: 0, roleCode: 'CARD_ISSUER' as const, status: 'ACTIVE' as const },
  { firstName: 'Sergio', lastName: 'Gómez', email: 's.gomez@deltacontratista.com', companyIndex: 3, roleCode: 'APPLICANT' as const, status: 'BLOCKED' as const },
];

async function main() {
  console.log('Seeding SGA database...');

  // 1. Create permissions
  const permissionMap = new Map<string, string>();
  for (const code of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code },
      create: { code, name: code, description: `Permission: ${code}` },
      update: {},
    });
    permissionMap.set(code, perm.id);
  }
  console.log(`  ✓ ${permissionMap.size} permissions`);

  // 2. Create roles and link permissions
  const roleMap = new Map<string, string>();
  for (const [code, info] of Object.entries(ROLE_LABELS)) {
    const role = await prisma.role.upsert({
      where: { code: code as any },
      create: { code: code as any, name: info.name, description: info.description, isSystem: true },
      update: { name: info.name, description: info.description },
    });
    roleMap.set(code, role.id);

    const perms = ROLE_PERMISSIONS[code] || [];
    for (const permCode of perms) {
      const permId = permissionMap.get(permCode)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        create: { roleId: role.id, permissionId: permId },
        update: {},
      });
    }
  }
  console.log(`  ✓ ${roleMap.size} roles with permissions`);

  // 3. Create companies
  const companyMap = new Map<number, string>();
  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const company = await prisma.company.upsert({
      where: { taxIdentifier: c.taxIdentifier! },
      create: {
        legalName: c.legalName,
        tradeName: c.tradeName,
        taxIdentifier: c.taxIdentifier,
        email: c.email,
        phone: c.phone,
        address: c.address,
        mainContactName: c.mainContactName,
        status: c.status,
      },
      update: {
        legalName: c.legalName,
        tradeName: c.tradeName,
        email: c.email,
        phone: c.phone,
        address: c.address,
        mainContactName: c.mainContactName,
        status: c.status,
      },
    });
    companyMap.set(i, company.id);
  }
  console.log(`  ✓ ${companyMap.size} companies`);

  // 4. Create users
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  let userCount = 0;
  for (const u of users) {
    const companyId = companyMap.get(u.companyIndex)!;
    const roleId = roleMap.get(u.roleCode)!;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        companyId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        passwordHash,
        status: u.status,
      },
      update: {
        companyId,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        status: u.status,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      create: { userId: user.id, roleId },
      update: {},
    });
    userCount++;
  }
  console.log(`  ✓ ${userCount} users (password: ${DEMO_PASSWORD})`);

  // 5. Seed catalog items
  let catalogCount = 0;
  for (const group of CATALOG_SEEDS) {
    for (const entry of group.entries) {
      await prisma.catalogItem.upsert({
        where: { kind_code: { kind: group.kind, code: entry.code } },
        create: {
          kind: group.kind,
          code: entry.code,
          name: entry.name,
          description: entry.description ?? null,
          sortOrder: entry.sortOrder ?? 0,
          isActive: true,
          isEssential: entry.isEssential ?? false,
        },
        update: { name: entry.name, description: entry.description ?? null },
      });
      catalogCount++;
    }
  }
  console.log(`  ✓ ${catalogCount} catalog items`);

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
