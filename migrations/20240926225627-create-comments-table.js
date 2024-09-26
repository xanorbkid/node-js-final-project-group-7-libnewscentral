// migrations/20230915-create-comments-table.js
module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('comments', {
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
              onDelete: 'CASCADE',
          },
          user_id: {
              type: Sequelize.INTEGER,
              references: {
                  model: 'users',
                  key: 'id',
              },
              onDelete: 'CASCADE',
          },
          content: {
              type: Sequelize.TEXT,
              allowNull: false,
          },
          created_at: {
              type: Sequelize.DATE,
              defaultValue: Sequelize.NOW,
          },
      });
  },

  down: (queryInterface, Sequelize) => {
      return queryInterface.dropTable('comments');
  }
};
