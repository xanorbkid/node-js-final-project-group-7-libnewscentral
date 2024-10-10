module.exports = (sequelize, DataTypes) => {
    const Article = sequelize.define('Article', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING(4000),
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
        },
        category_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'categories',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        source: {
            type: DataTypes.STRING,
        },
        author_id: {
            type: DataTypes.STRING,
        },
        url: {
            type: DataTypes.STRING,
        },
        fetched_at: {
            type: DataTypes.DATE,
        },
        published_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        is_scraped: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        excerpt: {
            type: DataTypes.TEXT,
        },
        image_url: {
            type: DataTypes.STRING,
        },
        deleted_at: {
            type: DataTypes.DATE,
        },
        // New fields
        summary: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        vectors: {
            type: DataTypes.JSONB,
            allowNull: true,  // Assuming vectors will be stored as JSON
        },
        keywords: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,  // Assuming keywords will be stored as an array of strings
        },
    }, {
        timestamps: false,
        tableName: 'articles',
    });

    return Article;
};
