// urlroute.js
require('dotenv').config();


const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');

let db;

// Check if we are in a production or development environment
// Determine the environment for database type (PostgreSQL or SQLite)
if (process.env.DB_TYPE === 'postgres') {
    // PostgreSQL configuration
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Timeout after 2 seconds if a connection cannot be established
    });

    db = {
        // Mock SQLite's db.all function using PostgreSQL
        all: async (query, params) => {
            try {
                const res = await pool.query(query, params);
                console.log(`Query succeeded: ${query}`); // Logging successful query
                return res.rows;
            } catch (error) {
                console.error(`PostgreSQL query error in 'all': ${error.message}`, { query, params });
                throw error;
            }
        },

        // Mock SQLite's db.get function using PostgreSQL
        get: async (query, params) => {
            try {
                const res = await pool.query(query, params);
                console.log(`Query succeeded: ${query}`); // Logging successful query
                return res.rows[0];
            } catch (error) {
                console.error(`PostgreSQL query error in 'get': ${error.message}`, { query, params });
                throw error;
            }
        },

        // Mock SQLite's db.run function using PostgreSQL
        run: async (query, params) => {
            try {
                const res = await pool.query(query, params);
                console.log(`Query succeeded: ${query}`); // Logging successful query
                return { lastID: res.insertId, changes: res.rowCount };
            } catch (error) {
                console.error(`PostgreSQL query error in 'run': ${error.message}`, { query, params });
                throw error;
            }
        }
    };

    console.log('Connected to PostgreSQL database');

} else if (process.env.DB_TYPE === 'sqlite') {
    // SQLite configuration
    const databasePath = process.env.DATABASE_PATH;

    if (!databasePath || typeof databasePath !== 'string') {
        throw new Error('DATABASE_PATH environment variable is not set or is not a valid string');
    }

    const sqliteDb = new sqlite3.Database(databasePath, (err) => {
        if (err) {
            console.error('Error opening SQLite database:', err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    });

    // Promisify the SQLite methods to keep the interface consistent with PostgreSQL
    db = {
        all: promisify(sqliteDb.all).bind(sqliteDb),
        get: promisify(sqliteDb.get).bind(sqliteDb),
        run: promisify(sqliteDb.run).bind(sqliteDb)
    };

} else {
    throw new Error('DB_TYPE environment variable is not set or is not recognized');
}

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads'); // Directory to store uploaded images
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage });

// Helper function to execute a query (Promisified version)
const executeQuery = async (query, params = []) => {
    try {
        return await db.all(query, params);
    } catch (error) {
        throw new Error('Database error: ' + error.message);
    }
};


// Home Route
router.get('/', async (req, res) => {
    try {
        // Define queries with dynamic category IDs for better flexibility
        const queries = {
            latestNews: `
                SELECT articles.*, categories.name AS category_name
                FROM articles
                LEFT JOIN categories ON articles.category_id = categories.id
                ORDER BY articles.published_at DESC
            `,
            topNews: `
                SELECT articles.*, categories.name AS category_name
                FROM articles
                LEFT JOIN categories ON articles.category_id = categories.id
                WHERE articles.category_id = 13
                ORDER BY articles.published_at DESC
            `,
            healthNews: `
                SELECT articles.*, categories.name AS category_name
                FROM articles
                LEFT JOIN categories ON articles.category_id = categories.id
                WHERE articles.category_id = 18
                ORDER BY articles.published_at DESC
            `,
            sportNews: `
                SELECT articles.*, categories.name AS category_name
                FROM articles
                LEFT JOIN categories ON articles.category_id = categories.id
                WHERE articles.category_id = 14
                ORDER BY articles.published_at DESC
            `,
            ecoNews: `
                SELECT articles.*, categories.name AS category_name
                FROM articles
                LEFT JOIN categories ON articles.category_id = categories.id
                WHERE articles.category_id = 19
                ORDER BY articles.published_at DESC
            `,
            frontNews: `SELECT DISTINCT articles.id, articles.*, categories.name AS category_name
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            WHERE articles.category_id = 12
            ORDER BY articles.published_at DESC;
            `
        };

        // Helper function to execute a query
        const executeQuery = (query) => {
            return new Promise((resolve, reject) => {
                db.all(query, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });
        };

        // Execute all queries concurrently using Promise.all
        const [latestNews, topNews, healthNews, sportNews, ecoNews, frontNews] = await Promise.all([
            executeQuery(queries.latestNews),
            executeQuery(queries.topNews),
            executeQuery(queries.healthNews),
            executeQuery(queries.sportNews),
            executeQuery(queries.ecoNews),
            executeQuery(queries.frontNews),
        ]);

        

        // Render the homepage with the retrieved news data
        res.render('index2', {
            latestNews,
            topNews,
            healthNews,
            sportNews,
            ecoNews,
            frontNews,
            title: 'Home | LibNewsCentral'
        });

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('An error occurred while retrieving the news.');
    }
});


// Coming Soon
router.get('/coming_soon', (req, res) => {
    
    res.render('coming_soon', {
        title: 'Coming Soon | LibNewsCentral'
    });
});


// Categories List Route with Pagination
router.get('/categories', (req, res) => {
    const perPage = 12; 
    const page = req.query.page ? parseInt(req.query.page) : 1;

    db.get('SELECT COUNT(*) AS count FROM categories', (err, result) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalCategories = result.count;
        const totalPages = Math.ceil(totalCategories / perPage);
        const offset = (page - 1) * perPage;

        db.all('SELECT * FROM categories LIMIT ? OFFSET ?', [perPage, offset], (err, categories) => {
            if (err) {
                return res.status(500).send('Database error');
            }
            res.render('categories', {
                categories,
                currentPage: page,
                totalPages: totalPages,
                title: 'Categories | LibNewsCentral'
            });
        });
    });
});

// List of articles in Category with Pagination
router.get('/category/:id', (req, res) => {
    const categoryId = req.params.id;
    const perPage = 12;
    const page = req.query.page ? parseInt(req.query.page) : 1;

    db.get('SELECT COUNT(*) as count FROM articles WHERE category_id = ?', [categoryId], (err, countResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalArticles = countResult.count;
        const totalPages = Math.ceil(totalArticles / perPage);
        const offset = (page - 1) * perPage;

        db.all('SELECT * FROM articles WHERE category_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?', [categoryId, perPage, offset], (err, articles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            db.get('SELECT name FROM categories WHERE id = ?', [categoryId], (err, category) => {
                if (err || !category) {
                    return res.status(404).send('Category not found');
                }

                res.render('category_articles', {
                    articles,
                    category,
                    currentPage: page,
                    totalPages: totalPages,
                    title: "Category-Article | LibNewsCentral"
                });
            });
        });
    });
});

// Article list view with Pagination
router.get('/articles', (req, res) => {
    const itemsPerPage = 12;
    const currentPage = parseInt(req.query.page) || 1;
    const offset = (currentPage - 1) * itemsPerPage;

    db.get('SELECT COUNT(*) AS count FROM articles', (err, countResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalItems = countResult.count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const query = `
            SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN comments ON articles.id = comments.article_id
            GROUP BY articles.id
            ORDER BY articles.published_at DESC
            LIMIT ? OFFSET ?
        `;

        db.all(query, [itemsPerPage, offset], (err, articles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            res.render('articles', {
                title: 'Articles',
                articles: articles,
                currentPage: currentPage,
                totalPages: totalPages,
                layout: 'layouts/base'
            });
        });
    });
});

// Article Details Route with Related Articles
router.get('/articles_details/:id', (req, res) => {
    const articleId = req.params.id;

    const articleQuery = `
        SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        LEFT JOIN comments ON articles.id = comments.article_id
        WHERE articles.id = ?
        GROUP BY articles.id
    `;

    const relatedArticlesQuery = `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = ? AND articles.id != ?
        ORDER BY articles.published_at DESC
        LIMIT 4
    `;

    db.get(articleQuery, [articleId], (err, article) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (!article) {
            return res.status(404).send('Article not found');
        }

        db.all(relatedArticlesQuery, [article.category_id, articleId], (err, relatedArticles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            res.render('articles_detail', {
                article: article,
                relatedArticles: relatedArticles,
                title: 'News Details | LibNewsCentral'
            });
        });
    });
});

// Global Search
router.get('/search', (req, res) => {
    const itemsPerPage = 12;
    const currentPage = parseInt(req.query.page) || 1;
    const offset = (currentPage - 1) * itemsPerPage;

    const searchQuery = req.query.q || ''; // Retrieve the search query from the URL
    const searchTerms = `%${searchQuery}%`; // Prepare search terms for SQL LIKE operator

    // Prepare the base query with search filters
    const baseQuery = `
        SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        LEFT JOIN comments ON articles.id = comments.article_id
        WHERE articles.title LIKE ? OR articles.url LIKE ? OR categories.name LIKE ?
        GROUP BY articles.id
        ORDER BY articles.published_at DESC
        LIMIT ? OFFSET ?
    `;

    const countQuery = `
        SELECT COUNT(*) AS count
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.title LIKE ? OR articles.url LIKE ? OR categories.name LIKE ?
    `;

    // Count total items that match the search query
    db.get(countQuery, [searchTerms, searchTerms, searchTerms], (err, countResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalItems = countResult.count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Fetch matching articles
        db.all(baseQuery, [searchTerms, searchTerms, searchTerms, itemsPerPage, offset], (err, articles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            // Render the search results page
            res.render('search', {
                title: 'Search Results',
                articles: articles,
                currentPage: currentPage,
                totalPages: totalPages,
                layout: 'layouts/base',
                searchQuery: searchQuery // Pass search query for use in the template
            });
        });
    });
});

// #############################################
// ADMIN VIEWS & Route
// #############################################
// Admin Dashboard
router.get('/admin/dashboard', (req, res) => {
    const countQueryUsers = 'SELECT COUNT(*) AS count FROM users';
    const countQueryCategories = 'SELECT COUNT(*) AS count FROM categories WHERE deleted_at IS NULL';
    const countQueryArticles = 'SELECT COUNT(*) AS count FROM articles';

        // Execute all queries in parallel
    db.all(countQueryUsers, (err, usersResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        db.all(countQueryCategories, (err, categoriesResult) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            db.all(countQueryArticles, (err, articlesResult) => {
                if (err) {
                    return res.status(500).send('Database error');
                }

                // Extract counts from query results
                const totalUsers = usersResult[0].count;
                const totalCategories = categoriesResult[0].count;
                const totalArticles = articlesResult[0].count;

                // Render the admin dashboard view
                res.render('admin/dashboard', {
                    title: 'Dashboard | LibNewsCentral',
                    layout: 'admin/base',
                    totalUsers,
                    totalCategories,
                    totalArticles,
                });
            });
        });
    });
});


// Categories List for Admin
router.get('/admin/category_list', (req, res) => {
    db.all('SELECT * FROM categories WHERE deleted_at IS NULL', (err, categories) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        res.render('admin/category_list', {
            title: 'Category',
            categories: categories,
            layout: 'admin/base'
        });
    });
});


// Add Category Route
router.post('/add_category', upload.single('image_url'), (req, res) => {
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !image_url) {
        return res.status(400).send('All fields are required');
    }

    db.run('INSERT INTO categories (name, image_url) VALUES (?, ?)', [name, image_url], function (err) {
        if (err) {
            return res.status(500).send('Database error');
        }
        res.redirect('/admin/category_list');
    });
});

// Edit Category Route
router.post('/edit_category/:id', upload.single('image_url'), (req, res) => {
    const categoryId = req.params.id;
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    let query = 'UPDATE categories SET name = ?';
    let params = [name];

    if (image_url) {
        query += ', image_url = ?';
        params.push(image_url);
    }

    query += ' WHERE id = ?';
    params.push(categoryId);

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).send('Database error');
        }
        res.redirect('/admin/category_list');
    });
});


// Delete Category (Soft Delete)
router.get('/delete_category/:id', (req, res) => {
    const categoryId = req.params.id;

    db.get('SELECT COUNT(*) AS count FROM articles WHERE category_id = ?', [categoryId], (err, row) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (row.count > 0) {
            return res.status(400).send('Cannot delete category with associated articles');
        }

        db.run('UPDATE categories SET deleted_at = ? WHERE id = ?', [new Date(), categoryId], function (err) {
            if (err) {
                return res.status(500).send('Database error');
            }

            res.redirect('/admin/category_list?deleteSuccess=true');
        });
    });
});

// Admin Views (Users, Publishers, Articles List)
router.get('/admin/users', (req, res) => {
    res.render('admin/users', { title: 'Membership | LibNews Central', layout: 'admin/base' });
});

router.get('/admin/publishers', (req, res) => {
    res.render('admin/publishers', { title: 'Publisher | LibNews Central', layout: 'admin/base' });
});

router.get('/admin/articleslist', (req, res) => {
    res.render('admin/articleslist', { title: 'Articles | LibNews Central', layout: 'admin/base' });
});

// Edit article:
// Edit article Route
router.post('/edit_article/:id', upload.single('image_url'), (req, res) => {
    const articleId = req.params.id;
    const { title, content, category_id, source } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Base update query
    let query = 'UPDATE articles SET title = ?, content = ?, category_id = ?, source = ?';
    let params = [title, content, category_id, source];

    // If a new image is uploaded, include image URL in the update
    if (image_url) {
        query += ', image_url = ?';
        params.push(image_url);
    }

    // Complete the query by adding the WHERE clause
    query += ' WHERE id = ?';
    params.push(articleId);

    // Run the query to update the article
    db.run(query, params, function (err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('An error occurred while updating the article.');
        }
        res.redirect('/admin/articleslist');
    });
});

// Hard Delete Article
// In routes/articles.js or the appropriate router file

// Hard Delete Article by ID
router.get('/delete_article/:id', (req, res) => {
    const articleId = req.params.id;

    // Check if the article exists
    db.get('SELECT id FROM articles WHERE id = ?', [articleId], (err, article) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (!article) {
            return res.status(404).send('Article not found');
        }

        // Hard delete the article from the database
        db.run('DELETE FROM articles WHERE id = ?', [articleId], function (err) {
            if (err) {
                return res.status(500).send('Database error');
            }

            // Redirect to article list after deletion
            res.redirect('/admin/articleslist?deleteSuccess=true');
        });
    });
});





// #######################################
// URL ROUTE ENDS
// #######################################

// Export the router
module.exports = router;

