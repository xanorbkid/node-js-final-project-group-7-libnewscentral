require('dotenv').config();

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');  // PostgreSQL client
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const truncateText = require('./truncate');

const { scrapeFrontPageAfrica } = require('./scraper');

const app = express();

let db;

// Check if we are in a production or development environment
if (process.env.DB_TYPE === 'postgres') {
    // PostgreSQL (production)
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,  // Automatically set by Railway
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Mimic SQLite's db.all function for PostgreSQL
    db = {
        all: (query, params, callback) => {
            pool.query(query, params)
                .then((res) => callback(null, res.rows))
                .catch((err) => callback(err, null));
        }
    };
    console.log('Connected to PostgreSQL database');
} else {
    // SQLite (development)
    db = new sqlite3.Database(process.env.DATABASE_PATH, (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    });
}

// ################################################
// Middleware
// ###############################################
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// View engine and layouts
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/base'); // Points to views/layouts/base.ejs
app.set('views', [__dirname + '/views', __dirname + '/admin']);


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


// Middleware to make moment.js available in all views
app.use((req, res, next) => {
    res.locals.moment = moment;
    next();
});

// Middleware to make truncateText function available in all views
app.use((req, res, next) => {
    res.locals.truncateText = truncateText;
    next();
});











// Middleware to fetch categories and make them available in all templates
app.use((req, res, next) => {
    db.all('SELECT * FROM categories WHERE deleted_at IS NULL', [], (err, categories) => {
        if (err) {
            return next(err);
        }
        res.locals.topCategories = categories.slice(0, 6); // Limit to first 6 categories
        res.locals.categories = categories;
        next();
    });
});

// Middleware to fetch articles with category names
app.use((req, res, next) => {
    const query = `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
    `;
    db.all(query, [], (err, articles) => {
        if (err) {
            return next(err);
        }
        res.locals.toparticles = articles.slice(0, 6); // Limit to first 6 articles
        res.locals.articles = articles;
        next();
    });
});

// Session management
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
}));



// Scraper functions (moved outside of app.listen to avoid multiple executions)
scrapeFrontPageAfrica().then(articles => {
    console.log('Scraped articles from FrontPageAfrica:', articles);
});



// Import routes
const urlRoutes = require('./routes/route');
app.use('/', urlRoutes); // Apply the routes from urlRoutes.js

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
