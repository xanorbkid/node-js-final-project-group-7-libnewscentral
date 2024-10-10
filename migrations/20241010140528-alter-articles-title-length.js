module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('articles', 'title', {
      type: Sequelize.TEXT,  // Extend title to 4000 characters
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('articles', 'title', {
      type: Sequelize.TEXT,  // Rollback to original 255 characters
      allowNull: false
    });
  }
};
