require('dotenv').config();
const { Pool } = require('pg'); // PostgreSQL client
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;  // Cloudinary SDK


// // Import the necessary modules
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// // Initialize the GoogleGenerativeAI client
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // Get the generative model
// const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });




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

// generateContent

// Function to generate summary, keywords, and vectors using Google Gemini API
async function generateScrapeContent(content) {
    const apiKey = process.env.GEMINI_API_KEY;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

    const headers = {
        'Content-Type': 'application/json'
    };
    try {
        // Generate summary request
        const summaryResponse = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "contents": [{
                    "parts": [
                        { "text": `Summarize this article: ${content}` }
                    ]
                }]
            })
        });

        const summaryData = await summaryResponse.json();
        // console.log('summary Data:', summaryData )
        const summary = summaryData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // console.log(`This is the summary:`, summary);

        // Extract Keywords request
        const keywordsResponse = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "contents": [{
                    "parts": [
                        { "text": `Extract keywords from this article: ${content}` }
                    ]
                }]
            })
        });

        const keywordsData = await keywordsResponse.json();
        const keywords = (keywordsData?.candidates?.[0]?.content?.parts?.[0]?.text || '').split(',').map(kw => kw.trim());
        // console.log(`These are the keywords:`, keywords);


       // Get embeddings request for article
        const embeddingResponse = await fetch(embedUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "content": {
                    "parts": [
                        { "text": content } // "content" should be the text of the article
                    ]
                }
            })
        });

        const embeddingData = await embeddingResponse.json();

        // Extract embedding vectors if available
        const vectors = embeddingData?.embedding?.values || [];

        if (vectors.length === 0) {
            console.error('Vectors are empty. Check the embedding model or input content.');
        } else {
            console.log(`Vectors generated:`, vectors);
        }

        return { summary, keywords, vectors };
    } catch (error) {
        console.error('Error with Gemini API:', error.message);
        return { summary: '', keywords: [], vectors: [] };
    }
}


// Scrape articles from FrontPageAfrica
// Scraping function to extract content and process articles
async function scrapeFrontPageAfrica() {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    try {
        await page.goto('https://frontpageafricaonline.com/', { waitUntil: 'networkidle2', timeout: 60000 });
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
                article.image_url = await saveImage(article.image_url); // Use Cloudinary or local storage
            } else {
                console.log('Invalid image URL:', article.image_url);
            }

            // Call Gemini API to get summary, keywords, and vectors (embeddings)
            const { summary, keywords, vectors } = await generateScrapeContent(article.content);
            article.summary = summary;
            article.keywords = keywords;
            article.vector = vectors; // Vector (embedding) generated from the article content

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




// Function to scrape articles from Liberian Observer
async function scrapeLiberianObserver() {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    try {
        await page.goto('https://www.liberianobserver.com/', { waitUntil: 'networkidle2', timeout: 60000 }); // Increased timeout

        await page.waitForSelector('.card-container'); // Adjust based on the article structure

        // Scrape articles from the homepage
        const articles = await page.evaluate(() => {
            const articleElements = document.querySelectorAll('.card-container'); // Use the specific selector
            const scrapedArticles = [];

            articleElements.forEach(article => {
                const titleElement = article.querySelector('.card-headline a.tnt-asset-link');
                const title = titleElement ? titleElement.innerText : null;
                const url = titleElement ? titleElement.href : null;

                const categoryElement = article.querySelector('.card-labels .card-label-section a.tnt-section-tag');
                const category_name = categoryElement ? categoryElement.innerText : 'No Category'; // Provide default value if not found


                const imageElement = article.querySelector('.card-image img[data-srcset]');
                const image_url = imageElement ? imageElement.getAttribute('data-srcset').split(',')[0].split(' ')[0].replace(/(\?.*)$/, '') : null; // Get the first image URL and remove query parameters

                const authorElement = article.querySelector('.card-byline');
                const author_id = authorElement ? authorElement.innerText.replace('By ', '') : 'Unknown';

                const publishedAtElement = article.querySelector('.tnt-date');
                const published_at = publishedAtElement ? publishedAtElement.getAttribute('datetime') : null;

                const excerptElement = article.querySelector('.tnt-summary');
                const excerpt = excerptElement ? excerptElement.innerText : null;

                if (title) {
                    scrapedArticles.push({
                        title,
                        url,
                        image_url,
                        published_at,
                        excerpt,
                        category_name,
                        author_id,
                        source: 'LiberianObserver'
                    });
                }
            });

            return scrapedArticles;
        });

        // Scrape individual articles for detailed content
        for (let article of articles) {
            await page.goto(article.url, { waitUntil: 'networkidle2', timeout: 60000 }); // Increased timeout

            await page.waitForSelector('div.asset-content');

            // Scrape the article body content
            article.content = await page.evaluate(() => {
                const contentElement = document.querySelector('div.asset-content');
                return contentElement ? contentElement.innerText : null;
            });

            // Validate and save image URL
            if (article.image_url && article.image_url.startsWith('http')) {
                article.image_url = await saveImage(article.image_url); // Save to Cloudinary or local storage
            } else {
                console.log('Invalid image URL:', article.image_url);
            }

            // Call Gemini API to get summary, keywords, and vector
            const { summary, keywords, vector } = await generateScrapeContent(article.content);
            article.summary = summary;
            article.keywords = keywords;
            article.vector = vector;

            // Save each article
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


// Function to Scrape from New Dawn
async function scrapeNewDawn() {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    try {
        // Visit the New Dawn Liberia website
        await page.goto('https://thenewdawnliberia.com/', { waitUntil: 'networkidle2', timeout: 60000 }); // Adjust timeout if necessary

        // Wait for the necessary elements to load
        await page.waitForSelector('.post-item'); // Adjust based on the article structure

        // Scrape articles from the homepage
        const articles = await page.evaluate(() => {
            const articleElements = document.querySelectorAll('.post-item'); // Use the specific selector for the article list
            const scrapedArticles = [];

            articleElements.forEach(article => {
                // Scrape the title and URL
                const titleElement = article.querySelector('h2.post-title a');
                const title = titleElement ? titleElement.innerText.trim() : null;
                const url = titleElement ? titleElement.href : null;

                // Scrape the category name
                const categoryElement = article.querySelector('.tie-cat-77 .post-cat');
                const category_name = categoryElement ? categoryElement.innerText.trim() : 'No Category';

                // Scrape the image URL
                const imageElement = article.querySelector('img');
                const image_url = imageElement ? imageElement.src : null;

                // Scrape the author name
                const authorElement = article.querySelector('.meta-author-wrapper .meta-author a');
                const author_id = authorElement ? authorElement.innerText.trim() : 'Unknown';

                // Scrape the publish date
                const publishedAtElement = article.querySelector('.post-meta .date');
                const published_at = publishedAtElement ? publishedAtElement.innerText.trim() : null;

                // Scrape the excerpt
                const excerptElement = article.querySelector('.post-excerpt');
                const excerpt = excerptElement ? excerptElement.innerText.trim() : null;

                // Collect the scraped data for each article
                if (title && url) {
                    scrapedArticles.push({
                        title,
                        url,
                        image_url,
                        published_at,
                        excerpt,
                        category_name,
                        author_id,
                        source: 'New Dawn'
                    });
                }
            });

            return scrapedArticles;
        });

        // Scrape individual articles for detailed content
        for (let article of articles) {
            await page.goto(article.url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait for the article content to load
            await page.waitForSelector('div.entry-content.entry.clearfix');

            // Scrape the article body content
            article.content = await page.evaluate(() => {
                const contentElement = document.querySelector('div.entry-content.entry.clearfix');
                return contentElement ? contentElement.innerText.trim() : null;
            });

            // Optionally, save the image if necessary
            // Validate and save image URL
            if (article.image_url && article.image_url.startsWith('http')) {
                article.image_url = await saveImage(article.image_url); // Save to Cloudinary or local storage
            } else {
                console.log('Invalid image URL:', article.image_url);
            }

            // Call Gemini API to get summary, keywords, and vector
            const { summary, keywords, vector } = await generateScrapeContent(article.content);
            article.summary = summary;
            article.keywords = keywords;
            article.vector = vector;

            // Save each article
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

// Call the function and log the result (for testing)
// scrapeNewDawn().then(articles => console.log(articles));



// Save scraped articles into the database, ensuring no duplicates
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

            // Check for existing article
            const duplicateCheckQuery = `SELECT id, summary, vectors, keywords FROM articles WHERE title = $1 AND source = $2 AND url = $3`;
            const existingArticle = await db.get(duplicateCheckQuery, [title, source, url]);

            // Summarize and embed the article content
            const { summary, keywords, vectors } = await generateScrapeContent(article.content);

            if (existingArticle) {
                console.log(`Updating existing article: ${title}`);
                console.log('Article  summary:', summary);


                // Update only if summary, vectors, or keywords are null or empty
                let updateFields = {};
                if (!existingArticle.summary || existingArticle.summary.trim() === '') {
                    updateFields.summary = summary;
                }
                if (!existingArticle.vectors || existingArticle.vectors.length === 0) {
                    updateFields.vectors = vectors;
                }
                if (!existingArticle.keywords || existingArticle.keywords.length === 0) {
                    updateFields.keywords = keywords;
                }

                if (Object.keys(updateFields).length > 0) {
                    const updateArticleQuery = `
                        UPDATE articles 
                        SET summary = COALESCE($1, summary), 
                            vectors = COALESCE($2, vectors), 
                            keywords = COALESCE($3, keywords)
                        WHERE id = $4
                    `;
                    await db.run(updateArticleQuery, [
                        updateFields.summary || null,
                        updateFields.vectors || null,
                        updateFields.keywords || null,
                        existingArticle.id
                    ]);
                    console.log(`Article updated with new data: ${title}`);

                } else {
                    console.log(`No updates needed for article: ${title}`);
                }


                // Update the article with new summary, vectors, and keywords
                // const updateArticleQuery = `
                //     UPDATE articles 
                //     SET summary = $1, vectors = $2, keywords = $3 
                //     WHERE id = $4
                // `;
                // await db.run(updateArticleQuery, [summary, vectors, keywords, existingArticle.id]);
                // console.log('Article updated with summary, vectors, and keywords:', title);
                // console.log('Article  summary:', summary);
                

            } else {
                console.log(`Inserting new article: ${title}`);

                // Insert a new article
                const insertArticleQuery = `
                    INSERT INTO articles (title, content, url, image_url, published_at, category_id, source, author_id, is_scraped, summary, vectors, keywords)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
                    1,
                    summary,
                    vectors,
                    keywords
                ]);
                console.log('Article inserted with summary, vectors, and keywords:', title);
                console.log('Article Vectors:', vectors)
            }
        } catch (err) {
            console.error('Database error:', err.message);
        }
    }
}

// Export the scraping functions
module.exports = {
    scrapeFrontPageAfrica,
    scrapeLiberianObserver,
    scrapeNewDawn
};
