import { DataTypes } from 'sequelize';
import { syncSchemaWithDiffCheck } from '../src/utils/schemaSync';

describe('syncSchemaWithDiffCheck', () => {
  it('compares enum columns without forcing a sync when schema already matches', async () => {
    const describeTable = jest.fn().mockResolvedValue({
      role: {
        type: "ENUM('admin','user')",
        allowNull: false,
        defaultValue: 'user',
        primaryKey: false,
      },
    });
    const showIndex = jest.fn().mockResolvedValue([]);
    const sync = jest.fn().mockResolvedValue(undefined);

    const sequelize = {
      models: {
        User: {
          getTableName: () => 'auth_users',
          getAttributes: () => ({
            role: {
              type: DataTypes.ENUM('admin', 'user'),
              allowNull: false,
              defaultValue: 'user',
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

    await expect(syncSchemaWithDiffCheck(sequelize, 'auth')).resolves.toBeUndefined();
    expect(sync).not.toHaveBeenCalled();
  });
});
