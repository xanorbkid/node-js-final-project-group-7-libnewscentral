require('dotenv').config();
const { Pool } = require('pg'); // PostgreSQL client
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;  // Cloudinary SDK

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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

// Set up multer for file uploads in development
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads'); // Directory to store uploaded images
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage });

// Check if it's production or development and log the appropriate message
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

// Helper function to upload image to Cloudinary in production or save locally in development
async function saveImage(imageUrl) {
    try {
        if (env === 'production') {
            // Upload image to Cloudinary in production
            const result = await cloudinary.uploader.upload(imageUrl, {
                folder: 'scraped_images',
            });
            return result.secure_url;  // Return Cloudinary image URL
        } else {
            // Download and save image locally in development
            const imageName = `${Date.now()}${path.extname(imageUrl)}`;
            const savePath = path.join(__dirname, 'public/uploads', imageName);
            const writer = fs.createWriteStream(savePath);

            const response = await axios({
                url: imageUrl,
                method: 'GET',
                responseType: 'stream',
            });
            
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(`/uploads/${imageName}`));  // Return local path
                writer.on('error', reject);
            });
        }
    } catch (error) {
        console.error('Failed to save image:', imageUrl, error.message);
    }
}

// Database helper functions
const db = {
    all: async (query, params) => {
        try {
            const res = await pool.query(query, params);
            return res.rows;
        } catch (err) {
            throw new Error(`Query error: ${err.message}`);
        }
    },
    get: async (query, params) => {
        try {
            const res = await pool.query(query, params);
            return res.rows[0];
        } catch (err) {
            throw new Error(`Query error: ${err.message}`);
        }
    },
    run: async (query, params) => {
        try {
            const res = await pool.query(query, params);
            return { lastID: res.insertId, changes: res.rowCount };
        } catch (err) {
            throw new Error(`Query error: ${err.message}`);
        }
    }
};


// Scrape articles from FrontPageAfrica
async function scrapeFrontPageAfrica() {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    try {
        await page.goto('https://frontpageafricaonline.com/');
        await page.waitForSelector('article.l-post.grid-post.grid-base-post');

        const articles = await page.evaluate(() => {
            const articleElements = document.querySelectorAll('article.l-post.grid-post.grid-base-post');
            const scrapedArticles = [];

            articleElements.forEach(article => {
                const titleElement = article.querySelector('h2.post-title a');
                const title = titleElement ? titleElement.innerText : null;
                const url = titleElement ? titleElement.href : null;

                const categoryElement = article.querySelector('a.category');
                const category_name = categoryElement ? categoryElement.innerText : 'Uncategorized';

                const publishedAtElement = article.querySelector('time.post-date');
                const published_at = publishedAtElement ? publishedAtElement.getAttribute('datetime') : null;

                const excerptElement = article.querySelector('div.excerpt p');
                const excerpt = excerptElement ? excerptElement.innerText : null;

                const imageElement = article.querySelector('span.img');
                const image_url = imageElement ? imageElement.getAttribute('data-bgsrc').replace(';', '') : null;

                const authorElement = article.querySelector('p strong em');
                const author_id = authorElement ? authorElement.innerText.replace('By ', '') : 'Unknown';

                if (title) {
                    scrapedArticles.push({
                        title,
                        url,
                        image_url,
                        published_at,
                        excerpt,
                        category_name,
                        author_id,
                        source: 'FrontPageAfrica'
                    });
                }
            });

            return scrapedArticles;
        });

        for (let article of articles) {
            await page.goto(article.url, { waitUntil: 'networkidle2' });
            await page.waitForSelector('div.post-content.cf.entry-content.content-spacious');
            
            article.content = await page.evaluate(() => {
                const contentElement = document.querySelector('div.post-content.cf.entry-content.content-spacious');
                return contentElement ? contentElement.innerText : null;
            });

            article.author_name = await page.evaluate(() => {
                const authorElement = document.querySelector('p strong em');
                return authorElement ? authorElement.innerText.replace('By ', '') : 'Unknown';
            });

            if (article.image_url && article.image_url.startsWith('http')) {
                article.image_url = await saveImage(article.image_url);  // Use Cloudinary or local storage
            } else {
                console.log('Invalid image URL:', article.image_url);
            }

            await saveScrapedArticles([article]);
        }

        await browser.close();
        return articles;
    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
        return [];
    }
}

// Save scraped articles into the database, ensuring no duplicates
async function saveScrapedArticles(scrapedArticles) {
    for (let article of scrapedArticles) {
        const { title, content, url, image_url, published_at, category_name, source, author_id } = article;

        const categoryQuery = 'SELECT id FROM categories WHERE name = $1';
        try {
            let category = await db.get(categoryQuery, [category_name]);

            if (!category) {
                const insertCategoryQuery = 'INSERT INTO categories (name) VALUES ($1) RETURNING id';
                const result = await db.run(insertCategoryQuery, [category_name]);
                category = { id: result.lastID };
            }

            const duplicateCheckQuery = `SELECT id FROM articles WHERE title = $1 AND source = $2 AND url = $3`;
            const existingArticle = await db.get(duplicateCheckQuery, [title, source, url]);

            if (existingArticle) {
                console.log(`Duplicate article found: ${title}. Skipping insertion.`);
            } else {
                const insertArticleQuery = `
                    INSERT INTO articles (title, content, url, image_url, published_at, category_id, source, author_id, is_scraped)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `;
                await db.run(insertArticleQuery, [
                    title,
                    content,
                    url,
                    image_url,
                    published_at,
                    category.id,
                    source,
                    author_id,
                    1
                ]);
                console.log('Article saved:', title);
            }
        } catch (err) {
            console.error('Database error:', err.message);
        }
    }
}

// Export the scraping functions
module.exports = {
    scrapeFrontPageAfrica,
};
