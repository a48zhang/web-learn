import User from './User';
import Topic from './Topic';
import TopicMember from './TopicMember';
import Resource from './Resource';
import Task from './Task';
import Submission, { SubmissionWithAssocs } from './Submission';
import Review from './Review';

// User associations
User.hasMany(Topic, { foreignKey: 'created_by', as: 'topics' });
User.hasMany(Resource, { foreignKey: 'owner_id', as: 'resources' });
User.hasMany(Task, { foreignKey: 'created_by', as: 'tasks' });
User.hasMany(Submission, { foreignKey: 'student_id', as: 'submissions' });
User.hasMany(Review, { foreignKey: 'reviewer_id', as: 'reviews' });

// Topic associations
Topic.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Topic.hasMany(Resource, { foreignKey: 'topic_id', as: 'resources' });
Topic.hasMany(Task, { foreignKey: 'topic_id', as: 'tasks' });

// TopicMember associations (Many-to-Many: Topic <-> User)
Topic.belongsToMany(User, { through: TopicMember, foreignKey: 'topic_id', otherKey: 'user_id', as: 'members' });
User.belongsToMany(Topic, { through: TopicMember, foreignKey: 'user_id', otherKey: 'topic_id', as: 'joinedTopics' });
Topic.hasMany(TopicMember, { foreignKey: 'topic_id', as: 'topicMembers' });
TopicMember.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });
TopicMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Resource associations
Resource.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });
Resource.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// Task associations
Task.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Task.hasMany(Submission, { foreignKey: 'task_id', as: 'submissions' });

// Submission associations
Submission.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
Submission.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
Submission.hasOne(Review, { foreignKey: 'submission_id', as: 'review' });

// Review associations
Review.belongsTo(Submission, { foreignKey: 'submission_id', as: 'submission' });
Review.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });

export {
  User,
  Topic,
  TopicMember,
  Resource,
  Task,
  Submission,
  SubmissionWithAssocs,
  Review,
};
