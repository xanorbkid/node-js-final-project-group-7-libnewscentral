require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');  // PostgreSQL client
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

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



// Define the db variable
let db;

// Check if we are in a production or development environment
if (process.env.DB_TYPE === 'postgres') {
    // Use PostgreSQL
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    db = {
        // Mock SQLite's db.all function
        all: (query, params, callback) => {
            pool.query(query, params)
                .then(res => callback(null, res.rows))
                .catch(err => callback(err, null));
        },
        // Mock SQLite's db.get function
        get: (query, params, callback) => {
            pool.query(query, params)
                .then(res => callback(null, res.rows[0]))
                .catch(err => callback(err, null));
        },
        // Mock SQLite's db.run function
        run: (query, params, callback) => {
            pool.query(query, params)
                .then(res => callback(null, { lastID: res.insertId, changes: res.rowCount }))
                .catch(err => callback(err));
        }
    };

    console.log('Connected to PostgreSQL database');
} else if (process.env.DB_TYPE === 'sqlite') {
    // Use SQLite
    const databasePath = process.env.DATABASE_PATH;

    if (!databasePath || typeof databasePath !== 'string') {
        throw new Error('DATABASE_PATH environment variable is not set or is not a valid string');
    }

    db = new sqlite3.Database(databasePath, (err) => {
        if (err) {
            console.error('Error opening SQLite database:', err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    });
} else {
    throw new Error('DB_TYPE environment variable is not set or is not recognized');
}

// Export db for use in other modules
module.exports = db;


// Helper function to download and save image locally
async function downloadImage(imageUrl, savePath) {
    const writer = fs.createWriteStream(savePath);
    
    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'stream',
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Failed to download image:', imageUrl, error.message);
    }
}



// async function downloadImage(imageUrl, savePath) {
//     const writer = fs.createWriteStream(savePath);
//     const response = await axios({
//         url: imageUrl,
//         method: 'GET',
//         responseType: 'stream',
//     });

//     response.data.pipe(writer);

//     return new Promise((resolve, reject) => {
//         writer.on('finish', resolve);
//         writer.on('error', reject);
//     });
// }

// Scrape articles from FrontPageAfrica
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
                // const image_url = imageElement ? imageElement.getAttribute('data-bgsrc') : null;
                const image_url = imageElement ? imageElement.getAttribute('data-bgsrc').replace(';', '') : null;


                const authorElement = article.querySelector('p strong em');
                const author_id = authorElement ? authorElement.innerText.replace('By ', '') : 'Unknown';

                // Only add the article if it has a valid title
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

        // For each article, scrape additional details and save it
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

            // Process image saving if applicable
            if (article.image_url && article.image_url.startsWith('http')) {
                const imageName = `${Date.now()}${path.extname(article.image_url)}`;
                const savePath = path.join(__dirname, 'public/uploads', imageName);
                await downloadImage(article.image_url, savePath);
                article.image_url = `/uploads/${imageName}`;
            } else {
                console.log('Invalid image URL:', article.image_url);
            }
            

            // if (article.image_url) {
            //     const imageName = `${Date.now()}${path.extname(article.image_url)}`;
            //     const savePath = path.join(__dirname, 'public/uploads', imageName);
            //     await downloadImage(article.image_url, savePath);
            //     article.image_url = `/uploads/${imageName}`;
            // }

            // Save the article to the database
            await saveScrapedArticles([article]);
        }

        await browser.close();
        return articles; // Ensure articles are returned here
    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
        return []; // Return an empty array if an error occurs
    }
}


// Save scraped articles into the database, ensuring no duplicates
async function saveScrapedArticles(scrapedArticles) {
    for (let article of scrapedArticles) {
        const { title, content, url, image_url, published_at, category_name, source, author_id } = article;

        // Check if the category exists
        const categoryQuery = 'SELECT id FROM categories WHERE name = $1';
        db.get(categoryQuery, [category_name], (err, category) => {
            if (err) {
                console.error('Database error:', err);
                return;
            }

            let categoryId;

            if (category) {
                categoryId = category.id;
                checkForDuplicatesAndInsert(categoryId);
            } else {
                const insertCategoryQuery = 'INSERT INTO categories (name) VALUES ($1) RETURNING id';
                db.run(insertCategoryQuery, [category_name], (err, result) => {
                    if (err) {
                        console.error('Failed to insert category:', err);
                        return;
                    }
                    categoryId = result.rows[0].id;
                    checkForDuplicatesAndInsert(categoryId);
                });
            }

            function checkForDuplicatesAndInsert(categoryId) {
                const duplicateCheckQuery = `
                    SELECT id FROM articles 
                    WHERE title = $1 AND source = $2 AND url = $3
                `;
                db.get(duplicateCheckQuery, [title, source, url], (err, existingArticle) => {
                    if (err) {
                        console.error('Error checking for duplicates:', err);
                        return;
                    }

                    if (existingArticle) {
                        console.log(`Duplicate article found: ${title}. Skipping insertion.`);
                    } else {
                        insertArticle(categoryId);
                    }
                });
            }

            function insertArticle(categoryId) {
                const insertArticleQuery = `
                    INSERT INTO articles (title, content, url, image_url, published_at, category_id, source, author_id, is_scraped)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `;
                db.run(insertArticleQuery, [
                    title,
                    content,
                    url,
                    image_url,
                    published_at,
                    categoryId,
                    source,
                    author_id,
                    1  // is_scraped is 1
                ], (err) => {
                    if (err) {
                        console.error('Failed to insert article:', err);
                    } else {
                        console.log('Article saved:', title);
                    }
                });
            }
        });

    }
}


// Export the scraping functions
module.exports = {
    scrapeFrontPageAfrica,
};