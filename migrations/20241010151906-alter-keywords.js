module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Alter 'keywords' column to change its type to ARRAY of TEXT
    await queryInterface.changeColumn('articles', 'keywords', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert the change back to ARRAY of STRING if needed
    await queryInterface.changeColumn('articles', 'keywords', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });
  }
};
