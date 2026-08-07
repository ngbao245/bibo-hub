# PDF Studio — Huong dan trien khai

## Tong quan

PDF Studio chuyen doi file 12 chieu (PDF, Word, Excel, PPTX, PNG, JPG, EPUB) qua 2 provider: CloudConvert va iLovePDF. Kien truc: Supabase Edge Function lam control plane, browser upload truc tiep voi descriptor ngan han.

## Dieu kien tien quyet

- Supabase Core project da co:
  - Bang `service_providers` da seed `ilovepdf` va `cloudconvert`
  - Bang `service_profiles` co it nhat 1 profile active cho moi provider
  - Bang `service_credentials` co it nhat 1 credential active (API key) cho moi profile
- Edge Function `service-executor` da deploy tren Core project
- User admin da co `profiles.role = 'admin'`

## Buoc 1: Migration metadata (DA CHAY)

File: `backup/supabase/migrations/20260723000000_pdf_studio_jobs.sql`

Tao 4 bang:
- `pdf_studio_batches` — batch metadata
- `pdf_studio_jobs` — job metadata per file
- `pdf_studio_capability_catalog` — validated provider/capability pairs
- `pdf_studio_reservations` — credit reservation ledger

Dong thoi:
- Dang ky tool `pdf_studio` trong bang `tools`
- Them `pdf_studio` vao `allowed_tools` cua role `admin`
- Seed capability catalog (18 rows)
- Seed `tool_settings` default

## Buoc 2: Edge Function `service-executor` (DA DEPLOY)

File: `backup/supabase/functions/service-executor/index.ts`

Deploy qua Dashboard Edge Functions editor (single file, da inline crypto).

Chuc nang:
- Verify JWT (ES256 shared key)
- Check quyen tool qua `profiles.role` + `allowed_tools`
- Chon credential tu pool theo provider policy
- Tra ve descriptor ngan han (token/server/task cho iLovePDF, server_execute cho CloudConvert)
- Reserve/commit credits
- Test connection (admin only)
- Update credential status (admin only)

## Buoc 3: Tao binding cho pdf_studio (DA CHAY)

Binding noi `pdf_studio/pdf.convert` voi provider profile:

```sql
-- Kiem tra binding da co chua
SELECT * FROM tool_service_bindings WHERE tool_code = 'pdf_studio';
```

Neu chua co:

```sql
DO $$
DECLARE
  v_ilovepdf_profile_id uuid;
  v_cloudconvert_profile_id uuid;
BEGIN
  SELECT sp.id INTO v_ilovepdf_profile_id
  FROM service_profiles sp
  JOIN service_providers prov ON sp.provider_id = prov.id
  WHERE prov.code = 'ilovepdf' AND sp.status = 'active'
  ORDER BY sp.created_at LIMIT 1;

  SELECT sp.id INTO v_cloudconvert_profile_id
  FROM service_profiles sp
  JOIN service_providers prov ON sp.provider_id = prov.id
  WHERE prov.code = 'cloudconvert' AND sp.status = 'active'
  ORDER BY sp.created_at LIMIT 1;

  IF v_ilovepdf_profile_id IS NOT NULL THEN
    INSERT INTO tool_service_bindings (tool_code, capability, profile_id, is_primary, priority, enabled)
    VALUES ('pdf_studio', 'pdf.convert', v_ilovepdf_profile_id, true, 0, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_cloudconvert_profile_id IS NOT NULL THEN
    INSERT INTO tool_service_bindings (tool_code, capability, profile_id, is_primary, priority, enabled)
    VALUES ('pdf_studio', 'pdf.convert', v_cloudconvert_profile_id, false, 1, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
```

## Buoc 4: Them CloudConvert API key (NEU CHUA CO)

Neu chua co profile + credential cho CloudConvert:

```sql
-- 1. Tao profile
INSERT INTO service_profiles (provider_id, name, status, settings_json)
SELECT id, 'default', 'active', '{"keySelectionStrategy": "priority"}'::jsonb
FROM service_providers WHERE code = 'cloudconvert'
ON CONFLICT DO NOTHING;

-- 2. Them credential (thay YOUR_API_KEY)
INSERT INTO service_credentials (profile_id, credential_kind, identifier, secret_data_json, status, priority)
SELECT sp.id, 'api_key', 'cloudconvert-key-1', '{"api_key": "YOUR_CLOUDCONVERT_API_KEY"}'::jsonb, 'active', 0
FROM service_profiles sp
JOIN service_providers prov ON sp.provider_id = prov.id
WHERE prov.code = 'cloudconvert' AND sp.name = 'default'
LIMIT 1;
```

## Buoc 5: Cap quyen user (neu can)

Admin da duoc cap quyen tu migration. User thuong can duoc them `pdf_studio` vao role:

```sql
-- Them cho tat ca user (qua role)
UPDATE roles
SET allowed_tools = array_append(allowed_tools, 'pdf_studio'), updated_at = now()
WHERE name = 'user' AND NOT ('pdf_studio' = ANY(allowed_tools));
```

Hoac user co `allowed_tools = ["*"]` thi da co quyen san.

## Buoc 6: Test

1. Dang nhap app → vao `/pdf-studio`
2. Keo 1 file DOCX vao → nhan "Bat dau"
3. Ky vong: job chuyen uploading → processing → ready
4. Nhan nut tai → file PDF duoc download

Test them: PDF → JPG, PNG → PDF, JPG → PDF.

## OCR (da tich hop)

PDF Studio tu dong detect PDF scan va chay OCR truoc khi convert:

- PDF scan/mixed → editable (Word/Excel/PPTX/EPUB): auto OCR, khong chan
- PDF text: convert binh thuong, khong chay OCR
- Output "PDF (OCR)": chi tao PDF searchable, khong convert format

### Provider OCR

- CloudConvert: engine `ocrmypdf` tich hop trong job (1 request = OCR + convert)
- iLovePDF: tool `ocr` rieng (2 buoc: ocr → convert)

### Multi-stage hien thi

Job can OCR hien stages: Detect → OCR (Auto) → Chuyen doi. Moi stage co indicator trang thai.

### Migration OCR catalog

File: `backup/supabase/migrations/20260724000000_pdf_studio_ocr_capabilities.sql`

Chay tren Core SQL Editor de seed 6 OCR capabilities vao catalog.

## Chua chay — Migration lock secret boundary

File: `backup/supabase/migrations/20260723000001_lock_secret_boundary.sql`

[!] KHOAN CHAY migration nay. No se:
- Drop policy `creds_authenticated_read` tren `service_credentials`
- Tao view `service_credentials_meta` (khong co `secret_data_json`)
- Sau khi chay: browser khong doc duoc raw secret nua

Anh huong:
- RAG (Gemini key) — hien dang doc `service_credentials` tu browser qua `executor.ts`
- Library PDF compress (iLovePDF) — doc key tu browser
- Library Drive backup — doc OAuth token tu browser

Chay migration nay SAU KHI da migrate cac consumer do sang goi Edge Function `service-executor`. Luc do:
- `src/lib/service-registry/executor.ts` (browser executor) se bi thay the boi `server-executor.ts`
- RAG, Library compress, Drive backup goi `serverExecutor.execute()` thay vi doc DB truc tiep

## Routing provider

| Input → Output | Primary | Fallback |
|---|---|---|
| DOCX/XLSX/PPTX/EPUB → PDF | CloudConvert | iLovePDF (khi confirmed) |
| PDF → DOCX/XLSX/PPTX/EPUB | CloudConvert | — |
| PDF → PNG | CloudConvert | — |
| PDF → JPG | iLovePDF | CloudConvert |
| PNG/JPG → PDF | iLovePDF | CloudConvert |

## Cau hinh admin

Cot `tool_settings.settings_json` voi `tool_code = 'pdf_studio'`:

```json
{
  "max_files_per_batch": 10,
  "max_file_size_mb": 50,
  "max_batch_size_mb": 200,
  "concurrency": 3,
  "grace_period_minutes": 60,
  "safety_retention_hours": 24
}
```

Doi truc tiep tren SQL Editor hoac qua Setting UI (khi Phase 5 Setting integration hoan tat).

## Troubleshooting

| Van de | Nguyen nhan | Fix |
|---|---|---|
| 403 No permission | User chua co `pdf_studio` trong allowed_tools | Them vao role hoac profile |
| 404 No bindings | Chua tao `tool_service_bindings` cho pdf_studio | Chay SQL buoc 3 |
| 503 All credentials exhausted | Khong co credential active | Them key hoac check status |
| iLovePDF DamagedFile | File bi corrupt hoac dinh dang sai | Thu file khac |
| user_id null constraint | Bug cu (da fix) — app version cu | Refresh app de lay code moi |

## Files lien quan

- Frontend: `src/tools/pdf-studio/`
- Types: `src/lib/pdf-studio/types.ts`
- Server executor client: `src/lib/service-registry/server-executor.ts`
- Edge Function: `backup/supabase/functions/service-executor/index.ts`
- Migration: `backup/supabase/migrations/20260723000000_pdf_studio_jobs.sql`
- Lock boundary (chua chay): `backup/supabase/migrations/20260723000001_lock_secret_boundary.sql`
- Spec: `.kiro/specs/pdf-studio/`
- Research: `docs/pdf-converter/README.md`
