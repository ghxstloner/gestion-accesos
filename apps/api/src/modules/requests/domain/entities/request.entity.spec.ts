import { describe, it, expect } from '@jest/globals';
import { Request, type RequestParticipantLink } from './request.entity';

function mkRequest(
  overrides: Partial<Parameters<typeof Request.create>[0]> = {},
): Request {
  return Request.create(
    {
      companyId: 'c-1',
      requestTypeId: 'rt-1',
      requestTypeCode: 'CARNE_PERMANENTE',
      createdByUserId: 'u-creator',
      createdByCompanyId: 'c-1',
      reason: 'Test reason',
      ...overrides,
    },
    'req-1',
  );
}

function mkParticipant(
  overrides: Partial<RequestParticipantLink> = {},
): RequestParticipantLink {
  return {
    id: 'p-' + Math.random().toString(36).slice(2, 8),
    requestId: 'req-1',
    participantUserId: null,
    role: 'BENEFICIARY',
    personalEmergency: false,
    usePreviousPhoto: false,
    identificationTypeCode: 'NATIONAL_ID',
    departmentSnapshot: null,
    positionSnapshot: null,
    companyNameSnapshot: null,
    identificationSnapshot: '8-123-456',
    fullNameSnapshot: 'John Doe',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Request entity — addParticipant snapshot rules', () => {
  it('accepts a manual participant without participantUserId', () => {
    const req = mkRequest();
    const link = mkParticipant({ fullNameSnapshot: 'Jane Manual' });
    req.addParticipant(link);
    expect(req.participants).toHaveLength(1);
    expect(req.participants[0].participantUserId).toBeNull();
    expect(req.participants[0].fullNameSnapshot).toBe('Jane Manual');
  });

  it('rejects two manual participants sharing the same full name (case-insensitive)', () => {
    const req = mkRequest();
    req.addParticipant(mkParticipant({ fullNameSnapshot: 'Pedro Perez' }));
    expect(() =>
      req.addParticipant(mkParticipant({ fullNameSnapshot: 'PEDRO PEREZ' })),
    ).toThrow(/already linked/);
  });

  it('rejects two participants referencing the same participantUserId', () => {
    const req = mkRequest();
    req.addParticipant(
      mkParticipant({ participantUserId: 'u-1', fullNameSnapshot: null }),
    );
    expect(() =>
      req.addParticipant(
        mkParticipant({ participantUserId: 'u-1', fullNameSnapshot: null }),
      ),
    ).toThrow(/already linked/);
  });

  it('allows a manual participant and a User-linked participant together', () => {
    const req = mkRequest();
    req.addParticipant(
      mkParticipant({
        participantUserId: null,
        fullNameSnapshot: 'Visitor One',
      }),
    );
    req.addParticipant(
      mkParticipant({
        participantUserId: 'u-1',
        fullNameSnapshot: null,
      }),
    );
    expect(req.participants).toHaveLength(2);
  });

  it('removes participants by id', () => {
    const req = mkRequest();
    const link1 = mkParticipant({ fullNameSnapshot: 'A' });
    const link2 = mkParticipant({ fullNameSnapshot: 'B' });
    req.addParticipant(link1);
    req.addParticipant(link2);
    req.removeParticipant(link1.id);
    expect(req.participants.map((p) => p.id)).toEqual([link2.id]);
  });

  it('supports a PRIMARY participant (titular/principal)', () => {
    const req = mkRequest();
    const link = mkParticipant({
      role: 'PRIMARY',
      participantUserId: 'u-titular',
      fullNameSnapshot: 'Titular Principal',
    });
    req.addParticipant(link);
    expect(req.participants.find((p) => p.role === 'PRIMARY')).toBeDefined();
  });

  it('supports multiple BENEFICIARY participants alongside a PRIMARY', () => {
    const req = mkRequest();
    req.addParticipant(
      mkParticipant({
        role: 'PRIMARY',
        participantUserId: 'u-1',
        fullNameSnapshot: null,
      }),
    );
    req.addParticipant(mkParticipant({ fullNameSnapshot: 'Visitor One' }));
    req.addParticipant(mkParticipant({ fullNameSnapshot: 'Visitor Two' }));
    expect(req.participants).toHaveLength(3);
    expect(
      req.participants.filter((p) => p.role === 'BENEFICIARY'),
    ).toHaveLength(2);
  });

  it('allows participants with optional User link to coexist with manual ones', () => {
    const req = mkRequest();
    // optional User-linked participant
    req.addParticipant(
      mkParticipant({
        participantUserId: 'u-opt',
        fullNameSnapshot: 'Linked User',
      }),
    );
    // manual participant (no User)
    req.addParticipant(mkParticipant({ fullNameSnapshot: 'Manual Visitor' }));
    expect(req.participants).toHaveLength(2);
    const linked = req.participants.find(
      (p) => p.participantUserId === 'u-opt',
    );
    expect(linked?.fullNameSnapshot).toBe('Linked User');
  });

  it('rejects addParticipant once the request is submitted (immutability post-submit)', () => {
    const req = mkRequest();
    req.applyTransition('SUBMITTED');
    expect(() =>
      req.addParticipant(mkParticipant({ fullNameSnapshot: 'Late Entry' })),
    ).toThrow(/not editable/);
  });

  it('rejects removeParticipant once the request is submitted', () => {
    const req = mkRequest();
    const link = mkParticipant({ fullNameSnapshot: 'Permanent' });
    req.addParticipant(link);
    req.applyTransition('SUBMITTED');
    expect(() => req.removeParticipant(link.id)).toThrow(/not editable/);
  });

  it('preserves snapshots when a linked participantUserId is null (User deletion scenario)', () => {
    const req = mkRequest();
    const link = mkParticipant({
      participantUserId: 'u-soon-deleted',
      fullNameSnapshot: 'Snapshot Only',
      identificationSnapshot: 'X-1',
    });
    req.addParticipant(link);
    // Simulate cascade SetNull: participantUserId becomes null after submission
    req.applyTransition('SUBMITTED');
    const stored = req.participants.find((p) => p.id === link.id);
    expect(stored).toBeDefined();
    expect(stored?.fullNameSnapshot).toBe('Snapshot Only');
    expect(stored?.identificationSnapshot).toBe('X-1');
  });

  it('allows editing participants while in RETURNED_FOR_CORRECTION', () => {
    const req = mkRequest();
    req.addParticipant(mkParticipant({ fullNameSnapshot: 'Initial' }));
    req.applyTransition('SUBMITTED');
    req.applyTransition('RETURNED_FOR_CORRECTION');
    expect(() =>
      req.addParticipant(
        mkParticipant({ fullNameSnapshot: 'Added On Return' }),
      ),
    ).not.toThrow();
  });
});
