// backend/db.js
require('dotenv').config({ path: '../.env' }); // Reaches up to the root!
const mysql = require('mysql2/promise');

const pool = mysql.createPool(process.env.DATABASE_URL);

// Quick test to see if it connects when the server starts
pool.getConnection()
    .then(connection => {
        console.log("✅ Successfully connected to TiDB Cloud (scaffold_ai)!");
        connection.release();
    })
    .catch(err => {
        console.error("❌ TiDB Connection Failed:", err.message);
    });

module.exports = pool;