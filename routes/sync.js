const express = require('express');
const path = require('path');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Динамический импорт sqlite3 только в development
let sqlite3 = null;
let sqlitePath = null;

if (process.env.NODE_ENV !== 'production') {
  sqlite3 = require('sqlite3').verbose();
  sqlitePath = path.join(__dirname, '../data/habits.db');
}

// Получить статус синхронизации
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Production: только PostgreSQL
      res.json({
        status: 'synced',
        lastSync: new Date().toISOString(),
        database: 'postgresql',
        environment: 'production'
      });
    } else {
      // Development: проверяем оба источника
      const db = new sqlite3.Database(sqlitePath);
      const getLocalCount = () => {
        return new Promise((resolve, reject) => {
          db.get('SELECT COUNT(*) as count FROM habits WHERE user_id = ?', [req.user.id], (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });
      };
      
      const localCount = await getLocalCount();
      
      let cloudCount = 0;
      if (process.env.DB_HOST) {
        try {
          const result = await pool.query('SELECT COUNT(*) as count FROM habits WHERE user_id = $1', [req.user.id]);
          cloudCount = parseInt(result.rows[0].count);
        } catch (error) {
          console.log('Облачная база недоступна');
        }
      }
      
      res.json({
        status: localCount === cloudCount ? 'synced' : 'out_of_sync',
        lastSync: new Date().toISOString(),
        localCount,
        cloudCount,
        database: 'hybrid',
        environment: 'development'
      });
    }
  } catch (error) {
    console.error('Ошибка получения статуса синхронизации:', error);
    res.status(500).json({ error: 'Ошибка получения статуса синхронизации' });
  }
});

// Синхронизировать локальные данные в облако
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.json({ message: 'В production режиме синхронизация не требуется' });
      return;
    }
    
    const db = new sqlite3.Database(sqlitePath);
    
    // Получаем все локальные привычки
    const getLocalHabits = () => {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM habits WHERE user_id = ?', [req.user.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    
    const localHabits = await getLocalHabits();
    
    // Загружаем в PostgreSQL
    for (const habit of localHabits) {
      await pool.query(
        'INSERT INTO habits (id, name, description, category, unit, target, color, type, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET name = $2, description = $3, category = $4, unit = $5, target = $6, color = $7, type = $8, updated_at = $11',
        [habit.id, habit.name, habit.description, habit.category, habit.unit, habit.target, habit.color, habit.type, habit.user_id, habit.created_at, habit.updated_at]
      );
    }
    
    res.json({ 
      message: 'Данные загружены в облако',
      uploaded: localHabits.length 
    });
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    res.status(500).json({ error: 'Ошибка загрузки данных' });
  }
});

// Скачать данные из облака
router.post('/download', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.json({ message: 'В production режиме скачивание не требуется' });
      return;
    }
    
    const db = new sqlite3.Database(sqlitePath);
    
    // Получаем все облачные привычки
    const result = await pool.query('SELECT * FROM habits WHERE user_id = $1', [req.user.id]);
    const cloudHabits = result.rows;
    
    // Загружаем в SQLite
    for (const habit of cloudHabits) {
      const insertHabit = () => {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT OR REPLACE INTO habits (id, name, description, category, unit, target, color, type, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [habit.id, habit.name, habit.description, habit.category, habit.unit, habit.target, habit.color, habit.type, habit.user_id, habit.created_at, habit.updated_at],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      };
      await insertHabit();
    }
    
    res.json({ 
      message: 'Данные скачаны из облака',
      downloaded: cloudHabits.length 
    });
  } catch (error) {
    console.error('Ошибка скачивания данных:', error);
    res.status(500).json({ error: 'Ошибка скачивания данных' });
  }
});

// Автоматическая синхронизация
router.post('/auto', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.json({ message: 'В production режиме автоматическая синхронизация не требуется' });
      return;
    }
    
    // Получаем статус
    const statusResponse = await fetch(`${req.protocol}://${req.get('host')}/api/sync/status`, {
      headers: { 'Authorization': req.headers.authorization }
    });
    const status = await statusResponse.json();
    
    if (status.status === 'synced') {
      res.json({ message: 'Данные уже синхронизированы' });
      return;
    }
    
    // Определяем направление синхронизации
    if (status.localCount > status.cloudCount) {
      // Загружаем в облако
      const uploadResponse = await fetch(`${req.protocol}://${req.get('host')}/api/sync/upload`, {
        method: 'POST',
        headers: { 'Authorization': req.headers.authorization }
      });
      const uploadResult = await uploadResponse.json();
      res.json({ ...uploadResult, direction: 'upload' });
    } else {
      // Скачиваем из облака
      const downloadResponse = await fetch(`${req.protocol}://${req.get('host')}/api/sync/download`, {
        method: 'POST',
        headers: { 'Authorization': req.headers.authorization }
      });
      const downloadResult = await downloadResponse.json();
      res.json({ ...downloadResult, direction: 'download' });
    }
  } catch (error) {
    console.error('Ошибка автоматической синхронизации:', error);
    res.status(500).json({ error: 'Ошибка автоматической синхронизации' });
  }
});

module.exports = router; 