import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicAttributes {
  id: number;
  title: string;
  description?: string;
  type: 'knowledge' | 'website';
  website_url?: string | null;
  created_by: number;
  status: 'draft' | 'published' | 'closed';
}

interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'website_url' | 'status' | 'type'> {}

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: number;
  public title!: string;
  public description?: string;
  public type!: 'knowledge' | 'website';
  public website_url?: string | null;
  public created_by!: number;
  public status!: 'draft' | 'published' | 'closed';
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

Topic.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM('knowledge', 'website'), allowNull: false, defaultValue: 'knowledge' },
    website_url: { type: DataTypes.STRING(500), allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false, defaultValue: 'draft',
    },
  },
  { sequelize, tableName: 'topic_topics', underscored: true }
);

export default Topic;
