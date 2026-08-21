import { addChange, compareStringSet } from './change-set';
import type { ChangeMap } from './change-set';
import type {
  FieldPresence,
  GeneratedPublicSurface,
  OperationSurface,
  RuntimeFieldDescriptor,
  RuntimeSchemaSurface,
  SchemaKind,
  SchemaSurface
} from './types';

export function compareSchemas(
  baseline: GeneratedPublicSurface,
  current: GeneratedPublicSurface,
  changes: ChangeMap
): void {
  const baselineRefs = collectReferencedSchemaRefs(baseline.operations);
  const currentRefs = collectReferencedSchemaRefs(current.operations);
  const allRefs = new Set([...baselineRefs, ...currentRefs]);
  const compareRuntimeTypes = Object.keys(baseline.runtimeSchemas).length > 0;

  for (const schemaRef of allRefs) {
    const previous = baseline.schemas[schemaRef];
    const next = current.schemas[schemaRef];

    if (previous === undefined && next !== undefined) {
      addChange(changes, {
        level: 'additive',
        code: 'schema.added',
        target: schemaRef,
        message: `Schema ${schemaRef} was added.`
      });
      continue;
    }
    if (previous !== undefined && next === undefined) {
      addChange(changes, {
        level: 'breaking',
        code: 'schema.removed',
        target: schemaRef,
        message: `Schema ${schemaRef} was removed.`
      });
      continue;
    }
    if (previous === undefined || next === undefined) {
      throw new Error(`Referenced schema ${schemaRef} is missing from both surfaces.`);
    }

    compareSchema(
      previous,
      next,
      baseline.runtimeSchemas[schemaRef],
      current.runtimeSchemas[schemaRef],
      compareRuntimeTypes,
      changes
    );
  }
}

function compareSchema(
  baseline: SchemaSurface,
  current: SchemaSurface,
  baselineRuntime: RuntimeSchemaSurface | undefined,
  currentRuntime: RuntimeSchemaSurface | undefined,
  compareRuntimeTypes: boolean,
  changes: ChangeMap
): void {
  const schemaRef = baseline.schemaRef;
  if (baseline.kind !== current.kind) {
    addChange(changes, {
      level: 'breaking',
      code: 'schema.kind.changed',
      target: schemaRef,
      message: `Schema ${schemaRef} changed kind from ${baseline.kind} to ${current.kind}.`
    });
    return;
  }
  if (baseline.schemaId !== current.schemaId) {
    addChange(changes, {
      level: 'breaking',
      code: 'schema.id.changed',
      target: schemaRef,
      message: `Schema ${schemaRef} changed TypeScript id from ${baseline.schemaId} to ${current.schemaId}.`
    });
  }
  if (baseline.carriesSecretMaterial !== current.carriesSecretMaterial) {
    addChange(changes, {
      level: current.carriesSecretMaterial ? 'breaking' : 'additive',
      code: 'schema.secret-material.changed',
      target: schemaRef,
      message: `Schema ${schemaRef} changed carriesSecretMaterial from ${baseline.carriesSecretMaterial} to ${current.carriesSecretMaterial}.`
    });
  }

  if (
    compareRuntimeTypes &&
    baselineRuntime !== undefined &&
    currentRuntime === undefined
  ) {
    addChange(changes, {
      level: 'breaking',
      code: 'schema.runtime-descriptor.removed',
      target: schemaRef,
      message: `Schema ${schemaRef} lost its runtime type descriptor.`
    });
  }

  const fields = new Set([
    ...baseline.requiredFields,
    ...baseline.optionalFields,
    ...current.requiredFields,
    ...current.optionalFields
  ]);
  for (const field of fields) {
    const previousPresence = fieldPresence(baseline, field);
    const nextPresence = fieldPresence(current, field);
    compareFieldPresence(
      baseline.kind,
      schemaRef,
      field,
      previousPresence,
      nextPresence,
      changes
    );

    if (
      !compareRuntimeTypes ||
      baselineRuntime === undefined ||
      currentRuntime === undefined ||
      previousPresence === 'absent' ||
      nextPresence === 'absent'
    ) {
      continue;
    }

    const previousType = baselineRuntime.fieldTypes[field];
    const nextType = currentRuntime.fieldTypes[field];
    if (previousType === undefined && nextType !== undefined) {
      addChange(changes, {
        level: 'additive',
        code: 'schema.field-type.added',
        target: `${schemaRef}#${field}`,
        message: `Field ${schemaRef}#${field} gained a runtime type descriptor.`
      });
    } else if (previousType !== undefined && nextType === undefined) {
      addChange(changes, {
        level: 'breaking',
        code: 'schema.field-type.removed',
        target: `${schemaRef}#${field}`,
        message: `Field ${schemaRef}#${field} lost its runtime type descriptor.`
      });
    } else if (previousType !== undefined && nextType !== undefined) {
      compareFieldType(
        baseline.kind,
        schemaRef,
        field,
        previousType,
        nextType,
        changes
      );
    }
  }

  compareStringSet(
    schemaRef,
    'secret-field',
    baseline.secretFields,
    current.secretFields,
    changes,
    'additive',
    'breaking'
  );
}

function compareFieldPresence(
  kind: SchemaKind,
  schemaRef: string,
  field: string,
  baseline: FieldPresence,
  current: FieldPresence,
  changes: ChangeMap
): void {
  if (baseline === current) {
    return;
  }

  const target = `${schemaRef}#${field}`;
  if (kind === 'request') {
    const breaking =
      current === 'required' ||
      (baseline !== 'absent' && current === 'absent');
    addChange(changes, {
      level: breaking ? 'breaking' : 'additive',
      code: `schema.request.field.${baseline}-to-${current}`,
      target,
      message: `Request field ${target} changed from ${baseline} to ${current}.`
    });
    return;
  }

  const breaking =
    current === 'absent' ||
    (baseline === 'required' && current === 'optional');
  addChange(changes, {
    level: breaking ? 'breaking' : 'additive',
    code: `schema.response.field.${baseline}-to-${current}`,
    target,
    message: `Response field ${target} changed from ${baseline} to ${current}.`
  });
}

function compareFieldType(
  kind: SchemaKind,
  schemaRef: string,
  field: string,
  baseline: RuntimeFieldDescriptor,
  current: RuntimeFieldDescriptor,
  changes: ChangeMap
): void {
  if (fieldDescriptorKey(baseline) === fieldDescriptorKey(current)) {
    return;
  }

  const target = `${schemaRef}#${field}`;
  if (typeof baseline === 'string' || typeof current === 'string') {
    addChange(changes, {
      level: 'breaking',
      code: 'schema.field-type.changed',
      target,
      message: `Field ${target} changed wire type from ${fieldDescriptorKey(
        baseline
      )} to ${fieldDescriptorKey(current)}.`
    });
    return;
  }

  const removed = baseline.enum.filter((value) => !current.enum.includes(value));
  const added = current.enum.filter((value) => !baseline.enum.includes(value));
  if (removed.length > 0) {
    addChange(changes, {
      level: kind === 'request' ? 'breaking' : 'additive',
      code: 'schema.enum-values.removed',
      target,
      message: `Field ${target} removed enum values: ${removed.join(', ')}.`
    });
  }
  if (added.length > 0) {
    addChange(changes, {
      level: kind === 'response' ? 'breaking' : 'additive',
      code: 'schema.enum-values.added',
      target,
      message: `Field ${target} added enum values: ${added.join(', ')}.`
    });
  }
}

function fieldPresence(schema: SchemaSurface, field: string): FieldPresence {
  if (schema.requiredFields.includes(field)) {
    return 'required';
  }
  if (schema.optionalFields.includes(field)) {
    return 'optional';
  }
  return 'absent';
}

function fieldDescriptorKey(descriptor: RuntimeFieldDescriptor): string {
  return typeof descriptor === 'string'
    ? descriptor
    : `enum:${[...descriptor.enum].sort().join('|')}`;
}

function collectReferencedSchemaRefs(
  operations: Readonly<Record<string, OperationSurface>>
): ReadonlySet<string> {
  const refs = new Set<string>();
  for (const operation of Object.values(operations)) {
    refs.add(operation.requestSchemaRef);
    if (operation.responseSchemaRef !== null) {
      refs.add(operation.responseSchemaRef);
    }
  }
  return refs;
}
