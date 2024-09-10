// app.js
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();
const db = new sqlite3.Database('./newscentral.db');

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
app.set('views', __dirname + '/views');


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

// Categories List Route
app.get('/categories', (req, res) => {
    db.all('SELECT * FROM categories', (err, categories) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        res.render('categories', { categories, title: 'Categories | LibNewsCentral' });
    });
});


// Category Detail Route

app.get('/category/:id', (req, res) => {
    const categoryId = req.params.id;

    db.all('SELECT * FROM articles WHERE category_id = ? ORDER BY published_at DESC', [categoryId], (err, articles) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        // Fetch the category name as well (assuming you have a categories table)
        db.get('SELECT name FROM categories WHERE id = ?', [categoryId], (err, category) => {
            if (err || !category) {
                return res.status(404).send('Category not found');
            }

            res.render('category', { articles, category });
        });
    });
});


// Article List Route
app.get('/articles', (req, res) => {
    db.all('SELECT * FROM articles', (err, articles) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        res.render('articles', { articles, title: 'Articles | LibNewsCentral' });
    });
});




// #######################################
// URL ROUTE ENDS
// #######################################

// Start server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
