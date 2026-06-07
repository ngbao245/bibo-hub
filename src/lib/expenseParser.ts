import { parseMoney } from './moneyParse';
import type { ExpenseCategory } from './expense';

// ============================================================
// Expense parser - "cà phê 35k" → { name, amount, category }
// ============================================================
//
// Đơn giản hoá v1:
// 1. Tách số cuối cùng thành amount
// 2. Phần text còn lại là name
// 3. Match keywords trong name để detect category
// ============================================================

interface ParsedExpense {
  name: string;
  amount: number;
  category: ExpenseCategory;
  raw: string;
}

// ============================================================
// Keyword → category map (Vietnamese, no diacritics matching)
// ============================================================

const CATEGORY_KEYWORDS: { category: ExpenseCategory; keywords: string[] }[] = [
  {
    category: 'food',
    keywords: [
      'an', 'ăn', 'uong', 'uống', 'ca phe', 'cà phê', 'cafe', 'tra sua', 'trà sữa',
      'com', 'cơm', 'pho', 'phở', 'bun', 'bún', 'mi', 'mì', 'banh', 'bánh',
      'ga', 'gà', 'bo', 'bò', 'lau', 'lẩu', 'nhau', 'nước', 'nuoc',
      'tra', 'trà', 'snack', 'kem', 'sua', 'sữa',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'xang', 'xăng', 'grab', 'be', 'gojek', 'taxi', 'xe', 'gui xe', 'gửi xe',
      'parking', 've xe', 'vé xe', 'gui', 'shipping', 'ship',
    ],
  },
  {
    category: 'keycap',
    keywords: [
      'keycap', 'key cap', 'switch', 'switches', 'ban phim', 'bàn phím',
      'keyboard', 'gmk', 'mt3', 'sa profile', 'pbt', 'abs', 'cherry',
    ],
  },
  {
    category: 'tech',
    keywords: [
      'laptop', 'pc', 'cpu', 'gpu', 'ram', 'ssd', 'hdd', 'monitor', 'man hinh', 'màn hình',
      'chuot', 'chuột', 'mouse', 'tai nghe', 'headset', 'loa', 'speaker',
      'sac', 'sạc', 'cap', 'cáp', 'usb', 'hub', 'dock', 'phone', 'dien thoai', 'điện thoại',
    ],
  },
  {
    category: 'shopping',
    keywords: [
      'mua', 'shopee', 'lazada', 'tiki', 'sendo', 'ao', 'áo', 'quan', 'quần',
      'giay', 'giày', 'tui', 'túi', 'balo', 'do', 'đồ',
    ],
  },
  {
    category: 'travel',
    keywords: [
      'di lich', 'du lich', 'du lịch', 'travel', 'khach san', 'khách sạn', 'hotel',
      'hostel', 'air bnb', 'airbnb', 've may bay', 'vé máy bay', 'flight',
    ],
  },
  {
    category: 'gift',
    keywords: [
      'qua', 'quà', 'tang', 'tặng', 'gift', 'hoa', 'le', 'lễ',
    ],
  },
  {
    category: 'course',
    keywords: [
      'khoa hoc', 'khóa học', 'course', 'sach', 'sách', 'book', 'udemy',
      'coursera', 'pluralsight', 'hoc phi', 'học phí',
    ],
  },
  {
    category: 'health',
    keywords: [
      'thuoc', 'thuốc', 'kham', 'khám', 'bv', 'benh vien', 'bệnh viện',
      'thuoc tay', 'phong gym', 'gym', 'pt',
    ],
  },
];

/** Bỏ dấu tiếng Việt + lowercase để match keyword */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/** Detect category từ name */
export function detectCategory(name: string): ExpenseCategory {
  const normalized = normalize(name);
  // Match exact word boundary
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      const normalizedKw = normalize(kw);
      // Word boundary: trước/sau là space hoặc đầu/cuối string
      const re = new RegExp(`(^|\\s)${escapeRegex(normalizedKw)}(\\s|$)`);
      if (re.test(normalized)) {
        return category;
      }
    }
  }
  return 'other';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Main parser
// ============================================================
//
// Lấy số cuối cùng làm amount, phần còn lại là name.
// Examples:
//   "cà phê 35k"      → { name: "cà phê", amount: 35000, cat: food }
//   "xăng 50"         → { name: "xăng", amount: 50000? hoặc 50?
//   "GMK keycap 800k" → { name: "GMK keycap", amount: 800000, cat: keycap }
//
// Edge case "50":
// - 1-3 chữ số không suffix → assume nghìn (k) - phổ biến với chi tiêu hằng ngày
// - 4+ chữ số → coi là VND đầy đủ
// ============================================================

const AMOUNT_REGEX = /(\d+(?:[.,]\d+)?(?:k|m|tr|tỷ|tỉ|ty)?)\s*$/i;

export function parseExpenseInput(input: string): ParsedExpense | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(AMOUNT_REGEX);
  if (!match) {
    // Không có số → vẫn cho phép, amount = 0
    return {
      name: trimmed,
      amount: 0,
      category: detectCategory(trimmed),
      raw: input,
    };
  }

  const amountStr = match[1];
  const name = trimmed.slice(0, match.index).trim();

  // Auto k convention: số 1-3 chữ số không suffix → nhân 1000
  let amount = parseMoney(amountStr);
  const hasSuffix = /[a-zA-Z]/.test(amountStr);
  if (!hasSuffix && amount > 0 && amount < 1000) {
    amount = amount * 1000;
  }

  return {
    name: name || trimmed,
    amount,
    category: detectCategory(name || trimmed),
    raw: input,
  };
}
