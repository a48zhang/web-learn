import Topic from './Topic';
import TopicPage from './TopicPage';

Topic.hasMany(TopicPage, { foreignKey: 'topic_id', as: 'pages' });
TopicPage.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });
TopicPage.belongsTo(TopicPage, { foreignKey: 'parent_page_id', as: 'parent' });
TopicPage.hasMany(TopicPage, { foreignKey: 'parent_page_id', as: 'children' });

export { Topic, TopicPage };
