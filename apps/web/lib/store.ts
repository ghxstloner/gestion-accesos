import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AccessRequest,
  ActivityEvent,
  AuthorizedSigner,
  CatalogEntry,
  Catalogs,
  Company,
  CurrentUser,
  DocumentItem,
  Notification,
  Person,
  RequestHistoryEvent,
  RequestStatus,
  User,
} from '@/lib/types';
import { genId, genRequestNumber, genCredentialNumber, ROLES } from '@/lib/constants';
import { mockCompanies } from '@/lib/mock-data/companies';
import { mockUsers } from '@/lib/mock-data/users';
import { mockPeople } from '@/lib/mock-data/people';
import { mockRequests } from '@/lib/mock-data/requests';
import { mockCatalogs } from '@/lib/mock-data/catalogs';
import { mockNotifications, mockActivity } from '@/lib/mock-data/notifications';

interface SgaState {
  companies: Company[];
  users: User[];
  people: Person[];
  authorizedSigners: AuthorizedSigner[];
  requests: AccessRequest[];
  documents: DocumentItem[];
  catalogs: Catalogs;
  notifications: Notification[];
  activityHistory: ActivityEvent[];
  currentUser: CurrentUser | null;
  requestSeq: number;
  /** Monotonic credential (carné) sequence — feeds `genCredentialNumber`. */
  cardSeq: number;

  // actions
  setCurrentUser: (cu: CurrentUser | null) => void;
  resetData: () => void;

  // companies
  addCompany: (c: Omit<Company, 'id' | 'createdAt'>) => Company;
  updateCompany: (id: string, patch: Partial<Company>) => void;
  toggleCompanyStatus: (id: string) => void;

  // users
  addUser: (u: Omit<User, 'id' | 'createdAt' | 'lastAccess'>) => User;
  updateUser: (id: string, patch: Partial<User>) => void;
  toggleUserStatus: (id: string) => void;
  resetUserPassword: (id: string) => void;

  // people
  addPerson: (p: Omit<Person, 'id' | 'createdAt'>) => Person;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  togglePersonStatus: (id: string) => void;

  // authorized signers
  addSigner: (s: Omit<AuthorizedSigner, 'id' | 'createdAt'>) => AuthorizedSigner;
  updateSigner: (id: string, patch: Partial<AuthorizedSigner>) => void;
  toggleSignerStatus: (id: string) => void;

  // requests
  createDraftRequest: (req: Partial<AccessRequest> & { type: AccessRequest['type']; companyId: string; createdBy: string }) => AccessRequest;
  updateRequest: (id: string, patch: Partial<AccessRequest>) => void;
  submitRequest: (id: string) => void;
  addRequestHistory: (id: string, event: Omit<RequestHistoryEvent, 'id' | 'timestamp'>) => void;
  setRequestStatus: (id: string, status: RequestStatus, actor: string, actorRole: RequestHistoryEvent['actorRole'], comment?: string) => void;

  // reviews
  approveDocument: (reqId: string, docId: string) => void;
  rejectDocument: (reqId: string, docId: string, observation: string) => void;
  approveDocumentStage: (reqId: string, actor: string) => void;
  returnRequest: (reqId: string, reason: string, comment: string, actor: string, actorRole: RequestHistoryEvent['actorRole']) => void;
  rejectRequest: (reqId: string, reason: string, comment: string, actor: string, actorRole: RequestHistoryEvent['actorRole']) => void;
  approveRequest: (reqId: string, actor: string, actorRole: RequestHistoryEvent['actorRole']) => void;

  // issuance
  startIssuance: (reqId: string, actor: string) => void;
  markReady: (reqId: string, actor: string) => void;
  registerDelivery: (reqId: string, receivedBy: string, observation: string, actor: string) => void;
  // issuance reversions (controlled transitions with mandatory reason)
  cancelConfection: (reqId: string, reason: string, actor: string) => void;
  returnToConfection: (reqId: string, reason: string, actor: string) => void;
  correctDelivery: (reqId: string, reason: string, actor: string) => void;

  // catalogs
  addCatalogEntry: (key: keyof Catalogs, entry: Omit<CatalogEntry, 'id'>) => void;
  updateCatalogEntry: (key: keyof Catalogs, id: string, patch: Partial<CatalogEntry>) => void;
  toggleCatalogEntry: (key: keyof Catalogs, id: string) => void;

  // notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
}

const initialState: {
  companies: Company[];
  users: User[];
  people: Person[];
  authorizedSigners: AuthorizedSigner[];
  requests: AccessRequest[];
  documents: DocumentItem[];
  catalogs: Catalogs;
  notifications: Notification[];
  activityHistory: ActivityEvent[];
  currentUser: CurrentUser | null;
  requestSeq: number;
  cardSeq: number;
} = {
  companies: mockCompanies,
  users: mockUsers,
  people: mockPeople,
  authorizedSigners: [
    {
      id: 'as_1',
      companyId: 'co_copa',
      personId: 'pe_005',
      position: 'Gerente de seguridad',
      startDate: '2024-01-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      documentName: 'poder_copa.pdf',
      signatureName: 'Jorge Ramos',
      createdAt: '2024-01-25T10:00:00Z',
    },
    {
      id: 'as_2',
      companyId: 'co_mcd',
      personId: 'pe_002',
      position: 'Gerente de operaciones',
      startDate: '2024-02-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      documentName: 'poder_mcd.pdf',
      signatureName: 'María Fernández',
      createdAt: '2024-02-10T10:00:00Z',
    },
    {
      id: 'as_3',
      companyId: 'co_delta',
      personId: 'pe_007',
      position: 'Jefe de operaciones',
      startDate: '2024-03-01',
      endDate: '2026-09-30',
      status: 'ACTIVE',
      documentName: 'poder_delta.pdf',
      signatureName: 'Diego Herrera',
      createdAt: '2024-03-15T10:00:00Z',
    },
  ] as AuthorizedSigner[],
  requests: mockRequests,
  documents: [] as DocumentItem[],
  catalogs: mockCatalogs,
  notifications: mockNotifications,
  activityHistory: mockActivity,
  currentUser: null as CurrentUser | null,
  requestSeq: 121,
  cardSeq: 1,
};

export const useSgaStore = create<SgaState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentUser: (cu) => set({ currentUser: cu }),

      resetData: () => {
        set({
          ...initialState,
          currentUser: get().currentUser,
          requestSeq: 121,
          cardSeq: 1,
        });
      },

      addCompany: (c) => {
        const company: Company = { ...c, id: genId('co'), createdAt: new Date().toISOString() };
        set((s) => ({ companies: [...s.companies, company] }));
        return company;
      },
      updateCompany: (id, patch) =>
        set((s) => ({ companies: s.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      toggleCompanyStatus: (id) =>
        set((s) => ({
          companies: s.companies.map((c) =>
            c.id === id ? { ...c, status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : c
          ),
        })),

      addUser: (u) => {
        const normalizedEmail = u.email.trim().toLowerCase();
        if (get().users.some((x) => x.email.trim().toLowerCase() === normalizedEmail)) {
          throw new Error('Ya existe un usuario con ese correo electrónico.');
        }
        const user: User = { ...u, email: normalizedEmail, id: genId('us'), createdAt: new Date().toISOString(), lastAccess: null };
        set((s) => ({ users: [...s.users, user] }));
        return user;
      },
      updateUser: (id, patch) => {
        if (patch.email) {
          const normalizedEmail = patch.email.trim().toLowerCase();
          if (
            get().users.some((x) => x.id !== id && x.email.trim().toLowerCase() === normalizedEmail)
          ) {
            throw new Error('Ya existe un usuario con ese correo electrónico.');
          }
          patch = { ...patch, email: normalizedEmail };
        }
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
      },
      toggleUserStatus: (id) =>
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' } : u
          ),
        })),
      resetUserPassword: (id) => {
        const u = get().users.find((x) => x.id === id);
        void u;
      },

      addPerson: (p) => {
        const person: Person = { ...p, id: genId('pe'), createdAt: new Date().toISOString() };
        set((s) => ({ people: [...s.people, person] }));
        return person;
      },
      updatePerson: (id, patch) =>
        set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      togglePersonStatus: (id) =>
        set((s) => ({
          people: s.people.map((p) =>
            p.id === id ? { ...p, status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : p
          ),
        })),

      addSigner: (sg) => {
        const signer: AuthorizedSigner = { ...sg, id: genId('as'), createdAt: new Date().toISOString() };
        set((s) => ({ authorizedSigners: [...s.authorizedSigners, signer] }));
        return signer;
      },
      updateSigner: (id, patch) =>
        set((s) => ({ authorizedSigners: s.authorizedSigners.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      toggleSignerStatus: (id) =>
        set((s) => ({
          authorizedSigners: s.authorizedSigners.map((x) =>
            x.id === id ? { ...x, status: x.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : x
          ),
        })),

      createDraftRequest: (req) => {
        // Integrity: ADMIN_EMPRESA / SOLICITANTE can only create requests for
        // their own company. ADMIN_GENERAL / JEFE_DOCUMENTOS are unrestricted.
        const cu = get().currentUser;
        if (
          cu &&
          (cu.role === 'ADMIN_EMPRESA' || cu.role === 'SOLICITANTE')
        ) {
          const me = get().users.find((u) => u.id === cu.userId);
          if (me && me.companyId !== req.companyId) {
            throw new Error('No puede crear solicitudes para otra empresa.');
          }
        }
        const seq = get().requestSeq;
        const newReq: AccessRequest = {
          id: genId('rq'),
          number: genRequestNumber(seq),
          status: 'BORRADOR',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: [],
          personIds: [],
          vehicles: [],
          tools: [],
          accessPoints: [],
          zones: [],
          documents: [],
          reason: '',
          startDate: '',
          endDate: '',
          startTime: '',
          endTime: '',
          observations: '',
          ...req,
        };
        set((s) => ({ requests: [...s.requests, newReq], requestSeq: seq + 1 }));
        return newReq;
      },
      updateRequest: (id, patch) => {
        const r = get().requests.find((x) => x.id === id);
        if (!r) return;
        // Integrity: editable only in BORRADOR / DEVUELTA_PARA_CORRECCION.
        if (!['BORRADOR', 'DEVUELTA_PARA_CORRECCION'].includes(r.status)) {
          throw new Error(
            `No se puede editar una solicitud en estado ${r.status}.`
          );
        }
        // Integrity: ADMIN_EMPRESA / SOLICITANTE limited to own company.
        const cu = get().currentUser;
        if (
          cu &&
          (cu.role === 'ADMIN_EMPRESA' || cu.role === 'SOLICITANTE')
        ) {
          const me = get().users.find((u) => u.id === cu.userId);
          if (me && me.companyId !== r.companyId) {
            throw new Error('No puede editar solicitudes de otra empresa.');
          }
        }
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        }));
      },
      addRequestHistory: (id, event) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  history: [
                    ...r.history,
                    { ...event, id: genId('ev'), timestamp: new Date().toISOString() },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        })),
      submitRequest: (id) => {
        const r = get().requests.find((x) => x.id === id);
        if (!r) return;
        // Integrity: only drafts (or returned-for-correction) can be submitted.
        if (!['BORRADOR', 'DEVUELTA_PARA_CORRECCION'].includes(r.status)) {
          throw new Error(`La solicitud ya fue enviada (estado ${r.status}).`);
        }
        const cu = get().currentUser;
        const user = get().users.find((u) => u.id === cu?.userId);
        get().setRequestStatus(
          id,
          'ENVIADA',
          user ? `${user.firstName} ${user.lastName}` : 'Usuario',
          cu?.role ?? 'ADMIN_EMPRESA',
          'Solicitud enviada'
        );
      },
      setRequestStatus: (id, status, actor, actorRole, comment) => {
        const r = get().requests.find((x) => x.id === id);
        if (!r) return;
        set((s) => ({
          requests: s.requests.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status,
                  updatedAt: new Date().toISOString(),
                  history: [
                    ...x.history,
                    {
                      id: genId('ev'),
                      status,
                      action: statusToAction(status),
                      actor,
                      actorRole,
                      comment,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : x
          ),
        }));
      },

      approveDocument: (reqId, docId) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === reqId
              ? {
                  ...r,
                  documents: r.documents.map((d) =>
                    d.id === docId ? { ...d, status: 'APROBADO', observation: undefined } : d
                  ),
                }
              : r
          ),
        })),
      rejectDocument: (reqId, docId, observation) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === reqId
              ? {
                  ...r,
                  documents: r.documents.map((d) =>
                    d.id === docId ? { ...d, status: 'RECHAZADO', observation } : d
                  ),
                }
              : r
          ),
        })),
      approveDocumentStage: (reqId, actor) => {
        const cu = get().currentUser;
        get().setRequestStatus(reqId, 'DOCUMENTOS_APROBADOS', actor, cu?.role ?? 'REVISOR', 'Etapa documental aprobada');
        get().setRequestStatus(reqId, 'PENDIENTE_APROBACION', actor, cu?.role ?? 'REVISOR', 'Enviada a aprobación final');
      },
      returnRequest: (reqId, reason, comment, actor, actorRole) => {
        get().setRequestStatus(reqId, 'DEVUELTA_PARA_CORRECCION', actor, actorRole, `${reason}: ${comment}`);
      },
      rejectRequest: (reqId, reason, comment, actor, actorRole) => {
        get().setRequestStatus(reqId, 'RECHAZADA', actor, actorRole, `${reason}: ${comment}`);
      },
      approveRequest: (reqId, actor, actorRole) => {
        get().setRequestStatus(reqId, 'APROBADA', actor, actorRole, 'Solicitud aprobada');
      },

      startIssuance: (reqId, actor) => {
        const r = get().requests.find((x) => x.id === reqId);
        if (!r) return;
        set((s) => ({
          requests: s.requests.map((x) =>
            x.id === reqId
              ? {
                  ...x,
                  status: 'EN_CONFECCION',
                  issuance: {
                    ...(x.issuance ?? {}),
                    startedAt: new Date().toISOString(),
                    actedBy: s.currentUser?.userId ?? x.issuance?.actedBy,
                  },
                  updatedAt: new Date().toISOString(),
                  history: [
                    ...x.history,
                    {
                      id: genId('ev'),
                      status: 'EN_CONFECCION',
                      action: 'Confección iniciada',
                      actor,
                      actorRole: 'EMISOR_CARNE',
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : x
          ),
        }));
      },
      markReady: (reqId, actor) => {
        const r = get().requests.find((x) => x.id === reqId);
        if (!r) return;
        // Idempotent: if a card number already exists (e.g. after a reversion),
        // keep it instead of generating a new one.
        const existingCard = r.issuance?.cardNumber;
        const seq = get().cardSeq;
        const cardNumber =
          existingCard ??
          genCredentialNumber(
            r.type === 'CARNE_PERMANENTE' ? 'CARNE_PERMANENTE' : 'PERMISO',
            seq
          );
        set((s) => ({
          cardSeq: existingCard ? s.cardSeq : s.cardSeq + 1,
          requests: s.requests.map((x) =>
            x.id === reqId
              ? {
                  ...x,
                  status: 'LISTA_PARA_ENTREGA',
                  issuance: {
                    ...(x.issuance ?? {}),
                    readyAt: new Date().toISOString(),
                    cardNumber,
                    actedBy: s.currentUser?.userId ?? x.issuance?.actedBy,
                  },
                  updatedAt: new Date().toISOString(),
                  history: [
                    ...x.history,
                    {
                      id: genId('ev'),
                      status: 'LISTA_PARA_ENTREGA',
                      action: 'Marcada como lista para entrega',
                      actor,
                      actorRole: 'EMISOR_CARNE',
                      comment: existingCard
                        ? undefined
                        : `Credencial generada: ${cardNumber}`,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : x
          ),
        }));
      },
      registerDelivery: (reqId, receivedBy, observation, actor) => {
        set((s) => ({
          requests: s.requests.map((x) =>
            x.id === reqId
              ? {
                  ...x,
                  status: 'ENTREGADA',
                  issuance: {
                    ...(x.issuance ?? {}),
                    deliveredAt: new Date().toISOString(),
                    receivedBy,
                    deliveryObservation: observation,
                    actedBy: s.currentUser?.userId ?? x.issuance?.actedBy,
                  },
                  updatedAt: new Date().toISOString(),
                  history: [
                    ...x.history,
                    {
                      id: genId('ev'),
                      status: 'ENTREGADA',
                      action: 'Carné entregado',
                      actor,
                      actorRole: 'EMISOR_CARNE',
                      comment: `Recibido por ${receivedBy}`,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : x
          ),
        }));
      },

      // ---- Issuance reversions (controlled transitions) ----
      cancelConfection: (reqId, reason, actor) => {
        const r = get().requests.find((x) => x.id === reqId);
        if (!r) return;
        if (r.status !== 'EN_CONFECCION') {
          throw new Error('Solo se puede regresar desde EN_CONFECCION.');
        }
        if (!reason.trim()) {
          throw new Error('Debe indicar el motivo de la reversión.');
        }
        get().setRequestStatus(
          reqId,
          'APROBADA',
          actor,
          'EMISOR_CARNE',
          `Reversión a APROBADA: ${reason.trim()}`
        );
        set((s) => ({
          requests: s.requests.map((x) =>
            x.id === reqId
              ? {
                  ...x,
                  issuance: { ...(x.issuance ?? {}) },
                }
              : x
          ),
        }));
      },
      returnToConfection: (reqId, reason, actor) => {
        const r = get().requests.find((x) => x.id === reqId);
        if (!r) return;
        if (r.status !== 'LISTA_PARA_ENTREGA') {
          throw new Error('Solo se puede regresar desde LISTA_PARA_ENTREGA.');
        }
        if (!reason.trim()) {
          throw new Error('Debe indicar el motivo de la reversión.');
        }
        get().setRequestStatus(
          reqId,
          'EN_CONFECCION',
          actor,
          'EMISOR_CARNE',
          `Reversión a EN_CONFECCION: ${reason.trim()}`
        );
      },
      correctDelivery: (reqId, reason, actor) => {
        const r = get().requests.find((x) => x.id === reqId);
        if (!r) return;
        const role = get().currentUser?.role;
        if (role !== 'JEFE_DOCUMENTOS' && role !== 'ADMIN_GENERAL') {
          throw new Error('Solo JEFE_DOCUMENTOS o ADMIN_GENERAL pueden corregir entregas.');
        }
        if (r.status !== 'ENTREGADA') {
          throw new Error('Solo se puede corregir desde ENTREGADA.');
        }
        if (!reason.trim()) {
          throw new Error('Debe indicar el motivo de la corrección.');
        }
        get().setRequestStatus(
          reqId,
          'LISTA_PARA_ENTREGA',
          actor,
          (role as 'JEFE_DOCUMENTOS' | 'ADMIN_GENERAL') ?? 'ADMIN_GENERAL',
          `Corrección de entrega: ${reason.trim()}`
        );
      },

      addCatalogEntry: (key, entry) =>
        set((s) => ({
          catalogs: {
            ...s.catalogs,
            [key]: [...s.catalogs[key], { ...entry, id: genId('ct') }],
          },
        })),
      updateCatalogEntry: (key, id, patch) =>
        set((s) => ({
          catalogs: {
            ...s.catalogs,
            [key]: s.catalogs[key].map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        })),
      toggleCatalogEntry: (key, id) =>
        set((s) => ({
          catalogs: {
            ...s.catalogs,
            [key]: s.catalogs[key].map((e) => (e.id === id ? { ...e, active: !e.active } : e)),
          },
        })),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      addNotification: (n) =>
        set((s) => ({
          notifications: [
            { ...n, id: genId('nt'), read: false, createdAt: new Date().toISOString() },
            ...s.notifications,
          ],
        })),
    }),
    {
      name: 'sga-mvp-storage',
      storage: createJSONStorage(() => {
        // Wrap localStorage so a corrupted/unreadable entry never throws and
        // crashes the app — we treat it as "no persisted state" and let the
        // store fall back to `initialState`.
        return {
          getItem: (name) => {
            try {
              return localStorage.getItem(name);
            } catch {
              return null;
            }
          },
          setItem: (name, value) => {
            try {
              localStorage.setItem(name, value);
            } catch {
              /* quota / disabled storage — ignore */
            }
          },
          removeItem: (name) => {
            try {
              localStorage.removeItem(name);
            } catch {
              /* ignore */
            }
          },
        };
      }),
      version: 2,
      /**
       * Migrate persisted shape between store versions.
       *
       * v1 → v2:
       *   - introduces `cardSeq` (credential sequence counter)
       *   - leaves `requestSeq` and all other keys untouched
       *   - stored `AccessRequest.issuance` records silently gain an optional
       *     `cardNumber` / `actedBy` field; pre-v2 issued requests whose card
       *     number had never been set will read as `undefined` (the
       *     CredentialView UI handles that gracefully).
       */
      migrate: (persistedState, fromVersion) => {
        const state = (persistedState ?? {}) as Partial<SgaState>;
        if (fromVersion < 2) {
          return {
            ...state,
            cardSeq: state.cardSeq ?? 1,
          } as SgaState;
        }
        return state as SgaState;
      },
    }
  )
);

function statusToAction(status: RequestStatus): string {
  const map: Record<RequestStatus, string> = {
    BORRADOR: 'Borrador guardado',
    ENVIADA: 'Solicitud enviada',
    EN_REVISION_DOCUMENTAL: 'En revisión documental',
    DEVUELTA_PARA_CORRECCION: 'Devuelta para corrección',
    DOCUMENTOS_APROBADOS: 'Documentos aprobados',
    PENDIENTE_APROBACION: 'Pendiente de aprobación',
    APROBADA: 'Solicitud aprobada',
    RECHAZADA: 'Solicitud rechazada',
    EN_CONFECCION: 'En confección',
    LISTA_PARA_ENTREGA: 'Lista para entrega',
    ENTREGADA: 'Carné entregado',
    CANCELADA: 'Solicitud cancelada',
  };
  return map[status];
}

// Helper selectors
export function useCurrentUser() {
  return useSgaStore((s) => s.currentUser);
}

export function useCurrentUserData() {
  return useSgaStore((s) => {
    const cu = s.currentUser;
    if (!cu) return null;
    return s.users.find((u) => u.id === cu.userId) ?? null;
  });
}

/**
 * Whether the persistent store has finished rehydrating from localStorage
 * on the client. Returns `false` until the first `onRehydrateStorage`
 * callback resolves. Use this to gate skeleton vs real content to avoid
 * a flash of empty/seed states during SSR/initial client render.
 */
export function useStoreHydrated(): boolean {
  return useSgaStore.persist.hasHydrated();
}

export function useRoleLabel(role?: string) {
  if (!role) return '';
  return ROLES[role as keyof typeof ROLES]?.label ?? role;
}
