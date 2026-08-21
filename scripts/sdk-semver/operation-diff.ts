import {
  addChange,
  compareNumberSet,
  compareStringSet
} from './change-set';
import type { ChangeMap } from './change-set';
import type { OperationSurface } from './types';

const IDEMPOTENCY_STRICTNESS: Readonly<Record<string, number>> = {
  not_required: 0,
  optional_idempotency_key: 1,
  required_idempotency_key: 2
};

export function compareOperations(
  baseline: Readonly<Record<string, OperationSurface>>,
  current: Readonly<Record<string, OperationSurface>>,
  changes: ChangeMap
): void {
  for (const operationId of Object.keys(baseline)) {
    const previous = baseline[operationId];
    const next = current[operationId];
    if (previous === undefined) {
      continue;
    }
    if (next === undefined) {
      addChange(changes, {
        level: 'breaking',
        code: 'operation.removed',
        target: operationId,
        message: `Operation ${operationId} was removed.`
      });
      continue;
    }

    compareOperation(operationId, previous, next, changes);
  }

  for (const operationId of Object.keys(current)) {
    if (baseline[operationId] !== undefined) {
      continue;
    }
    addChange(changes, {
      level: 'additive',
      code: 'operation.added',
      target: operationId,
      message: `Operation ${operationId} was added.`
    });
  }
}

function compareOperation(
  operationId: string,
  baseline: OperationSurface,
  current: OperationSurface,
  changes: ChangeMap
): void {
  for (const field of [
    'method',
    'path',
    'requestSchemaRef',
    'responseSchemaRef',
    'responseBodyMode'
  ] as const) {
    if (baseline[field] === current[field]) {
      continue;
    }
    addChange(changes, {
      level: 'breaking',
      code: `operation.${field}.changed`,
      target: operationId,
      message: `Operation ${operationId} changed ${field} from ${String(
        baseline[field]
      )} to ${String(current[field])}.`
    });
  }

  compareRequiredFlag(
    operationId,
    'authRequired',
    baseline.authRequired,
    current.authRequired,
    changes
  );
  compareRequiredFlag(
    operationId,
    'requestIdRequired',
    baseline.requestIdRequired,
    current.requestIdRequired,
    changes
  );
  compareRequiredFlag(
    operationId,
    'traceIdRequired',
    baseline.traceIdRequired,
    current.traceIdRequired,
    changes
  );

  const baselineStrictness = IDEMPOTENCY_STRICTNESS[baseline.idempotency];
  const currentStrictness = IDEMPOTENCY_STRICTNESS[current.idempotency];
  if (baselineStrictness === undefined || currentStrictness === undefined) {
    throw new Error(`Unsupported idempotency policy on ${operationId}.`);
  }
  if (baselineStrictness !== currentStrictness) {
    addChange(changes, {
      level: currentStrictness > baselineStrictness ? 'breaking' : 'additive',
      code: 'operation.idempotency.changed',
      target: operationId,
      message: `Operation ${operationId} changed idempotency from ${baseline.idempotency} to ${current.idempotency}.`
    });
  }

  compareNumberSet(
    operationId,
    'success-status',
    baseline.successStatuses,
    current.successStatuses,
    changes,
    'breaking',
    'additive'
  );
  compareStringSet(
    operationId,
    'error-code',
    baseline.errorCodes,
    current.errorCodes,
    changes,
    'additive',
    'breaking'
  );
}

function compareRequiredFlag(
  operationId: string,
  field: string,
  baseline: boolean,
  current: boolean,
  changes: ChangeMap
): void {
  if (baseline === current) {
    return;
  }
  addChange(changes, {
    level: current ? 'breaking' : 'additive',
    code: `operation.${field}.changed`,
    target: operationId,
    message: `Operation ${operationId} changed ${field} from ${baseline} to ${current}.`
  });
}
