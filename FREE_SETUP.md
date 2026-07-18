# Настройка без оплаты

1. Загрузите проект в отдельный GitHub-репозиторий.
2. Добавьте редакционного Telegram-бота администратором канала.
3. Создайте GitHub Actions Secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHANNEL_ID`
   - `FACEFORM_BOT_URL`
   - `CHANNEL_USERNAME`
4. Откройте Actions и вручную запустите `FaceForm Daily Post`.
5. Проверьте пост в канале.

`OPENAI_API_KEY` больше не нужен.
Railway для автопостера больше не нужен.
