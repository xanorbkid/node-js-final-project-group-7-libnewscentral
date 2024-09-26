// migrations/20230915-create-likes-table.js
module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('likes', {
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
          created_at: {
              type: Sequelize.DATE,
              defaultValue: Sequelize.NOW,
          },
      }).then(() => {
          return queryInterface.addIndex('likes', ['article_id', 'user_id'], {
              unique: true,
          });
      });
  },

  down: (queryInterface, Sequelize) => {
      return queryInterface.dropTable('likes');
  }
};
