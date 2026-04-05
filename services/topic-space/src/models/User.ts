import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../utils/database';

class User extends Model {
  public id!: number;
  public username!: string;
  public email!: string;
  public role!: string;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(50), allowNull: false },
    email: { type: DataTypes.STRING(100), allowNull: false },
    role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'student' },
  },
  { sequelize, tableName: 'users', underscored: true }
);

export default User;
