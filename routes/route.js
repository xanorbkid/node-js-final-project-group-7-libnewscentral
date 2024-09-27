// urlroute.js
require('dotenv').config();


const { Pool } = require('pg'); // PostgreSQL module
const sqlite3 = require('sqlite3').verbose(); // SQLite module
const multer = require('multer');
const path = require('path');
const express = require('express');
const router = express.Router();

let db;

// PostgreSQL connection setup
if (process.env.DB_TYPE === 'postgres') {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Use SSL if required by your host
        max: 10, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 20000, // Wait for 20 seconds to establish a connection
    });

    // Promisified Database Query Executor
    db = {
        all: async (query, params = []) => {
            try {
                const start = Date.now();
                const res = await pool.query(query, params);
                console.log(`all() Query Time: ${Date.now() - start}ms`);
                return res.rows;
            } catch (err) {
                console.error('all() Error:', err);
                throw err;
            }
        },
        get: async (query, params = []) => {
            try {
                const start = Date.now();
                const res = await pool.query(query, params);
                console.log(`get() Query Time: ${Date.now() - start}ms`);
                return res.rows[0];
            } catch (err) {
                console.error('get() Error:', err);
                throw err;
            }
        },
        run: async (query, params = []) => {
            try {
                const start = Date.now();
                const res = await pool.query(query, params);
                console.log(`run() Query Time: ${Date.now() - start}ms`);
                return { lastID: res.insertId, changes: res.rowCount };
            } catch (err) {
                console.error('run() Error:', err);
                throw err;
            }
        }
    };

    console.log('Connected to PostgreSQL database');
    
} else if (process.env.DB_TYPE === 'sqlite') {
    const databasePath = process.env.DATABASE_PATH || './database.db';

    db = new sqlite3.Database(databasePath, (err) => {
        if (err) {
            console.error('Error opening SQLite database:', err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    });

    // Promisified Database Query Executor for SQLite
    db.allAsync = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    db.getAsync = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };
} else {
    throw new Error('DB_TYPE environment variable is not set or not recognized');
}

// Updated executeQuery for handling LIMIT and OFFSET in PostgreSQL
const executeQuery = async (query, params = [], limit, offset) => {
    if (process.env.DB_TYPE === 'postgres' && limit !== undefined && offset !== undefined) {
        // Directly insert LIMIT and OFFSET values into the query for PostgreSQL
        query = query.replace('LIMIT ? OFFSET ?', `LIMIT ${limit} OFFSET ${offset}`);
        return db.all(query, params);
    } else {
        // Use parameterized queries for SQLite or other cases
        return db.allAsync ? db.allAsync(query, params) : db.all(query, params);
    }
};



// ########################
// Multer Configuration
// ########################
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads'); // Directory to store uploaded images
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage });

// ########################
// ROUTES
// ########################

// Home Route
router.get('/', async (req, res) => {
    try {
        const queries = {
            latestNews: `SELECT articles.*, categories.name AS category_name FROM articles LEFT JOIN categories ON articles.category_id = categories.id ORDER BY articles.published_at DESC`,
            topNews: `SELECT articles.*, categories.name AS category_name FROM articles LEFT JOIN categories ON articles.category_id = categories.id WHERE articles.category_id = 13 ORDER BY articles.published_at DESC`,
            healthNews: `SELECT articles.*, categories.name AS category_name FROM articles LEFT JOIN categories ON articles.category_id = categories.id WHERE articles.category_id = 18 ORDER BY articles.published_at DESC`,
            sportNews: `SELECT articles.*, categories.name AS category_name FROM articles LEFT JOIN categories ON articles.category_id = categories.id WHERE articles.category_id = 14 ORDER BY articles.published_at DESC`,
            ecoNews: `SELECT articles.*, categories.name AS category_name FROM articles LEFT JOIN categories ON articles.category_id = categories.id WHERE articles.category_id = 19 ORDER BY articles.published_at DESC`,
            frontNews: `SELECT DISTINCT articles.id, articles.*, categories.name AS category_name FROM articles LEFT JOIN categories ON articles.category_id = categories.id WHERE articles.category_id = 12 ORDER BY articles.published_at DESC`
        };

        const [latestNews, topNews, healthNews, sportNews, ecoNews, frontNews] = await Promise.all([
            executeQuery(queries.latestNews),
            executeQuery(queries.topNews),
            executeQuery(queries.healthNews),
            executeQuery(queries.sportNews),
            executeQuery(queries.ecoNews),
            executeQuery(queries.frontNews),
        ]);

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

// Categories List Route with Pagination
router.get('/categories', async (req, res) => {
    const perPage = 12; 
    const page = req.query.page ? parseInt(req.query.page) : 1;

    try {
        const countResult = await executeQuery('SELECT COUNT(*) AS count FROM categories');
        const totalCategories = countResult[0].count;
        const totalPages = Math.ceil(totalCategories / perPage);
        const offset = (page - 1) * perPage;

        const categories = await executeQuery(
            'SELECT * FROM categories LIMIT ? OFFSET ?', 
            [], perPage, offset // pass limit and offset for PostgreSQL handling
        );

        res.render('categories', {
            categories,
            currentPage: page,
            totalPages: totalPages,
            title: 'Categories | LibNewsCentral'
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

// List of articles in Category with Pagination
router.get('/category/:id', async (req, res) => {
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
router.get('/articles', async (req, res) => {
    try {
        const itemsPerPage = 12;
        const currentPage = parseInt(req.query.page) || 1;
        const offset = (currentPage - 1) * itemsPerPage;

        const countResult = await executeQuery('SELECT COUNT(*) AS count FROM articles');
        const totalItems = countResult[0].count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const articles = await executeQuery(`
            SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN comments ON articles.id = comments.article_id
            GROUP BY articles.id, categories.name
            ORDER BY articles.published_at DESC
            LIMIT ? OFFSET ?`, 
            [], itemsPerPage, offset // pass limit and offset for PostgreSQL handling
        );
        

        res.render('articles', {
            title: 'Articles',
            articles,
            currentPage,
            totalPages,
            layout: 'layouts/base'
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).send('Database error');
    }
});


// Article Details Route with Related Articles
router.get('/articles_details/:id', async (req, res) => {
    const articleId = req.params.id;

    try {
        const article = await executeQuery(`
            SELECT 
                articles.id, 
                articles.title, 
                articles.content, 
                articles.published_at, 
                categories.name AS category_name, 
                COUNT(comments.id) AS comment_count
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN comments ON articles.id = comments.article_id
            WHERE articles.id = ?
            GROUP BY articles.id, categories.name
        `, [articleId]);

        if (!article.length) {
            return res.status(404).send('Article not found');
        }

        const relatedArticles = await executeQuery(`
            SELECT articles.id, articles.title, articles.published_at, categories.name AS category_name
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            WHERE articles.category_id = ? AND articles.id != ?
            ORDER BY articles.published_at DESC
            LIMIT 4
        `, [article[0].category_id, articleId]);

        res.render('articles_detail', {
            article: article[0],
            relatedArticles: relatedArticles,
            title: 'News Details | LibNewsCentral'
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
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

