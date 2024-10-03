const express = require('express');
const { Pool } = require('pg'); // Using PostgreSQL with connection pooling
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Create a pool of connections based on environment variables (development/production)
// Environment-based database configuration
const env = process.env.NODE_ENV || 'development'; // Use environment variables
let dbConfig;

if (env === 'production') {
    dbConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    };
} else {
    dbConfig = {
        user: process.env.DB_USER || 'bronax',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'newscentral',
        password: process.env.DB_PASSWORD || 'ilovecoding',
        port: process.env.DB_PORT || 5432,
    };
}

// Set up PostgreSQL pool configuration
const pool = new Pool(dbConfig);

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

// Home Route
router.get('/', async (req, res) => {
  try {
    // Query for latest articles of the day
    const latestNewsQuery = `
      SELECT articles.*, categories.name AS category_name
      FROM articles
      LEFT JOIN categories ON articles.category_id = categories.id
      ORDER BY articles.published_at DESC
    `;

    // Other queries for top, health, sport, economy, and front news
    const queries = {
      topNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 1
        ORDER BY articles.published_at DESC
      `,
      healthNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 7
        ORDER BY articles.published_at DESC
      `,
      sportNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 3
        ORDER BY articles.published_at DESC
      `,
      ecoNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 8
        ORDER BY articles.published_at DESC
      `,
      frontNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 2
        ORDER BY articles.published_at DESC
      `,
    };

    // Execute queries using the pool
    const latestNews = await pool.query(latestNewsQuery);
    const topNews = await pool.query(queries.topNewsQuery);
    const healthNews = await pool.query(queries.healthNewsQuery);
    const sportNews = await pool.query(queries.sportNewsQuery);
    const ecoNews = await pool.query(queries.ecoNewsQuery);
    const frontNews = await pool.query(queries.frontNewsQuery);

    // Render the homepage with the latest and top news articles
    res.render('index2', {
      latestNews: latestNews.rows,
      topNews: topNews.rows,
      healthNews: healthNews.rows,
      sportNews: sportNews.rows,
      ecoNews: ecoNews.rows,
      frontNews: frontNews.rows,
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
    const countResult = await pool.query('SELECT COUNT(*) AS count FROM categories');
    const totalCategories = countResult.rows[0].count;
    const totalPages = Math.ceil(totalCategories / perPage);
    const offset = (page - 1) * perPage;

    const categories = await pool.query('SELECT * FROM categories LIMIT $1 OFFSET $2', [perPage, offset]);

    res.render('categories', {
      categories: categories.rows,
      currentPage: page,
      totalPages: totalPages,
      title: 'Categories | LibNewsCentral'
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).send('An error occurred while retrieving the categories.');
  }
});

router.get('/coming_soon', async(req, res) =>{

    res.render('coming_soon', {
    title: 'Coming soon | LibNewsCentral'
    });
});

// List of articles in Category with Pagination
router.get('/category/:id', async (req, res) => {
    const categoryId = req.params.id;
    const perPage = 12;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const offset = (page - 1) * perPage;

    try {
        const countResult = await pool.query('SELECT COUNT(*) AS count FROM articles WHERE category_id = $1', [categoryId]);
        const totalArticles = countResult.rows[0].count;
        const totalPages = Math.ceil(totalArticles / perPage);

        const articles = await pool.query('SELECT * FROM articles WHERE category_id = $1 ORDER BY published_at DESC LIMIT $2 OFFSET $3', [categoryId, perPage, offset]);

        const categoryResult = await pool.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
        const category = categoryResult.rows[0];

        if (!category) {
            return res.status(404).send('Category not found');
        }

        res.render('category_articles', {
            articles: articles.rows,
            category,
            currentPage: page,
            totalPages: totalPages,
            title: "Category-Article | LibNewsCentral"
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('An error occurred while retrieving the category articles.');
    }
});

// Article list view with Pagination
router.get('/articles', async (req, res) => {
    try {
        const itemsPerPage = 12;
        const currentPage = parseInt(req.query.page) || 1;
        const offset = (currentPage - 1) * itemsPerPage;

        const countResult = await pool.query('SELECT COUNT(*) AS count FROM articles');
        const totalItems = countResult.rows[0].count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const articles = await pool.query(`
            SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN comments ON articles.id = comments.article_id
            GROUP BY articles.id, categories.name
            ORDER BY articles.published_at DESC
            LIMIT $1 OFFSET $2
        `, [itemsPerPage, offset]);

        res.render('articles', {
            title: 'Articles',
            articles: articles.rows,
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
        // Fetch article details including the article URL
        const articleResult = await pool.query(`
            SELECT 
                articles.id, 
                articles.title, 
                articles.content, 
                articles.image_url,
                articles.source,
                articles.url,  -- Ensure that the URL field is selected
                articles.published_at, 
                categories.name AS category_name, 
                COUNT(comments.id) AS comment_count
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN comments ON articles.id = comments.article_id
            WHERE articles.id = $1
            GROUP BY articles.id, categories.name
        `, [articleId]);

        const article = articleResult.rows[0];

        if (!article) {
            return res.status(404).send('Article not found');
        }

        // Fetch related articles and include the article URL
        const relatedArticlesResult = await pool.query(`
            SELECT 
                articles.id, 
                articles.title, 
                articles.url,  -- Ensure that the URL field is selected
                articles.published_at, 
                categories.name AS category_name
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            WHERE articles.category_id = $1 AND articles.id != $2
            ORDER BY articles.published_at DESC
            LIMIT 4
        `, [article.category_id, articleId]);

        res.render('articles_detail', {
            article,
            relatedArticles: relatedArticlesResult.rows,
            title: 'News Details | LibNewsCentral'
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});


// Global Search
router.get('/search', async (req, res) => {
    const itemsPerPage = 12;
    const searchTerm = req.query.q || '';
    const currentPage = parseInt(req.query.page) || 1;
    const offset = (currentPage - 1) * itemsPerPage;

    try {
        const countResult = await pool.query(`
            SELECT COUNT(*) AS count 
            FROM articles 
            WHERE title ILIKE $1 OR content ILIKE $2
        `, [`%${searchTerm}%`, `%${searchTerm}%`]);

        const totalItems = countResult.rows[0].count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const searchResults = await pool.query(`
            SELECT articles.*, categories.name AS category_name 
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            WHERE articles.title ILIKE $1 OR articles.content ILIKE $2
            LIMIT $3 OFFSET $4
        `, [`%${searchTerm}%`, `%${searchTerm}%`, itemsPerPage, offset]);

        res.render('search_results', {
            title: 'Search Results',
            searchResults: searchResults.rows,
            totalItems,
            totalPages,
            searchTerm,
            currentPage
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).send('Database error');
    }
});

// Handle contact form submissions
router.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;
    
    try {
        await pool.query(
            'INSERT INTO contact (name, email, message) VALUES ($1, $2, $3)',
            [name, email, message]
        );

        res.redirect('/contact?success=true');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

module.exports = router;




// #############################################
// ADMIN VIEWS & Route
// #############################################
// Admin Dashboard
router.get('/admin/dashboard', async (req, res) => {
    const countQueryUsers = 'SELECT COUNT(*) AS count FROM users';
    const countQueryCategories = 'SELECT COUNT(*) AS count FROM categories WHERE deleted_at IS NULL';
    const countQueryArticles = 'SELECT COUNT(*) AS count FROM articles';

    try {
        // Execute all queries in parallel
        const [usersResult, categoriesResult, articlesResult] = await Promise.all([
            pool.query(countQueryUsers),
            pool.query(countQueryCategories),
            pool.query(countQueryArticles)
        ]);

        // Extract counts from query results
        const totalUsers = usersResult.rows[0].count;
        const totalCategories = categoriesResult.rows[0].count;
        const totalArticles = articlesResult.rows[0].count;

        // Render the admin dashboard view
        res.render('admin/dashboard', {
            title: 'Dashboard | LibNewsCentral',
            layout: 'admin/base',
            totalUsers,
            totalCategories,
            totalArticles,
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

// Categories List for Admin
router.get('/admin/category_list', async (req, res) => {
    try {
        const categories = await pool.query('SELECT * FROM categories WHERE deleted_at IS NULL');
        res.render('admin/category_list', {
            title: 'Category',
            categories: categories.rows,
            layout: 'admin/base'
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

// Add Category Route
router.post('/add_category', upload.single('image_url'), async (req, res) => {
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !image_url) {
        return res.status(400).send('All fields are required');
    }

    try {
        await pool.query('INSERT INTO categories (name, image_url) VALUES ($1, $2)', [name, image_url]);
        res.redirect('/admin/category_list');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

// Edit Category Route
router.post('/edit_category/:id', upload.single('image_url'), async (req, res) => {
    const categoryId = req.params.id;
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        await pool.query(
            `UPDATE categories 
             SET name = $1, 
                 image_url = COALESCE($2, image_url) 
             WHERE id = $3`,
            [name, image_url, categoryId]
        );
        res.redirect('/admin/category_list');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});


// Delete Category (Soft Delete)
router.get('/delete_category/:id', async (req, res) => {
    const categoryId = req.params.id;

    try {
        const articleCount = await pool.query('SELECT COUNT(*) AS count FROM articles WHERE category_id = $1', [categoryId]);

        if (articleCount.rows[0].count > 0) {
            return res.status(400).send('Cannot delete category with associated articles');
        }

        await pool.query('UPDATE categories SET deleted_at = $1 WHERE id = $2', [new Date(), categoryId]);
        res.redirect('/admin/category_list?deleteSuccess=true');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

// Admin Views (Users, Publishers, Articles List)
router.get('/admin/users', async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        res.render('admin/users', { title: 'Membership | LibNews Central', layout: 'admin/base', users: users.rows });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

router.get('/admin/publishers', async (req, res) => {
    try {
        const publishers = await pool.query('SELECT * FROM publishers');
        res.render('admin/publishers', { title: 'Publishers | LibNews Central', layout: 'admin/base', publishers: publishers.rows });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

router.get('/admin/articleslist', async (req, res) => {
    try {
        const articles = await pool.query('SELECT articles.*, categories.name AS category_name FROM articles LEFT JOIN categories ON articles.category_id = categories.id');
        res.render('admin/articleslist', { title: 'Articles | LibNews Central', layout: 'admin/base', articles: articles.rows });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});

router.post('/edit_article/:id', upload.single('image_url'), async (req, res) => {
    const articleId = req.params.id;
    const { title, content, category_id, source } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    let query = 'UPDATE articles SET title = $1, content = $2, category_id = $3, source = $4';
    let params = [title, content, category_id, source];

    if (image_url) {
        query += ', image_url = $5';
        params.push(image_url);
        query += ' WHERE id = $6';
        params.push(articleId);
    } else {
        query += ' WHERE id = $5';
        params.push(articleId);
    }

    try {
        await pool.query(query, params);
        res.redirect('/admin/articleslist');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('An error occurred while updating the article.');
    }
});

// Hard Delete Article
router.get('/delete_article/:id', async (req, res) => {
    const articleId = req.params.id;

    try {
        const article = await pool.query('SELECT id FROM articles WHERE id = $1', [articleId]);

        if (!article.rows.length) {
            return res.status(404).send('Article not found');
        }

        await pool.query('DELETE FROM articles WHERE id = $1', [articleId]);
        res.redirect('/admin/articleslist?deleteSuccess=true');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Database error');
    }
});





// #######################################
// URL ROUTE ENDS
// #######################################

// Export the router
module.exports = router;

