module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('articles', 'title', {
      type: Sequelize.STRING(4000),  // Extend title to 4000 characters
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('articles', 'title', {
      type: Sequelize.STRING(255),  // Rollback to original 255 characters
      allowNull: false
    });
  }
};
