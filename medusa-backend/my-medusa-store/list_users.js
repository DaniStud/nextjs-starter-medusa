const { Client } = require('pg')

// Database URL from .env or default for docker-compose
const connectionString = process.env.DATABASE_URL || 'postgres://medusa:medusa@localhost:5432/medusa'

const client = new Client({
    connectionString,
})

client.connect()
    .then(() => console.log("Connected to database"))
    .then(() => client.query('SELECT email FROM "user"'))
    .then(res => {
        console.log("Users:")
        res.rows.forEach(row => console.log(`- ${row.email}`))
        if (res.rows.length === 0) console.log("No users found.")
    })
    .catch(e => console.error("Error executing query:", e))
    .finally(() => client.end())
