import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS } from '../src/modules/identity/domain/permissions.js';
import { CATALOG_SEEDS } from '../src/modules/catalogs/domain/catalog-seeds.js';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

if (!process.env.SEED_ADMIN_PASSWORD) {
  console.error('Error: SEED_ADMIN_PASSWORD environment variable is required to run seed.');
  process.exit(1);
}
const DEFAULT_ADMIN_PASSWORD = 'Amaxonia26*';
const DEMO_PASSWORD = 'Demo1234!';

const companies = [
  { id: undefined, legalName: 'Administración Aeroportuaria Central, S.A.', tradeName: 'AAC', taxIdentifier: 'AAC-155001-2-2015', email: 'contacto@aac.aero', phone: '+507 275-9000', address: 'Edificio Sede, Aeropuerto Internacional, Ciudad', mainContactName: 'Roberto Méndez', status: 'ACTIVE' as const },
  { id: undefined, legalName: "McDonald's Panamá, S.A.", tradeName: "McDonald's", taxIdentifier: 'MCD-778001-1-2018', email: 'operaciones@mdpanama.com', phone: '+507 269-1100', address: 'Local 14, Terminal 1, Aeropuerto Internacional', mainContactName: 'Laura Fuentes', status: 'ACTIVE' as const },
  { id: undefined, legalName: 'Copa Airlines, S.A.', tradeName: 'Copa Airlines', taxIdentifier: 'CPA-155123-2-2010', email: 'accesos@copaair.com', phone: '+507 304-2000', address: 'Edificio Copa, Hub de las Américas', mainContactName: 'Andrés Pino', status: 'ACTIVE' as const },
  { id: undefined, legalName: 'Empresa Contratista Delta, S.A.', tradeName: 'Contratista Delta', taxIdentifier: 'DLT-778456-1-2020', email: 'rrhh@deltacontratista.com', phone: '+507 321-4400', address: 'Galpón 7, Zona Franca, Aeropuerto', mainContactName: 'Marta Ríos', status: 'ACTIVE' as const },
  { id: undefined, legalName: 'Servicios Aeroportuarios Panamá, S.A.', tradeName: 'SAP', taxIdentifier: 'SAP-155987-2-2012', email: 'carnes@sapaero.com', phone: '+507 275-7788', address: 'Bodega 3, Área de Carga, Aeropuerto', mainContactName: 'Carlos Iturra', status: 'INACTIVE' as const },
];

// All human users (no separate Person entity)
const initialUsers = [
  // Super Admin: Yoiner Moreno
  { key: 'yoiner', documentType: 'PASSPORT' as const, documentNumber: '5849827', firstName: 'Yoiner', lastName: 'Moreno', email: null, companyIndex: 0, roleCode: 'SYSTEM_ADMIN' as const, status: 'ACTIVE' as const, isCustomPassword: true },
  { key: 'roberto', documentType: 'NATIONAL_ID' as const, documentNumber: '8-234-567', firstName: 'Roberto', lastName: 'Méndez', email: 'r.mendez@aac.aero', companyIndex: 0, roleCode: 'SYSTEM_ADMIN' as const, status: 'ACTIVE' as const },
  { key: 'laura', documentType: 'NATIONAL_ID' as const, documentNumber: '4-345-678', firstName: 'Laura', lastName: 'Fuentes', email: 'l.fuentes@mdpanama.com', companyIndex: 1, roleCode: 'COMPANY_ADMIN' as const, status: 'ACTIVE' as const },
  { key: 'andres', documentType: 'NATIONAL_ID' as const, documentNumber: '3-456-789', firstName: 'Andrés', lastName: 'Pino', email: 'a.pino@copaair.com', companyIndex: 2, roleCode: 'COMPANY_ADMIN' as const, status: 'ACTIVE' as const },
  { key: 'marta', documentType: 'NATIONAL_ID' as const, documentNumber: '2-567-890', firstName: 'Marta', lastName: 'Ríos', email: 'm.rios@deltacontratista.com', companyIndex: 3, roleCode: 'COMPANY_ADMIN' as const, status: 'ACTIVE' as const },
  { key: 'jose', documentType: 'NATIONAL_ID' as const, documentNumber: '8-678-901', firstName: 'José', lastName: 'Torres', email: 'j.torres@copaair.com', companyIndex: 2, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const },
  { key: 'daniela', documentType: 'NATIONAL_ID' as const, documentNumber: '8-789-012', firstName: 'Daniela', lastName: 'Cruz', email: 'd.cruz@aac.aero', companyIndex: 0, roleCode: 'DOCUMENT_RECEIVER' as const, status: 'ACTIVE' as const },
  { key: 'manuel', documentType: 'NATIONAL_ID' as const, documentNumber: '8-890-123', firstName: 'Manuel', lastName: 'Ortega', email: 'm.ortega@aac.aero', companyIndex: 0, roleCode: 'ACCESS_DOCUMENTS_MANAGER' as const, status: 'ACTIVE' as const },
  { key: 'patricia', documentType: 'NATIONAL_ID' as const, documentNumber: '8-901-234', firstName: 'Patricia', lastName: 'Salas', email: 'p.salas@aac.aero', companyIndex: 0, roleCode: 'CARD_ISSUER' as const, status: 'ACTIVE' as const },
  { key: 'sergio', documentType: 'NATIONAL_ID' as const, documentNumber: '8-012-345', firstName: 'Sergio', lastName: 'Gómez', email: 's.gomez@deltacontratista.com', companyIndex: 3, roleCode: 'APPLICANT' as const, status: 'BLOCKED' as const },
  // Participants & Subject Users
  { key: 'carlos', documentType: 'NATIONAL_ID' as const, documentNumber: '8-123-456', firstName: 'Carlos', middleName: 'Eduardo', lastName: 'Vargas', secondLastName: 'López', email: 'c.vargas@copaair.com', companyIndex: 2, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const, department: 'Operaciones', position: 'Agente de rampa' },
  { key: 'maria', documentType: 'NATIONAL_ID' as const, documentNumber: '4-567-890', firstName: 'María', middleName: 'José', lastName: 'Fernández', secondLastName: 'Quirós', email: 'm.fernandez@mdpanama.com', companyIndex: 1, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const, department: 'Operaciones', position: 'Supervisora de tienda' },
  { key: 'luis', documentType: 'NATIONAL_ID' as const, documentNumber: '3-210-345', firstName: 'Luis', middleName: 'Alberto', lastName: 'Castro', secondLastName: 'Mena', email: 'l.castro@deltacontratista.com', companyIndex: 3, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const, department: 'Mantenimiento', position: 'Técnico eléctrico' },
  { key: 'ana', documentType: 'PASSPORT' as const, documentNumber: 'PA-1234567', firstName: 'Ana', middleName: 'Lucía', lastName: 'Pérez', secondLastName: 'Solís', email: 'a.perez@sapaero.com', companyIndex: 4, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const, department: 'Carga', position: 'Coordinadora de carga' },
  { key: 'jorge', documentType: 'NATIONAL_ID' as const, documentNumber: '6-789-012', firstName: 'Jorge', middleName: 'Ignacio', lastName: 'Ramos', secondLastName: 'Vidal', email: 'j.ramos@copaair.com', companyIndex: 2, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const, department: 'Seguridad', position: 'Analista de seguridad' },
  { key: 'elena', documentType: 'NATIONAL_ID' as const, documentNumber: '2-345-678', firstName: 'Elena', middleName: 'Rosa', lastName: 'Soto', secondLastName: 'Campos', email: 'e.soto@mdpanama.com', companyIndex: 1, roleCode: 'APPLICANT' as const, status: 'INACTIVE' as const, department: 'Recursos Humanos', position: 'Reclutadora' },
  { key: 'diego', documentType: 'NATIONAL_ID' as const, documentNumber: '1-901-234', firstName: 'Diego', middleName: 'Fernando', lastName: 'Herrera', secondLastName: 'Mora', email: 'd.herrera@deltacontratista.com', companyIndex: 3, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const, department: 'Mantenimiento', position: 'Jefe de cuadrilla' },
  { key: 'sofia', documentType: 'NATIONAL_ID' as const, documentNumber: '9-234-567', firstName: 'Sofía', middleName: 'Beatriz', lastName: 'Núñez', secondLastName: 'Arias', email: 's.nunez@aac.aero', companyIndex: 0, roleCode: 'APPLICANT' as const, status: 'ACTIVE' as const, department: 'Accesos', position: 'Oficial de accesos' },
];

function normalizeDoc(doc: string): string {
  return doc.trim().toUpperCase();
}

async function main() {
  console.log('Seeding SGA database with consolidated User + AuthIdentity architecture...');

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

  // 4. Create consolidated users and auth identities
  const userMap = new Map<string, string>();
  let userCount = 0;
  const demoHash = await argon2.hash(DEMO_PASSWORD);
  const adminHash = await argon2.hash(DEFAULT_ADMIN_PASSWORD);

  for (const u of initialUsers) {
    const companyId = companyMap.get(u.companyIndex)!;
    const roleId = roleMap.get(u.roleCode)!;
    const normalizedDoc = normalizeDoc(u.documentNumber);

    const user = await prisma.user.upsert({
      where: {
        documentType_normalizedDocumentNumber: {
          documentType: u.documentType,
          normalizedDocumentNumber: normalizedDoc,
        },
      },
      create: {
        companyId,
        documentType: u.documentType,
        documentNumber: u.documentNumber,
        normalizedDocumentNumber: normalizedDoc,
        firstName: u.firstName,
        middleName: (u as any).middleName ?? null,
        lastName: u.lastName,
        secondLastName: (u as any).secondLastName ?? null,
        email: u.email ?? null,
        emailVerifiedAt: u.email ? new Date() : null,
        department: (u as any).department ?? null,
        position: (u as any).position ?? null,
        status: u.status,
      },
      update: {
        companyId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email ?? null,
        status: u.status,
      },
    });

    // Create AuthIdentity for user
    const passHash = u.isCustomPassword ? adminHash : demoHash;
    await prisma.authIdentity.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        passwordHash: passHash,
        mustChangePassword: false,
      },
      update: {
        passwordHash: passHash,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      create: { userId: user.id, roleId },
      update: {},
    });

    userMap.set(u.key, user.id);
    if (u.email) userMap.set(u.email, user.id);
    userCount++;
  }

  // 4b. Grant ABSOLUTELY ALL permissions directly to the super admin
  // (document 5849827 — Yoiner Moreno) via UserPermission, on top of the
  // SYSTEM_ADMIN role. This is belt-and-suspenders: the role already includes
  // [...PERMISSIONS], but assigning them explicitly ensures they surface in
  // `additionalPermissions` at runtime regardless of any future role edits.
  const superAdminUserId = userMap.get('yoiner');
  if (superAdminUserId) {
    for (const code of PERMISSIONS) {
      const permId = permissionMap.get(code)!;
      await prisma.userPermission.upsert({
        where: {
          userId_permissionId: {
            userId: superAdminUserId,
            permissionId: permId,
          },
        },
        create: { userId: superAdminUserId, permissionId: permId },
        update: {},
      });
    }
    console.log(`  ✓ Granted all ${PERMISSIONS.length} permissions directly to super admin (doc 5849827)`);
  }
  console.log(`  ✓ ${userCount} users with AuthIdentities created (Yoiner Moreno: PASSPORT / 5849827)`);

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

  // 6. Authorized signers (User-based)
  const signerSeed = [
    { key: 'copa', companyIndex: 2, userKey: 'jorge', position: 'Gerente de seguridad' },
    { key: 'mcd', companyIndex: 1, userKey: 'maria', position: 'Gerente de operaciones' },
    { key: 'delta', companyIndex: 3, userKey: 'diego', position: 'Jefe de operaciones' },
  ];
  const signerMap = new Map<string, string>();
  for (const signer of signerSeed) {
    const signerUserId = userMap.get(signer.userKey)!;
    const companyId = companyMap.get(signer.companyIndex)!;
    const existing = await prisma.companyAuthorizedSigner.findFirst({
      where: { companyId, signerUserId },
    });
    const row = existing
      ? await prisma.companyAuthorizedSigner.update({
          where: { id: existing.id },
          data: { position: signer.position, validFrom: new Date('2024-01-01'), validUntil: new Date('2027-12-31'), status: 'ACTIVE' },
        })
      : await prisma.companyAuthorizedSigner.create({
          data: { companyId, signerUserId, position: signer.position, validFrom: new Date('2024-01-01'), validUntil: new Date('2027-12-31'), status: 'ACTIVE' },
        });
    signerMap.set(signer.key, row.id);
  }
  console.log(`  ✓ ${signerMap.size} authorized signers`);

  // 7. Requests and aggregate participants (User-based)
  const requestSeed = [
    { number: 'SGA-2026-000118', type: 'PERMANENT_CARD', companyIndex: 2, signer: 'copa', creator: 'andres', reason: 'Renovación de carné permanente para personal de operaciones', from: '2026-08-01', until: '2027-07-31', status: 'UNDER_DOCUMENT_REVIEW' as const, users: ['carlos'], points: ['EMP_T1T2', 'PORTON_8'], areas: ['ROJA-A', 'NARANJA-A'] },
    { number: 'SGA-2026-000112', type: 'TEMPORARY_PERSON', companyIndex: 1, signer: 'mcd', creator: 'laura', reason: 'Ingreso temporal para auditoría de tienda', from: '2026-07-20', until: '2026-07-22', status: 'PENDING_FINAL_APPROVAL' as const, users: ['maria', 'elena'], points: ['FOOD_COURT', 'EMP_T1T2'], areas: ['BLANCA-T1'] },
    { number: 'SGA-2026-000104', type: 'TEMPORARY_VEHICLE', companyIndex: 3, signer: 'delta', creator: 'marta', reason: 'Ingreso de vehículo para traslado de materiales', from: '2026-07-15', until: '2026-07-15', status: 'RETURNED_FOR_CORRECTION' as const, users: ['luis'], points: ['PORTON_10', 'EDIF_CARGA'], areas: ['ROJA-A', 'VERDE-A'], vehicle: true },
    { number: 'SGA-2026-000099', type: 'PERMANENT_CARD', companyIndex: 2, signer: 'copa', creator: 'andres', reason: 'Carné permanente para analista de seguridad', from: '2026-07-01', until: '2027-06-30', status: 'APPROVED' as const, users: ['jorge'], points: ['EMP_T1T2', 'PORTON_3'], areas: ['ROJA-B', 'AZUL-A'], credential: 'IN_PRODUCTION' as const },
    { number: 'SGA-2026-000098', type: 'PERMANENT_CARD', companyIndex: 2, signer: 'copa', creator: 'andres', reason: 'Carné permanente para agente de rampa', from: '2026-06-01', until: '2027-05-31', status: 'APPROVED' as const, users: ['carlos'], points: ['EMP_T1T2', 'PORTON_8'], areas: ['ROJA-A'], credential: 'DELIVERED' as const },
  ];

  const requestMap = new Map<string, string>();
  for (const fixture of requestSeed) {
    const participants = fixture.users.map((key, index) => ({
      participantUserId: userMap.get(key)!,
      role: index === 0 ? ('PRIMARY' as const) : ('BENEFICIARY' as const),
    }));
    const accessPoints = fixture.points.map((code) => ({ accessPointId: catalogMap.get(`ACCESS_POINT:${code}`)! }));
    const accessAreas = fixture.areas.map((code) => ({ accessAreaId: catalogMap.get(`ACCESS_AREA:${code}`)!, justification: `Acceso requerido: ${code}` }));

    const existing = await prisma.request.findUnique({ where: { requestNumber: fixture.number } });
    if (existing) {
      await prisma.requestParticipant.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestAccessPoint.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestAccessArea.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestVehicle.deleteMany({ where: { requestId: existing.id } });
      await prisma.requestEquipment.deleteMany({ where: { requestId: existing.id } });
    }

    const data = {
      requestNumber: fixture.number,
      companyId: companyMap.get(fixture.companyIndex)!,
      requestTypeId: catalogMap.get(`REQUEST_TYPE:${fixture.type}`)!,
      createdByUserId: userMap.get(fixture.creator)!,
      createdByCompanyId: companyMap.get(fixture.companyIndex)!,
      authorizedSignerId: fixture.signer ? signerMap.get(fixture.signer) : null,
      reason: fixture.reason,
      validFrom: new Date(fixture.from),
      validUntil: new Date(fixture.until),
      scheduleFrom: '08:00',
      scheduleUntil: '17:00',
      status: fixture.status,
      submittedAt: new Date('2026-07-08T10:00:00Z'),
    };

    const children = {
      participants: { create: participants },
      accessPoints: { create: accessPoints },
      accessAreas: { create: accessAreas },
      vehicles: fixture.vehicle ? { create: [{ brand: 'Toyota', model: 'Hilux', plateNumber: '8X-23-45', color: 'Blanco', year: 2022 }] } : undefined,
    };

    const row = existing
      ? await prisma.request.update({ where: { id: existing.id }, data: { ...data, ...children } })
      : await prisma.request.create({ data: { ...data, ...children } });
    requestMap.set(fixture.number, row.id);

    await prisma.requestEvent.deleteMany({ where: { requestId: row.id } });
    await prisma.requestEvent.create({
      data: {
        requestId: row.id,
        eventType: 'SUBMITTED',
        fromStatus: null,
        toStatus: fixture.status,
        actorUserId: userMap.get(fixture.creator)!,
        actorCompanyId: companyMap.get(fixture.companyIndex)!,
        occurredAt: new Date('2026-07-08T10:00:00Z'),
      },
    });

    if (fixture.credential) {
      const credentialNumber = fixture.number === 'SGA-2026-000098' ? 'CAR-2026-000098' : 'CAR-2026-000099';
      const credential = await prisma.credential.upsert({
        where: { requestId: row.id },
        create: {
          credentialNumber,
          requestId: row.id,
          credentialType: 'PERMANENT_CARD',
          subjectUserId: participants[0].participantUserId,
          status: fixture.credential,
          createdBy: userMap.get('patricia')!,
          producedAt: new Date('2026-07-08T08:00:00Z'),
          readyAt: fixture.credential === 'DELIVERED' ? new Date('2026-07-09T10:00:00Z') : null,
          deliveredAt: fixture.credential === 'DELIVERED' ? new Date('2026-07-10T10:00:00Z') : null,
        },
        update: { status: fixture.credential, subjectUserId: participants[0].participantUserId },
      });

      if (fixture.credential === 'DELIVERED') {
        await prisma.deliveryRecord.upsert({
          where: { credentialId: credential.id },
          create: {
            credentialId: credential.id,
            deliveredByUserId: userMap.get('patricia')!,
            receivedByName: 'Carlos Vargas',
            receivedByIdentification: '8-123-456',
            deliveredAt: new Date('2026-07-10T10:00:00Z'),
            observations: 'Entregado al titular en oficina de accesos',
          },
          update: {},
        });
      }
    }
  }
  console.log(`  ✓ ${requestMap.size} requests with workflow data`);

  // ─── Workflow engine: seed two demo definitions ───────────────────────────
  const adminUserId = userMap.get('yoiner')!;
  await seedWorkflows(prisma, adminUserId);

  console.log('Seed complete!');
}

/**
 * Seeds two demo WorkflowDefinitions:
 *  - permanent_card_default   (DRAFT — skeleton for React Flow editor)
 *  - temporary_person_default (PUBLISHED v1 — the engine drives this live)
 *
 * Both contain a canonical START → SYSTEM(submit) → HUMAN_TASK(review) →
 * SYSTEM(finalize) → END graph that maps onto the existing RequestTransition
 * state machine. The published one is the contract the engine drives; the
 * DRAFT one is the skeleton the React Flow editor will eventually mutate.
 */
async function seedWorkflows(prisma: PrismaClient, adminUserId: string) {
  console.log('Seeding workflow definitions...');

  const { WorkflowVersion } = await import(
    '../src/modules/workflows/domain/entities/workflow-definition.entity.js'
  );
  const { WORKFLOW_SCHEMA_VERSION } = await import(
    '../src/modules/workflows/domain/workflow-definition.types.js'
  );

  const graph = {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      { key: 'START', type: 'START', name: 'Inicio', description: 'Punto de entrada de la solicitud' },
      {
        key: 'SUBMIT_REQUEST',
        type: 'SYSTEM',
        name: 'Registrar solicitud',
        description: 'Transiciona la solicitud a IN_REVIEW',
        config: { systemAction: 'UPDATE_REQUEST_STATUS', targetRequestStatus: 'SUBMITTED' },
      },
      {
        key: 'INTAKE_DOCS',
        type: 'HUMAN_TASK',
        name: 'Recepción y validación documental',
        description: 'DOCUMENT_RECEIVER revisa la documentación adjunta',
        assignment: { type: 'ROLE', roleCode: 'DOCUMENT_RECEIVER', companyScoped: true },
        config: { outcomes: ['APPROVE', 'RETURN_FOR_CORRECTION', 'REJECT'] },
      },
      {
        key: 'MANAGER_REVIEW',
        type: 'HUMAN_TASK',
        name: 'Aprobación gerencial',
        description: 'ACCESS_DOCUMENTS_MANAGER aprueba/rechaza',
        assignment: { type: 'ROLE', roleCode: 'ACCESS_DOCUMENTS_MANAGER', companyScoped: true },
        config: { outcomes: ['APPROVE', 'REJECT'] },
      },
      {
        key: 'ROUTE_OUTCOME',
        type: 'DECISION',
        name: 'Decisiones',
        description: 'Distribuye a la rama correcta según el último resultado',
      },
      {
        key: 'FINALIZE_APPROVED',
        type: 'SYSTEM',
        name: 'Aprobar y derivar a emisión',
        description: 'Marca la solicitud como APPROVED',
        config: { systemAction: 'UPDATE_REQUEST_STATUS', targetRequestStatus: 'APPROVED' },
      },
      {
        key: 'FINALIZE_REJECTED',
        type: 'SYSTEM',
        name: 'Rechazar',
        description: 'Marca la solicitud como REJECTED',
        config: { systemAction: 'UPDATE_REQUEST_STATUS', targetRequestStatus: 'REJECTED' },
      },
      {
        key: 'FINALIZE_RETURNED',
        type: 'SYSTEM',
        name: 'Solicitar correcciones',
        description: 'Devuelve la solicitud al solicitante',
        config: {
          systemAction: 'UPDATE_REQUEST_STATUS',
          targetRequestStatus: 'RETURNED_FOR_CORRECTION',
        },
      },
      { key: 'END', type: 'END', name: 'Fin' },
    ],
    edges: [
      { from: 'START', to: 'SUBMIT_REQUEST', action: 'BEGIN' },
      { from: 'SUBMIT_REQUEST', to: 'INTAKE_DOCS', action: 'COMPLETE' },
      { from: 'INTAKE_DOCS', to: 'MANAGER_REVIEW', action: 'APPROVE' },
      { from: 'INTAKE_DOCS', to: 'FINALIZE_RETURNED', action: 'RETURN_FOR_CORRECTION' },
      { from: 'INTAKE_DOCS', to: 'FINALIZE_REJECTED', action: 'REJECT' },
      { from: 'MANAGER_REVIEW', to: 'FINALIZE_APPROVED', action: 'APPROVE' },
      { from: 'MANAGER_REVIEW', to: 'FINALIZE_REJECTED', action: 'REJECT' },
      { from: 'FINALIZE_APPROVED', to: 'END', action: 'COMPLETE' },
      { from: 'FINALIZE_REJECTED', to: 'END', action: 'COMPLETE' },
      { from: 'FINALIZE_RETURNED', to: 'END', action: 'COMPLETE' },
    ],
  };

  const checksum = WorkflowVersion.computeChecksum(graph as any);

  // 1) permanent_card_default — DRAFT (skeleton for React Flow editor)
  const permanentDef = await prisma.workflowDefinition.upsert({
    where: { key: 'permanent_card_default' },
    update: {
      name: 'Tarjeta permanente — estándar',
      description: 'Flujo canónico de aprobación de tarjeta de acceso permanente.',
      requestType: 'PERMANENT_CARD',
      status: 'DRAFT',
    },
    create: {
      key: 'permanent_card_default',
      name: 'Tarjeta permanente — estándar',
      description: 'Flujo canónico de aprobación de tarjeta de acceso permanente.',
      requestType: 'PERMANENT_CARD',
      status: 'DRAFT',
      createdByUserId: adminUserId,
    },
  });
  await prisma.workflowVersion.upsert({
    where: {
      workflowDefinitionId_versionNumber: {
        workflowDefinitionId: permanentDef.id,
        versionNumber: 1,
      },
    },
    update: { definitionJson: graph as Prisma.InputJsonValue, checksum },
    create: {
      workflowDefinitionId: permanentDef.id,
      versionNumber: 1,
      status: 'DRAFT',
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      definitionJson: graph as Prisma.InputJsonValue,
      checksum,
      createdByUserId: adminUserId,
    },
  });

  // 2) temporary_person_default — PUBLISHED v1 (the engine uses this live)
  const temporaryDef = await prisma.workflowDefinition.upsert({
    where: { key: 'temporary_person_default' },
    update: {
      name: 'Persona temporal — estándar',
      description: 'Flujo público de aprobación de persona temporal (default).',
      requestType: 'TEMPORARY_PERSON',
      status: 'PUBLISHED',
    },
    create: {
      key: 'temporary_person_default',
      name: 'Persona temporal — estándar',
      description: 'Flujo público de aprobación de persona temporal (default).',
      requestType: 'TEMPORARY_PERSON',
      status: 'PUBLISHED',
      createdByUserId: adminUserId,
    },
  });
  await prisma.workflowVersion.upsert({
    where: {
      workflowDefinitionId_versionNumber: {
        workflowDefinitionId: temporaryDef.id,
        versionNumber: 1,
      },
    },
    update: {
      status: 'PUBLISHED',
      definitionJson: graph as Prisma.InputJsonValue,
      checksum,
      publishedByUserId: adminUserId,
      publishedAt: new Date(),
    },
    create: {
      workflowDefinitionId: temporaryDef.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      definitionJson: graph as Prisma.InputJsonValue,
      checksum,
      createdByUserId: adminUserId,
      publishedByUserId: adminUserId,
      publishedAt: new Date(),
    },
  });

  console.log('  ✓ Seeded 2 workflow definitions (1 DRAFT + 1 PUBLISHED)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
