const sqlite3 = require('sqlite3').verbose();
const puppeteer = require('puppeteer');

// Connect to the database
const db = new sqlite3.Database('./newscentral.db');

// Scrape FrontPageAfrica
async function scrapeFrontPageAfrica() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

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
            const category_name = categoryElement ? categoryElement.innerText : 'Uncategorized';  // Default to 'Uncategorized' if no category
            const publishedAtElement = article.querySelector('time.post-date');
            const published_at = publishedAtElement ? publishedAtElement.getAttribute('datetime') : null;
            const excerptElement = article.querySelector('div.excerpt p');
            const excerpt = excerptElement ? excerptElement.innerText : null;
            const content = excerptElement ? excerptElement.innerText : null; // Treat excerpt as content
            const imageElement = article.querySelector('span.img');
            const image_url = imageElement ? imageElement.getAttribute('data-bgsrc') : null;

            scrapedArticles.push({
                title,
                content,
                url,
                image_url,
                published_at,
                excerpt,
                category_name,
                source: 'FrontPageAfrica'
            });
        });

        return scrapedArticles;
    });

    await browser.close();

    // Save scraped articles into the database
    await saveScrapedArticles(articles);

    return articles;
}

// Function to save scraped articles to the database
async function saveScrapedArticles(scrapedArticles) {
    for (let article of scrapedArticles) {
        const { title, content, url, image_url, published_at, category_name, source } = article;

        // Check if the category exists
        const categoryQuery = 'SELECT id FROM categories WHERE name = ?';
        db.get(categoryQuery, [category_name], (err, category) => {
            if (err) {
                console.error('Database error:', err);
                return;
            }

            let categoryId;

            if (category) {
                // Category exists, use its ID
                categoryId = category.id;
                insertArticle(categoryId);
            } else {
                // Category does not exist, create it using INSERT OR IGNORE to avoid duplicate errors
                const insertCategoryQuery = 'INSERT OR IGNORE INTO categories (name) VALUES (?)';
                db.run(insertCategoryQuery, [category_name], function(err) {
                    if (err) {
                        console.error('Failed to insert category:', err);
                        return;
                    }

                    // Retrieve the category id (newly created or the existing one)
                    db.get(categoryQuery, [category_name], (err, newCategory) => {
                        if (err || !newCategory) {
                            console.error('Failed to retrieve category after insertion:', err);
                            return;
                        }
                        categoryId = newCategory.id;
                        insertArticle(categoryId);
                    });
                });
            }

            // Insert article function
            function insertArticle(categoryId) {
                const insertArticleQuery = `
                    INSERT INTO articles (title, content, url, image_url, published_at, category_id, source, is_scraped)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.run(insertArticleQuery, [
                    title,
                    content,
                    url,
                    image_url,
                    published_at,
                    categoryId,
                    source,
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

// Run the scraper and save to DB
scrapeFrontPageAfrica()
    .then(() => {
        console.log('Scraping and database insertion complete!');
    })
    .catch(err => {
        console.error('Error during scraping or DB insertion:', err);
    });

// Export the scraping functions
module.exports = {
    scrapeFrontPageAfrica
};
