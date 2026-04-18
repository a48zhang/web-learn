import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';
import AgentConversation from './AgentConversation';

interface AgentMessageAttributes {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  seq: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AgentMessageCreationAttributes extends Optional<AgentMessageAttributes, 'id'> {}

class AgentMessage extends Model<AgentMessageAttributes, AgentMessageCreationAttributes> implements AgentMessageAttributes {
  public id!: string;
  public conversation_id!: string;
  public role!: 'user' | 'assistant';
  public content!: string;
  public seq!: number;
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

AgentMessage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ai_agent_conversations',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    seq: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'ai_agent_messages',
    underscored: true,
  }
);

AgentConversation.hasMany(AgentMessage, {
  foreignKey: 'conversation_id',
  as: 'messages',
});

AgentMessage.belongsTo(AgentConversation, {
  foreignKey: 'conversation_id',
  as: 'conversation',
});

export default AgentMessage;
