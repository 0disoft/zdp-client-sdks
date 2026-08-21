import type {
  CompatibilityChange,
  CompatibilityLevel,
  CompatibilityReport
} from './types';

export type ChangeMap = Map<string, CompatibilityChange>;

export function addChange(
  changes: ChangeMap,
  change: CompatibilityChange
): void {
  const key = `${change.code}\u0000${change.target}\u0000${change.message}`;
  changes.set(key, change);
}

export function compareNumberSet(
  target: string,
  label: string,
  baseline: readonly number[],
  current: readonly number[],
  changes: ChangeMap,
  removedLevel: Exclude<CompatibilityLevel, 'none'>,
  addedLevel: Exclude<CompatibilityLevel, 'none'>
): void {
  for (const value of baseline) {
    if (!current.includes(value)) {
      addChange(changes, {
        level: removedLevel,
        code: `operation.${label}.removed`,
        target,
        message: `${target} removed ${label} ${value}.`
      });
    }
  }
  for (const value of current) {
    if (!baseline.includes(value)) {
      addChange(changes, {
        level: addedLevel,
        code: `operation.${label}.added`,
        target,
        message: `${target} added ${label} ${value}.`
      });
    }
  }
}

export function compareStringSet(
  target: string,
  label: string,
  baseline: readonly string[],
  current: readonly string[],
  changes: ChangeMap,
  removedLevel: Exclude<CompatibilityLevel, 'none'>,
  addedLevel: Exclude<CompatibilityLevel, 'none'>
): void {
  for (const value of baseline) {
    if (!current.includes(value)) {
      addChange(changes, {
        level: removedLevel,
        code: `${label}.removed`,
        target: `${target}#${value}`,
        message: `${target} removed ${label} ${value}.`
      });
    }
  }
  for (const value of current) {
    if (!baseline.includes(value)) {
      addChange(changes, {
        level: addedLevel,
        code: `${label}.added`,
        target: `${target}#${value}`,
        message: `${target} added ${label} ${value}.`
      });
    }
  }
}

export function finalizeChanges(changes: ChangeMap): CompatibilityReport {
  const sorted = [...changes.values()].sort((left, right) => {
    if (left.level !== right.level) {
      return left.level === 'breaking' ? -1 : 1;
    }
    const targetOrder = left.target.localeCompare(right.target);
    return targetOrder !== 0 ? targetOrder : left.code.localeCompare(right.code);
  });

  const classification = sorted.some((change) => change.level === 'breaking')
    ? 'breaking'
    : sorted.length > 0
      ? 'additive'
      : 'none';

  return { classification, changes: sorted };
}
