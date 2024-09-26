// migrations/20230915-create-publishers-table.js
module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('publishers', {
          id: {
              type: Sequelize.INTEGER,
              autoIncrement: true,
              primaryKey: true,
          },
          name: {
              type: Sequelize.STRING,
              allowNull: false,
          },
          website: {
              type: Sequelize.STRING,
          },
          source_type: {
              type: Sequelize.ENUM('external', 'internal'),
              allowNull: false,
          },
          created_at: {
              type: Sequelize.DATE,
              defaultValue: Sequelize.NOW,
          },
      });
  },

  down: (queryInterface, Sequelize) => {
      return queryInterface.dropTable('publishers');
  }
};
