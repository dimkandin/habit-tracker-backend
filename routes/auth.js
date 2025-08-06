const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');

const isProduction = process.env.NODE_ENV === 'production';

const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    // Хешируем пароль
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    if (isProduction) {
      // Production: PostgreSQL
      const { pool } = require('../config/database');
      const client = await pool.connect();
      try {
        // Проверяем, существует ли пользователь
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
          return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Создаем пользователя
        const result = await client.query(
          'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
          [email.toLowerCase(), passwordHash, name || null]
        );

        const user = result.rows[0];
        const token = generateToken(user.id);

        res.status(201).json({
          message: 'Пользователь успешно зарегистрирован',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          token
        });
      } finally {
        client.release();
      }
    } else {
      // Development: SQLite
      const sqlite3 = require('sqlite3').verbose();
      const { sqlitePath } = require('../config/database');
      const db = new sqlite3.Database(sqlitePath);

      // Проверяем, существует ли пользователь
      db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
        if (err) {
          db.close();
          console.error('Ошибка проверки пользователя:', err);
          return res.status(500).json({ error: 'Ошибка при регистрации' });
        }

        if (row) {
          db.close();
          return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Создаем пользователя
        db.run(
          'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
          [email.toLowerCase(), passwordHash, name || null],
          function(err) {
            db.close(); // Закрываем базу в callback
            
            if (err) {
              console.error('Ошибка создания пользователя:', err);
              return res.status(500).json({ error: 'Ошибка при регистрации' });
            }

            const userId = this.lastID;
            const token = generateToken(userId);

            res.status(201).json({
              message: 'Пользователь успешно зарегистрирован',
              user: {
                id: userId,
                email: email.toLowerCase(),
                name: name || null
              },
              token
            });
          }
        );
      });
    }
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    if (isProduction) {
      // Production: PostgreSQL
      const { pool } = require('../config/database');
      const client = await pool.connect();
      try {
        // Ищем пользователя
        const result = await client.query(
          'SELECT id, email, password_hash, name FROM users WHERE email = $1',
          [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const user = result.rows[0];

        // Проверяем пароль
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = generateToken(user.id);

        res.json({
          message: 'Вход выполнен успешно',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          token
        });
      } finally {
        client.release();
      }
    } else {
      // Development: SQLite
      const sqlite3 = require('sqlite3').verbose();
      const { sqlitePath } = require('../config/database');
      const db = new sqlite3.Database(sqlitePath);

      // Ищем пользователя
      db.get('SELECT id, email, password_hash, name FROM users WHERE email = ?', [email.toLowerCase()], async (err, user) => {
        if (err) {
          db.close();
          console.error('Ошибка поиска пользователя:', err);
          return res.status(500).json({ error: 'Ошибка при входе' });
        }

        if (!user) {
          db.close();
          return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        try {
          // Проверяем пароль
          const isValidPassword = await bcrypt.compare(password, user.password_hash);
          db.close(); // Закрываем базу после проверки
          
          if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
          }

          const token = generateToken(user.id);

          res.json({
            message: 'Вход выполнен успешно',
            user: {
              id: user.id,
              email: user.email,
              name: user.name
            },
            token
          });
        } catch (passwordError) {
          db.close();
          console.error('Ошибка проверки пароля:', passwordError);
          return res.status(500).json({ error: 'Ошибка при входе' });
        }
      });
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка при входе' });
  }
});

// Получение профиля пользователя
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Токен доступа не предоставлен' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (isProduction) {
      // Production: PostgreSQL
      const { pool } = require('../config/database');
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT id, email, name, created_at FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({
          user: result.rows[0]
        });
      } finally {
        client.release();
      }
    } else {
      // Development: SQLite
      const sqlite3 = require('sqlite3').verbose();
      const { sqlitePath } = require('../config/database');
      const db = new sqlite3.Database(sqlitePath);

      db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [decoded.userId], (err, user) => {
        db.close(); // Закрываем базу в callback
        
        if (err) {
          console.error('Ошибка получения профиля:', err);
          return res.status(500).json({ error: 'Ошибка при получении профиля' });
        }

        if (!user) {
          return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({
          user: user
        });
      });
    }
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Ошибка при получении профиля' });
  }
});

// Обновление профиля
router.put('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Токен доступа не предоставлен' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { name } = req.body;

    if (isProduction) {
      // Production: PostgreSQL
      const { pool } = require('../config/database');
      const client = await pool.connect();
      try {
        const result = await client.query(
          'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name',
          [name, decoded.userId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({
          message: 'Профиль обновлен',
          user: result.rows[0]
        });
      } finally {
        client.release();
      }
    } else {
      // Development: SQLite
      const sqlite3 = require('sqlite3').verbose();
      const { sqlitePath } = require('../config/database');
      const db = new sqlite3.Database(sqlitePath);

      db.run('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, decoded.userId], function(err) {
        if (err) {
          db.close();
          console.error('Ошибка обновления профиля:', err);
          return res.status(500).json({ error: 'Ошибка при обновлении профиля' });
        }

        if (this.changes === 0) {
          db.close();
          return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Получаем обновленного пользователя
        db.get('SELECT id, email, name FROM users WHERE id = ?', [decoded.userId], (err, user) => {
          db.close(); // Закрываем базу в callback
          
          if (err) {
            console.error('Ошибка получения обновленного профиля:', err);
            return res.status(500).json({ error: 'Ошибка при обновлении профиля' });
          }

          res.json({
            message: 'Профиль обновлен',
            user: user
          });
        });
      });
    }
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Ошибка при обновлении профиля' });
  }
});

module.exports = router; 