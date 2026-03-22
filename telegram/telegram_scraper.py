"""
Telegram Deal Scraper - Không cần API
Scrape trực tiếp từ web Telegram
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import time

# Cấu hình
CHANNEL_USERNAME = 'cuongtruewireless'
CHANNEL_URL = f'https://t.me/s/{CHANNEL_USERNAME}'
DEALS_FILE = 'deals.txt'
SEEN_IDS_FILE = 'seen_messages.json'
CHECK_INTERVAL = 300  # Kiểm tra mỗi 5 phút (300 giây)

def load_seen_ids():
    """Load danh sách tin nhắn đã xem"""
    if os.path.exists(SEEN_IDS_FILE):
        with open(SEEN_IDS_FILE, 'r', encoding='utf-8') as f:
            return set(json.load(f))
    return set()

def save_seen_ids(seen_ids):
    """Lưu danh sách tin nhắn đã xem"""
    with open(SEEN_IDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(seen_ids), f)

def save_deal(message_id, message_text, message_date, message_link):
    """Lưu mã giảm giá vào file"""
    with open(DEALS_FILE, 'a', encoding='utf-8') as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"📅 Ngày: {message_date}\n")
        f.write(f"🔗 Link: {message_link}\n")
        f.write(f"📝 Nội dung:\n{message_text}\n")
    print(f"✅ Đã lưu deal mới (ID: {message_id})")

def scrape_channel():
    """Scrape tin nhắn từ kênh Telegram"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(CHANNEL_URL, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        messages = soup.find_all('div', class_='tgme_widget_message')
        
        deals = []
        for msg in messages:
            try:
                # Lấy ID tin nhắn
                msg_link = msg.get('data-post', '')
                if not msg_link:
                    continue
                message_id = msg_link.split('/')[-1]
                
                # Lấy nội dung
                text_div = msg.find('div', class_='tgme_widget_message_text')
                if not text_div:
                    continue
                message_text = text_div.get_text(strip=True)
                
                # Lấy thời gian
                time_tag = msg.find('time')
                message_date = time_tag.get('datetime', 'N/A') if time_tag else 'N/A'
                
                # Link đầy đủ
                message_link = f"https://t.me/{CHANNEL_USERNAME}/{message_id}"
                
                deals.append({
                    'id': message_id,
                    'text': message_text,
                    'date': message_date,
                    'link': message_link
                })
            except Exception as e:
                continue
        
        return deals
    
    except requests.exceptions.RequestException as e:
        print(f"❌ Lỗi kết nối: {e}")
        return []
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        return []

def main():
    """Hàm chính"""
    print("🚀 Telegram Deal Scraper - Không cần API!")
    print(f"📡 Đang theo dõi kênh: {CHANNEL_USERNAME}")
    print(f"⏱️  Kiểm tra mỗi {CHECK_INTERVAL} giây")
    print(f"💾 Lưu vào file: {DEALS_FILE}")
    print("="*60)
    
    seen_ids = load_seen_ids()
    
    while True:
        try:
            print(f"\n🔍 Đang kiểm tra... ({datetime.now().strftime('%H:%M:%S')})")
            
            deals = scrape_channel()
            
            if not deals:
                print("⚠️  Không lấy được dữ liệu, thử lại sau...")
            else:
                new_count = 0
                for deal in deals:
                    if deal['id'] not in seen_ids:
                        save_deal(deal['id'], deal['text'], deal['date'], deal['link'])
                        seen_ids.add(deal['id'])
                        new_count += 1
                
                if new_count > 0:
                    save_seen_ids(seen_ids)
                    print(f"🎉 Tìm thấy {new_count} deal mới!")
                else:
                    print("✓ Không có deal mới")
            
            print(f"⏳ Chờ {CHECK_INTERVAL} giây để kiểm tra lại...")
            time.sleep(CHECK_INTERVAL)
            
        except KeyboardInterrupt:
            print("\n\n👋 Đã dừng script. Tạm biệt!")
            break
        except Exception as e:
            print(f"❌ Lỗi không mong đợi: {e}")
            print(f"⏳ Thử lại sau {CHECK_INTERVAL} giây...")
            time.sleep(CHECK_INTERVAL)

if __name__ == '__main__':
    main()
