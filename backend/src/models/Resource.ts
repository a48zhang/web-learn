import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface ResourceAttributes {
  id: number;
  topic_id: number;
  owner_id: number;
  type: 'document' | 'video' | 'link' | 'other';
  title?: string;
  uri: string;
  uploaded_at: Date;
}

interface ResourceCreationAttributes extends Optional<ResourceAttributes, 'id' | 'uploaded_at' | 'title'> {}

class Resource extends Model<ResourceAttributes, ResourceCreationAttributes> implements ResourceAttributes {
  public id!: number;
  public topic_id!: number;
  public owner_id!: number;
  public type!: 'document' | 'video' | 'link' | 'other';
  public title?: string;
  public uri!: string;
  public readonly uploaded_at!: Date;
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
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'resources',
    timestamps: false,
  }
);

export default Resource;
