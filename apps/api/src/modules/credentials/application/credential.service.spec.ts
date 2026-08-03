/**
 * SGA Phase 2 — Credential service behaviour spec.
 *
 * Covers the externally observable contract for issuance, photo management,
 * replacement, custody, lifecycle transitions, idempotency and audit. Uses
 * in-memory fakes for the credential repository port, the Request service
 * and Audit service. No DB or NestJS runtime required.
 */
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/errors/domain-error';
import { Credential } from '../domain/entities/credential.entity';
import { CREDENTIAL_PREFIX } from '../domain/credential.constants';
import { CredentialService } from './credential.service';
import type {
  CredentialEventRecord,
  CredentialListPage,
  CredentialRecord,
  CredentialRepositoryPort,
  CustodyRecordInfo,
  DeliveryRecordInfo,
  FileMetadataRecord,
} from '../domain/repositories/credential.repository.port';
import type { Request } from '../../requests/domain/entities/request.entity';

const ISSUER: AuthenticatedUser = {
  userId: 'issuer-1',
  companyId: 'co-1',
  email: 'issuer@example.test',
  roles: ['CARD_ISSUER'],
  permissions: ['issuance.read', 'issuance.manage'],
};

const READER: AuthenticatedUser = {
  userId: 'reader-1',
  companyId: 'co-1',
  email: 'reader@example.test',
  roles: ['ACCESS_DOCUMENTS_MANAGER'],
  permissions: ['issuance.read'],
};

const STRANGER: AuthenticatedUser = {
  userId: 'stranger-1',
  companyId: 'co-1',
  email: 'stranger@example.test',
  roles: ['COMPANY_USER'],
  permissions: [],
};

/** In-memory credential repository used by the spec. */
class InMemoryCredentialRepo implements CredentialRepositoryPort {
  records = new Map<string, CredentialRecord>();
  events = new Map<string, CredentialEventRecord[]>();
  deliveries = new Map<string, DeliveryRecordInfo>();
  custody = new Map<string, CustodyRecordInfo>();
  fileMeta = new Map<string, FileMetadataRecord>();

  async findById(id: string) {
    return this.records.get(id) ?? null;
  }
  async findByRequestId(requestId: string) {
    return (
      [...this.records.values()].find((r) => r.requestId === requestId) ?? null
    );
  }
  async findByCredentialNumber(credentialNumber: string) {
    return (
      [...this.records.values()].find(
        (r) => r.credentialNumber === credentialNumber,
      ) ?? null
    );
  }
  async findActiveByCardCode(cardCode: string) {
    const active = new Set([
      'PENDING_PRODUCTION',
      'IN_PRODUCTION',
      'READY_FOR_DELIVERY',
      'DELIVERED',
      'SUSPENDED',
    ]);
    return (
      [...this.records.values()]
        .filter((r) => r.cardCode === cardCode && active.has(r.status))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null
    );
  }
  async findLatestWithPhotoForSubject(subjectUserId: string) {
    return (
      [...this.records.values()]
        .filter((r) => r.subjectUserId === subjectUserId && !!r.photoFileId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null
    );
  }
  async list(inputs: {
    filters: Record<string, unknown>;
    page: number;
    pageSize: number;
  }): Promise<CredentialListPage> {
    const all = [...this.records.values()];
    const start = (inputs.page - 1) * inputs.pageSize;
    const items = all.slice(start, start + inputs.pageSize);
    return {
      items,
      total: all.length,
      page: inputs.page,
      pageSize: inputs.pageSize,
    };
  }
  async save(record: CredentialRecord) {
    this.records.set(record.id, record);
  }
  async countByPrefixThisYear(prefix: string) {
    const year = new Date().getFullYear();
    const needle = `${prefix}-${year}-`;
    return [...this.records.values()].filter((r) =>
      r.credentialNumber.startsWith(needle),
    ).length;
  }
  async listEvents(credentialId: string) {
    return this.events.get(credentialId) ?? [];
  }
  async saveEvent(event: CredentialEventRecord) {
    const list = this.events.get(event.credentialId) ?? [];
    list.push(event);
    this.events.set(event.credentialId, list);
  }
  async findDeliveryByCredential(credentialId: string) {
    return this.deliveries.get(credentialId) ?? null;
  }
  async saveDelivery(record: DeliveryRecordInfo) {
    this.deliveries.set(record.credentialId, record);
  }
  async markDeliveryCorrected(credentialId: string, reason: string) {
    const d = this.deliveries.get(credentialId);
    if (!d) return;
    this.deliveries.set(credentialId, {
      ...d,
      correctedAt: new Date(),
      correctionReason: reason,
    });
  }
  async findCustody(id: string) {
    return this.custody.get(id) ?? null;
  }
  async findCustodyByCredential(credentialId: string) {
    return (
      [...this.custody.values()]
        .filter((c) => c.credentialId === credentialId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null
    );
  }
  async listCustody(inputs: {
    filters: Record<string, unknown>;
    page: number;
    pageSize: number;
  }) {
    const all = [...this.custody.values()];
    const start = (inputs.page - 1) * inputs.pageSize;
    return {
      items: all.slice(start, start + inputs.pageSize),
      total: all.length,
    };
  }
  async saveCustody(record: CustodyRecordInfo) {
    this.custody.set(record.id, record);
  }
  async saveFileMetadata(record: FileMetadataRecord) {
    this.fileMeta.set(record.id, record);
  }
  async findFileMetadata(id: string) {
    return this.fileMeta.get(id) ?? null;
  }
}

type RequestShape = Pick<Request, 'id' | 'status' | 'accessAreas'>;

function buildRequest(
  id: string,
  status: 'APPROVED' | 'PENDING' | 'SUBMITTED' | 'REJECTED' = 'APPROVED',
  areas: { accessAreaId: string; reviewStatus: string }[] = [
    { accessAreaId: 'zone-a', reviewStatus: 'APPROVED' },
  ],
): RequestShape {
  return {
    id,
    status,
    accessAreas: areas.map((a, i) => ({
      id: `link-${i}-${id}`,
      requestId: id,
      accessAreaId: a.accessAreaId,
      justification: null,
      reviewStatus: a.reviewStatus as 'APPROVED' | 'PENDING' | 'REJECTED',
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      createdAt: new Date(),
    })),
  } as unknown as RequestShape;
}

function buildService(
  repo = new InMemoryCredentialRepo(),
  requests: Record<string, RequestShape> = {},
  custom?: Partial<{ requestService: any; auditService: any }>,
) {
  const requestService = custom?.requestService ?? {
    async getById(_actor: AuthenticatedUser, id: string) {
      const r = requests[id];
      if (!r) throw new NotFoundError('Request', id);
      return r;
    },
  };
  const auditCalls: any[] = [];
  const auditService = custom?.auditService ?? {
    async record(entry: any) {
      auditCalls.push(entry);
    },
  };
  const service = new CredentialService(repo, requestService, auditService);
  return { service, repo, auditCalls };
}

describe('CredentialService — Phase 2', () => {
  describe('issuance', () => {
    it('forbids issuance without issuance.manage or SYSTEM_ADMIN', async () => {
      const { service, repo } = buildService(undefined, {
        'req-1': buildRequest('req-1'),
      });
      repo.countByPrefixThisYear = async () => 0;
      await expect(
        service.issue(READER, {
          requestId: 'req-1',
          credentialType: 'PERMANENT_CARD',
          subjectUserId: 'sub-1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('rejects issuance for a non-APPROVED request', async () => {
      const { service } = buildService(undefined, {
        'req-2': buildRequest('req-2', 'PENDING'),
      });
      await expect(
        service.issue(ISSUER, {
          requestId: 'req-2',
          credentialType: 'PERMANENT_CARD',
          subjectUserId: 'sub-2',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('issues a credential with a per-year sequence number', async () => {
      const { service, repo } = buildService(undefined, {
        'req-3': buildRequest('req-3'),
      });
      const cred = await service.issue(ISSUER, {
        requestId: 'req-3',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-3',
        holderName: 'Jane Doe',
        cardCode: 'CARD-0001',
      });
      const year = new Date().getFullYear();
      expect(cred.credentialNumber).toBe(
        `${CREDENTIAL_PREFIX.PERMANENT_CARD}-${year}-000001`,
      );
      expect(cred.holderName).toBe('Jane Doe');
      expect(cred.authorizedZones).toEqual(['zone-a']);
      expect(cred.status).toBe('PENDING_PRODUCTION');
      expect(repo.records.size).toBe(1);
      expect(
        (await repo.listEvents(cred.id)).map((e) => e.eventType),
      ).toContain('CREATED');
    });

    it('rejects a requested zone that is not part of the approved set', async () => {
      const { service } = buildService(undefined, {
        'req-4': buildRequest('req-4'),
      });
      await expect(
        service.issue(ISSUER, {
          requestId: 'req-4',
          credentialType: 'PERMANENT_CARD',
          subjectUserId: 'sub-4',
          authorizedZones: ['zone-b'],
        }),
      ).rejects.toThrow(/not part of the approved request/);
    });

    it('forbids duplicate card code', async () => {
      const repo = new InMemoryCredentialRepo();
      repo.records.set('existing', {
        id: 'existing',
        credentialNumber: 'CAR-2099-000001',
        cardCode: 'CARD-DUP',
        requestId: 'req-prev',
        replacesCredentialId: null,
        credentialType: 'PERMANENT_CARD',
        subjectUserId: null,
        holderName: null,
        authorizedZones: null,
        status: 'DELIVERED',
        issuedAt: null,
        expiresAt: null,
        producedAt: null,
        readyAt: null,
        deliveredAt: new Date(),
        observations: null,
        photoFileId: null,
        photoSource: null,
        photoCapturedAt: null,
        photoReusedFromCredentialId: null,
        cardMaterialData: null,
        createdBy: 'x',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const { service } = buildService(repo, {
        'req-5': buildRequest('req-5'),
      });
      await expect(
        service.issue(ISSUER, {
          requestId: 'req-5',
          credentialType: 'PERMANENT_CARD',
          subjectUserId: 'sub-5',
          cardCode: 'CARD-DUP',
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('returns the existing credential on idempotent re-issue', async () => {
      const { service } = buildService(undefined, {
        'req-6': buildRequest('req-6'),
      });
      const first = await service.issue(ISSUER, {
        requestId: 'req-6',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-6',
      });
      const second = await service.issue(ISSUER, {
        requestId: 'req-6',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-6',
      });
      expect(second.id).toBe(first.id);
    });
  });

  describe('read access', () => {
    it('forbids list for an actor with no issuance.read', async () => {
      const { service } = buildService();
      await expect(service.list(STRANGER, {}, 1, 10)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  describe('delivery', () => {
    it('requires READY_FOR_DELIVERY status before delivery', async () => {
      const { service } = buildService(undefined, {
        'req-d1': buildRequest('req-d1'),
      });
      const cred = await service.issue(ISSUER, {
        requestId: 'req-d1',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-d1',
      });
      await expect(
        service.deliver(ISSUER, cred.id, {
          receivedByName: 'Bob',
          receivedByIdentification: 'ID-1234',
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('records delivery and observation', async () => {
      const { service, repo } = buildService(undefined, {
        'req-d2': buildRequest('req-d2'),
      });
      const cred = await service.issue(ISSUER, {
        requestId: 'req-d2',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-d2',
      });
      await service.transition(ISSUER, cred.id, 'start_production');
      await service.transition(ISSUER, cred.id, 'mark_ready');
      const delivered = await service.deliver(ISSUER, cred.id, {
        receivedByName: 'Bob',
        receivedByIdentification: 'ID-1234',
        observations: 'Handed over at gate',
      });
      expect(delivered.status).toBe('DELIVERED');
      const events = await repo.listEvents(cred.id);
      expect(events.some((e) => e.eventType === 'DELIVERED')).toBe(true);
      const delivery = await repo.findDeliveryByCredential(cred.id);
      expect(delivery?.receivedByName).toBe('Bob');
      expect(delivery?.observations).toBe('Handed over at gate');
    });
  });

  describe('photo management', () => {
    async function setupWithCredential() {
      const { service, repo } = buildService(undefined, {
        'req-p1': buildRequest('req-p1'),
      });
      const cred = await service.issue(ISSUER, {
        requestId: 'req-p1',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-p1',
      });
      return { service, repo, cred };
    }

    it('attaches a freshly captured photo', async () => {
      const { service, cred } = await setupWithCredential();
      const updated = await service.attachPhoto(ISSUER, cred.id, {
        source: 'CAPTURED',
        originalFilename: 'me.jpg',
        mimeType: 'image/jpeg',
        size: 1234,
        bytes: Buffer.alloc(0),
        storageKey: 'credentials/me.jpg',
        sha256: 'abc',
        storedFilename: 'me-1.jpg',
      });
      expect(updated.photo?.source).toBe('CAPTURED');
    });

    it('blocks photo reuse when no reusable photo exists', async () => {
      const { service, cred } = await setupWithCredential();
      await expect(
        service.reusePreviousPhoto(ISSUER, cred.id, true),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('blocks photo reuse without explicit confirmation', async () => {
      const { service, cred } = await setupWithCredential();
      await expect(
        service.reusePreviousPhoto(ISSUER, cred.id, false),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('reuses the latest photo for the subject when present', async () => {
      const repo = new InMemoryCredentialRepo();
      const { service } = buildService(repo, {
        'req-prev-photo': buildRequest('req-prev-photo'),
        'req-new-photo': buildRequest('req-new-photo'),
      });
      const first = await service.issue(ISSUER, {
        requestId: 'req-prev-photo',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-shared',
      });
      await service.attachPhoto(ISSUER, first.id, {
        source: 'CAPTURED',
        originalFilename: 'old.jpg',
        mimeType: 'image/jpeg',
        size: 1,
        bytes: Buffer.alloc(0),
        storageKey: 'credentials/old.jpg',
        sha256: 'aaa',
        storedFilename: 'old-1.jpg',
      });
      const second = await service.issue(ISSUER, {
        requestId: 'req-new-photo',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-shared',
      });
      const reused = await service.reusePreviousPhoto(ISSUER, second.id, true);
      expect(reused.photo?.source).toBe('REUSED');
      expect(reused.photo?.reusedFromCredentialId).toBe(first.id);
    });
  });

  describe('replacement', () => {
    it('revokes the original and spawns a replacement', async () => {
      const { service, repo } = buildService(undefined, {
        'req-r1': buildRequest('req-r1'),
      });
      const original = await service.issue(ISSUER, {
        requestId: 'req-r1',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-r1',
      });
      const { original: revoked, replacement } = await service.replace(
        ISSUER,
        original.id,
        { reason: 'Lost in airport' },
      );
      expect(revoked.status).toBe('REVOKED');
      expect(replacement.status).toBe('PENDING_PRODUCTION');
      expect(replacement.authorizedZones).toEqual(revoked.authorizedZones);
      expect(replacement.id).not.toBe(revoked.id);
      // Bug #4 regression: replacement links back to the original via
      // replacesCredentialId, and the id must be a UUID (not a domain fallback)
      // so downstream UUID-validated endpoints (custody, deliver) accept it.
      expect(replacement.replacesCredentialId).toBe(original.id);
      expect(replacement.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      // Two credentials in repo
      expect(repo.records.size).toBe(2);
    });

    it('re-issues a fresh credential when prior one is terminal (request reuse)', async () => {
      const { service, repo } = buildService(undefined, {
        'req-reuse': buildRequest('req-reuse'),
      });
      // First issue + replace revokes original and yields a new active cred
      const first = await service.issue(ISSUER, {
        requestId: 'req-reuse',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-reuse',
      });
      const { replacement } = await service.replace(ISSUER, first.id, {
        reason: 'damaged',
      });
      // Revoke the replacement to drive the request fully terminal
      await service.transition(ISSUER, replacement.id, 'revoke');
      // Now issue() should bypass idempotency and return a NEW credential
      const third = await service.issue(ISSUER, {
        requestId: 'req-reuse',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-reuse',
      });
      expect(third.id).not.toBe(first.id);
      expect(third.id).not.toBe(replacement.id);
      expect(repo.records.size).toBe(3);
    });

    it('requires a reason', async () => {
      const { service } = buildService(undefined, {
        'req-r2': buildRequest('req-r2'),
      });
      const cred = await service.issue(ISSUER, {
        requestId: 'req-r2',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-r2',
      });
      await expect(
        service.replace(ISSUER, cred.id, { reason: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('custody', () => {
    async function setupForCustody() {
      const { service, repo } = buildService(undefined, {
        'req-c1': buildRequest('req-c1'),
      });
      const cred = await service.issue(ISSUER, {
        requestId: 'req-c1',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-c1',
        holderName: 'Custody Person',
      });
      return { service, repo, cred };
    }

    it('deposits custody and masks the document identifier', async () => {
      const { service, cred } = await setupForCustody();
      const record = await service.depositCustody(ISSUER, {
        credentialId: cred.id,
        documentType: 'PASSPORT',
        documentIdentifier: 'A12345678',
      });
      expect(record.documentIdentifier).not.toContain('12345678');
      expect(record.documentIdentifier).toMatch(/\*+/);
      expect(record.returnTime).toBeNull();
    });

    it('deposits custody with an explicit expected return date', async () => {
      const { service, cred } = await setupForCustody();
      const record = await service.depositCustody(ISSUER, {
        credentialId: cred.id,
        documentType: 'PASSPORT',
        documentIdentifier: 'A12345678',
        expectedReturnAt: new Date(Date.now() + 60_000),
      });
      expect(record.documentIdentifier).not.toBe('A12345678');
      expect(record.expectedReturnAt).not.toBeNull();
      expect(record.returnTime).toBeNull();
    });

    it('blocks a duplicate active custody deposit', async () => {
      const { service, cred } = await setupForCustody();
      await service.depositCustody(ISSUER, {
        credentialId: cred.id,
        documentType: 'PASSPORT',
        documentIdentifier: 'A12345678',
      });
      await expect(
        service.depositCustody(ISSUER, {
          credentialId: cred.id,
          documentType: 'PASSPORT',
          documentIdentifier: 'B98765432',
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('returns custody by id and blocks duplicate returns', async () => {
      const { service, cred } = await setupForCustody();
      const record = await service.depositCustody(ISSUER, {
        credentialId: cred.id,
        documentType: 'PASSPORT',
        documentIdentifier: 'A12345678',
      });
      const returned = await service.returnCustody(ISSUER, {
        custodyId: record.id,
        returnReceivedBy: ' front-desk-agent',
      });
      const stored = await service.getCustody(ISSUER, returned.id);
      expect(stored.returnTime).toBeTruthy();
      await expect(
        service.returnCustody(ISSUER, {
          custodyId: returned.id,
          returnReceivedBy: 'again',
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('computeCustodyStatus returns OVERDUE when expectedReturnAt passed', () => {
      const now = new Date();
      const record: CustodyRecordInfo = {
        id: 'cust-1',
        credentialId: 'cred-1',
        subjectUserId: 'sub-1',
        holderName: null,
        documentType: 'PASSPORT',
        documentIdentifier: 'A***78',
        temporaryPermitRef: null,
        receivedByUserId: 'x',
        depositTime: new Date(now.getTime() - 120_000),
        expectedReturnAt: new Date(now.getTime() - 30_000),
        depositNotes: null,
        returnTime: null,
        returnedByUserId: null,
        returnReceivedBy: null,
        returnCondition: null,
        returnNotes: null,
        createdAt: now,
        updatedAt: now,
      };
      const { service } = buildService();
      expect(service.computeCustodyStatus(record)).toBe('OVERDUE');
      record.returnTime = now;
      expect(service.computeCustodyStatus(record)).toBe('RETURNED');
    });
  });

  describe('audit', () => {
    it('records an audit event on issue', async () => {
      const { service, auditCalls } = buildService(undefined, {
        'req-audit': buildRequest('req-audit'),
      });
      await service.issue(ISSUER, {
        requestId: 'req-audit',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-audit',
      });
      expect(
        auditCalls.some(
          (e) =>
            e.action === 'credential.issue' && e.aggregateType === 'credential',
        ),
      ).toBe(true);
    });
  });

  describe('credential entity — lifecycle transitions', () => {
    function makeCred(): Credential {
      return Credential.create({
        id: 'cred-state',
        requestId: 'req-state',
        credentialType: 'PERMANENT_CARD',
        subjectUserId: 'sub-state',
        holderName: null,
        authorizedZones: ['zone-a'],
        cardCode: null,
        createdBy: 'issuer-1',
        sequence: 1,
        issuedAt: null,
        expiresAt: null,
        observations: null,
      });
    }
    it('suspend then reactivate returns to previous production state', () => {
      const cred = makeCred();
      cred.startProduction();
      cred.markReady();
      cred.suspend();
      expect(cred.status).toBe('SUSPENDED');
      cred.reactivate();
      expect(cred.status).toBe('READY_FOR_DELIVERY');
    });
    it('suspend cannot be applied twice', () => {
      const cred = makeCred();
      cred.startProduction();
      cred.suspend();
      expect(() => cred.suspend()).toThrow();
    });
    it('cancel cannot be applied twice', () => {
      const cred = makeCred();
      cred.cancel();
      expect(() => cred.cancel()).toThrow();
    });
    it('revoking an already-revoked credential is rejected', () => {
      const cred = makeCred();
      cred.revoke();
      expect(() => cred.revoke()).toThrow();
    });
  });

  describe('maskDocumentIdentifier', () => {
    it('masks medium-length identifiers while keeping some chars', async () => {
      const { maskDocumentIdentifier } =
        await import('../domain/entities/credential.entity');
      const masked = maskDocumentIdentifier('AB12345678CD');
      expect(masked).not.toContain('12345678');
      expect(masked).toMatch(/^[A-Za-z]+\*+[A-Za-z0-9]+$/);
    });
    it('preserves short identifiers unchanged', async () => {
      const { maskDocumentIdentifier } =
        await import('../domain/entities/credential.entity');
      expect(maskDocumentIdentifier('ABC')).toBe('ABC');
    });
  });
});
