import { finalizeChanges } from './change-set';
import { compareOperations } from './operation-diff';
import { compareSchemas } from './schema-diff';
import type {
  CompatibilityChange,
  CompatibilityReport,
  GeneratedPublicSurface
} from './types';

export function diffGeneratedPublicSurface(
  baseline: GeneratedPublicSurface,
  current: GeneratedPublicSurface
): CompatibilityReport {
  const changes = new Map<string, CompatibilityChange>();
  compareOperations(baseline.operations, current.operations, changes);
  compareSchemas(baseline, current, changes);
  return finalizeChanges(changes);
}
