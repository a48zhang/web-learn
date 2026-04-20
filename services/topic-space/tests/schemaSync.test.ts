import { DataTypes } from 'sequelize';
import { syncSchemaWithDiffCheck } from '../src/utils/schemaSync';

describe('syncSchemaWithDiffCheck', () => {
  it('compares enum columns without throwing during drift detection', async () => {
    const describeTable = jest.fn().mockResolvedValue({
      status: {
        type: "ENUM('draft','published','closed')",
        allowNull: false,
        defaultValue: 'draft',
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
            status: {
              type: DataTypes.ENUM('draft', 'published', 'closed'),
              allowNull: false,
              defaultValue: 'draft',
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
