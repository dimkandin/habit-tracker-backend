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

// Получить все привычки пользователя
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'SELECT * FROM habits WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      );
      res.json(result.rows);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const getHabits = () => {
        return new Promise((resolve, reject) => {
          db.all(
            'SELECT * FROM habits WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
      };
      const habits = await getHabits();
      db.close();
      res.json(habits);
    }
  } catch (error) {
    console.error('Ошибка получения привычек:', error);
    res.status(500).json({ error: 'Ошибка получения привычек' });
  }
});

// Создать новую привычку
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, category, unit, target, color, type } = req.body;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'INSERT INTO habits (name, description, category, unit, target, color, type, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [name, description, category, unit, target, color, type, req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const createHabit = () => {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO habits (name, description, category, unit, target, color, type, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description, category, unit, target, color, type, req.user.id],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      };
      const habitId = await createHabit();
      const getHabit = () => {
        return new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM habits WHERE id = ?',
            [habitId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      };
      const habit = await getHabit();
      res.status(201).json(habit);
    }
  } catch (error) {
    console.error('Ошибка создания привычки:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка создания привычки',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Обновить привычку
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, unit, target, color, type } = req.body;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'UPDATE habits SET name = $1, description = $2, category = $3, unit = $4, target = $5, color = $6, type = $7 WHERE id = $8 AND user_id = $9 RETURNING *',
        [name, description, category, unit, target, color, type, id, req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Привычка не найдена' });
      }
      res.json(result.rows[0]);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const updateHabit = () => {
        return new Promise((resolve, reject) => {
          db.run(
            'UPDATE habits SET name = ?, description = ?, category = ?, unit = ?, target = ?, color = ?, type = ? WHERE id = ? AND user_id = ?',
            [name, description, category, unit, target, color, type, id, req.user.id],
            function(err) {
              if (err) reject(err);
              else resolve(this.changes);
            }
          );
        });
      };
      const changes = await updateHabit();
      if (changes === 0) {
        return res.status(404).json({ error: 'Привычка не найдена' });
      }
      const getHabit = () => {
        return new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM habits WHERE id = ?',
            [id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      };
      const habit = await getHabit();
      res.json(habit);
    }
  } catch (error) {
    console.error('Ошибка обновления привычки:', error);
    res.status(500).json({ error: 'Ошибка обновления привычки' });
  }
});

// Удалить привычку
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Привычка не найдена' });
      }
      res.json({ message: 'Привычка удалена' });
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const deleteHabit = () => {
        return new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM habits WHERE id = ? AND user_id = ?',
            [id, req.user.id],
            function(err) {
              if (err) reject(err);
              else resolve(this.changes);
            }
          );
        });
      };
      const changes = await deleteHabit();
      if (changes === 0) {
        return res.status(404).json({ error: 'Привычка не найдена' });
      }
      res.json({ message: 'Привычка удалена' });
    }
  } catch (error) {
    console.error('Ошибка удаления привычки:', error);
    res.status(500).json({ error: 'Ошибка удаления привычки' });
  }
});

// Отметить выполнение привычки
router.post('/:id/completion', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, completed } = req.body;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'INSERT INTO habit_completions (habit_id, user_id, date, completed) VALUES ($1, $2, $3, $4) ON CONFLICT (habit_id, user_id, date) DO UPDATE SET completed = $4 RETURNING *',
        [id, req.user.id, date, completed]
      );
      res.json(result.rows[0]);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const addCompletion = () => {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT OR REPLACE INTO habit_completions (habit_id, user_id, date, completed) VALUES (?, ?, ?, ?)',
            [id, req.user.id, date, completed],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      };
      await addCompletion();
      const getCompletion = () => {
        return new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM habit_completions WHERE habit_id = ? AND user_id = ? AND date = ?',
            [id, req.user.id, date],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      };
      const completion = await getCompletion();
      res.json(completion);
    }
  } catch (error) {
    console.error('Ошибка отметки выполнения:', error);
    res.status(500).json({ error: 'Ошибка отметки выполнения' });
  }
});

// Добавить количественное значение
router.post('/:id/value', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, value } = req.body;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'INSERT INTO habit_values (habit_id, user_id, date, value) VALUES ($1, $2, $3, $4) ON CONFLICT (habit_id, user_id, date) DO UPDATE SET value = $4 RETURNING *',
        [id, req.user.id, date, value]
      );
      res.json(result.rows[0]);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const addValue = () => {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT OR REPLACE INTO habit_values (habit_id, user_id, date, value) VALUES (?, ?, ?, ?)',
            [id, req.user.id, date, value],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      };
      await addValue();
      const getValue = () => {
        return new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM habit_values WHERE habit_id = ? AND user_id = ? AND date = ?',
            [id, req.user.id, date],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      };
      const valueRecord = await getValue();
      res.json(valueRecord);
    }
  } catch (error) {
    console.error('Ошибка добавления значения:', error);
    res.status(500).json({ error: 'Ошибка добавления значения' });
  }
});

// Добавить настроение
router.post('/:id/mood', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, mood } = req.body;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'INSERT INTO habit_moods (habit_id, user_id, date, mood) VALUES ($1, $2, $3, $4) ON CONFLICT (habit_id, user_id, date) DO UPDATE SET mood = $4 RETURNING *',
        [id, req.user.id, date, mood]
      );
      res.json(result.rows[0]);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const addMood = () => {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT OR REPLACE INTO habit_moods (habit_id, user_id, date, mood) VALUES (?, ?, ?, ?)',
            [id, req.user.id, date, mood],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      };
      await addMood();
      const getMood = () => {
        return new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM habit_moods WHERE habit_id = ? AND user_id = ? AND date = ?',
            [id, req.user.id, date],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      };
      const moodRecord = await getMood();
      res.json(moodRecord);
    }
  } catch (error) {
    console.error('Ошибка добавления настроения:', error);
    res.status(500).json({ error: 'Ошибка добавления настроения' });
  }
});

// Получить все выполнения привычек пользователя
router.get('/completions', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'SELECT * FROM habit_completions WHERE user_id = $1 ORDER BY date DESC',
        [req.user.id]
      );
      res.json(result.rows);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const getCompletions = () => {
        return new Promise((resolve, reject) => {
          db.all(
            'SELECT * FROM habit_completions WHERE user_id = ? ORDER BY date DESC',
            [req.user.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
      };
      const completions = await getCompletions();
      db.close();
      res.json(completions);
    }
  } catch (error) {
    console.error('Ошибка получения выполнений:', error);
    res.status(500).json({ error: 'Ошибка получения выполнений' });
  }
});

// Получить все значения привычек пользователя
router.get('/values', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'SELECT * FROM habit_values WHERE user_id = $1 ORDER BY date DESC',
        [req.user.id]
      );
      res.json(result.rows);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const getValues = () => {
        return new Promise((resolve, reject) => {
          db.all(
            'SELECT * FROM habit_values WHERE user_id = ? ORDER BY date DESC',
            [req.user.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
      };
      const values = await getValues();
      db.close();
      res.json(values);
    }
  } catch (error) {
    console.error('Ошибка получения значений:', error);
    res.status(500).json({ error: 'Ошибка получения значений' });
  }
});

// Получить все настроения пользователя
router.get('/moods', authenticateToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Production: используем PostgreSQL
      const result = await pool.query(
        'SELECT * FROM habit_moods WHERE user_id = $1 ORDER BY date DESC',
        [req.user.id]
      );
      res.json(result.rows);
    } else {
      // Development: используем SQLite
      const db = new sqlite3.Database(sqlitePath);
      const getMoods = () => {
        return new Promise((resolve, reject) => {
          db.all(
            'SELECT * FROM habit_moods WHERE user_id = ? ORDER BY date DESC',
            [req.user.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
      };
      const moods = await getMoods();
      db.close();
      res.json(moods);
    }
  } catch (error) {
    console.error('Ошибка получения настроений:', error);
    res.status(500).json({ error: 'Ошибка получения настроений' });
  }
});

module.exports = router; 