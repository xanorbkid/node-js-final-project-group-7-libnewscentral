# LIBNEWS CENTRAL
LibNews Central is a comprehensive news  aggregation platform that allows users to access diverse content efficiently, providing clear and balanced attribution to the sources.

# Table of Contents
- Features
- Installation
- Setup Database
- Environment Variables
- Usage 
- Contributing
- Licence

# Features
* Diverse News Coverage: Access news from multiple sources with balanced and transparent attribution.
* Efficient Content Access: User-friendly interface for quick browsing and content retrieval.
* Category and Filter Options: Sort news by categories, dates, or sources.


# Installation
1. Clone the repository
    - git clone https://github.com/xanorbkid/node-js-final-project-group-7-libnewscentral
    - cd libnews-central

2. Install Dependencies
    - npm install


# Setup Database
1. Install PostgreSQL if you haven't already. You can download it here.
2. Create a PostgreSQL Database:

Open your PostgreSQL command line or preferred GUI tool.

- CREATE DATABASE libnews_db;
- CREATE USER libnews_user WITH ENCRYPTED PASSWORD 'your_password';
- ALTER ROLE libnews_user SET client_encoding TO 'utf8';
- ALTER ROLE libnews_user SET default_transaction_isolation TO 'read committed';
- ALTER ROLE libnews_user SET timezone TO 'UTC';
- GRANT ALL PRIVILEGES ON DATABASE libnews_db TO libnews_user;

3. Database Migrations
    - After setting up the database, run migrations to initialize the database schema:
        * npm run migrate

# Usage

1. Start the Server:
    npm run dev

2. Access the Application:
 Open your browser and navigate to http://localhost:3000 to view LibNews Central.
