const mysql = require('mysql2/promise');

const getDbConfig = () => {
  const isCloudRun = process.env.DB_SOCKET_PATH ? true : false;

  if (isCloudRun) {
    console.log("Using socket path for Cloud Run connection");
    return {
      socketPath: process.env.DB_SOCKET_PATH,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    };
  } else {
    console.log("Using host for local connection");
    return {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    };
  }
};

const pool = mysql.createPool(getDbConfig());

module.exports = pool;
