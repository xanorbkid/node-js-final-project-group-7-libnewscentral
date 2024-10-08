module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('articles', 'summary', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('articles', 'vectors', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addColumn('articles', 'keywords', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('articles', 'summary');
    await queryInterface.removeColumn('articles', 'vectors');
    await queryInterface.removeColumn('articles', 'keywords');
  }
};
