# Habit Tracker Backend

Backend API для приложения трекера привычек с аутентификацией и синхронизацией.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка базы данных
Создайте файл `.env` на основе `env.example`:
```bash
cp env.example .env
```

Отредактируйте `.env` файл:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=habit_tracker
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 3. Настройка PostgreSQL

#### Локальная установка:
```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Создание базы данных:
```bash
psql -U postgres
CREATE DATABASE habit_tracker;
\q
```

### 4. Запуск сервера
```bash
# Разработка
npm run dev

# Продакшн
npm start
```

## 📊 API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/profile` - Получить профиль
- `PUT /api/auth/profile` - Обновить профиль

### Привычки
- `GET /api/habits` - Получить все привычки
- `POST /api/habits` - Создать привычку
- `PUT /api/habits/:id` - Обновить привычку
- `DELETE /api/habits/:id` - Удалить привычку

### Выполнение привычек
- `POST /api/habits/:id/completion` - Обновить выполнение (бинарная)
- `POST /api/habits/:id/value` - Обновить значение (количественная)
- `POST /api/habits/:id/mood` - Обновить настроение

## 🗄️ Структура базы данных

### Таблицы:
- `users` - Пользователи
- `habits` - Привычки
- `habit_completions` - Выполнение бинарных привычек
- `habit_values` - Количественные значения
- `habit_moods` - Настроения

## 🔧 Развертывание в Yandex Cloud

### 1. Создание PostgreSQL в Yandex Cloud
1. Откройте Yandex Cloud Console
2. Создайте Managed Service for PostgreSQL
3. Настройте сетевой доступ
4. Создайте базу данных и пользователя

### 2. Настройка переменных окружения
```env
NODE_ENV=production
DB_HOST=your-db-host.yandexcloud.net
DB_PORT=5432
DB_NAME=habit_tracker
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=your_production_jwt_secret
FRONTEND_URL=https://your-domain.com
```

### 3. Развертывание
```bash
# Сборка
npm run build

# Запуск
npm start
```

## 🔒 Безопасность

- JWT токены для аутентификации
- Хеширование паролей с bcrypt
- Валидация входных данных
- CORS настройки
- Helmet для защиты заголовков

## 📝 Логирование

- Morgan для HTTP логов
- Консольные логи для ошибок
- Структурированные логи в продакшне

## 🧪 Тестирование

```bash
# Запуск тестов (когда будут добавлены)
npm test
```

## 📦 Зависимости

- **express** - Веб-фреймворк
- **pg** - PostgreSQL клиент
- **bcryptjs** - Хеширование паролей
- **jsonwebtoken** - JWT токены
- **cors** - CORS middleware
- **helmet** - Безопасность
- **morgan** - Логирование
- **dotenv** - Переменные окружения 