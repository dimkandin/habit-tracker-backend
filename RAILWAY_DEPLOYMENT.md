# 🚂 Развертывание на Railway

## 🎯 **Быстрый старт**

### **1. Подготовка репозитория**
- ✅ Backend готов к деплою
- ✅ Production конфигурация настроена
- ✅ Procfile создан
- ✅ package.json обновлен

### **2. Развертывание на Railway**

#### **Шаг 1: Создание проекта**
1. Перейдите на [Railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите "Deploy from GitHub repo"

#### **Шаг 2: Подключение репозитория**
1. Выберите репозиторий: `dimkandin/habit-tracker`
2. Выберите ветку: `main`
3. Выберите папку: `backend`
4. Нажмите "Deploy Now"

#### **Шаг 3: Настройка базы данных**
1. В проекте Railway нажмите "New"
2. Выберите "Database" → "PostgreSQL"
3. Railway автоматически создаст базу данных
4. Скопируйте переменные окружения

#### **Шаг 4: Настройка переменных окружения**
В настройках проекта добавьте:

```env
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this
FRONTEND_URL=https://dimkandin.github.io
```

Railway автоматически добавит:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## 🔧 **Проверка деплоя**

### **Health Check:**
```bash
curl https://your-app-name.railway.app/api/health
```

### **Ожидаемый ответ:**
```json
{
  "status": "OK",
  "timestamp": "2025-08-05T21:45:00.000Z",
  "environment": "production",
  "database": {
    "sqlite": "disabled",
    "postgresql": "configured"
  },
  "platform": "Railway",
  "version": "1.0.0"
}
```

## 📊 **Мониторинг**

### **Railway Dashboard:**
- **Logs** - просмотр логов в реальном времени
- **Metrics** - мониторинг производительности
- **Variables** - управление переменными окружения
- **Settings** - настройки домена и SSL

### **Полезные команды:**
```bash
# Просмотр логов
railway logs

# Переменные окружения
railway variables

# Перезапуск сервиса
railway restart
```

## 🔗 **Интеграция с PWA**

После успешного деплоя обновите PWA:

### **1. Обновление API URL:**
```javascript
// src/services/api.js
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-app-name.railway.app/api'
  : 'http://localhost:5001/api';
```

### **2. Обновление CORS:**
```javascript
// backend/config/production.js
cors: {
  origin: [
    'https://dimkandin.github.io',
    'https://your-app-name.railway.app'
  ],
  credentials: true
}
```

## 🎉 **Результат**

После успешного деплоя:

### **✅ Что будет работать:**
- 🌐 **Облачный API** - доступен с любого устройства
- 💾 **PostgreSQL** - надежное хранение данных
- 🔄 **Синхронизация** - между всеми устройствами
- 📱 **PWA** - полноценная работа на телефоне
- 🔒 **SSL** - безопасное соединение

### **🔄 Жизненный цикл данных:**
```
📱 Телефон → ☁️ Railway API → 💾 PostgreSQL
💻 Компьютер → ☁️ Railway API → 💾 PostgreSQL
📱 Планшет → ☁️ Railway API → 💾 PostgreSQL
```

## 🚀 **Готовы к деплою?**

Следуйте инструкциям выше и ваш backend будет работать в облаке! 