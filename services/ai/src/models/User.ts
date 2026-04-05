import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'student';
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: 'admin' | 'teacher' | 'student';
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    password: { type: DataTypes.CHAR(60), allowNull: false },
    role: {
      type: DataTypes.ENUM('admin', 'teacher', 'student'),
      allowNull: false,
      defaultValue: 'student',
    },
  },
  { sequelize, tableName: 'users', underscored: true }
);

export default User;
