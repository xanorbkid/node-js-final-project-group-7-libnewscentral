// server.js

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg'); // Import pg (PostgreSQL)
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const truncateText = require('./truncate');
const { scrapeFrontPageAfrica, scrapeLiberianObserver, scrapeNewDawn } = require('./scraper');
require('dotenv').config(); // Load environment variables


const app = express();



// Set environment based on NODE_ENV (development by default)
const env = process.env.NODE_ENV || 'development';

// Configure dbConfig based on environment
let dbConfig;

if (env === 'production') {
    // Production environment uses DATABASE_URL
    dbConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            require: true, // Enforce SSL in production
            rejectUnauthorized: false, // Allow self-signed certificates
        }
    };
} else {
    // Development environment uses separate DB variables
    dbConfig = {
        user: process.env.DB_USERNAME || 'bronax',
        password: process.env.DB_PASSWORD || 'ilovecoding',
        database: process.env.DB_NAME || 'newscentral',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
    };
}

// Set up PostgreSQL pool configuration
const pool = new Pool(dbConfig);

// Log connection environment
if (env === 'production') {
    console.log('Connected to the production database');
} else {
    console.log('Connected to the development database');
}

// Test the connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Database connection successful');
    release();
});

// Set up Sequelize for ORM with proper config
// const sequelize = new Sequelize(dbConfig.connectionString || dbConfig.database, dbConfig.user, dbConfig.password, {
//     host: dbConfig.host,
//     dialect: 'postgres',
//     dialectOptions: dbConfig.ssl ? { ssl: dbConfig.ssl } : {}, // SSL settings for production
//     logging: console.log, // Enable logging in development only
// });


// Middleware to fetch categories and make them available in all templates
app.use(async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM categories WHERE deleted_at IS NULL');
        res.locals.topCategories = result.rows.slice(0, 6); // Limit to first 6 categories
        res.locals.categories = result.rows;
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
        const result = await pool.query(query);
        res.locals.toparticles = result.rows.slice(0, 6); // Limit to first 6 articles
        res.locals.articles = result.rows;
        next();
    } catch (err) {
        next(err);
    }
});


// Scrape articles example
scrapeFrontPageAfrica().then(articles => {
    console.log('Scraped articles from FrontPageAfrica:', articles);
});
scrapeLiberianObserver().then(articles => {
    console.log('Scraped articles from Liberian Observer:', articles);
});
scrapeNewDawn().then(articles => {
    console.log('Scraped articles from New Dawn:', articles);
})
.catch(error => {
    console.error('Error:', error);
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
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'public/uploads'); // Directory to store uploaded images
//     },
//     filename: function (req, file, cb) {
//         cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
//     }
// });
// const upload = multer({ storage: storage });

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

