/**
 * WorkflowDefinitionService spec — covers definition and version commands.
 */
import { WorkflowDefinition } from '../domain/entities/workflow-definition.entity';
import { WorkflowVersion } from '../domain/entities/workflow-definition.entity';
import type { RequestType } from '../../../generated/prisma/client';
import type {
  PageInput,
  WorkflowDefinitionRepositoryPort,
  WorkflowVersionListFilters,
  WorkflowVersionRepositoryPort,
  WorkflowDefinitionListFilters,
} from '../domain/repositories/workflow-definition.repository.port';
import { WorkflowDefinitionService } from './workflow-definition.service';
import type { AuthenticatedUser } from '../../../common/presentation/decorators/authenticated-user';
import type { WorkflowGraphDefinition } from '../domain/workflow-definition.types';
import { WORKFLOW_SCHEMA_VERSION } from '../domain/workflow-definition.types';

const ADMIN: AuthenticatedUser = {
  userId: 'admin-1',
  companyId: null,
  email: 'admin@example.test',
  roles: ['SYSTEM_ADMIN'],
  permissions: [],
};

const NON_ADMIN: AuthenticatedUser = {
  userId: 'applicant-1',
  companyId: 'co-1',
  email: 'applicant@example.test',
  roles: ['APPLICANT'],
  permissions: [],
};

class FakeDefinitionRepo implements WorkflowDefinitionRepositoryPort {
  defs = new Map<string, WorkflowDefinition>();
  byKey = new Map<string, WorkflowDefinition>();
  counter = 0;

  findById(id: string) {
    return Promise.resolve(this.defs.get(id) ?? null);
  }
  findByKey(key: string) {
    return Promise.resolve(this.byKey.get(key) ?? null);
  }
  findLatestVersionPerDefinition(_filter: WorkflowDefinitionListFilters) {
    void _filter;
    return Promise.resolve([] as WorkflowDefinition[]);
  }
  findPublishedForRequestType(_requestType: RequestType) {
    void _requestType;
    return Promise.resolve(null);
  }
  list(_filters: WorkflowDefinitionListFilters, _page: PageInput) {
    void _filters;
    void _page;
    const items = Array.from(this.defs.values());
    return Promise.resolve({
      items,
      total: items.length,
      page: 1,
      pageSize: 50,
    });
  }
  save(def: WorkflowDefinition) {
    if (!def.id) {
      (def as { id?: string }).id = `wd-${++this.counter}`;
    }
    this.defs.set(def.id, def);
    this.byKey.set(def.key, def);
    return Promise.resolve();
  }
  delete(id: string) {
    const def = this.defs.get(id);
    if (def) {
      this.byKey.delete(def.key);
      this.defs.delete(id);
    }
    return Promise.resolve();
  }
}

class FakeVersionRepo implements WorkflowVersionRepositoryPort {
  versions = new Map<string, WorkflowVersion>();

  findById(id: string) {
    return Promise.resolve(this.versions.get(id) ?? null);
  }
  findByChecksum(_defId: string, checksum: string) {
    for (const v of this.versions.values()) {
      if (v.checksum === checksum) return Promise.resolve(v);
    }
    return Promise.resolve(null);
  }
  findLatestForDefinition(definitionId: string) {
    const list = Array.from(this.versions.values())
      .filter((v) => v.workflowDefinitionId === definitionId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return Promise.resolve(list[0] ?? null);
  }
  findPublishedForDefinition(definitionId: string) {
    const list = Array.from(this.versions.values()).filter(
      (v) =>
        v.workflowDefinitionId === definitionId && v.status === 'PUBLISHED',
    );
    return Promise.resolve(list[0] ?? null);
  }
  findPublishedForRequestType(_requestType: RequestType) {
    void _requestType;
    return Promise.resolve(null);
  }
  list(_filters: WorkflowVersionListFilters, p: PageInput) {
    void _filters;
    const list = Array.from(this.versions.values());
    return Promise.resolve({
      items: list,
      total: list.length,
      page: p.page,
      pageSize: p.pageSize,
    });
  }
  save(v: WorkflowVersion) {
    this.versions.set(v.id, v);
    return Promise.resolve();
  }
  deleteDraft(id: string) {
    this.versions.delete(id);
    return Promise.resolve();
  }
}

function stubGraph(): WorkflowGraphDefinition {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      { key: 'START', type: 'START', name: 'Start' },
      { key: 'END', type: 'END', name: 'End' },
    ],
    edges: [{ from: 'START', to: 'END', action: 'BEGIN' }],
  };
}

describe('WorkflowDefinitionService', () => {
  it('create() rejects non-admin actors', async () => {
    const svc = new WorkflowDefinitionService(
      new FakeDefinitionRepo(),
      new FakeVersionRepo(),
    );
    await expect(
      svc.create(
        { key: 'k_one', name: 'K1', description: null, requestType: null },
        NON_ADMIN,
      ),
    ).rejects.toThrow(/Only SYSTEM_ADMIN or COMPANY_ADMIN/);
  });

  it('create() refuses duplicate keys', async () => {
    const defs = new FakeDefinitionRepo();
    const svc = new WorkflowDefinitionService(defs, new FakeVersionRepo());
    await svc.create(
      { key: 'k_one', name: 'K1', description: null, requestType: null },
      ADMIN,
    );
    await expect(
      svc.create(
        { key: 'k_one', name: 'Other', description: null, requestType: null },
        ADMIN,
      ),
    ).rejects.toThrow(/already exists/);
  });

  it('createDraft() rejects a second open draft for the same definition', async () => {
    const defs = new FakeDefinitionRepo();
    const versions = new FakeVersionRepo();
    const svc = new WorkflowDefinitionService(defs, versions);
    const def = await svc.create(
      { key: 'k_two', name: 'K2', description: null, requestType: null },
      ADMIN,
    );
    await svc.createDraft(def.id, { definitionJson: stubGraph() }, ADMIN);
    await expect(
      svc.createDraft(def.id, { definitionJson: stubGraph() }, ADMIN),
    ).rejects.toThrow(/already has an open DRAFT/);
  });

  it('publish() is idempotent when graph checksum matches existing published version', async () => {
    const defs = new FakeDefinitionRepo();
    const versions = new FakeVersionRepo();
    const svc = new WorkflowDefinitionService(defs, versions);
    const def = await svc.create(
      { key: 'k_three', name: 'K3', description: null, requestType: null },
      ADMIN,
    );
    const v1 = await svc.createDraft(
      def.id,
      { definitionJson: stubGraph() },
      ADMIN,
    );
    await svc.publish(v1.id, ADMIN);
    // Now create another draft with identical graph — should fail to publish.
    const v2 = await svc.createDraft(
      def.id,
      { definitionJson: stubGraph() },
      ADMIN,
    );
    await expect(svc.publish(v2.id, ADMIN)).rejects.toThrow(
      /identical graph is already published/,
    );
  });

  it('deleteDraft() refuses to delete a non-DRAFT version', async () => {
    const defs = new FakeDefinitionRepo();
    const versions = new FakeVersionRepo();
    const svc = new WorkflowDefinitionService(defs, versions);
    const def = await svc.create(
      { key: 'k_four', name: 'K4', description: null, requestType: null },
      ADMIN,
    );
    const v = await svc.createDraft(
      def.id,
      { definitionJson: stubGraph() },
      ADMIN,
    );
    await svc.publish(v.id, ADMIN);
    await expect(svc.deleteDraft(v.id, ADMIN)).rejects.toThrow(
      /cannot be deleted/,
    );
  });
});
