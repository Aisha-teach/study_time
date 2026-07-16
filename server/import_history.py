"""
server/import_history.py

Одноразовый импорт истории канала из экспорта Telegram (Machine-readable JSON)
в ту же SQLite-базу, которую использует main.py.

Как получить файл:
  Telegram Desktop -> канал -> "..." -> Export chat
  Формат: Machine-readable JSON
  From: the oldest message, to: present

После экспорта Telegram создаст папку, внутри неё файл result.json.

Запуск (из папки server, через uv):
    uv run python import_history.py путь/к/result.json
"""

import sys
import json
from datetime import datetime

from main import init_db, save_reading, parse_message


def extract_text(message: dict) -> str:
    """
    В экспорте Telegram поле 'text' бывает либо строкой,
    либо списком (если есть ссылки/форматирование) - тогда каждый
    элемент списка либо строка, либо словарь с ключом 'text'.
    """
    text = message.get("text", "")

    if isinstance(text, str):
        return text

    if isinstance(text, list):
        parts = []
        for chunk in text:
            if isinstance(chunk, str):
                parts.append(chunk)
            elif isinstance(chunk, dict):
                parts.append(chunk.get("text", ""))
        return "".join(parts)

    return ""


def main(json_path: str):
    init_db()

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    messages = data.get("messages", [])
    print(f"Найдено сообщений в экспорте: {len(messages)}")

    imported = 0
    skipped = 0

    for message in messages:
        if message.get("type") != "message":
            continue

        text = extract_text(message)
        parsed = parse_message(text)

        if not parsed:
            skipped += 1
            continue

        created_at = message.get("date")
        if not created_at:
            unixtime = message.get("date_unixtime")
            created_at = (
                datetime.utcfromtimestamp(int(unixtime)).isoformat()
                if unixtime else datetime.utcnow().isoformat()
            )

        save_reading(
            location=parsed["location"],
            temperature=parsed["temperature"],
            brightness=parsed.get("brightness"),
            noise_db=parsed.get("noise_db"),
            created_at=created_at,
        )
        imported += 1

    print(f"Импортировано записей с показателями: {imported}")
    print(f"Пропущено (не подошли под формат): {skipped}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Использование: uv run python import_history.py путь/к/result.json")
        sys.exit(1)

    main(sys.argv[1])