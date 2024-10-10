module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('articles', 'keywords', {
      type: Sequelize.ARRAY(Sequelize.STRING(500)),
      allowNull: true,  // Allows null in future records
      defaultValue: []  // Existing rows will have an empty array as default
    });

    // Update existing rows with default value if necessary
    await queryInterface.sequelize.query(`UPDATE articles SET keywords = '{}' WHERE keywords IS NULL`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('articles', 'keywords');
  }
};
