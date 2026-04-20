import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface AgentConversationAttributes {
  id: string;
  topic_id: string;
  user_id: string;
  agent_type: 'building' | 'learning';
  selected_skills: string[];
  compressed_summary: string;
  compressed_summary_version: number;
  first_uncompressed_message_id: string | null;
  has_compressed_context: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AgentConversationCreationAttributes
  extends Optional<
    AgentConversationAttributes,
    'id' | 'selected_skills' | 'compressed_summary' | 'compressed_summary_version' | 'first_uncompressed_message_id' | 'has_compressed_context'
  > {}

class AgentConversation
  extends Model<AgentConversationAttributes, AgentConversationCreationAttributes>
  implements AgentConversationAttributes
{
  public id!: string;
  public topic_id!: string;
  public user_id!: string;
  public agent_type!: 'building' | 'learning';
  public selected_skills!: string[];
  public compressed_summary!: string;
  public compressed_summary_version!: number;
  public first_uncompressed_message_id!: string | null;
  public has_compressed_context!: boolean;
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

AgentConversation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    topic_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    agent_type: {
      type: DataTypes.ENUM('building', 'learning'),
      allowNull: false,
    },
    selected_skills: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    compressed_summary: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    compressed_summary_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    first_uncompressed_message_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'last_compressed_message_id',
    },
    has_compressed_context: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'ai_agent_conversations',
    underscored: true,
  }
);

export default AgentConversation;
