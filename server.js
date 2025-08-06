const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');
const syncRoutes = require('./routes/sync');

const productionConfig = require('./config/production');

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(helmet());
app.use(cors({
  origin: isProduction ? productionConfig.cors.origin : process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/sync', syncRoutes);

// Health check для Railway
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      sqlite: isProduction ? 'disabled' : 'available',
      postgresql: (process.env.PGHOST || process.env.DB_HOST) ? 'configured' : 'not configured'
    },
    platform: 'Railway',
    version: '1.0.0',
    jwt_secret: process.env.JWT_SECRET ? 'configured' : 'missing'
  });
});

// Debug endpoint для проверки таблиц
app.get('/api/debug/tables', async (req, res) => {
  try {
    if (isProduction) {
      const { pool } = require('./config/database');
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        res.json({ 
          tables: result.rows,
          message: 'PostgreSQL tables'
        });
      } finally {
        client.release();
      }
    } else {
      res.json({ message: 'Debug endpoint только для production' });
    }
  } catch (error) {
    console.error('Ошибка проверки таблиц:', error);
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint для Railway
app.get('/', (req, res) => {
  res.json({
    message: 'Habit Tracker API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      habits: '/api/habits',
      sync: '/api/sync'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Что-то пошло не так!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Внутренняя ошибка сервера'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Start server
const startServer = async () => {
  try {
    if (isProduction) {
      // Production: только PostgreSQL
      console.log('🚀 Запуск в production режиме (Railway)');
      
      // Динамически импортируем только PostgreSQL модули
      const { connectDB, createTables } = require('./config/database');
      
      let postgresAvailable = false;
      console.log('🔍 Проверка переменных PostgreSQL:');
      console.log('PGHOST:', process.env.PGHOST);
      console.log('PGDATABASE:', process.env.PGDATABASE);
      console.log('PGUSER:', process.env.PGUSER);
      console.log('PGPASSWORD:', process.env.PGPASSWORD ? '***' : 'не установлен');
      
      if (process.env.PGHOST || process.env.DB_HOST) {
        try {
          await connectDB();
          await createTables();
          postgresAvailable = true;
          console.log('✅ PostgreSQL подключен успешно');
        } catch (error) {
          console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
          console.log('⚠️ Работаем без базы данных');
        }
      } else {
        console.log('⚠️ Переменные PostgreSQL не найдены');
      }

      app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📊 Режим: production`);
        console.log(`🔗 API: https://habit-tracker-production-b372.up.railway.app`);
        console.log(`💾 База данных: ${postgresAvailable ? 'PostgreSQL' : 'недоступна'}`);
      });
    } else {
      // Development: SQLite + PostgreSQL
      console.log('🚀 Запуск в development режиме');
      
      // Динамически импортируем все модули
      const { 
        connectDB, 
        createTables, 
        createSQLiteDB, 
        createSQLiteTables 
      } = require('./config/database');
      
      // Инициализация SQLite (локальная база)
      const sqliteDB = await createSQLiteDB();
      await createSQLiteTables(sqliteDB);
      
      // Попытка подключения к PostgreSQL (облачная база)
      let postgresAvailable = false;
      if (process.env.PGHOST || process.env.DB_HOST) {
        try {
          await connectDB();
          await createTables();
          postgresAvailable = true;
          console.log('✅ Облачная синхронизация доступна');
        } catch (error) {
          console.log('⚠️ Облачная синхронизация недоступна, работаем только локально');
        }
      }

      app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📊 Режим: development`);
        console.log(`🔗 API: http://localhost:${PORT}/api`);
        console.log(`💾 Локальная БД: SQLite (${postgresAvailable ? 'с' : 'без'} облачной синхронизации)`);
      });
    }
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

startServer(); 