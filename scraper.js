const sqlite3 = require('sqlite3').verbose();
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

// Connect to the SQLite database
const db = new sqlite3.Database('./newscentral.db');


// Helper function to download and save image locally
async function downloadImage(imageUrl, savePath) {
    const writer = fs.createWriteStream(savePath);
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
}

// Scrape articles from FrontPageAfrica
// Scrape articles from FrontPageAfrica
async function scrapeFrontPageAfrica() {
    const browser = await puppeteer.launch();
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
                const image_url = imageElement ? imageElement.getAttribute('data-bgsrc') : null;

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
            if (article.image_url) {
                const imageName = `${Date.now()}${path.extname(article.image_url)}`;
                const savePath = path.join(__dirname, 'public/uploads', imageName);
                await downloadImage(article.image_url, savePath);
                article.image_url = `/uploads/${imageName}`;
            }

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



// Scrape articles from NewDawn Liberia
async function scrapeNewDawnLiberia() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        await page.goto('https://thenewdawnliberia.com/');
        await page.waitForSelector('article');

        const articles = await page.evaluate(() => {
            const articleElements = document.querySelectorAll('article');
            const scrapedArticles = [];

            articleElements.forEach(article => {
                const titleElement = article.querySelector('h2.entry-title a');
                const title = titleElement ? titleElement.innerText : null;
                const url = titleElement ? titleElement.href : null;

                const categoryElement = article.querySelector('span.cat-links a');
                const category_name = categoryElement ? categoryElement.innerText : 'Uncategorized';

                const publishedAtElement = article.querySelector('time.entry-date');
                const published_at = publishedAtElement ? publishedAtElement.getAttribute('datetime') : null;

                const excerptElement = article.querySelector('div.entry-summary p');
                const excerpt = excerptElement ? excerptElement.innerText : null;

                const imageElement = article.querySelector('img.wp-post-image');
                const image_url = imageElement ? imageElement.src : null;

                const authorElement = article.querySelector('.author.vcard a');
                const author_id = authorElement ? authorElement.innerText : 'Unknown';

                scrapedArticles.push({
                    title,
                    url,
                    image_url,
                    published_at,
                    excerpt,
                    category_name,
                    author_id,
                    source: 'NewDawnLiberia'
                });
            });

            return scrapedArticles;
        });

        // For each article, fetch detailed content
        for (let article of articles) {
            await page.goto(article.url, { waitUntil: 'networkidle2' });
            await page.waitForSelector('div.entry-content');

            article.content = await page.evaluate(() => {
                const contentElement = document.querySelector('div.entry-content');
                return contentElement ? contentElement.innerText : null;
            });

            article.author_name = await page.evaluate(() => {
                const authorElement = document.querySelector('.author.vcard a');
                return authorElement ? authorElement.innerText : 'Unknown';
            });

            // Download the image and save it locally
            if (article.image_url) {
                const imageName = `${Date.now()}${path.extname(article.image_url)}`;
                const savePath = path.join(__dirname, 'public/uploads', imageName);
                await downloadImage(article.image_url, savePath);

                // Update the article's image_url with the relative path (without '/public')
                article.image_url = `/uploads/${imageName}`;
            }

            // Save the scraped article to the database
            await saveScrapedArticles([article]);
        }

        await browser.close();
        return articles;
    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
    }
}


// Save scraped articles into the database, ensuring no duplicates
async function saveScrapedArticles(scrapedArticles) {
    for (let article of scrapedArticles) {
        const { title, content, url, image_url, published_at, category_name, source, author_id } = article;

        // Check if the category exists
        const categoryQuery = 'SELECT id FROM categories WHERE name = ?';
        db.get(categoryQuery, [category_name], (err, category) => {
            if (err) {
                console.error('Database error:', err);
                return;
            }

            let categoryId;

            if (category) {
                // Category already exists, use its id
                categoryId = category.id;
                checkForDuplicatesAndInsert(categoryId);
            } else {
                // Category does not exist, insert it
                const insertCategoryQuery = 'INSERT OR IGNORE INTO categories (name) VALUES (?)';
                db.run(insertCategoryQuery, [category_name], function (err) {
                    if (err) {
                        console.error('Failed to insert category:', err);
                        return;
                    }

                    // Retrieve the category id (whether newly created or already existing)
                    db.get(categoryQuery, [category_name], (err, newCategory) => {
                        if (err || !newCategory) {
                            console.error('Failed to retrieve category after insertion:', err);
                            return;
                        }
                        categoryId = newCategory.id;
                        checkForDuplicatesAndInsert(categoryId);
                    });
                });
            }

            // Function to check for duplicates and insert the article if not a duplicate
            function checkForDuplicatesAndInsert(categoryId) {
                const duplicateCheckQuery = `
                    SELECT id FROM articles 
                    WHERE title = ? AND source = ? AND url = ?
                `;
                db.get(duplicateCheckQuery, [title, source,  url], (err, existingArticle) => {
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

            // Insert article function
            function insertArticle(categoryId) {
                const insertArticleQuery = `
                    INSERT INTO articles (title, content, url, image_url, published_at, category_id, source, author_id, is_scraped)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    1 // is_scraped is 1
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
    scrapeNewDawnLiberia
};