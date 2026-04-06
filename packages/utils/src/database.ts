import { Sequelize } from 'sequelize';
import { DatabaseConfig } from './config';

export const createSequelize = (config: DatabaseConfig): Sequelize =>
  new Sequelize(config.name, config.user, config.password, {
    host: config.host,
    port: config.port,
    dialect: 'mysql',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  });
