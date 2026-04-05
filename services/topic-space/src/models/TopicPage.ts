import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicPageAttributes {
  id: number;
  topic_id: number;
  title: string;
  content: string;
  parent_page_id?: number | null;
  order: number;
}

interface TopicPageCreationAttributes extends Optional<TopicPageAttributes, 'id' | 'content' | 'parent_page_id' | 'order'> {}

class TopicPage extends Model<TopicPageAttributes, TopicPageCreationAttributes> implements TopicPageAttributes {
  public id!: number;
  public topic_id!: number;
  public title!: string;
  public content!: string;
  public parent_page_id?: number | null;
  public order!: number;
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

TopicPage.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    topic_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    parent_page_id: { type: DataTypes.INTEGER, allowNull: true },
    order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'topic_pages', underscored: true }
);

export default TopicPage;
