import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TaskAttributes {
  id: number;
  topic_id: number;
  title: string;
  description?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

interface TaskCreationAttributes extends Optional<TaskAttributes, 'id' | 'created_at' | 'updated_at' | 'description'> {}

class Task extends Model<TaskAttributes, TaskCreationAttributes> implements TaskAttributes {
  public id!: number;
  public topic_id!: number;
  public title!: string;
  public description?: string;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Task.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    topic_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'topics',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'tasks',
  }
);

export default Task;
