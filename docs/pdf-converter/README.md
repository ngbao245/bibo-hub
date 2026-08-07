# PDF Studio — Báo cáo định hướng và quyết định

**Status:** Reference  
**Last verified:** 2026-07-23  
**Canonical spec:** `.kiro/specs/pdf-studio/`  
**Decision state:** Phase 1 đã được user xác nhận; implementation chưa bắt đầu.

Tài liệu này lưu nghiên cứu provider, trade-off và rationale. Requirements/design/tasks trong canonical spec là nguồn sự thật cho behavior sẽ triển khai.

## 1. Mục tiêu Phase 1

PDF Studio phục vụ nhóm người dùng có tài khoản, ưu tiên chất lượng sát bản gốc và batch có thể phục hồi sau reload.

| Từ PDF | Sang PDF |
|---|---|
| PDF → Word (DOCX) | Word → PDF |
| PDF → PNG | PNG → PDF |
| PDF → JPG | JPG → PDF |
| PDF → EPUB | EPUB → PDF |
| PDF → Excel (XLSX) | Excel → PDF |
| PDF → PowerPoint (PPTX) | PowerPoint → PDF |

Tổng cộng 12 chiều chuyển đổi. Phase 1 không gồm OCR hoặc PDF Toolbox.

## 2. Phạm vi sản phẩm đã chốt

- Tên plugin: **PDF Studio**; tool code DB dự kiến `pdf_studio`, frontend id/route `pdf-studio`.
- Batch hỗn hợp nhiều input; output mặc định và override từng file.
- Provider do hệ thống tự chọn; admin cấu hình primary/fallback trong Setting.
- Metadata lịch sử lưu Supabase; file không lưu lâu dài trên server của app.
- Input pending/failed và output chưa tải cache IndexedDB trên cùng browser/profile.
- Provider job đã nhận tiếp tục khi tab đóng; pending local resume khi app mở lại.
- Tải riêng và Download All dạng ZIP.
- Shortcut đăng ký động; không hard-code phím mặc định.
- Phase 2 tách riêng cho PDF Toolbox, OCR và cloud storage/multi-device resume.

## 3. Định vị provider

### CloudConvert

CloudConvert là universal file conversion platform, phù hợp tài liệu, ebook, ảnh và Office. API v2 dùng mô hình job/task, hỗ trợ import, conversion và export trong cùng job. Hơn 200 format không có nghĩa mọi cặp đều chuyển được; capability phải được xác nhận theo input/output/engine.

### iLovePDF

iLovePDF Developer API tập trung PDF và ảnh: merge, split, compress, OCR, PDF/JPG, image/PDF, rotate, protect, watermark, repair, extract và một số operation khác. Capability của website người dùng cuối không tự động được xem là capability developer API; ví dụ ký PDF chưa xuất hiện trong API tool list đã kiểm tra.

### TheBestPDF

TheBestPDF là sản phẩm người dùng cuối có PDF workflow/editor rộng hơn một converter. Không tìm thấy public developer API hoặc tài liệu đủ để benchmark toàn bộ 12 route. PDF Studio có khả năng cạnh tranh về converter nếu provider routing, batch UX và reliability tốt; chưa thể tuyên bố vượt chất lượng trước benchmark cùng corpus.

## 4. Routing mặc định

| Capability | Primary | Fallback |
|---|---|---|
| PDF với Word/Excel/PPTX/EPUB hai chiều | CloudConvert | Provider đã xác nhận hỗ trợ |
| PDF → PNG | CloudConvert | Provider đã xác nhận hỗ trợ |
| PDF → JPG | iLovePDF | CloudConvert |
| PNG/JPG → PDF | iLovePDF | CloudConvert |
| Office → PDF | CloudConvert | iLovePDF khi capability được xác nhận |

Không gửi cùng một file tới cả hai provider mặc định. Fallback chỉ chạy với lỗi được phân loại an toàn.

## 5. Service Registry và key pools

Hệ thống hiện có provider → profile/pool → nhiều credentials → tool capability binding. PDF Studio tái sử dụng model này nhưng chuyển execution sang Supabase Edge Function để browser không nhận raw API key.

Provider policy khác nhau:

- **Gemini:** cân bằng RPM/RPD; 429 dùng cooldown/Retry-After; daily quota reset.
- **iLovePDF:** dùng credential ưu tiên tới quota exhausted rồi chuyển credential tiếp theo.
- **CloudConvert:** chọn account còn credit, reserve estimate và reconcile actual usage.
- **Drive:** chọn account theo priority và available capacity; reserve bytes trước upload.

Edge Function là control plane serverless, không phải backend server riêng. File lớn upload trực tiếp từ browser tới provider bằng descriptor/token ngắn hạn khi provider hỗ trợ.

### Security gap phải xử lý trước launch

`service_credentials.secret_data_json` hiện là plaintext được bảo vệ bằng RLS, nhưng migration cũ cho authenticated user SELECT và browser executor đọc toàn row. Ẩn secret trong UI không ngăn DevTools đọc dữ liệu. Launch gate của PDF Studio gồm:

- Provider operations chuyển sang server-side execution.
- Admin add/test/replace/disable credential qua control plane.
- App user không còn SELECT raw secret.
- Setting chỉ nhận metadata masked.
- State quota/cooldown/reservation lưu bền vững và cập nhật atomic.

## 6. PDF scan policy

| PDF input | DOCX/XLSX/PPTX/EPUB | PNG/JPG |
|---|---|---|
| Có text layer | Cho phép | Cho phép |
| Scan hoàn toàn | Chặn | Cho phép |
| Hỗn hợp text/scan | Cho phép sau cảnh báo | Cho phép |

Phase 1 không chạy OCR. Scan hoàn toàn bị chặn trước provider nếu output cần nội dung editable. PDF hỗn hợp không bỏ trang; trang scan có thể xuất hiện dưới dạng ảnh.

## 7. Batch, resume và retry

- Mỗi file là một child job; partial success là trạng thái hợp lệ.
- Batch có output mặc định và per-file override.
- Default limit: 10 file, 50 MB/file, 200 MB/batch; admin cấu hình được.
- Local queue chạy theo concurrency cấu hình.
- Provider-side processing tiếp tục sau khi tab đóng.
- Local pending uploads resume khi app mở lại nếu blob IndexedDB còn tồn tại.
- Retry Failed/Incomplete bỏ qua job completed.
- Retry Entire Batch chỉ dùng được với original input còn cache; input đã dọn phải chọn lại.
- Close-tab warning nêu rõ job provider, file đã persist và file có nguy cơ mất.

## 8. Output safety và cleanup

Provider completed chưa đồng nghĩa output ready. Output phải được tải về IndexedDB trước khi UI hiện sẵn sàng tải; nếu F5 giữa chừng, app dùng provider job reference để lấy lại.

Cleanup không giao cho browser tự quyết:

- Cleanup theo state/event là cơ chế chính.
- Output bắt đầu grace period sau lần download đầu tiên; mặc định một giờ, admin cấu hình được.
- User có thể dọn ngay từng file hoặc batch.
- Active input không bị xóa để lấy chỗ.
- Safety retention xử lý dữ liệu mồ côi do crash/abandon.
- Khi thiếu quota, app dọn terminal data trước hoặc báo batch không bảo đảm resume.
- Browser eviction là fallback không đáng tin cậy.

IndexedDB không tự làm UI nặng nếu app chỉ đọc Blob tới lượt, giới hạn concurrency, throttle progress và chạy scan/fingerprint/ZIP ngoài main thread.

## 9. Download

- Tải riêng từng output.
- PDF nhiều trang sang PNG/JPG tạo nhiều ảnh và đóng ZIP theo job.
- Download All tạo ZIP từ các output ready và nêu rõ job bị loại.
- ZIP chạy ngoài main thread.
- Batch quá lớn phải chia ZIP hoặc tải riêng, không cố nạp toàn bộ vào RAM.

## 10. Benchmark trước khi tuyên bố chất lượng

Corpus 50–100 file nên bao phủ:

- Tiếng Việt, font nhúng và ký tự đặc biệt.
- Bảng nhiều cột, biểu đồ và công thức.
- Word có header/footer/section.
- Excel nhiều sheet, merged cells, chart và print area.
- PPTX có master slide, transparency và media.
- EPUB có ảnh, mục lục, footnote và reflow.
- PDF text, scan, mixed, encrypted, corrupt và gần limit.

Trọng số đề xuất:

| Tiêu chí | Trọng số |
|---|---:|
| Độ trung thực bố cục/nội dung | 40% |
| Khả năng chỉnh sửa output | 15% |
| Tỷ lệ job thành công | 15% |
| Thời gian xử lý | 10% |
| Bảo mật/vòng đời file | 10% |
| Credit/chi phí mỗi job | 10% |

## 11. Phase 2

- PDF Toolbox: merge, split, compress, rotate, protect, unlock, watermark và repair.
- OCR với auto-detect và manual control.
- Cloud storage pool, multi-device resume và background upload hoàn toàn.
- Notification, scheduling và realtime progress.

Những capability này cần spec riêng; không ghép vào Phase 1 converter.

## 12. Nguồn tham khảo

- [CloudConvert File Conversion API](https://cloudconvert.com/apis/file-conversion)
- [CloudConvert PDF to Office API](https://cloudconvert.com/apis/pdf-to-office)
- [CloudConvert Office to PDF API](https://cloudconvert.com/apis/office-to-pdf)
- [CloudConvert PDF to EPUB](https://cloudconvert.com/pdf-to-epub)
- [CloudConvert EPUB to PDF](https://cloudconvert.com/epub-to-pdf)
- [CloudConvert API v2 documentation](https://cloudconvert.com/docs)
- [iLovePDF API reference](https://developer.ilovepdf.com/docs/api-reference)
- [iLovePDF Office to PDF guide](https://developer.ilovepdf.com/docs/guides/office-to-pdf-api)
- [TheBestPDF public product page](https://thebestpdf.com/new/remove-watermark)

## 13. Giới hạn của báo cáo

TheBestPDF không cung cấp đủ public developer documentation để so trực tiếp. Provider pricing, quota, retention và capability có thể thay đổi; cần kiểm tra lại trước implementation và ghi evidence benchmark thay vì dựa vào marketing claim.

Content was rephrased for compliance with licensing restrictions.
