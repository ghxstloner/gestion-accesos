import 'dotenv/config';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
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
  const userMap = new Map<string, string>();
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
    userMap.set(u.email, user.id);
    userCount++;
  }
  console.log(`  ✓ ${userCount} users (password: ${DEMO_PASSWORD})`);

  // 5. Seed catalog items
  const catalogMap = new Map<string, string>();
  let catalogCount = 0;
  for (const group of CATALOG_SEEDS) {
    for (const entry of group.entries) {
      const item = await prisma.catalogItem.upsert({
        where: { kind_code: { kind: group.kind, code: entry.code } },
        create: {
          kind: group.kind,
          code: entry.code,
          name: entry.name,
          description: entry.description ?? null,
          displayOrder: 0,
          isActive: true,
          parentZoneCode: entry.parentZoneCode ?? null,
          metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        },
        update: {
          name: entry.name,
          description: entry.description ?? null,
          parentZoneCode: entry.parentZoneCode ?? null,
          metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      catalogMap.set(`${group.kind}:${entry.code}`, item.id);
      catalogCount++;
    }
  }
  console.log(`  ✓ ${catalogCount} catalog items`);

  // 6. People: all demonstration records live in the database, never in the UI.
  const peopleSeed = [
    { key: 'carlos', companyIndex: 2, firstName: 'Carlos', middleName: 'Eduardo', firstSurname: 'Vargas', secondSurname: 'López', identificationType: 'CEDULA', identificationNumber: '8-123-456', birthDate: '1988-05-12', gender: 'MASCULINO', maritalStatus: 'CASADO', nationality: 'Panameña', bloodType: 'O+', email: 'c.vargas@copaair.com', mobile: '+507 6123-4567', department: 'Operaciones', position: 'Agente de rampa', yearsOfService: 6, status: 'ACTIVE' as const },
    { key: 'maria', companyIndex: 1, firstName: 'María', middleName: 'José', firstSurname: 'Fernández', secondSurname: 'Quirós', identificationType: 'CEDULA', identificationNumber: '4-567-890', birthDate: '1992-11-03', gender: 'FEMENINO', maritalStatus: 'CASADO', nationality: 'Panameña', bloodType: 'A+', email: 'm.fernandez@mdpanama.com', mobile: '+507 6234-5678', department: 'Operaciones', position: 'Supervisora de tienda', yearsOfService: 3, status: 'ACTIVE' as const },
    { key: 'luis', companyIndex: 3, firstName: 'Luis', middleName: 'Alberto', firstSurname: 'Castro', secondSurname: 'Mena', identificationType: 'CEDULA', identificationNumber: '3-210-345', birthDate: '1990-02-28', gender: 'MASCULINO', maritalStatus: 'SOLTERO', nationality: 'Panameña', bloodType: 'B+', email: 'l.castro@deltacontratista.com', mobile: '+507 6345-6789', department: 'Mantenimiento', position: 'Técnico eléctrico', yearsOfService: 4, status: 'ACTIVE' as const },
    { key: 'ana', companyIndex: 4, firstName: 'Ana', middleName: 'Lucía', firstSurname: 'Pérez', secondSurname: 'Solís', identificationType: 'PASAPORTE', identificationNumber: 'PA-1234567', birthDate: '1995-07-19', gender: 'FEMENINO', maritalStatus: 'SOLTERO', nationality: 'Colombiana', bloodType: 'AB+', email: 'a.perez@sapaero.com', mobile: '+507 6456-7890', department: 'Carga', position: 'Coordinadora de carga', yearsOfService: 2, status: 'ACTIVE' as const },
    { key: 'jorge', companyIndex: 2, firstName: 'Jorge', middleName: 'Ignacio', firstSurname: 'Ramos', secondSurname: 'Vidal', identificationType: 'CEDULA', identificationNumber: '6-789-012', birthDate: '1985-09-22', gender: 'MASCULINO', maritalStatus: 'CASADO', nationality: 'Panameña', bloodType: 'O-', email: 'j.ramos@copaair.com', mobile: '+507 6567-8901', department: 'Seguridad', position: 'Analista de seguridad', yearsOfService: 9, status: 'ACTIVE' as const },
    { key: 'elena', companyIndex: 1, firstName: 'Elena', middleName: 'Rosa', firstSurname: 'Soto', secondSurname: 'Campos', identificationType: 'CEDULA', identificationNumber: '2-345-678', birthDate: '1993-12-08', gender: 'FEMENINO', maritalStatus: 'UNION_LIBRE', nationality: 'Panameña', bloodType: 'A-', email: 'e.soto@mdpanama.com', mobile: '+507 6678-9012', department: 'Recursos Humanos', position: 'Reclutadora', yearsOfService: 1, status: 'INACTIVE' as const },
    { key: 'diego', companyIndex: 3, firstName: 'Diego', middleName: 'Fernando', firstSurname: 'Herrera', secondSurname: 'Mora', identificationType: 'CEDULA', identificationNumber: '1-901-234', birthDate: '1982-03-15', gender: 'MASCULINO', maritalStatus: 'CASADO', nationality: 'Panameña', bloodType: 'B-', email: 'd.herrera@deltacontratista.com', mobile: '+507 6789-0123', department: 'Mantenimiento', position: 'Jefe de cuadrilla', yearsOfService: 7, status: 'ACTIVE' as const },
    { key: 'sofia', companyIndex: 0, firstName: 'Sofía', middleName: 'Beatriz', firstSurname: 'Núñez', secondSurname: 'Arias', identificationType: 'CEDULA', identificationNumber: '9-234-567', birthDate: '1998-08-30', gender: 'FEMENINO', maritalStatus: 'SOLTERO', nationality: 'Panameña', bloodType: 'O+', email: 's.nunez@aac.aero', mobile: '+507 6890-1234', department: 'Accesos', position: 'Oficial de accesos', yearsOfService: 2, status: 'ACTIVE' as const },
  ];
  const personMap = new Map<string, string>();
  for (const person of peopleSeed) {
    const identificationTypeId = catalogMap.get(`IDENTIFICATION_TYPE:${person.identificationType}`)!;
    const row = await prisma.person.upsert({
      where: { identificationTypeId_identificationNumber: { identificationTypeId, identificationNumber: person.identificationNumber } },
      create: {
        companyId: companyMap.get(person.companyIndex)!, firstName: person.firstName,
        middleName: person.middleName, firstSurname: person.firstSurname,
        secondSurname: person.secondSurname, identificationTypeId,
        identificationNumber: person.identificationNumber, birthDate: new Date(person.birthDate),
        gender: person.gender, maritalStatus: person.maritalStatus, nationality: person.nationality,
        bloodType: person.bloodType, email: person.email, mobile: person.mobile,
        department: person.department, position: person.position,
        yearsOfService: person.yearsOfService, status: person.status,
      },
      update: {
        companyId: companyMap.get(person.companyIndex)!, firstName: person.firstName,
        middleName: person.middleName, firstSurname: person.firstSurname,
        secondSurname: person.secondSurname, birthDate: new Date(person.birthDate),
        gender: person.gender, maritalStatus: person.maritalStatus, nationality: person.nationality,
        bloodType: person.bloodType, email: person.email, mobile: person.mobile,
        department: person.department, position: person.position,
        yearsOfService: person.yearsOfService, status: person.status,
      },
    });
    personMap.set(person.key, row.id);
  }
  console.log(`  ✓ ${personMap.size} people`);

  // 7. Authorized signers.
  const signerSeed = [
    { key: 'copa', companyIndex: 2, personKey: 'jorge', position: 'Gerente de seguridad' },
    { key: 'mcd', companyIndex: 1, personKey: 'maria', position: 'Gerente de operaciones' },
    { key: 'delta', companyIndex: 3, personKey: 'diego', position: 'Jefe de operaciones' },
  ];
  const signerMap = new Map<string, string>();
  for (const signer of signerSeed) {
    const existing = await prisma.companyAuthorizedSigner.findFirst({
      where: { companyId: companyMap.get(signer.companyIndex)!, personId: personMap.get(signer.personKey)! },
    });
    const row = existing
      ? await prisma.companyAuthorizedSigner.update({ where: { id: existing.id }, data: { position: signer.position, validFrom: new Date('2024-01-01'), validUntil: new Date('2027-12-31'), status: 'ACTIVE' } })
      : await prisma.companyAuthorizedSigner.create({ data: { companyId: companyMap.get(signer.companyIndex)!, personId: personMap.get(signer.personKey)!, position: signer.position, validFrom: new Date('2024-01-01'), validUntil: new Date('2027-12-31'), status: 'ACTIVE' } });
    signerMap.set(signer.key, row.id);
  }
  console.log(`  ✓ ${signerMap.size} authorized signers`);

  // 8. Requests and their aggregate children.
  const requestSeed = [
    { number: 'SGA-2026-000118', type: 'PERMANENT_CARD', companyIndex: 2, signer: 'copa', creator: 'a.pino@copaair.com', reason: 'Renovación de carné permanente para personal de operaciones', from: '2026-08-01', until: '2027-07-31', status: 'UNDER_DOCUMENT_REVIEW' as const, people: ['carlos'], points: ['EMP_T1T2', 'PORTON_8'], areas: ['ROJA-A', 'NARANJA-A'] },
    { number: 'SGA-2026-000112', type: 'TEMPORARY_PERSON', companyIndex: 1, signer: 'mcd', creator: 'l.fuentes@mdpanama.com', reason: 'Ingreso temporal para auditoría de tienda', from: '2026-07-20', until: '2026-07-22', status: 'PENDING_FINAL_APPROVAL' as const, people: ['maria', 'elena'], points: ['FOOD_COURT', 'EMP_T1T2'], areas: ['BLANCA-T1'] },
    { number: 'SGA-2026-000104', type: 'TEMPORARY_VEHICLE', companyIndex: 3, signer: 'delta', creator: 'm.rios@deltacontratista.com', reason: 'Ingreso de vehículo para traslado de materiales', from: '2026-07-15', until: '2026-07-15', status: 'RETURNED_FOR_CORRECTION' as const, people: ['luis'], points: ['PORTON_10', 'EDIF_CARGA'], areas: ['ROJA-A', 'VERDE-A'], vehicle: true },
    { number: 'SGA-2026-000099', type: 'PERMANENT_CARD', companyIndex: 2, signer: 'copa', creator: 'a.pino@copaair.com', reason: 'Carné permanente para analista de seguridad', from: '2026-07-01', until: '2027-06-30', status: 'APPROVED' as const, people: ['jorge'], points: ['EMP_T1T2', 'PORTON_3'], areas: ['ROJA-B', 'AZUL-A'], credential: 'IN_PRODUCTION' as const },
    { number: 'SGA-2026-000098', type: 'PERMANENT_CARD', companyIndex: 2, signer: 'copa', creator: 'a.pino@copaair.com', reason: 'Carné permanente para agente de rampa', from: '2026-06-01', until: '2027-05-31', status: 'APPROVED' as const, people: ['carlos'], points: ['EMP_T1T2', 'PORTON_8'], areas: ['ROJA-A'], credential: 'DELIVERED' as const },
    { number: 'SGA-2026-000095', type: 'TEMPORARY_EQUIPMENT', companyIndex: 3, signer: 'delta', creator: 'm.rios@deltacontratista.com', reason: 'Ingreso de equipos de soldadura', from: '2026-07-18', until: '2026-07-20', status: 'APPROVED' as const, people: ['diego', 'luis'], points: ['PORTON_10', 'EDIF_CARGA'], areas: ['VERDE-A'], equipment: true },
    { number: 'SGA-2026-000088', type: 'TEMPORARY_PERSON', companyIndex: 0, creator: 'r.mendez@aac.aero', reason: 'Acceso temporal para inspección de instalaciones', from: '2026-07-25', until: '2026-07-26', status: 'REJECTED' as const, people: ['sofia'], points: ['EMP_T1T2'], areas: ['BLANCA-T1', 'CELESTE-ADM'] },
    { number: 'SGA-2026-000120', type: 'TEMPORARY_PERSON', companyIndex: 1, signer: 'mcd', creator: 'l.fuentes@mdpanama.com', reason: 'Ingreso para capacitación de personal', from: '2026-08-05', until: '2026-08-06', status: 'DRAFT' as const, people: ['maria'], points: ['FOOD_COURT'], areas: [] },
  ];
  const requestMap = new Map<string, string>();
  for (const fixture of requestSeed) {
    const personLinks = fixture.people.map((key, index) => ({
      personId: personMap.get(key)!, role: index === 0 ? 'PRIMARY' as const : 'BENEFICIARY' as const,
    }));
    const accessPoints = fixture.points.map((code) => ({ accessPointId: catalogMap.get(`ACCESS_POINT:${code}`)! }));
    const accessAreas = fixture.areas.map((code) => ({ accessAreaId: catalogMap.get(`ACCESS_AREA:${code}`)!, justification: `Acceso requerido: ${code}` }));
    const children = {
      personLinks: { create: personLinks }, accessPoints: { create: accessPoints }, accessAreas: { create: accessAreas },
      vehicles: fixture.vehicle ? { create: [{ brand: 'Toyota', model: 'Hilux', plateNumber: '8X-23-45', color: 'Blanco', year: 2022 }] } : undefined,
      equipment: fixture.equipment ? { create: [{ brand: 'Lincoln', equipmentType: 'Soldadora', serialNumber: 'SN-LIN-001', quantity: 1 }, { brand: 'Bosch', equipmentType: 'Taladro', serialNumber: 'SN-BOS-002', quantity: 2 }] } : undefined,
    };
    const existing = await prisma.request.findUnique({ where: { requestNumber: fixture.number } });
    if (existing) {
      await prisma.requestPerson.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestAccessPoint.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestAccessArea.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestVehicle.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestEquipment.deleteMany({ where: { requestId: existing.id } });
    }
    const data = {
      requestNumber: fixture.number, companyId: companyMap.get(fixture.companyIndex)!,
      requestTypeId: catalogMap.get(`REQUEST_TYPE:${fixture.type}`)!,
      createdByUserId: userMap.get(fixture.creator)!, createdByCompanyId: companyMap.get(fixture.companyIndex)!,
      authorizedSignerId: fixture.signer ? signerMap.get(fixture.signer) : null,
      reason: fixture.reason, validFrom: new Date(fixture.from), validUntil: new Date(fixture.until),
      scheduleFrom: '08:00', scheduleUntil: '17:00', status: fixture.status,
      submittedAt: fixture.status === 'DRAFT' ? null : new Date('2026-07-08T10:00:00Z'),
    };
    const row = existing
      ? await prisma.request.update({ where: { id: existing.id }, data: { ...data, ...children } })
      : await prisma.request.create({ data: { ...data, ...children } });
    requestMap.set(fixture.number, row.id);

    await prisma.requestEvent.deleteMany({ where: { requestId: row.id } });
    await prisma.requestEvent.create({ data: { requestId: row.id, eventType: fixture.status === 'DRAFT' ? 'CREATED' : 'SUBMITTED', fromStatus: null, toStatus: fixture.status, actorUserId: userMap.get(fixture.creator)!, actorCompanyId: companyMap.get(fixture.companyIndex)!, occurredAt: new Date('2026-07-08T10:00:00Z') } });
    await prisma.requestDocument.deleteMany({ where: { requestId: row.id } });
    if (fixture.status !== 'DRAFT') {
      const seededDocuments = [
        { code: 'CEDULA', filename: `identificacion-${fixture.number}.pdf` },
        { code: 'AUTORIZACION', filename: `autorizacion-${fixture.number}.pdf` },
      ];
      for (const [index, document] of seededDocuments.entries()) {
        const documentId = randomUUID();
        const versionId = randomUUID();
        const status = fixture.status === 'RETURNED_FOR_CORRECTION' && index === 1
          ? 'REJECTED' as const
          : fixture.status === 'UNDER_DOCUMENT_REVIEW' && index === 1
            ? 'PENDING' as const
            : 'APPROVED' as const;
        await prisma.requestDocument.create({ data: {
          id: documentId, requestId: row.id,
          documentTypeId: catalogMap.get(`DOCUMENT_TYPE:${document.code}`)!,
          subjectType: 'REQUEST', subjectId: row.id, status,
        } });
        await prisma.documentVersion.create({ data: {
          id: versionId, requestDocumentId: documentId, versionNumber: 1,
          originalFilename: document.filename, storedFilename: document.filename,
          storageKey: `seed/${fixture.number}/${document.filename}`,
          mimeType: 'application/pdf', size: BigInt(220_000 + index * 10_000),
          sha256: createHash('sha256').update(document.filename).digest('hex'),
          uploadedBy: userMap.get(fixture.creator)!, uploadedAt: new Date('2026-07-08T10:00:00Z'),
        } });
        await prisma.requestDocument.update({ where: { id: documentId }, data: { currentVersionId: versionId } });
      }
    }
    await prisma.reviewTask.deleteMany({ where: { requestId: row.id } });
    if (fixture.status === 'UNDER_DOCUMENT_REVIEW') await prisma.reviewTask.create({ data: { requestId: row.id, taskType: 'DOCUMENT_REVIEW', status: 'ASSIGNED', assignedToUserId: userMap.get('d.cruz@aac.aero'), assignedRoleCode: 'DOCUMENT_RECEIVER', assignedAt: new Date() } });
    if (fixture.status === 'PENDING_FINAL_APPROVAL') await prisma.reviewTask.create({ data: { requestId: row.id, taskType: 'FINAL_APPROVAL', status: 'ASSIGNED', assignedToUserId: userMap.get('m.ortega@aac.aero'), assignedRoleCode: 'ACCESS_DOCUMENTS_MANAGER', assignedAt: new Date() } });

    if (fixture.credential) {
      const credentialNumber = fixture.number === 'SGA-2026-000098' ? 'CAR-2026-000098' : 'CAR-2026-000099';
      const credential = await prisma.credential.upsert({
        where: { requestId: row.id },
        create: { credentialNumber, requestId: row.id, credentialType: 'PERMANENT_CARD', personId: personLinks[0].personId, status: fixture.credential, createdBy: userMap.get('p.salas@aac.aero')!, producedAt: new Date('2026-07-08T08:00:00Z'), readyAt: fixture.credential === 'DELIVERED' ? new Date('2026-07-09T10:00:00Z') : null, deliveredAt: fixture.credential === 'DELIVERED' ? new Date('2026-07-10T10:00:00Z') : null },
        update: { status: fixture.credential, personId: personLinks[0].personId },
      });
      if (fixture.credential === 'DELIVERED') await prisma.deliveryRecord.upsert({ where: { credentialId: credential.id }, create: { credentialId: credential.id, deliveredByUserId: userMap.get('p.salas@aac.aero')!, receivedByName: 'Carlos Vargas', receivedByIdentification: '8-123-456', deliveredAt: new Date('2026-07-10T10:00:00Z'), observations: 'Entregado al titular en oficina de accesos' }, update: {} });
    }
  }
  console.log(`  ✓ ${requestMap.size} requests with workflow data`);

  // 9. User-scoped notifications and append-only audit examples.
  const notifications = [
    { id: '10000000-0000-4000-8000-000000000001', user: 'd.cruz@aac.aero', title: 'Nueva solicitud recibida', message: 'SGA-2026-000118 — solicitud pendiente de revisión.', type: 'info', entity: 'SGA-2026-000118' },
    { id: '10000000-0000-4000-8000-000000000002', user: 'm.ortega@aac.aero', title: 'Solicitud pendiente de aprobación', message: 'SGA-2026-000112 — documentación revisada.', type: 'success', entity: 'SGA-2026-000112' },
    { id: '10000000-0000-4000-8000-000000000003', user: 'm.rios@deltacontratista.com', title: 'Solicitud devuelta', message: 'SGA-2026-000104 — se requiere una corrección.', type: 'warning', entity: 'SGA-2026-000104' },
    { id: '10000000-0000-4000-8000-000000000004', user: 'p.salas@aac.aero', title: 'Carné entregado', message: 'SGA-2026-000098 — entrega registrada.', type: 'success', entity: 'SGA-2026-000098' },
  ];
  for (const notification of notifications) await prisma.notification.upsert({ where: { id: notification.id }, create: { id: notification.id, userId: userMap.get(notification.user)!, type: notification.type, title: notification.title, message: notification.message, entityType: 'Request', entityId: requestMap.get(notification.entity) }, update: { title: notification.title, message: notification.message } });
  const audits = [
    ['20000000-0000-4000-8000-000000000001', 'company.created', 'Company', companyMap.get(1)!, 'r.mendez@aac.aero'],
    ['20000000-0000-4000-8000-000000000002', 'request.approved', 'Request', requestMap.get('SGA-2026-000112')!, 'd.cruz@aac.aero'],
    ['20000000-0000-4000-8000-000000000003', 'person.created', 'Person', personMap.get('sofia')!, 'r.mendez@aac.aero'],
    ['20000000-0000-4000-8000-000000000004', 'request.submitted', 'Request', requestMap.get('SGA-2026-000118')!, 'a.pino@copaair.com'],
    ['20000000-0000-4000-8000-000000000005', 'credential.production_started', 'Credential', requestMap.get('SGA-2026-000099')!, 'p.salas@aac.aero'],
  ];
  for (const [id, action, aggregateType, aggregateId, actorEmail] of audits) await prisma.auditEvent.upsert({ where: { id }, create: { id, action, aggregateType, aggregateId, actorUserId: userMap.get(actorEmail)! }, update: {} });

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
