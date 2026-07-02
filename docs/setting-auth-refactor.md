# Setting Auth Refactor — TODO

Yêu cầu từ người đẹp, sẽ implement sau khi RAG flow ổn định.

---

## Mục tiêu

Refactor toàn bộ hệ thống Setting encrypt/decrypt:
- **Bỏ** cơ chế yêu cầu user nhập passphrase để encrypt/decrypt fields.
- **Mặc định** tất cả encrypt/decrypt đều dùng `APP_SECRET` (hiện tại: `Bibabibo@2003`).
- **Sau này**: `APP_SECRET` sẽ không hardcode nữa, mà được trả về từ backend cùng access token khi user đăng nhập.

---

## Kiến trúc tương lai (guest mode + auth)

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

---

## Scope refactor

### Files cần sửa

| File | Thay đổi |
|---|---|
| `src/lib/appSecret.ts` | Sau này sẽ đọc key từ auth response thay vì hardcode |
| `src/routes/Setting.tsx` | Bỏ `PassphraseRow` trong SettingDialog, luôn dùng APP_SECRET |
| `src/lib/reader/vault.ts` | Bỏ chained candidates, chỉ dùng APP_SECRET |
| `src/lib/rag/rag-vault.ts` | Đã dùng APP_SECRET (done) |
| `src/stores/cryptoStore.ts` | Có thể deprecate hoặc chuyển sang lưu encryption_key từ auth |
| `src/components/rag/RagTokensManager.tsx` | Đã dùng APP_SECRET (done) |

### Data migration

- Records cũ (Reader, P2P) đang encrypt bằng passphrase user nhập → cần re-encrypt bằng APP_SECRET.
- Viết script migration: decrypt (old passphrase) → re-encrypt (APP_SECRET) → PUT update.
- Hoặc: cho user nhập passphrase cũ 1 lần cuối → app tự re-encrypt tất cả.

---

## Trạng thái hiện tại

- [x] RAG tokens: đã dùng APP_SECRET (không cần passphrase)
- [ ] Reader vault: vẫn dùng chained candidates (APP_SECRET có trong chain nhưng nếu data encrypt bằng passphrase khác thì không decrypt được)
- [ ] Setting dialog generic: vẫn có PassphraseRow, vẫn cho user nhập/decrypt tay
- [ ] Guest mode UI: chưa implement
- [ ] Auth system: chưa implement

---

## Lưu ý

- Không implement khi đang test RAG — tránh break data hiện có.
- Khi bắt đầu, plan riêng + confirm trước khi sửa vault/setting.
