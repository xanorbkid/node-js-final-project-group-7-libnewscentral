// urlroute.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const db = new sqlite3.Database('./newscentral.db');


// Home Route
router.get('/', (req, res) => {
    db.all('SELECT * FROM articles ORDER BY published_at DESC', (err, articles) => {
        if (err) {
            return res.status(500).send('Database error');
        }
        res.render('index', { articles, title: 'Home | LibNewsCentral' });
    });
});

// Categories List Route with Pagination
router.get('/categories', (req, res) => {
    const perPage = 12; 
    const page = req.query.page ? parseInt(req.query.page) : 1;

    db.get('SELECT COUNT(*) AS count FROM categories', (err, result) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalCategories = result.count;
        const totalPages = Math.ceil(totalCategories / perPage);
        const offset = (page - 1) * perPage;

        db.all('SELECT * FROM categories LIMIT ? OFFSET ?', [perPage, offset], (err, categories) => {
            if (err) {
                return res.status(500).send('Database error');
            }
            res.render('categories', {
                categories,
                currentPage: page,
                totalPages: totalPages,
                title: 'Categories | LibNewsCentral'
            });
        });
    });
});

// List of articles in Category with Pagination
router.get('/category/:id', (req, res) => {
    const categoryId = req.params.id;
    const perPage = 12;
    const page = req.query.page ? parseInt(req.query.page) : 1;

    db.get('SELECT COUNT(*) as count FROM articles WHERE category_id = ?', [categoryId], (err, countResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalArticles = countResult.count;
        const totalPages = Math.ceil(totalArticles / perPage);
        const offset = (page - 1) * perPage;

        db.all('SELECT * FROM articles WHERE category_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?', [categoryId, perPage, offset], (err, articles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            db.get('SELECT name FROM categories WHERE id = ?', [categoryId], (err, category) => {
                if (err || !category) {
                    return res.status(404).send('Category not found');
                }

                res.render('category_articles', {
                    articles,
                    category,
                    currentPage: page,
                    totalPages: totalPages,
                    title: "Category-Article | LibNewsCentral"
                });
            });
        });
    });
});

// Article list view with Pagination
router.get('/articles', (req, res) => {
    const itemsPerPage = 12;
    const currentPage = parseInt(req.query.page) || 1;
    const offset = (currentPage - 1) * itemsPerPage;

    db.get('SELECT COUNT(*) AS count FROM articles', (err, countResult) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        const totalItems = countResult.count;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        const query = `
            SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
            FROM articles
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN comments ON articles.id = comments.article_id
            GROUP BY articles.id
            ORDER BY articles.published_at DESC
            LIMIT ? OFFSET ?
        `;

        db.all(query, [itemsPerPage, offset], (err, articles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            res.render('articles', {
                title: 'Articles',
                articles: articles,
                currentPage: currentPage,
                totalPages: totalPages,
                layout: 'layouts/base'
            });
        });
    });
});

// Article Details Route with Related Articles
router.get('/articles_details/:id', (req, res) => {
    const articleId = req.params.id;

    const articleQuery = `
        SELECT articles.*, categories.name AS category_name, COUNT(comments.id) AS comment_count
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        LEFT JOIN comments ON articles.id = comments.article_id
        WHERE articles.id = ?
        GROUP BY articles.id
    `;

    const relatedArticlesQuery = `
        SELECT articles.*, categories.name AS category_name
        FROM articles
        LEFT JOIN categories ON articles.category_id = categories.id
        WHERE articles.category_id = ? AND articles.id != ?
        ORDER BY articles.published_at DESC
        LIMIT 5
    `;

    db.get(articleQuery, [articleId], (err, article) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (!article) {
            return res.status(404).send('Article not found');
        }

        db.all(relatedArticlesQuery, [article.category_id, articleId], (err, relatedArticles) => {
            if (err) {
                return res.status(500).send('Database error');
            }

            res.render('articles_detail', {
                article: article,
                relatedArticles: relatedArticles,
                title: 'News Details | LibNewsCentral'
            });
        });
    });
});


// #############################################
// ADMIN VIEWS & Route
// #############################################

// Admin Dashboard
router.get('/admin/dashboard', (req, res) => {
    res.render('admin/dashboard', { title: 'Dashboard', layout: 'admin/base' });
});

// Categories List for Admin
router.get('/admin/category_list', (req, res) => {
    db.all('SELECT * FROM categories WHERE deleted_at IS NULL', (err, categories) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        res.render('admin/category_list', {
            title: 'Category',
            categories: categories,
            layout: 'admin/base'
        });
    });
});

// Add Category Route
router.post('/add_category', upload.single('image_url'), (req, res) => {
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !image_url) {
        return res.status(400).send('All fields are required');
    }

    db.run('INSERT INTO categories (name, image_url) VALUES (?, ?)', [name, image_url], function (err) {
        if (err) {
            return res.status(500).send('Database error');
        }
        res.redirect('/admin/category_list');
    });
});

// Edit Category Route
router.post('/edit_category/:id', upload.single('image_url'), (req, res) => {
    const categoryId = req.params.id;
    const { name } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    let query = 'UPDATE categories SET name = ?';
    let params = [name];

    if (image_url) {
        query += ', image_url = ?';
        params.push(image_url);
    }

    query += ' WHERE id = ?';
    params.push(categoryId);

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).send('Database error');
        }
        res.redirect('/admin/category_list');
    });
});


// Delete Category (Soft Delete)
router.get('/delete_category/:id', (req, res) => {
    const categoryId = req.params.id;

    db.get('SELECT COUNT(*) AS count FROM articles WHERE category_id = ?', [categoryId], (err, row) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (row.count > 0) {
            return res.status(400).send('Cannot delete category with associated articles');
        }

        db.run('UPDATE categories SET deleted_at = ? WHERE id = ?', [new Date(), categoryId], function (err) {
            if (err) {
                return res.status(500).send('Database error');
            }

            res.redirect('/admin/category_list?deleteSuccess=true');
        });
    });
});

// Admin Views (Users, Publishers, Articles List)
router.get('/admin/users', (req, res) => {
    res.render('admin/users', { title: 'Membership | LibNews Central', layout: 'admin/base' });
});

router.get('/admin/publishers', (req, res) => {
    res.render('admin/publishers', { title: 'Publisher | LibNews Central', layout: 'admin/base' });
});

router.get('/admin/articleslist', (req, res) => {
    res.render('admin/articleslist', { title: 'Articles | LibNews Central', layout: 'admin/base' });
});

// #######################################
// URL ROUTE ENDS
// #######################################

// Export the router
module.exports = router;
