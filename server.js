// app.js
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();
const db = new sqlite3.Database('./newscentral.db');


// SCRIPT NEWS FUNCTION
const scraper = require('./scraper');

// Scrape data when the server starts
scraper.scrapeFrontPageAfrica();

// Manual scraping route (optional)
// app.get('/admin/scrape', (req, res) => {
//     scraper.scrapeFrontPageAfrica();
//     res.send('Scraping started');
// });







// ################################################
// Middleware
// ###############################################

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.set('view engine', 'ejs');

// Use express-ejs-layouts
app.use(expressLayouts);
// Specify the default layout
app.set('layout', 'layouts/base'); // Points to views/layouts/base.ejs

// Set the directory where views will be stored
app.set('views' , __dirname + '/views', 'admin');

// 
// Handle File Upload
// 

const multer = require('multer');
const path = require('path');
const { title } = require('process');

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


// 
// Middleware to fetch categories and make them available in all templates
app.use((req, res, next) => {
    db.all('SELECT * FROM categories WHERE deleted_at IS NULL', (err, categories) => {
        if (err) {
            return next(err); // Pass the error to the error handler
        }

        // Limit the categories to the first 5
        const topCategories = categories.slice(0, 6);

        // Make categories available in all views via res.locals
        res.locals.topCategories = topCategories;
        res.locals.categories = categories;
        next();
    });
});


// ################################################
// END Middleware
// ###############################################


// Session management
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
}));

// ######################################
// URL ROUTES
// ######################################

// Home Route
app.get('/', (req, res) => {
    db.all('SELECT * FROM articles ORDER BY published_at DESC', (err, articles) => {
        if (err) {
            return res.status(500).send('Database error');
        }
        // Pass the 'title' variable along with the articles data
        res.render('index', { articles, title: 'Home | LibNewsCentral' });
    });
});



// Categories List Route with Pagination
app.get('/categories', (req, res) => {
    const perPage = 6; // Number of categories per page
    const page = req.query.page ? parseInt(req.query.page) : 1; // Current page number, default to 1

    // Fetch the total count of categories to calculate the total number of pages
    db.get('SELECT COUNT(*) AS count FROM categories', (err, result) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalCategories = result.count;
        const totalPages = Math.ceil(totalCategories / perPage);
        const offset = (page - 1) * perPage;

        // Fetch categories for the current page with LIMIT and OFFSET
        db.all('SELECT * FROM categories LIMIT ? OFFSET ?', [perPage, offset], (err, categories) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            // Render the categories page with pagination data
            res.render('categories', {
                categories,
                currentPage: page,
                totalPages: totalPages,
                title: 'Categories | LibNewsCentral'
            });
        });
    });
});


// Category Detail Route with Pagination
app.get('/category/:id', (req, res) => {
    const categoryId = req.params.id;
    const perPage = 9; // Number of articles per page
    const page = req.query.page ? parseInt(req.query.page) : 1;

    // Fetch the total number of articles for pagination
    db.get('SELECT COUNT(*) as count FROM articles WHERE category_id = ?', [categoryId], (err, countResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalArticles = countResult.count;
        const totalPages = Math.ceil(totalArticles / perPage);

        // Fetch articles for the selected category with pagination
        const offset = (page - 1) * perPage;
        db.all('SELECT * FROM articles WHERE category_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?', [categoryId, perPage, offset], (err, articles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            // Fetch the category name as well
            db.get('SELECT name FROM categories WHERE id = ?', [categoryId], (err, category) => {
                if (err || !category) {
                    return res.status(404).send('Category not found');
                }

                // Render the view and pass the category, articles, pagination details
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





// Article list view with pagination
app.get('/articles', (req, res) => {
    const itemsPerPage = 12; // Set how many articles per page
    const currentPage = parseInt(req.query.page) || 1; // Get current page from query, default to 1
    const offset = (currentPage - 1) * itemsPerPage;

    // Get total count of articles for pagination
    const countQuery = 'SELECT COUNT(*) AS count FROM articles';

    db.get(countQuery, (err, countResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalItems = countResult.count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Get articles with pagination
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

            // Pass data to the template
            res.render('articles', {
                title: 'Articles',
                articles: articles, // Pass the articles with category and comment count
                currentPage: currentPage,
                totalPages: totalPages,
                layout: 'layouts/base'
            });
        });
    });
});


// Article Detail Route
app.get('/articles_details/:id', (req, res) => {
    const articleId = req.params.id;

    const query = `
        SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        LEFT JOIN comments ON articles.id = comments.article_id
        WHERE articles.id = ?
        GROUP BY articles.id
    `;

    db.get(query, [articleId], (err, article) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (!article) {
            return res.status(404).send('Article not found');
        }

        // Render the articles_detail template and pass the article data
        res.render('articles_detail', {
            article: article,
            title: 'News Details | LibNewsCentral'
        });
    });
});





// #############################################
// ADMIN VIEWS
// #############################################
app.get('/admin/dashboard', (req, res) => {
    res.render('admin/dashboard', { title: 'Dashboard', layout: 'admin/base'  });
});


// LIST
app.get('/admin/category_list', (req, res) => {
    // Fetch all categories from the database
    db.all('SELECT * FROM categories WHERE deleted_at IS NULL', (err, categories) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        // Render the category_list template and pass the categories data
        res.render('admin/category_list', { 
            title: 'Category', 
            categories: categories,  // Pass the categories to the view
            layout: 'admin/base' 
        });
    });
});


// Add Categories
// Handle Add Category Form Submission with file upload
app.post('/add_category', upload.single('image_url'), (req, res) => {
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !image_url) {
        return res.status(400).send('All fields are required');
    }

    db.run('INSERT INTO categories (name, image_url) VALUES (?, ?)', [name, image_url], function(err) {
        if (err) {
            return res.status(500).send('Database error');
        }

        // Redirect to categories list after successful addition
        res.redirect('/admin/category_list');
    });
});


// Edit Categories
// Handle Edit Category Form Submission with file upload
app.post('/edit_category/:id', upload.single('image_url'), (req, res) => {
    const categoryId = req.params.id;
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    // If a new image is uploaded, update the image_url field
    let query = 'UPDATE categories SET name = ?';
    let params = [name];

    if (image_url) {
        query += ', image_url = ?';
        params.push(image_url);
    }

    query += ' WHERE id = ?';
    params.push(categoryId);

    db.run(query, params, function(err) {
        if (err) {
            return res.status(500).send('Database error');
        }
        
        // Redirect to the category list page after successful update
        res.redirect('/admin/category_list');
    });
});



// After successful soft delete, pass a success message flag to the category list view
app.get('/delete_category/:id', (req, res) => {
    const categoryId = req.params.id;

    db.get('SELECT COUNT(*) AS count FROM articles WHERE category_id = ?', [categoryId], (err, row) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (row.count > 0) {
            return res.status(400).send('Cannot delete category with associated articles');
        }

        db.run('UPDATE categories SET deleted_at = ? WHERE id = ?', [new Date(), categoryId], function(err) {
            if (err) {
                return res.status(500).send('Database error');
            }

            // After successful delete, redirect and pass success flag
            res.redirect('/admin/category_list?deleteSuccess=true');
        });
    });
});




app.get('/admin/users', (req, res) => {
    res.render('admin/users', { title: 'Membership | LibNews Central', layout: 'admin/base'  });
});

app.get('/admin/publishers', (req, res) => {
    res.render('admin/publishers', { title: 'Publisher | LibNews Central', layout: 'admin/base'  });
});

app.get('/admin/articleslist', (req, res) => {
    res.render('admin/articleslist', { title: 'Articles | LibNews Central', layout: 'admin/base'  });
});

















// #######################################
// URL ROUTE ENDS
// #######################################

// Start server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
