# Tests — BiBo Hub

Regression + security tests cho các tool trong hub. Vitest 4.1.10 pinned.

## Vì sao có tests

- **Không phải để cover 100% coverage.** Tests ở đây tập trung vào security boundaries + logic dễ regress (authorization, SSRF policy, data validation).
- **Đóng vai regression guard.** Khi ai đó (bạn hoặc AI) refactor code security-sensitive, tests fail ngay nếu vô tình mở lại lỗ hổng.
- **Chạy nhanh (< 1s).** Pure unit test, không đụng DB/network.

## Chạy tests

```bash
npm test              # chạy 1 lần, exit sau khi xong
npm test -- --watch   # watch mode khi đang dev
```

Không có coverage report — không cần thiết cho scope hiện tại.

## Cấu trúc

```
tests/
  README.md           # file này
  AGENT.md            # rule cho AI agent (Kiro, Claude, etc.)
  bookmarks/          # tests cho tool Bookmarks
    tenant-isolation.test.ts    # verify proxy authorization (14 tests)
    ssrf-policy.test.ts         # verify URL safety cho fetch-bookmark-meta (47 tests)
```

Mỗi folder con = 1 tool. Có thể thêm `tests/notes/`, `tests/vault/`,... khi cần.

## Khi nào cần thêm test

Viết test khi:

- Fix bug security-related (IDOR, SSRF, XSS, injection...) — viết test reproduce bug trước khi fix (Prove-It Pattern).
- Thêm authorization logic mới (proxy allowlist, RLS-like check).
- Thêm URL safety check hoặc input validation ở boundary.

**KHÔNG viết test khi:**

- Chỉ đổi UI/CSS/copy text.
- Refactor thuần (rename var, extract function) — không đổi behavior.
- Task quá nhỏ (typo, 1 dòng).

## Pattern viết test mới

Copy structure từ `tests/bookmarks/tenant-isolation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// 1. Re-implement logic cần test (không import từ Edge Function vì
//    Edge Function chạy Deno runtime, test chạy Node)
function myFunction(input: X): Y { /* copy từ source */ }

// 2. Test theo Arrange-Act-Assert
describe('myFunction — behavior name', () => {
  it('does specific thing', () => {
    const input = { /* arrange */ };
    const result = myFunction(input);
    expect(result).toEqual({ /* expected */ });
  });
});
```

**Rule quan trọng:**

- 1 test = 1 hành vi cụ thể. Không gộp nhiều assertions không liên quan.
- Tên test phải mô tả behavior, không phải implementation. VD: `'strips user_id from insert payload'` chứ không phải `'sanitize function returns object'`.
- Không mock trừ khi bắt buộc — pure logic thì dùng real function.
- Không đụng test khác khi thêm test mới.

## CI setup (optional)

Nếu muốn GitHub tự chạy test mỗi PR, tạo `.github/workflows/ci.yml`:

```yaml
name: CI
on: [pull_request, push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run lint
```

PR bị block nếu test/build/lint fail. Không có CI hiện tại → chạy tay khi cần.

## Reference

- Vitest docs: https://vitest.dev/
- Spec liên quan: `.kiro/specs/bookmarks-security-hardening/`
