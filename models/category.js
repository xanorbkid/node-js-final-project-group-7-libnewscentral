// models/Category.js
module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define('Category', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        image_url: {
            type: DataTypes.STRING,
        },
        deleted_at: {
            type: DataTypes.DATE,
        }
    }, {
        timestamps: false,
        tableName: 'categories',
    });
    return Category;
};
