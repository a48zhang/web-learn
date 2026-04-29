import { DataTypes } from 'sequelize';
import { syncSchemaWithDiffCheck } from '../src/utils/schemaSync';

describe('syncSchemaWithDiffCheck', () => {
  it('compares enum columns without throwing during drift detection', async () => {
    const describeTable = jest.fn().mockResolvedValue({
      id: {
        type: 'VARCHAR(36)',
        allowNull: false,
        defaultValue: null,
        primaryKey: true,
      },
      status: {
        type: "ENUM('draft','published','closed')",
        allowNull: false,
        defaultValue: 'draft',
        primaryKey: false,
      },
      editors: {
        type: 'JSON',
        allowNull: false,
        defaultValue: null,
        primaryKey: false,
      },
    });
    const showIndex = jest.fn().mockResolvedValue([]);
    const sync = jest.fn().mockResolvedValue(undefined);

    const sequelize = {
      models: {
        Topic: {
          getTableName: () => 'topic_topics',
          getAttributes: () => ({
            id: {
              type: DataTypes.STRING(36),
              primaryKey: true,
            },
            status: {
              type: DataTypes.ENUM('draft', 'published', 'closed'),
              allowNull: false,
              defaultValue: 'draft',
            },
            editors: {
              type: DataTypes.JSON,
              allowNull: false,
              defaultValue: [],
            },
          }),
        },
      },
      getQueryInterface: () => ({
        describeTable,
        showIndex,
      }),
      sync,
    } as any;

    await expect(syncSchemaWithDiffCheck(sequelize, 'topic-space')).resolves.toBeUndefined();
    expect(sync).not.toHaveBeenCalled();
  });
});
