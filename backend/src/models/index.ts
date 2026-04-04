import User from './User';
import Topic from './Topic';
import TopicPage from './TopicPage';

// User associations
User.hasMany(Topic, { foreignKey: 'created_by', as: 'topics' });

// Topic associations
Topic.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Topic.hasMany(TopicPage, { foreignKey: 'topic_id', as: 'pages' });

// TopicPage associations
TopicPage.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });
TopicPage.belongsTo(TopicPage, { foreignKey: 'parent_page_id', as: 'parent' });
TopicPage.hasMany(TopicPage, { foreignKey: 'parent_page_id', as: 'children' });

export {
  User,
  Topic,
  TopicPage,
};
