import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface SubmissionAttributes {
  id: number;
  task_id: number;
  student_id: number;
  content?: string;
  file_url?: string;
  submitted_at: Date;
}

interface SubmissionCreationAttributes extends Optional<SubmissionAttributes, 'id' | 'submitted_at' | 'content' | 'file_url'> {}

class Submission extends Model<SubmissionAttributes, SubmissionCreationAttributes> implements SubmissionAttributes {
  public id!: number;
  public task_id!: number;
  public student_id!: number;
  public content?: string;
  public file_url?: string;
  public readonly submitted_at!: Date;
}

Submission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    task_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id',
      },
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_url: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'submissions',
    timestamps: false,
  }
);

export default Submission;
