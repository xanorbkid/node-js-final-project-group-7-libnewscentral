require('dotenv').config(); // Load environment variables from .env

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'bronax',
    password: process.env.DB_PASSWORD || 'ilovecoding',
    database: process.env.DB_NAME || 'newscentral',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Disable logging for cleaner console
  },
  production: {
    use_env_variable: 'DATABASE_URL',  // Use DATABASE_URL from .env for production
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,  // Allow self-signed certificates (Railway likely uses SSL)
      },
    },
    logging: false,
  }
};




// module.exports = {
// development: {
  //   dialect: 'sqlite',
  //   storage: process.env.DATABASE_PATH || './libnewscentral.db',  // Using SQLite for development
  //   logging: false,  // Disable logging for a cleaner console
  // },
//   development: {
//     username: process.env.DB_USERNAME || 'your_db_username',
//     password: process.env.DB_PASSWORD || 'your_db_password',
//     database: process.env.DB_NAME || 'your_db_name',
//     host: process.env.DB_HOST || '127.0.0.1',
//     dialect: 'postgres',
//     logging: false, // Disable logging to keep console clean
//   },
//   test: {
//     username: process.env.DB_USERNAME || 'your_db_username',
//     password: process.env.DB_PASSWORD || 'your_db_password',
//     database: process.env.TEST_DB_NAME || 'your_test_db_name',
//     host: process.env.DB_HOST || '127.0.0.1',
//     dialect: 'postgres',
//   },
//   production: {
//     username: process.env.DB_USERNAME || 'your_db_username',
//     password: process.env.DB_PASSWORD || 'your_db_password',
//     database: process.env.DB_NAME || 'your_prod_db_name',
//     host: process.env.DB_HOST || '127.0.0.1',
//     dialect: 'postgres',
//     ssl: true,
//     dialectOptions: {
//       ssl: {
//         require: true,
//         rejectUnauthorized: false, // For self-signed certs
//       },
//     },
//   },
// };
