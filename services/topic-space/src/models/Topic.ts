import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicAttributes {
  id: number;
  title: string;
  description?: string;
  type: 'website';
  website_url?: string | null;
  created_by: number;
  status: 'draft' | 'published' | 'closed';
  files_snapshot?: string | null;
  chat_history?: string | null;
  published_url?: string | null;
  share_link?: string | null;
  editors: string[];
}

interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'website_url' | 'status' | 'type' | 'files_snapshot' | 'chat_history' | 'published_url' | 'share_link' | 'editors'> {}

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: number;
  public title!: string;
  public description?: string;
  public type!: 'website';
  public website_url?: string | null;
  public created_by!: number;
  public status!: 'draft' | 'published' | 'closed';
  public files_snapshot?: string | null;
  public chat_history?: string | null;
  public published_url?: string | null;
  public share_link?: string | null;
  public editors!: string[];
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

Topic.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM('website'), allowNull: false, defaultValue: 'website' },
    website_url: { type: DataTypes.STRING(500), allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false, defaultValue: 'draft',
    },
    files_snapshot: { type: DataTypes.TEXT, allowNull: true },
    chat_history: { type: DataTypes.TEXT, allowNull: true },
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
