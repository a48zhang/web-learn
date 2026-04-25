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
    dialectOptions: config.database.ssl
      ? {
          ssl: {
            rejectUnauthorized: config.database.sslRejectUnauthorized,
            ca: config.database.sslCa,
          },
        }
      : undefined,
    logging: false,
    define: { underscored: true, timestamps: true },
  }
);
