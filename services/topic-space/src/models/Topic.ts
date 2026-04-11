import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicAttributes {
  id: string;
  title: string;
  description?: string;
  type: 'website';
  created_by: string;
  status: 'draft' | 'published' | 'closed';
  published_url?: string | null;
  share_link?: string | null;
  editors: string[];
}

interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'status' | 'type' | 'published_url' | 'share_link' | 'editors'> {}

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: string;
  public title!: string;
  public description?: string;
  public type!: 'website';
  public created_by!: string;
  public status!: 'draft' | 'published' | 'closed';
  public published_url?: string | null;
  public share_link?: string | null;
  public editors!: string[];
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

Topic.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM('website'), allowNull: false, defaultValue: 'website' },
    created_by: { type: DataTypes.STRING(100), allowNull: false },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false,
      defaultValue: 'draft',
    },
    published_url: { type: DataTypes.STRING(500), allowNull: true },
    share_link: { type: DataTypes.STRING(500), allowNull: true },
    editors: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  { sequelize, tableName: 'topic_topics', underscored: true }
);

export default Topic;
