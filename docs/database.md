# Database Schema

## Overview

Dùng **MockAPI** (mockapi.io) với 2 table: `notes` và `tasks`.

Đặc điểm MockAPI:
- REST API tự động (GET/POST/PUT/DELETE)
- Trả JSON array
- Không có auth
- Limit 200 records/request (cần `?limit=200`)
- Field schema define trước, field không define sẽ bị ignore khi POST
- Giá trị mặc định tự generate nếu field có faker config

## Table: notes

Dùng chung cho NHIỀU feature, phân biệt bằng field `type`.

### Fields

| Field | Type | Dùng cho |
|---|---|---|
| id | string | Auto-generated |
| title | string | Tên/tiêu đề |
| content | string | Nội dung HTML (notes) hoặc JSON (expense, keycap) |
| type | string | Discriminator: note/ielts/course/code/secret/source/savings/movie/series/expense/keycap_inventory/order |
| source | string | URL (notes/sources) hoặc Date "YYYY-MM-DD" (expense) |
| tags | string | Tags comma-separated (notes) hoặc status (movies) |
| example | string | Notes only |
| url1-5 | string | Multi-purpose (xem mapping bên dưới) |
| wordCountEnabled | boolean | Notes only |
| timerDuration | string | Notes only |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |

### Type Mapping

#### type = "note" / "ielts" / "course" / "code"
Regular notes. Content = HTML (rich text).

#### type = "secret"
Secret notes. Title + content + url1 = **encrypted** (base64 + reverse).

#### type = "source"
Source code references. url1-5 = extra URLs.

#### type = "savings"
1 record duy nhất.
- title = tên goal
- content = JSON array history `[{amount, date}]`
- url1 = targetAmount (string number)
- url2 = currentAmount
- url3 = deadline (days)
- url4 = QR image base64
- url5 = challenge JSON (deprecated)

#### type = "movie" / "series"
Movies tracker.
- tags = status: "watching" / "completed" / "plan"
- source = watch URL
- url1 = currentTime (movie) / currentEpisode (series)
- url2 = totalTime (movie) / totalEpisodes (series)
- url3 = season (series)
- url4 = rating 1-5
- url5 = episodeDuration (series, deprecated)

#### type = "expense"
1 record per day.
- title = date string
- source = "YYYY-MM-DD"
- content = JSON array: `[{id, name, amount, category, time, raw, meta?}]`

#### type = "keycap_inventory"
1 record duy nhất cho toàn bộ inventory.
- title = "__keycap_inventory__"
- content = JSON: `{ items: [...], lots: [...], groups: [...] }`

#### type = "order" (deprecated, bỏ ở v2)
Orders app.

## Table: tasks

Chứa 2 loại: tasks và lists (custom lists).

### Fields

| Field | Type | Dùng cho |
|---|---|---|
| id | string | Auto |
| title | string | Tên task hoặc list |
| name | string | (MockAPI default, không dùng) |
| description | string | Task description |
| type | string | "task" hoặc "list" |
| status | string | "pending" / "completed" |
| priority | string | "normal" / "high" |
| dueDate | string | ISO timestamp hoặc "YYYY-MM-DD" |
| recurring | boolean | Task lặp hàng ngày |
| parentId | string | ID của list mà task thuộc về |
| url1-3 | string | (không dùng) |
| completedDate | string | ISO timestamp khi hoàn thành |
| createdAt | string | ISO |
| updatedAt | string | ISO |

### Type = "list"
Custom list (nhóm tasks):
- title = tên list
- Các task thuộc list có parentId = list.id

### Type = "task"
Todo item:
- parentId = null (all tasks) hoặc ID list

## Important Notes

1. **MockAPI trả field rác** cho records tạo qua UI MockAPI (vd `"status": "status 10"`). Code phải handle gracefully.

2. **Field không define sẽ bị ignore** — nếu POST field mà schema MockAPI không có, response sẽ không chứa field đó.

3. **Limit 200 records** — cần pass `?limit=200` nếu có nhiều records. Hiện tại code không pass (bug tiềm ẩn nếu data lớn).

4. **No auth** — ai có URL đều access được. Secret notes dùng obfuscation (base64) không phải encryption thật.

5. **All strings** — MockAPI lưu mọi field dạng string. Number fields (url1, url2...) phải parseInt khi dùng.