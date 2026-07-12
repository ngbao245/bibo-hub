---
status: frozen
last_verified: 2026-07-06
replacement: .kiro/specs/setting-auth-refactor/
reason: implemented — plan này giữ làm lịch sử ý tưởng ban đầu
---

# Setting Auth Refactor — Planning Note (historical)

> **Status**: FROZEN. Đã implement dưới hướng khác với plan gốc.
>
> Spec thực tế: `.kiro/specs/setting-auth-refactor/` (requirements + design + tasks).
>
> Plan gốc dưới đây giả định derive-key-from-password (D1). Implementation cuối cùng chọn Supabase Auth + `user_secrets` server-side (D3-variant), rồi refined thành clean design: Supabase Auth + `app_settings` plaintext + RLS + hybrid admin/app-user model. Xem spec để biết chi tiết cuối.

## Mục tiêu

Refactor toàn bộ hệ thống Setting encrypt/decrypt:
- Bỏ cơ chế yêu cầu user nhập passphrase để encrypt/decrypt fields.
- Mặc định tất cả encrypt/decrypt đều dùng `APP_SECRET` (hiện tại hardcode `Bibabibo@2003`).
- Sau này: `APP_SECRET` sẽ không hardcode nữa, mà được trả về từ backend cùng access token khi user đăng nhập.

## Người dùng liên quan

- **User authenticated**: đăng nhập → nhận encryption key → app tự encrypt/decrypt sensitive fields.
- **User guest**: chưa đăng nhập → ẩn toàn bộ Setting sensitive (RAG tokens, Reader creds, P2P config).

## Ý tưởng scope

### Must-have (candidate)

- **US-1**: User đã đăng nhập → Setting tự động encrypt/decrypt sensitive fields, không cần nhập passphrase mỗi lần.
- **US-2**: User guest → ẩn sensitive sections (RAG, Reader, P2P), chỉ thấy public tools (theme, ngôn ngữ, v.v.).
- **US-3**: User cũ (data đã encrypt bằng passphrase khác APP_SECRET) → migration path: dialog nhập passphrase cũ 1 lần → decrypt + re-encrypt bằng key mới.

### Nice-to-have (candidate)

- Auto-rotate encryption key (backend trả key mới định kỳ) — phase 2.

## Business rules (candidate)

- Guest mode = KHÔNG có token trong session. Auth mode = có token hợp lệ.
- Backend trả `{access_token, encryption_key}` trong response login. `encryption_key` dùng thay `APP_SECRET`.
- Key không lưu localStorage plaintext — chỉ giữ trong memory (Zustand store) trong session.
- Logout → clear key khỏi memory, back to guest mode.

## Out of scope

- **Backend auth implementation** — chỉ scope client-side refactor. Backend build riêng.
- **Multi-user data sharing** — vẫn single-user.
- **Encryption algorithm đổi** — giữ AES hiện tại (chỉ đổi key source).

## Ràng buộc kỹ thuật

- **Không break data hiện có**: records cũ trong MockAPI phải decrypt được (qua migration path).
- **Không hardcode key trong bundle**: sau refactor, `APP_SECRET` biến khỏi source code.
- **Guest mode fallback**: nếu backend chưa sẵn sàng, guest mode phải work được với public tools.

## Kiến trúc tương lai (sketch)

```
App boot
  ├─ Không có token → Guest mode
  │   - Ẩn toàn bộ Setting sensitive (RAG tokens, Reader creds, P2P config)
  │   - Chỉ hiện public tools
  │
  └─ Có token (đăng nhập) → Authenticated mode
      - Backend trả access_token + encryption_key (thay APP_SECRET)
      - App dùng encryption_key để encrypt/decrypt mọi Setting field
      - Không hardcode key trong bundle nữa
```

## Màn hình / Views (sketch)

- **Setting page — Guest mode**: header "Đăng nhập", chỉ public sections (Theme, Ngôn ngữ, Shortcut), ẩn RAG tokens / Reader creds / P2P config.
- **Setting page — Auth mode**: header "Đăng xuất" + email, đầy đủ sections, sensitive fields hiển thị đã decrypt sẵn.
- **Migration dialog** (1 lần): textarea nhập passphrase cũ → decrypt all → re-encrypt → PUT update → dismiss forever. Trigger: app boot detect decrypt fail với key mới.

## Luồng chính (sketch)

1. User đăng nhập → backend trả `{access_token, encryption_key}`
2. App lưu `encryption_key` vào Zustand `authStore` (memory only, không localStorage)
3. App decrypt tất cả Setting fields dùng key này
4. User chỉnh → save → auto encrypt lại
5. User logout → clear `authStore` → back to guest mode

## Edge cases

- **Token hết hạn giữa session**: refresh token flow (backend responsibility)
- **Key mất giữa session**: force logout, user login lại
- **Decrypt fail** (data cũ encrypt bằng key khác): hiện migration dialog
- **Backend down khi login**: hiện error, giữ guest mode

## Storage (candidate)

- **Zustand store `authStore`**: `{accessToken, encryptionKey, user}` — memory only, không persist
- **MockAPI `/Config`**: records vẫn ở đây, chỉ đổi cách encrypt
- **localStorage**: không lưu key. Chỉ lưu `hasLoggedInBefore` flag để show "welcome back" text

## Integration

- **RAG**: `rag-vault.ts` đã dùng APP_SECRET → sau refactor dùng `encryption_key` từ authStore
- **Reader**: `vault.ts` phải bỏ chained candidates → dùng thẳng key mới
- **P2P**: config field cũng encrypt bằng key mới
- **Crypto tool** (`src/modals/Crypto.tsx`): tool này là utility encrypt/decrypt manual, không đụng auth flow

## Files cần sửa (dự kiến)

| File | Thay đổi |
|---|---|
| `src/lib/appSecret.ts` | Đọc key từ authStore thay vì hardcode |
| `src/routes/Setting.tsx` | Bỏ `PassphraseRow` trong SettingDialog |
| `src/lib/reader/vault.ts` | Bỏ chained candidates, chỉ dùng key từ authStore |
| `src/stores/cryptoStore.ts` | Deprecate hoặc rename thành `authStore` |
| `src/stores/authStore.ts` (NEW) | Lưu `{accessToken, encryptionKey, user}` memory only |
| `src/components/SettingGuestBanner.tsx` (NEW) | Component cho guest mode empty state |
| `src/components/MigrationDialog.tsx` (NEW) | Dialog migrate data cũ |

## Trạng thái hiện tại (snapshot 2026-07-02)

- [x] RAG tokens: đã dùng APP_SECRET (không cần passphrase) — xem `src/lib/rag/rag-vault.ts`
- [ ] Reader vault: vẫn dùng chained candidates — xem `src/lib/reader/vault.ts`
- [ ] Setting dialog generic: vẫn có `PassphraseRow` — xem `src/routes/Setting.tsx`
- [ ] Guest mode UI: chưa implement
- [ ] Auth system: chưa implement (backend chưa có)

## Lưu ý

- KHÔNG implement khi đang test RAG — tránh break data hiện có.
- Khi bắt đầu spec đầy đủ: qua Pha 1 elicit (`planner-mode.md`) trước khi viết design/tasks.