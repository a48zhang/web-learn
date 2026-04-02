import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicAttributes {
  id: number;
  title: string;
  description?: string;
  created_by: number;
  deadline?: Date;
  status: 'draft' | 'published' | 'closed';
}

interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'deadline' | 'status'> {}

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: number;
  public title!: string;
  public description?: string;
  public created_by!: number;
  public deadline?: Date;
  public status!: 'draft' | 'published' | 'closed';
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

Topic.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false,
      defaultValue: 'draft',
    },
  },
  {
    sequelize,
    tableName: 'topics',
    underscored: true,
  }
);

export default Topic;
