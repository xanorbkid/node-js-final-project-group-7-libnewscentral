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









// Scrape New Republic Liberia
// Scrape New Republic Liberia

// Scrape New Republic Liberia
// async function scrapeNewRepublicLiberia() {
//     const browser = await puppeteer.launch({ headless: false }); // Debugging with headless mode off
//     const page = await browser.newPage();

//     try {
//         // Go to the New Republic Liberia website
//         await page.goto('https://www.newrepublicliberia.com/', { waitUntil: 'networkidle0', timeout: 60000 });
        
//         // Wait for a more reliable selector like the header or another element that loads early
//         await page.waitForSelector('header', { timeout: 60000 });

//         // Optional: take a screenshot to check the page's current state
//         await page.screenshot({ path: 'new_republic_screenshot.png' });

//         // Now wait for the articles to load
//         await page.waitForSelector('article.post', { timeout: 60000 });
//         await page.waitForTimeout(5000); // Optional extra wait time

//         const articles = await page.evaluate(() => {
//             const articleElements = document.querySelectorAll('article.post');
//             const scrapedArticles = [];

//             articleElements.forEach(article => {
//                 const titleElement = article.querySelector('h2.title a.post-title');
//                 const title = titleElement ? titleElement.innerText : null;
//                 const url = titleElement ? titleElement.href : null;
//                 const authorElement = article.querySelector('.post-author.author');
//                 const author = authorElement ? authorElement.innerText.trim() : 'Unknown'; // Default to 'Unknown' if no author
//                 const publishedAtElement = article.querySelector('time.post-published');
//                 const published_at = publishedAtElement ? publishedAtElement.getAttribute('datetime') : null;
//                 const excerptElement = article.querySelector('div.post-summary');
//                 const excerpt = excerptElement ? excerptElement.innerText.trim() : null;
//                 const imageElement = article.querySelector('a.img-holder');
//                 const image_url = imageElement ? imageElement.getAttribute('data-src') : null;

//                 const categoryElement = document.querySelector('section.archive-title h1.page-heading span.h-title');
//                 const category = categoryElement ? categoryElement.innerText.trim() : 'General';

//                 if (title && url) {
//                     scrapedArticles.push({
//                         title,
//                         url,
//                         author_id: author,
//                         image_url,
//                         published_at,
//                         excerpt,
//                         category_name: category,
//                         content: '', // Content will be scraped later from article detail page
//                         source: 'New Republic Liberia'
//                     });
//                 }
//             });

//             return scrapedArticles;
//         });

//         for (let article of articles) {
//             await scrapeArticleContent(page, article);
//         }

//         await browser.close();

//         await saveScrapedArticles(articles);

//         return articles;
//     } catch (error) {
//         console.error("Error scraping New Republic Liberia:", error);
//         await browser.close();
//         return [];
//     }
// }

// module.exports = scrapeNewRepublicLiberia;





// // Scrape full content from the article details page
// async function scrapeArticleContent(page, article) {
//     if (article.url) {
//         try {
//             await page.goto(article.url);
//             await page.waitForSelector('div.entry-content');

//             const content = await page.evaluate(() => {
//                 const contentElement = document.querySelector('div.entry-content');
//                 return contentElement ? contentElement.innerText.trim() : null;
//             });

//             article.content = content || article.excerpt; // Use full content if available, otherwise use the excerpt

//         } catch (error) {
//             console.error(`Failed to scrape content for ${article.title}:`, error);
//         }
//     }
// }



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
