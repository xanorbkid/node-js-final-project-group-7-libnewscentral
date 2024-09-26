// models/likes.js
module.exports = (sequelize, DataTypes) => {
    const Like = sequelize.define('Like', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        article_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'articles',
                key: 'id',
            },
        },
        user_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        timestamps: false,
        tableName: 'likes',
        indexes: [
            {
                unique: true,
                fields: ['article_id', 'user_id'],
            },
        ],
    });
    
    return Like;
};
