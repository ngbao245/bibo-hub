"""
Telegram Deal Tracker - Theo dõi mã giảm giá từ kênh Telegram
Hoàn toàn miễn phí, chạy trên máy local
"""

from telethon import TelegramClient, events
import asyncio
from datetime import datetime
import json
import os

# Cấu hình - BẠN CẦN ĐIỀN THÔNG TIN NÀY
API_ID = 'YOUR_API_ID'  # Lấy từ https://my.telegram.org
API_HASH = 'YOUR_API_HASH'  # Lấy từ https://my.telegram.org
CHANNEL_USERNAME = 'cuongtruewireless'  # Tên kênh cần theo dõi

# File lưu trữ
DEALS_FILE = 'deals.txt'
SEEN_IDS_FILE = 'seen_messages.json'

def load_seen_ids():
    """Load danh sách tin nhắn đã xem"""
    if os.path.exists(SEEN_IDS_FILE):
        with open(SEEN_IDS_FILE, 'r', encoding='utf-8') as f:
            return set(json.load(f))
    return set()

def save_seen_id(message_id):
    """Lưu ID tin nhắn đã xem"""
    seen_ids = load_seen_ids()
    seen_ids.add(message_id)
    with open(SEEN_IDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(seen_ids), f)

def save_deal(message_text, message_date, message_link):
    """Lưu mã giảm giá vào file"""
    with open(DEALS_FILE, 'a', encoding='utf-8') as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"📅 Ngày: {message_date.strftime('%d/%m/%Y %H:%M')}\n")
        f.write(f"🔗 Link: {message_link}\n")
        f.write(f"📝 Nội dung:\n{message_text}\n")
    print(f"✅ Đã lưu deal mới vào {DEALS_FILE}")

async def main():
    """Hàm chính"""
    # Tạo client
    client = TelegramClient('session_name', API_ID, API_HASH)
    
    await client.start()
    print("✅ Đã kết nối Telegram!")
    
    # Lấy thông tin kênh
    try:
        channel = await client.get_entity(CHANNEL_USERNAME)
        print(f"✅ Đã tìm thấy kênh: {channel.title}")
    except Exception as e:
        print(f"❌ Lỗi: Không tìm thấy kênh. Kiểm tra lại tên kênh.")
        return
    
    seen_ids = load_seen_ids()
    
    # Lấy tin nhắn mới nhất (10 tin gần nhất)
    print("\n🔍 Đang kiểm tra tin nhắn mới...")
    async for message in client.iter_messages(channel, limit=10):
        if message.id not in seen_ids and message.text:
            message_link = f"https://t.me/{CHANNEL_USERNAME}/{message.id}"
            save_deal(message.text, message.date, message_link)
            save_seen_id(message.id)
    
    print("\n👂 Đang lắng nghe tin nhắn mới... (Nhấn Ctrl+C để dừng)")
    
    # Lắng nghe tin nhắn mới
    @client.on(events.NewMessage(chats=channel))
    async def handler(event):
        if event.message.text:
            message_link = f"https://t.me/{CHANNEL_USERNAME}/{event.message.id}"
            save_deal(event.message.text, event.message.date, message_link)
            save_seen_id(event.message.id)
            print(f"\n🔔 CÓ DEAL MỚI! Kiểm tra file {DEALS_FILE}")
    
    # Chạy mãi mãi
    await client.run_until_disconnected()

if __name__ == '__main__':
    asyncio.run(main())
