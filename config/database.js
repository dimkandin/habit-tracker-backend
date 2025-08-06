const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLite для локального хранения
const sqlitePath = path.join(__dirname, '../data/habits.db');

// Создание SQLite базы данных
const createSQLiteDB = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqlitePath, (err) => {
      if (err) {
        console.error('❌ Ошибка создания SQLite базы:', err.message);
        reject(err);
      } else {
        console.log('✅ SQLite база данных создана:', sqlitePath);
        resolve(db);
      }
    });
  });
};

// Создание таблиц в SQLite
const createSQLiteTables = (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Таблица пользователей
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Таблица привычек
      db.run(`
        CREATE TABLE IF NOT EXISTS habits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL CHECK (category IN ('binary', 'quantity', 'mood')),
          unit TEXT,
          target REAL DEFAULT 1,
          color TEXT DEFAULT '#667eea',
          type TEXT DEFAULT 'daily',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Таблица выполнения бинарных привычек
      db.run(`
        CREATE TABLE IF NOT EXISTS habit_completions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habit_id INTEGER,
          date TEXT NOT NULL,
          completed BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE,
          UNIQUE(habit_id, date)
        )
      `);

      // Таблица количественных значений
      db.run(`
        CREATE TABLE IF NOT EXISTS habit_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habit_id INTEGER,
          date TEXT NOT NULL,
          value REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE,
          UNIQUE(habit_id, date)
        )
      `);

      // Таблица настроений
      db.run(`
        CREATE TABLE IF NOT EXISTS habit_moods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habit_id INTEGER,
          date TEXT NOT NULL,
          mood_value INTEGER NOT NULL CHECK (mood_value >= 1 AND mood_value <= 5),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE,
          UNIQUE(habit_id, date)
        )
      `);

      // Индексы для оптимизации
      db.run(`CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_id ON habit_completions(habit_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_habit_values_habit_id ON habit_values(habit_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_habit_values_date ON habit_values(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_habit_moods_habit_id ON habit_moods(habit_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_habit_moods_date ON habit_moods(date)`);

      console.log('✅ SQLite таблицы созданы/обновлены');
      resolve();
    });
  });
};

// PostgreSQL пул для облачной синхронизации
const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST,
  port: process.env.PGPORT || process.env.DB_PORT || 5432,
  database: process.env.PGDATABASE || process.env.DB_NAME,
  user: process.env.PGUSER || process.env.DB_USER,
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Функция для тестирования подключения к PostgreSQL
const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Подключение к PostgreSQL успешно установлено');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
    return false;
  }
};

// Функция для создания таблиц в PostgreSQL
const createTables = async () => {
  const client = await pool.connect();
  try {
    // Создание таблицы пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание таблицы привычек
    await client.query(`
      CREATE TABLE IF NOT EXISTS habits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL CHECK (category IN ('binary', 'quantity', 'mood')),
        unit VARCHAR(50),
        target NUMERIC DEFAULT 1,
        color VARCHAR(7) DEFAULT '#667eea',
        type VARCHAR(20) DEFAULT 'daily',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание таблицы выполнения бинарных привычек
    await client.query(`
      CREATE TABLE IF NOT EXISTS habit_completions (
        id SERIAL PRIMARY KEY,
        habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(habit_id, date)
      )
    `);

    // Создание таблицы количественных значений
    await client.query(`
      CREATE TABLE IF NOT EXISTS habit_values (
        id SERIAL PRIMARY KEY,
        habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        value NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(habit_id, date)
      )
    `);

    // Создание таблицы настроений
    await client.query(`
      CREATE TABLE IF NOT EXISTS habit_moods (
        id SERIAL PRIMARY KEY,
        habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        mood_value INTEGER NOT NULL CHECK (mood_value >= 1 AND mood_value <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(habit_id, date)
      )
    `);

    // Создание индексов для оптимизации
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
      CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_id ON habit_completions(habit_id);
      CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date);
      CREATE INDEX IF NOT EXISTS idx_habit_values_habit_id ON habit_values(habit_id);
      CREATE INDEX IF NOT EXISTS idx_habit_values_date ON habit_values(date);
      CREATE INDEX IF NOT EXISTS idx_habit_moods_habit_id ON habit_moods(habit_id);
      CREATE INDEX IF NOT EXISTS idx_habit_moods_date ON habit_moods(date);
    `);

    console.log('✅ PostgreSQL таблицы созданы/обновлены');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц PostgreSQL:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  connectDB,
  createTables,
  createSQLiteDB,
  createSQLiteTables,
  sqlitePath
}; 