module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('users', {
          id: {
              type: Sequelize.INTEGER,
              autoIncrement: true,
              primaryKey: true,
          },
          username: {
              type: Sequelize.STRING,
              allowNull: false,
              unique: true,
          },
          email: {
              type: Sequelize.STRING,
              allowNull: false,
              unique: true,
          },
          password: {
              type: Sequelize.STRING,
              allowNull: false,
          },
          role: {
              type: Sequelize.ENUM('admin', 'editor', 'reader'),
              allowNull: false,
          },
          preferences: {
              type: Sequelize.TEXT,
          },
          created_at: {
              type: Sequelize.DATE,
              defaultValue: Sequelize.NOW,
          },
      });
  },

  down: (queryInterface, Sequelize) => {
      return queryInterface.dropTable('users');
  }
};
