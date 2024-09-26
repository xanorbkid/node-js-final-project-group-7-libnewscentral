// migrations/20230915-create-articles-table.js
module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('articles', {
          id: {
              type: Sequelize.INTEGER,
              autoIncrement: true,
              primaryKey: true,
          },
          title: {
              type: Sequelize.STRING,
              allowNull: false,
          },
          content: {
              type: Sequelize.TEXT,
          },
          category_id: {
              type: Sequelize.INTEGER,
              references: {
                  model: 'categories',
                  key: 'id',
              },
              onDelete: 'CASCADE',
          },
          source: {
              type: Sequelize.STRING,
          },
          author_id: {
              type: Sequelize.STRING,
          },
          url: {
              type: Sequelize.STRING,
          },
          fetched_at: {
              type: Sequelize.DATE,
          },
          published_at: {
              type: Sequelize.DATE,
              defaultValue: Sequelize.NOW,
          },
          is_scraped: {
              type: Sequelize.BOOLEAN,
              defaultValue: false,
          },
          excerpt: {
              type: Sequelize.TEXT,
          },
          image_url: {
              type: Sequelize.STRING,
          },
          deleted_at: {
              type: Sequelize.DATE,
          },
      });
  },

  down: (queryInterface, Sequelize) => {
      return queryInterface.dropTable('articles');
  }
};
