"""
server/telegram_listener.py

Слушает новые сообщения в канале через ТВОЙ личный аккаунт (Telethon),
без необходимости быть администратором канала. Работает, если ты просто
состоишь в канале как участник - точно так же, как видишь посты в приложении.

Первый запуск попросит номер телефона и код подтверждения (как обычный вход
в Telegram) - после этого создаётся файл сессии, и повторной авторизации
не требуется.

Установка:
    cd server
    uv add telethon

Запуск (процесс должен работать постоянно, пока нужны live-обновления):
    uv run python telegram_listener.py
"""

import asyncio
from datetime import datetime, timezone

from telethon import TelegramClient, events

from main import init_db, save_reading, parse_message

# Получи на https://my.telegram.org -> API development tools
API_ID = 33213986           # <-- впиши сюда своё число
API_HASH = "34fe61fb1206ff6309c63ee161050ff5"   # <-- впиши сюда свою строку

# Username канала (без @) или его ID/ссылка-приглашение для приватных каналов
CHANNEL = "test_temp_nu"  # <-- впиши сюда

SESSION_NAME = "nu_atrium_session"  # файл сессии создастся рядом при первом запуске

client = TelegramClient(SESSION_NAME, API_ID, API_HASH)


@client.on(events.NewMessage(chats=CHANNEL))
async def handler(event):
    text = event.message.message or ""
    parsed = parse_message(text)

    if not parsed:
        return

    created_at = event.message.date.astimezone(timezone.utc).replace(tzinfo=None).isoformat()

    save_reading(
        location=parsed["location"],
        temperature=parsed["temperature"],
        brightness=parsed.get("brightness"),
        noise_db=parsed.get("noise_db"),
        created_at=created_at,
    )
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Сохранено: {parsed}")


async def main():
    init_db()
    await client.start()
    print("Слушаю канал... (Ctrl+C для остановки)")
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())