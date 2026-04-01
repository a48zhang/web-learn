import { Sequelize } from 'sequelize';
import { config } from './config';

export const sequelize = new Sequelize(
  config.database.name,
  config.database.user,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: 'mysql',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

export async function testDatabaseConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

export async function syncDatabase() {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');
  } catch (error) {
    console.error('Error syncing database:', error);
  }
}
