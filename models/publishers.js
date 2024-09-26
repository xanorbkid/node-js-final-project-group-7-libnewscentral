// models/publishers.js
module.exports = (sequelize, DataTypes) => {
    const Publisher = sequelize.define('Publisher', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        website: {
            type: DataTypes.STRING,
        },
        source_type: {
            type: DataTypes.ENUM('external', 'internal'),
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        timestamps: false,
        tableName: 'publishers',
    });
    
    return Publisher;
};
