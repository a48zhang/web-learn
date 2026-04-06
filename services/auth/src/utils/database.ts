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
    define: { underscored: true, timestamps: true },
  }
);
