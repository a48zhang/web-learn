import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicMemberAttributes {
  id: number;
  topic_id: number;
  user_id: number;
  joined_at: Date;
}

interface TopicMemberCreationAttributes extends Optional<TopicMemberAttributes, 'id' | 'joined_at'> {}

class TopicMember extends Model<TopicMemberAttributes, TopicMemberCreationAttributes> implements TopicMemberAttributes {
  public id!: number;
  public topic_id!: number;
  public user_id!: number;
  public joined_at!: Date;
}

TopicMember.init(
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'topic_members',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['topic_id', 'user_id'],
      },
    ],
  }
);

export default TopicMember;