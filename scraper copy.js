const sqlite3 = require('sqlite3').verbose();
const puppeteer = require('puppeteer');

// Connect to the SQLite database
const db = new sqlite3.Database('./newscentral.db');

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

                // For the author, we would need to navigate into the individual article pages
                const authorElement = article.querySelector('p strong em');
                const author_id = authorElement ? authorElement.innerText.replace('By ', '') : 'Unknown';

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
            });

            return scrapedArticles;
        });

        // For each article, we need to fetch the detailed content and author info from individual article pages
        for (let article of articles) {
            await page.goto(article.url);
            await page.waitForSelector('div.post-content.cf.entry-content.content-spacious');

            // Extract content from the article's body section
            article.content = await page.evaluate(() => {
                const contentElement = document.querySelector('div.post-content.cf.entry-content.content-spacious');
                return contentElement ? contentElement.innerText : null;
            });

            // Extract the author's name if available
            article.author_name = await page.evaluate(() => {
                const authorElement = document.querySelector('p strong em');
                return authorElement ? authorElement.innerText.replace('By ', '') : 'Unknown';
            });

            // Save the scraped articles into the database
            await saveScrapedArticles([article]);
        }

        await browser.close();
        return articles;
    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
    }
}

// END FRONTPAGE AFRICA SRCAPE



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
                    WHERE title = ? AND source = ? AND image_url = ?
                `;
                db.get(duplicateCheckQuery, [title, source, image_url], (err, existingArticle) => {
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



// Run the scraper and save to DB
// scrapeFrontPageAfrica()
//     .then(() => {
//         console.log('Scraping and database insertion complete!');
//     })
//     .catch(err => {
//         console.error('Error during scraping or DB insertion:', err);
//     });



// Export the scraping functions
module.exports = {
    scrapeFrontPageAfrica,
    // scrapeNewRepublicLiberia
};
