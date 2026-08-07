# AGENT.md — Rule cho AI khi làm việc với tests

File này dành cho AI agent (Kiro, Claude, Copilot, Codex...). User đọc `README.md` thay vì file này.

## Trước khi viết test

**HỎI**: task hiện tại có phải fix bug security hoặc thêm authorization logic không? Xem `tests/README.md` mục "Khi nào cần thêm test".

**KHÔNG tự viết test khi:**

- Task chỉ đổi UI/CSS/copy.
- Task refactor thuần (không đổi behavior).
- User không explicit yêu cầu test.
- Không có bug reproducible.

**BẮT BUỘC viết test khi:**

- User yêu cầu "add test", "write test", "TDD", "regression".
- Fix security bug (IDOR, SSRF, XSS, injection, auth bypass) — Prove-It Pattern: viết test fail trước, fix sau, test pass là done.
- Sửa boundary validation (input schema, URL policy, allowlist).

## Rule khi viết test

### 1. Không đụng test hiện có

Khi task mới, chỉ ADD test file mới hoặc test case mới trong file liên quan. **Không sửa test khác**.

Nếu test cũ fail sau khi bạn thay đổi code:
- Nếu behavior đổi có ý → sửa test cho khớp behavior mới + note lý do.
- Nếu behavior đổi vô ý → sửa code lại, không sửa test.

### 2. Không mock trừ khi bắt buộc

Test hiện tại là pure unit — logic được re-implement trong test file (không import từ Edge Function vì Deno vs Node runtime).

Nếu cần mock:
- Mock external service (fetch, Supabase client) — OK.
- Mock internal logic của app — KHÔNG (test sẽ sai vì implementation thật khác).

### 3. Cấu trúc test file

```ts
import { describe, it, expect } from 'vitest';

// (Optional) Re-implement logic từ source nếu source ở Deno/Edge runtime
function myLogic(x: X): Y { /* ... */ }

// 1 describe per feature/function
describe('myLogic — grouped behavior', () => {
  // 1 it per specific case
  it('handles case A', () => {
    const input = /* arrange */;
    const result = myLogic(input);
    expect(result).toEqual(/* expected */);
  });

  it('handles case B (edge case)', () => { /* ... */ });
});
```

**Tên test phải mô tả behavior**, không phải implementation:
- ✓ `'strips user_id from insert payload'`
- ✗ `'sanitize function works correctly'`

### 4. Không thêm dependency

Vitest đã cài. Không thêm `@testing-library/*`, `jest`, `mocha`, `supertest`... trừ khi user explicit yêu cầu.

Nếu cần assertion phức tạp, dùng Vitest built-in: `.toEqual`, `.toMatchObject`, `.toThrow`, `.toHaveProperty`,...

### 5. Không viết integration test đụng DB/network

Test hiện tại là **pure unit**. Không có test runner cho:
- Chạy Deno Edge Function thật
- Kết nối Supabase test project
- Gọi HTTP thật

Nếu task yêu cầu integration test, HỎI user trước — cần setup framework mới (Playwright, Vitest browser mode, hoặc Deno test).

### 6. Verify sau khi viết

Chạy `npm test` sau khi thêm test:
- Test mới pass → OK
- Test mới fail → xem test đúng chưa; nếu đúng thì fix code (Prove-It Pattern)
- Test khác bị break → sửa code, đừng sửa test khác

### 7. Test là spec

Test phải đọc như spec, không phải implementation dump. Khi đọc test file, người khác phải hiểu được "code này đang bảo vệ điều gì".

## Khi refactor code có test

Trước khi refactor:
1. Chạy `npm test` — confirm baseline pass.
2. Refactor.
3. Chạy `npm test` lại — nếu fail, kiểm tra:
   - Test đang bảo vệ behavior chính đáng → sửa lại code cho khớp test.
   - Test bảo vệ implementation detail không đáng → xin permission user để sửa/xoá test đó.

**KHÔNG** tự xoá test để "làm cho pass". Đây là red flag lớn.

## Khi thêm tool mới có security boundary

Nếu tool mới có:
- CRUD proxy → viết `tests/{tool}/authorization.test.ts` (copy pattern từ `bookmarks/tenant-isolation.test.ts`)
- Fetch URL user-provided → viết `tests/{tool}/url-safety.test.ts` (copy pattern từ `bookmarks/ssrf-policy.test.ts`)
- Input validation phức tạp → viết `tests/{tool}/validation.test.ts`

## Reference

- Test pattern reference: `tests/bookmarks/tenant-isolation.test.ts`, `tests/bookmarks/ssrf-policy.test.ts`
- Spec liên quan: `.kiro/specs/bookmarks-security-hardening/`
- TDD workflow: skill `test-driven-development` (nếu Kiro có access)
