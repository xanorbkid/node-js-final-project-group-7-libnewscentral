// server.js

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const truncateText = require('./truncate');
const { scrapeFrontPageAfrica, scrapeNewDawnLiberia } = require('./scraper');
const { Sequelize } = require('sequelize'); // Import Sequelize
const dbConfig = require('./config/config'); // Import the db configuration

const app = express();

// Set up Sequelize connection using the environment
const env = process.env.NODE_ENV || 'development'; // Set environment based on NODE_ENV
const config = dbConfig[env];
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        dialect: config.dialect,
        dialectOptions: config.dialectOptions,
        logging: config.logging,
    }
);

// Test the database connection
sequelize.authenticate()
    .then(() => {
        console.log('Connection to the database has been established successfully.');
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

// Scrape articles example
scrapeFrontPageAfrica().then(articles => {
    console.log('Scraped articles from FrontPageAfrica:', articles);
});

// Middleware
app.use(cors());
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

// Middleware to fetch categories and make them available in all templates
app.use(async (req, res, next) => {
    try {
        const [results, metadata] = await sequelize.query('SELECT * FROM categories WHERE deleted_at IS NULL');
        res.locals.topCategories = results.slice(0, 6); // Limit to first 6 categories
        res.locals.categories = results;
        next();
    } catch (err) {
        next(err);
    }
});

// Middleware to fetch articles with category names
app.use(async (req, res, next) => {
    const query = `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
    `;
    try {
        const [articles, metadata] = await sequelize.query(query);
        res.locals.toparticles = articles.slice(0, 6); // Limit to first 6 articles
        res.locals.articles = articles;
        next();
    } catch (err) {
        next(err);
    }
});

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

// Session management
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
}));

// Import routes
const urlRoutes = require('./routes/route');
app.use('/', urlRoutes); // Apply the routes from urlroute.js

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

