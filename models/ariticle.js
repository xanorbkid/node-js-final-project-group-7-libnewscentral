module.exports = (sequelize, DataTypes) => {
    const Article = sequelize.define('Article', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: DataTypes.TEXT,
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
        // Updated fields
        summary: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        vectors: {
            type: DataTypes.JSONB,
            allowNull: true,  // Storing vectors as JSONB
        },
        keywords: {
            type: DataTypes.ARRAY(DataTypes.TEXT),  // Changed to array of TEXT
            allowNull: true,
        },
    }, {
        timestamps: false,
        tableName: 'articles',
    });

    return Article;
};
