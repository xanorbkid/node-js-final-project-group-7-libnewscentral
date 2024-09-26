// models/article_views.js
module.exports = (sequelize, DataTypes) => {
    const ArticleView = sequelize.define('ArticleView', {
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
        view_count: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        last_viewed: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        timestamps: false,
        tableName: 'article_views',
    });
    
    return ArticleView;
};
