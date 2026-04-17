import { Sequelize, ModelAttributeColumnOptions, IndexesOptions } from 'sequelize';

type TableColumn = {
  type: string;
  allowNull: boolean;
  defaultValue: unknown;
  primaryKey: boolean;
};

const normalizeString = (value: string): string =>
  value.toLowerCase().replace(/[`"'\s]/g, '');

const normalizeType = (value: string): string => normalizeString(value);

const parseEnumValues = (typeValue: string): string[] => {
  const matches = typeValue.match(/'([^']+)'/g);
  if (!matches) {
    return [];
  }

  return matches.map((entry) => entry.slice(1, -1));
};

const typesMatch = (expected: string, actual: string): boolean => {
  const expectedNormalized = normalizeType(expected);
  const actualNormalized = normalizeType(actual);

  if (expectedNormalized === actualNormalized) {
    return true;
  }

  if (expectedNormalized.startsWith('enum(') && actualNormalized.startsWith('enum(')) {
    const expectedValues = parseEnumValues(expectedNormalized);
    const actualValues = parseEnumValues(actualNormalized);
    if (expectedValues.length !== actualValues.length) {
      return false;
    }

    return expectedValues.every((value, index) => value === actualValues[index]);
  }

  return false;
};

const normalizeDefault = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return normalizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

const hasUniqueIndexForColumn = (indexes: IndexesOptions[], column: string): boolean => {
  return indexes.some((index) => {
    if (!index.unique || !index.fields || index.fields.length !== 1) {
      return false;
    }

    const onlyField = index.fields[0];
    if (typeof onlyField === 'string') {
      return normalizeString(onlyField) === normalizeString(column);
    }

    if ('attribute' in onlyField && typeof onlyField.attribute === 'string') {
      return normalizeString(onlyField.attribute) === normalizeString(column);
    }

    if ('name' in onlyField && typeof onlyField.name === 'string') {
      return normalizeString(onlyField.name) === normalizeString(column);
    }

    return false;
  });
};

const getExpectedColumns = (
  attributes: Record<string, ModelAttributeColumnOptions>
): Map<string, ModelAttributeColumnOptions> => {
  const expectedColumns = new Map<string, ModelAttributeColumnOptions>();

  for (const [attributeName, definition] of Object.entries(attributes)) {
    const dbColumn = definition.field ?? attributeName;
    expectedColumns.set(normalizeString(dbColumn), definition);
  }

  return expectedColumns;
};

const getActualColumns = (tableInfo: Record<string, TableColumn>): Map<string, TableColumn> => {
  const actualColumns = new Map<string, TableColumn>();

  for (const [columnName, definition] of Object.entries(tableInfo)) {
    actualColumns.set(normalizeString(columnName), definition);
  }

  return actualColumns;
};

export const syncSchemaWithDiffCheck = async (
  sequelize: Sequelize,
  serviceName: string
): Promise<void> => {
  const queryInterface = sequelize.getQueryInterface();
  const driftReasons: string[] = [];

  for (const model of Object.values(sequelize.models)) {
    const tableName = model.getTableName();
    const rawTableName = typeof tableName === 'string' ? tableName : tableName.tableName;

    let tableInfo: Record<string, TableColumn>;
    try {
      tableInfo = (await queryInterface.describeTable(rawTableName)) as Record<string, TableColumn>;
    } catch {
      driftReasons.push(`${rawTableName}: table missing`);
      continue;
    }

    const expectedColumns = getExpectedColumns(model.getAttributes());
    const actualColumns = getActualColumns(tableInfo);

    for (const expectedColumn of expectedColumns.keys()) {
      if (!actualColumns.has(expectedColumn)) {
        driftReasons.push(`${rawTableName}: missing column ${expectedColumn}`);
      }
    }

    for (const actualColumn of actualColumns.keys()) {
      if (!expectedColumns.has(actualColumn)) {
        driftReasons.push(`${rawTableName}: extra column ${actualColumn}`);
      }
    }

    for (const [columnName, expectedDefinition] of expectedColumns.entries()) {
      const actualDefinition = actualColumns.get(columnName);
      if (!actualDefinition) {
        continue;
      }

      const expectedType = String(expectedDefinition.type);
      if (!typesMatch(expectedType, actualDefinition.type)) {
        driftReasons.push(
          `${rawTableName}.${columnName}: type ${actualDefinition.type} -> ${expectedType}`
        );
      }

      const expectedAllowNull = expectedDefinition.allowNull ?? true;
      if (expectedAllowNull !== actualDefinition.allowNull) {
        driftReasons.push(
          `${rawTableName}.${columnName}: allowNull ${actualDefinition.allowNull} -> ${expectedAllowNull}`
        );
      }

      const expectedPrimaryKey = expectedDefinition.primaryKey ?? false;
      if (expectedPrimaryKey !== actualDefinition.primaryKey) {
        driftReasons.push(
          `${rawTableName}.${columnName}: primaryKey ${actualDefinition.primaryKey} -> ${expectedPrimaryKey}`
        );
      }

      const expectedDefault = normalizeDefault(expectedDefinition.defaultValue);
      const actualDefault = normalizeDefault(actualDefinition.defaultValue);
      if (expectedDefault !== actualDefault) {
        driftReasons.push(
          `${rawTableName}.${columnName}: default ${actualDefault ?? 'null'} -> ${expectedDefault ?? 'null'}`
        );
      }
    }

    const indexes = (await queryInterface.showIndex(rawTableName)) as IndexesOptions[];
    for (const [attributeName, definition] of Object.entries(model.getAttributes())) {
      const hasUniqueConstraint = definition.unique === true || typeof definition.unique === 'string';
      if (!hasUniqueConstraint) {
        continue;
      }

      const columnName = definition.field ?? attributeName;
      if (!hasUniqueIndexForColumn(indexes, columnName)) {
        driftReasons.push(`${rawTableName}: missing unique index on ${columnName}`);
      }
    }
  }

  if (driftReasons.length === 0) {
    console.log(`[${serviceName}] database schema unchanged, skip sync`);
    return;
  }

  console.warn(`[${serviceName}] schema drift detected, recreate tables with force sync`);
  console.warn(`[${serviceName}] drift details: ${driftReasons.join('; ')}`);
  await sequelize.sync({ force: true });
  console.log(`[${serviceName}] database force synced after drift check`);
};
