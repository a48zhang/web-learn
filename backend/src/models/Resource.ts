import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';
import { Topic, User } from './index';

interface ResourceAttributes {
  id: number;
  topic_id: number;
  owner_id: number;
  type: 'document' | 'video' | 'link' | 'other';
  title?: string;
  uri: string;
  uploaded_at: Date;
}

interface ResourceCreationAttributes extends Optional<ResourceAttributes, 'id' | 'title' | 'uploaded_at'> {}

class Resource extends Model<ResourceAttributes, ResourceCreationAttributes> implements ResourceAttributes {
  public id!: number;
  public topic_id!: number;
  public owner_id!: number;
  public type!: 'document' | 'video' | 'link' | 'other';
  public title?: string;
  public uri!: string;
  public uploaded_at!: Date;
  public topic?: Topic;
  public owner?: User;
}

Resource.init(
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
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('document', 'video', 'link', 'other'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    uri: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    uploaded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'resources',
    underscored: true,
    timestamps: false,
  }
);

export default Resource;
