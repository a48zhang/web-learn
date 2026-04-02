import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';
import { Submission, User } from './index';

interface ReviewAttributes {
  id: number;
  submission_id: number;
  reviewer_id: number;
  score?: number;
  feedback?: string;
  reviewed_at: Date;
}

interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'id' | 'score' | 'feedback' | 'reviewed_at'> {}

class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public id!: number;
  public submission_id!: number;
  public reviewer_id!: number;
  public score?: number;
  public feedback?: string;
  public reviewed_at!: Date;
  public submission?: Submission;
  public reviewer?: User;
}

Review.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    submission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'submissions',
        key: 'id',
      },
    },
    reviewer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'reviews',
    underscored: true,
    timestamps: false,
  }
);

export default Review;
