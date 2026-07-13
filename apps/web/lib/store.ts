import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AccessRequest,
  ActivityEvent,
  AuthorizedSigner,
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
import { genId, genRequestNumber, ROLES } from '@/lib/constants';
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
        const user: User = { ...u, id: genId('us'), createdAt: new Date().toISOString(), lastAccess: null };
        set((s) => ({ users: [...s.users, user] }));
        return user;
      },
      updateUser: (id, patch) =>
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
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
      updateRequest: (id, patch) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        })),
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
                  issuance: { ...(x.issuance ?? {}), startedAt: new Date().toISOString() },
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
        set((s) => ({
          requests: s.requests.map((x) =>
            x.id === reqId
              ? {
                  ...x,
                  status: 'LISTA_PARA_ENTREGA',
                  issuance: { ...(x.issuance ?? {}), readyAt: new Date().toISOString() },
                  updatedAt: new Date().toISOString(),
                  history: [
                    ...x.history,
                    {
                      id: genId('ev'),
                      status: 'LISTA_PARA_ENTREGA',
                      action: 'Marcada como lista para entrega',
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
      storage: createJSONStorage(() => localStorage),
      version: 1,
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

export function useRoleLabel(role?: string) {
  if (!role) return '';
  return ROLES[role as keyof typeof ROLES]?.label ?? role;
}
