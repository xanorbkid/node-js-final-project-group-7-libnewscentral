// app.js
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const truncateText = require('./truncate');
const { scrapeFrontPageAfrica, scrapeNewRepublicLiberia } = require('./scraper');

const app = express();
const db = new sqlite3.Database('./newscentral.db');

// Now you can call the scraping functions like this:
scrapeFrontPageAfrica().then(articles => {
    console.log('Scraped articles from FrontPageAfrica:', articles);
});
// scrapeNewRepublicLiberia().then(articles => {
//     console.log('Scraped articles from New Republic Liberia:', articles);
// });

app.use(cors());

// Image proxy route
app.get('/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('URL parameter is required');
    }
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
        });
        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        res.status(500).send('Error fetching the image');
    }
});

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



// Middleware to fetch categories and make them available in all templates
app.use((req, res, next) => {
    db.all('SELECT * FROM categories WHERE deleted_at IS NULL', (err, categories) => {
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
    db.all(query, (err, articles) => {
        if (err) {
            return next(err);
        }
        res.locals.toparticles = articles.slice(0, 6); // Limit to first 6 articles
        res.locals.articles = articles;
        next();
    });
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

// ################################################
// END Middleware
// ###############################################

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
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

