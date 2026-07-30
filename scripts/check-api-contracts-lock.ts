import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ApiContractsLock {
  readonly schemaVersion: 'zdp.client-sdk-api-contract-lock/v1';
  readonly repository: '0disoft/zdp-api-contracts';
  readonly revision: string;
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const lock = parseLock(
  JSON.parse(
    await readFile(
      join(repositoryRoot, 'contracts', 'api-contracts.lock.json'),
      'utf8'
    )
  )
);

for (const workflow of ['ci.yml', 'release.yml']) {
  const source = await readFile(
    join(repositoryRoot, '.github', 'workflows', workflow),
    'utf8'
  );
  assert.ok(
    source.includes(`repository: ${lock.repository}`),
    `${workflow} must checkout ${lock.repository}.`
  );
  assert.ok(
    source.includes(`ref: ${lock.revision}`),
    `${workflow} must pin API contracts revision ${lock.revision}.`
  );
}

console.log(`API contracts lock verified at ${lock.revision}.`);

function parseLock(value: unknown): ApiContractsLock {
  assert.ok(isRecord(value), 'API contracts lock must contain an object.');
  assert.equal(
    value.schemaVersion,
    'zdp.client-sdk-api-contract-lock/v1',
    'Unexpected API contracts lock schema.'
  );
  assert.equal(value.repository, '0disoft/zdp-api-contracts');
  const revision = value.revision;
  if (typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error('API contracts lock revision must be a full Git SHA.');
  }
  return {
    schemaVersion: 'zdp.client-sdk-api-contract-lock/v1',
    repository: '0disoft/zdp-api-contracts',
    revision
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
