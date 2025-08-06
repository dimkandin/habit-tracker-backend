module.exports = {
  database: {
    host: process.env.PGHOST || process.env.DB_HOST,
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME,
    user: process.env.PGUSER || process.env.DB_USER,
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  cors: {
    origin: [
      'https://dimkandin.github.io',
      'https://habit-tracker.railway.app',
      'http://localhost:3000'
    ],
    credentials: true
  },
  server: {
    port: process.env.PORT || 8080,
    environment: 'production'
  }
}; 