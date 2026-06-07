# Project Packer — Format Specification & Implementation Guide

Tài liệu này đặc tả **đầy đủ** format `project-packed` và thuật toán pack/unpack.
Mục tiêu: một AI agent (hoặc dev) **không có context** project này vẫn có thể đọc tài liệu rồi tự tay viết được:
- **Packer**: chuyển 1 thư mục project thành 1 hoặc nhiều file `.txt` (hoặc 1 file `.zip` chứa các `.txt`).
- **Unpacker**: nhận chuỗi text / file `.txt` / file `.zip` → khôi phục lại thành thư mục project (file ZIP để download).

Format này được thiết kế để dán qua chat (ChatGPT, Claude, Gemini...) và phải sống sót khi chuỗi text đi qua nhiều layer encoding/copy-paste.

---

## 1. Tại sao có format này?

Một số môi trường (công ty, mạng nội bộ) **chặn upload/download file** nhưng cho phép chat.
Để chuyển 1 project source code qua chat, ta cần:
1. Serialize toàn bộ source thành **plain text**.
2. Chia nhỏ nếu chat tool có giới hạn ký tự (hầu hết tool chịu ~50K-100K chars/message).
3. Phía nhận **dán text → khôi phục lại source**.

Format dùng các marker chuỗi đặc biệt làm ranh giới giữa các file. Marker chọn theo nguyên tắc:
- Không trùng với syntax của ngôn ngữ phổ biến (TS/JS/CSS/Python/...).
- Bắt đầu bằng `===` để dễ phát hiện trực quan.
- Tự descriptive (đọc tên hiểu ngay).

---

## 2. Format specification (chuẩn cuối)

### 2.1. Các marker

```