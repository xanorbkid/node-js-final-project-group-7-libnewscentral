const express = require('express');
const { Pool } = require('pg'); // Using PostgreSQL with connection pooling
const router = express.Router();
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;  // Cloudinary SDK


// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});



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
      if (env === 'production') {
        cb(null, '/tmp');  // Temporary directory for Cloudinary uploads
      } else {
        cb(null, 'public/uploads'); // Local directory in development
      }
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
  });
  const upload = multer({ storage: storage });
  
  // Helper function to upload image to Cloudinary in production or save locally in development
  async function saveImage(imagePath) {
      try {
          if (env === 'production') {
              // Upload image to Cloudinary in production
              const result = await cloudinary.uploader.upload(imagePath, {
                  folder: 'scraped_images',
              });
              return result.secure_url;  // Return Cloudinary image URL
          } else {
              // Image is already saved locally by multer in development
              return `/uploads/${path.basename(imagePath)}`;  // Return local image URL
          }
      } catch (error) {
          console.error('Failed to save image:', imagePath, error.message);
      }
  }


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
      majorNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 1
        ORDER BY articles.published_at DESC
      `,
      sportNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 20
        ORDER BY articles.published_at DESC
      `,
      ecoNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 8
        ORDER BY articles.published_at DESC
      `,
    //   Business News
      businessNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 14
        ORDER BY articles.published_at DESC
      `,

    //   FRONTNEWS Query
      frontNewsQuery: `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = 2
        ORDER BY articles.published_at DESC
        LIMIT 4
      `,

      //   FRONTNEWS Query
      HealthNewsQuery: `
      SELECT articles.*, categories.name AS category_name
      FROM articles
      LEFT JOIN categories ON articles.category_id = categories.id
      WHERE articles.category_id = 2
      ORDER BY articles.published_at DESC
      LIMIT 4
    `,
    };

 
    

    // Execute queries using the pool
    const latestNews = await pool.query(latestNewsQuery);
    const topNews = await pool.query(queries.topNewsQuery);
    const majorNews = await pool.query(queries.majorNewsQuery);
    const sportNews = await pool.query(queries.sportNewsQuery);
    const ecoNews = await pool.query(queries.ecoNewsQuery);
    const frontNews = await pool.query(queries.frontNewsQuery);
    const businessNews = await pool.query(queries.businessNewsQuery)
    const healthNews = await pool.query(queries.HealthNewsQuery)

    // Render the homepage with the latest and top news articles
    res.render('index2', {
      latestNews: latestNews.rows,
      topNews: topNews.rows,
      healthNews: healthNews.rows,
      majorNews: majorNews.rows,
      sportNews: sportNews.rows,
      ecoNews: ecoNews.rows,
      frontNews: frontNews.rows,
      businessNews: businessNews.rows,
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

router.get('/page_terms', async(req, res) =>{

    res.render('page-terms', {
    title: 'Terns of Use | LibNewsCentral'
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
        const itemsPerPage = 16;
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
        // Fetch the article details
        const articleQuery = `
            SELECT 
                articles.id, 
                articles.title, 
                articles.content, 
                articles.image_url, 
                articles.source, 
                articles.summary, 
                articles.keywords, 
                articles.url, 
                articles.published_at, 
                categories.name AS category_name, 
                categories.id AS category_id, 
                COUNT(comments.id) AS comment_count
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN comments ON articles.id = comments.article_id
            WHERE articles.id = $1
            GROUP BY articles.id, categories.name, categories.id
        `;
        const articleResult = await pool.query(articleQuery, [articleId]);
        const article = articleResult.rows[0];

        // If no article found, return 404
        if (!article) {
            return res.status(404).send('Article not found');
        }

        // Fetch related articles from the same category, excluding the current article
        const relatedArticlesQuery = `
            SELECT 
                id, 
                title, 
                image_url, 
                summary, 
                source,
                published_at 
            FROM articles
            WHERE category_id = $1
            AND id != $2
            ORDER BY published_at DESC
            LIMIT 4
        `;
        const relatedArticlesResult = await pool.query(relatedArticlesQuery, [article.category_id, articleId]);

        // Render the article details and related articles
        res.render('articles_detail', {
            article,
            relatedArticles: relatedArticlesResult.rows,  // Pass the related articles to the template
            title: `News Details | LibNewsCentral`
        });
    } catch (error) {
        console.error('Database error:', error.message); // Log the error for debugging
        res.status(500).send('Internal server error');
    }
});



// Article Details Route with Related Articles By Vector
// Article Details Route with Related Articles
// router.get('/articles_details/:id', async (req, res) => {
//     const articleId = req.params.id;

//     try {
//         // Fetch article details including comments count and associated category
//         const articleQuery = `
//             SELECT 
//                 articles.id, 
//                 articles.title, 
//                 articles.content, 
//                 articles.image_url, 
//                 articles.source, 
//                 articles.summary,
//                 articles.keywords,
//                 articles.vectors,  -- The vectors field from the embedding model
//                 articles.url, 
//                 articles.published_at, 
//                 categories.name AS category_name, 
//                 COUNT(comments.id) AS comment_count
//             FROM articles
//             LEFT JOIN categories ON articles.category_id = categories.id
//             LEFT JOIN comments ON articles.id = comments.article_id
//             WHERE articles.id = $1
//             GROUP BY articles.id, categories.name
//         `;
        
//         const articleResult = await pool.query(articleQuery, [articleId]);
//         const article = articleResult.rows[0];

//         // Return 404 if the article does not exist
//         if (!article) {
//             console.warn(`Article with ID ${articleId} not found`);
//             return res.status(404).send('Article not found');
//         }

//         // Fetch related articles using vector similarity based on vectors
//         const vectors = article.vectors;  // This is assumed to be stored as jsonb

//         if (!vectors || vectors.length === 0) {
//             console.warn(`No vectors available for article ID ${articleId}`);
//             return res.status(400).send('Vectors not available for this article');
//         }

//         const relatedArticlesQuery = `
//             SELECT 
//                 a.id, 
//                 a.title, 
//                 a.url, 
//                 a.published_at, 
//                 a.image_url, 
//                 a.summary, 
//                 c.name AS category_name,
//                 1 - (
//                     SELECT SUM(x * y)
//                     FROM unnest(ARRAY(
//                         SELECT value::float8 
//                         FROM jsonb_array_elements(a.vectors)
//                     )) AS x,
//                     unnest(ARRAY(
//                         SELECT value::float8 
//                         FROM jsonb_array_elements($1::jsonb)
//                     )) AS y
//                 ) AS similarity_score
//             FROM articles a
//             LEFT JOIN categories c ON a.category_id = c.id
//             WHERE a.id != $2
//             ORDER BY similarity_score DESC
//             LIMIT 4;
//         `;

//         // Execute related articles query
//         const relatedArticlesResult = await pool.query(relatedArticlesQuery, [vectors, articleId]);

//         // Render the article details and related articles
//         res.render('articles_detail', {
//             article,
//             relatedArticles: relatedArticlesResult.rows,
//             title: `News Details | LibNewsCentral`
//         });
//     } catch (error) {
//         // Log error details for debugging
//         console.error(`Error fetching article details for ID ${articleId}:`, error.message);
//         console.error('Full error object:', error);
//         res.status(500).send('Internal server error');
//     }
// });




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
    const imageFile = req.file;

    if (!name || !imageFile) {
        return res.status(400).send('All fields are required');
    }

    try {
        const imageUrl = await saveImage(imageFile.path);
        await pool.query('INSERT INTO categories (name, image_url) VALUES ($1, $2)', [name, imageUrl]);
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
    const imageFile = req.file;

    try {
        let imageUrl = null;
        if (imageFile) {
            // If a new image is uploaded, save it
            imageUrl = await saveImage(imageFile.path);
        }

        // Update the category with the new image (if any) or retain the old one
        await pool.query(
            `UPDATE categories 
             SET name = $1, 
                 image_url = COALESCE($2, image_url) 
             WHERE id = $3`,
            [name, imageUrl, categoryId]
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




// Edit Article Route with file upload handling
router.post('/edit_article/:id', upload.single('image_url'), async (req, res) => {
    const articleId = req.params.id;
    const { title, content, category_id, source, summary, keywords, url } = req.body; // Include all fields from the form
    const imageFile = req.file; // Handle image file upload

    try {
        let imageUrl = null;

        // Conditionally handle image upload, save only if a new image is uploaded
        if (imageFile) {
            imageUrl = await saveImage(imageFile.path);  // Assuming saveImage is a function that stores the image and returns its URL
        }

        // Build the update query with placeholders
        const query = `
            UPDATE articles
            SET title = $1, 
                content = $2, 
                category_id = $3, 
                source = $4, 
                summary = $5, 
                keywords = $6, 
                url = $7,
                image_url = COALESCE($8, image_url)  -- Update image only if a new one is provided
            WHERE id = $9
        `;

        // Define the parameters array
        const params = [
            title, content, category_id, source, summary, keywords, url, imageUrl, articleId
        ];

        // Execute the query to update the article
        await pool.query(query, params);

        // Redirect to the articles list after successful update
        res.redirect('/admin/articleslist');
    } catch (error) {
        console.error('Database error:', error.message);  // Log the error for debugging
        res.status(500).send('An error occurred while updating the article.');  // Respond with a generic error message
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

