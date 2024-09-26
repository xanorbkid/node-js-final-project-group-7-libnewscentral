// migrations/20230915-create-article-views-table.js
module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('article_views', {
          id: {
              type: Sequelize.INTEGER,
              autoIncrement: true,
              primaryKey: true,
          },
          article_id: {
              type: Sequelize.INTEGER,
              references: {
                  model: 'articles',
                  key: 'id',
              },
          },
          user_id: {
              type: Sequelize.INTEGER,
              references: {
                  model: 'users',
                  key: 'id',
              },
          },
          view_count: {
              type: Sequelize.INTEGER,
              defaultValue: 1,
          },
          last_viewed: {
              type: Sequelize.DATE,
              defaultValue: Sequelize.NOW,
          },
      });
  },

  down: (queryInterface, Sequelize) => {
      return queryInterface.dropTable('article_views');
  }
};
