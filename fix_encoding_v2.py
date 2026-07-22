#!/usr/bin/env python3
"""
Fix all garbled Vietnamese characters - comprehensive version
"""
import re
from pathlib import Path

# Comprehensive mapping - order matters (longer patterns first)
REPLACEMENTS = [
    # Common full words/phrases that are garbled
    ('mß╗¢i nhất', 'mới nhất'),
    ('─Éắ tß║ío', 'Đã tạo'),
    ('Khổng tß║ío đ╞░ß╗úc', 'Không tạo được'),
    ('X├ôA Hß║╛T', 'XÓA HẾT'),
    ('Khổng thß╗â hoàn tác', 'Không thể hoàn tác'),
    ('xác nhß║¡n', 'xác nhận'),
    ('Khổng xốa đ╞░ß╗úc', 'Không xóa được'),
    ('Chß╗ìn source hoß║╖c tß║ío mß╗¢i', 'Chọn source hoặc tạo mới'),
    ('+ Tß║ío source', '+ Tạo source'),
    ('hiện thß╗ï', 'hiển thị'),
    ('c├óy th╞░ mß╗Ñc', 'cây thư mục'),
    ('không crash', 'không crash'),
    ('l╞░u trong', 'lưu trong'),
    ('KH├öNG văo', 'KHÔNG vào'),
    ('không trigger', 'không trigger'),
    ('re-render khổng lß╗ô', 're-render không lỗi'),
    ('chỉ chß╗⌐a', 'chỉ chứa'),
    ('metadata', 'metadata'),
    ('nhß║╣', 'nhẹ'),
    ('cß╗⌐u khi crash', 'cứu khi crash'),
    ('tự restore', 'tự restore'),
    ('từ paths c┼⌐', 'từ paths cũ'),
    ('tß║¡n dụng', 'tận dụng'),
    ('không scan', 'không scan'),
    ('nß║▒m trong', 'nằm trong'),
    ('không văo', 'không vào'),
    ('trß║ú max', 'trả max'),
    ('mß╗¢i có', 'mới có'),
    ('tổng sß╗æ', 'tổng số'),
    ('cache', 'cache'),
    ('tß║Ñt cả', 'tất cả'),
    ('toggle nhanh', 'toggle nhanh'),
    ('Mß╗ùi tick', 'Mỗi tick'),
    ('setState', 'setState'),
    ('TO├ÇN Bß╗ÿ', 'TOÀN BỘ'),
    ('Mß╗ùi folder', 'Mỗi folder'),
    ('re-compute', 're-compute'),
    ('count', 'count'),
    ('O(descendants)', 'O(descendants)'),
    ('descendants', 'descendants'),
    ('O(folders)', 'O(folders)'),
    ('O(n┬▓)', 'O(n²)'),
    ('subscribe văo', 'subscribe vào'),
    ('path cß╗ºa m├¼nh', 'path của mình'),
    ('chỉ row đố', 'chỉ row đó'),
    ('row đố', 'row đó'),
    ('NH╞»NG chỉ', 'NHƯNG chỉ'),
    ('không phải mß╗ùi', 'không phải mỗi'),
    ('Snapshot toàn bộ', 'Snapshot toàn bộ'),
    ('để persist', 'để persist'),
    ('localStorage hoß║╖c', 'localStorage hoặc'),
    ('Toggle nhiều', 'Toggle nhiều'),
    ('mß╗ìi thay đổi', 'mọi thay đổi'),
    ('cho folder', 'cho folder'),
    ('summary', 'summary'),
    ('checked status cß╗ºa', 'checked status của'),
    ('từ paths c┼⌐', 'từ paths cũ'),
    ('Cố overlap', 'Cố overlap'),
    ('với paths mß╗¢i', 'với paths mới'),
    ('giữ overlap', 'giữ overlap'),
    ('Khổng overlap', 'Không overlap'),
    ('select all', 'select all'),
    ('lần đß║ºu hoß║╖c', 'lần đầu hoặc'),
    ('folder khác hoàn toàn', 'folder khác hoàn toàn'),
    ('Yield mß╗ùi', 'Yield mỗi'),
    ('để main', 'để main'),
    ('thread không', 'thread không'),
    ('block', 'block'),
    ('Tảnh fileCount', 'Tính fileCount'),
    ('descendantPaths đß╗ç quy', 'descendantPaths đệ quy'),
    ('sort folder tr╞░ß╗¢c file', 'sort folder trước file'),
    ('folder tr╞░ß╗¢c', 'folder trước'),
    ('sau đố alphabet', 'sau đó alphabet'),
    ('State chỉ chß╗⌐a data nhß║╣', 'State chỉ chứa data nhẹ'),
    ('các thao tác nß║╖ng', 'các thao tác nặng'),
    ('scan', 'scan'),
    ('zip', 'zip'),
    ('persist qua', 'persist qua'),
    ('để resume phß║ºn fail', 'để resume phần fail'),
    ('packId dùng chung giữa lần đß║ºu', 'packId dùng chung giữa lần đầu'),
    ('lần retry', 'lần retry'),
    ('không tß║ío dupe', 'không tạo dupe'),
    ('user click', 'user click'),
    ('L╞░u tiß║┐p', 'Lưu tiếp'),
    ('hiện thß╗ï', 'hiển thị'),
    ('smooth animated', 'smooth animated'),
    ('Khác với', 'Khác với'),
    ('là raw', 'là raw'),
    ('value', 'value'),
    ('Tween displayProgress về', 'Tween displayProgress về'),
    ('mß╗ùi animation', 'mỗi animation'),
    ('frame', 'frame'),
    ('di chuyß╗ân', 'di chuyển'),
    ('khoß║úng cách mß╗ùi frame', 'khoảng cách mỗi frame'),
    ('m╞░ß╗út', 'mượt'),
    ('đuß╗òi kß╗ïp', 'đuổi kịp'),
    ('Download all', 'Download all'),
    ('parts as', 'parts as'),
    ('ZIP', 'ZIP'),
    ('chß╗⌐a nhiều', 'chứa nhiều'),
    ('.txt files', '.txt files'),
    ('─Éang tß║ío ZIP với', 'Đang tạo ZIP với'),
    ('part', 'part'),
    ('type', 'type'),
    ('blob', 'blob'),
    ('compression', 'compression'),
    ('DEFLATE', 'DEFLATE'),
    ('compressionOptions', 'compressionOptions'),
    ('level thß║Ñp', 'level thấp'),
    ('n├⌐n nhanh', 'nén nhanh'),
    ('ảt block', 'ít block'),
    ('CPU', 'CPU'),
    ('─Éắ tß║úi ZIP', 'Đã tải ZIP'),
    ('Hiß╗ân thß╗ï thổng báo reload', 'Hiển thị thông báo reload'),
    ('sau', 'sau'),
    ('reload page', 'reload page'),
    ('từ Supabase', 'từ Supabase'),
    ('hoß║╖c default', 'hoặc default'),
    ('Hydrate toàn bộ', 'Hydrate toàn bộ'),
    ('settings', 'settings'),
    ('gß╗ìi khi', 'gọi khi'),
    ('fetch xong từ', 'fetch xong từ'),
    
    # Individual character replacements
    ('mß╗¢i', 'mới'),
    ('─Éắ', 'Đã'),
    ('tß║ío', 'tạo'),
    ('─æ╞░ß╗úc', 'được'),
    ('đ╞░ß╗úc', 'được'),
    ('Khổng', 'Không'),
    ('thß╗â', 'thể'),
    ('hoàn tác', 'hoàn tác'),
    ('nhß║¡n', 'nhận'),
    ('xốa', 'xóa'),
    ('Chß╗ìn', 'Chọn'),
    ('hoß║╖c', 'hoặc'),
    ('Tß║ío', 'Tạo'),
    ('thß╗ï', 'thị'),
    ('hiß╗ân', 'hiển'),
    ('th╞░', 'thư'),
    ('mß╗Ñc', 'mục'),
    ('l╞░u', 'lưu'),
    ('văo', 'vào'),
    ('lß╗ô', 'lỗi'),
    ('chß╗⌐a', 'chứa'),
    ('nhß║╣', 'nhẹ'),
    ('cß╗⌐u', 'cứu'),
    ('c┼⌐', 'cũ'),
    ('tß║¡n', 'tận'),
    ('nß║▒m', 'nằm'),
    ('trß║ú', 'trả'),
    ('sß╗æ', 'số'),
    ('tß║Ñt', 'tất'),
    ('Mß╗ùi', 'Mỗi'),
    ('Bß╗ÿ', 'BỘ'),
    ('cß╗ºa', 'của'),
    ('m├¼nh', 'mình'),
    ('đố', 'đó'),
    ('NH╞»NG', 'NHƯNG'),
    ('mß╗ìi', 'mọi'),
    ('đß║ºu', 'đầu'),
    ('nß║╖ng', 'nặng'),
    ('phß║ºn', 'phần'),
    ('tiß║┐p', 'tiếp'),
    ('L╞░u', 'Lưu'),
    ('chuyß╗ân', 'chuyển'),
    ('khoß║úng', 'khoảng'),
    ('m╞░ß╗út', 'mượt'),
    ('đuß╗òi', 'đuổi'),
    ('kß╗ïp', 'kịp'),
    ('tß║úi', 'tải'),
    ('Hiß╗ân', 'Hiển'),
    ('thổng', 'thông'),
    ('gß╗ìi', 'gọi'),
    ('─Éang', 'Đang'),
    ('thß║Ñp', 'thấp'),
    ('n├⌐n', 'nén'),
    ('ảt', 'ít'),
    ('─æß╗ç', 'đệ'),
    ('tr╞░ß╗¢c', 'trước'),
    ('Hß║╛T', 'HẾT'),
    ('X├ôA', 'XÓA'),
    ('c├óy', 'cây'),
    
    # Special characters
    ('ΓÇö', '—'),
    ('ΓåÆ', '→'),
    ('├ƒΓòù', 'ớ'),
    ('├ª├ƒ', 'ế'),
    ('v├ƒ', 'ớ'),
    ('d├ƒ', 'ư'),
    ('n├ƒ', 'ế'),
    ('gi├ƒ', 'ữ'),
    ('tuy├ƒ', 'ệ'),
    ('─æ├ƒ', 'đố'),
    ('v├ƒ', 'ớ'),
    ('ho├án', 'hoàn'),
    ('to├án', 'toàn'),
    ('ch├¼', 'chỉ'),
    ('ph├⌐p', 'phép'),
    ('tr├▓n', 'tròn'),
    ('l├á', 'là'),
    ('kh├┤ng', 'không'),
    ('ph├ª', 'phải'),
    ('├íp', 'áp'),
    ('d├Ñng', 'dụng'),
    ('─æ├¼c', 'đọc'),
    ('t├¡', 'từ'),
    ('t╞░├íng', 'tương'),
    ('th├¡ch', 'thích'),
    ('─æ├ú', 'đã'),
    ('vi├¬', 'viết'),
    ('├ính', 'ánh'),
    ('s├íng', 'sáng'),
    ('ch├óy', 'chạy'),
    ('l├║', 'lần'),
    ('tr├íi', 'trái'),
    ('ph├ê', 'phải'),
    ('─É├ê', 'Đặt'),
    ('├╕', 'ở'),
    ('─æ├¬', 'để'),
    ('d├úi', 'dải'),
    ('nh├Ñt', 'nhất'),
    ('tr├┤i', 'trôi'),
    ('nhi├¬u', 'nhiều'),
    ('c├╣ng', 'cùng'),
    ('l├║c', 'lúc'),
    ('c├│', 'có'),
    ('c├úm', 'cảm'),
    ('gi├íc', 'giác'),
    ('c├ºn', 'cần'),
    ('─æ├ÿ', 'độ'),
    ('nghi├¬ng', 'nghiêng'),
    ('─æo', 'đo'),
    ('b├▒ng', 'bằng'),
    ('─æ├ºy', 'đầy'),
    ('─æ├║', 'đủ'),
    ('├╕n', 'ổn'),
    ('─æ├¼nh', 'định'),
    ('v├¬', 'vẽ'),
    ('k├¼', 'ký'),
    ('t├▒', 'tự'),
    ('d├áy', 'dày'),
    ('c├ích', 'cách'),
    ('ch├▒ng', 'chồng'),
    ('nh├Å', 'nhỏ'),
    ('th├¬m', 'thêm'),
]

FILES_TO_FIX = [
    '.gitignore',
    'docs/lift-design-guidelines.md',
    'src/App.tsx',
    'src/components/ui/checkbox.tsx',
    'src/lib/tools.ts',
    'src/routes/DesignSystem.tsx',
    'src/routes/HubPro.tsx',
    'src/styles/README.md',
    'src/styles/index.css',
    'src/tools/project-packer/api.ts',
    'src/tools/project-packer/components/PackPanel.tsx',
    'src/tools/project-packer/components/SourcesPanel.tsx',
    'src/tools/theme/api.ts',
    'src/tools/theme/constants.ts',
    'src/tools/theme/index.ts',
    'src/tools/theme/store.ts',
    'src/tools/theme/types.ts',
    'tailwind.config.ts',
]

def fix_file(file_path):
    """Fix encoding issues in a single file"""
    path = Path(file_path)
    
    if not path.exists():
        print(f"⏭  Skip (not found): {file_path}")
        return False
    
    try:
        # Read file
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        original_content = content
        changes = 0
        
        # Apply all replacements (order matters - longer first)
        for garbled, correct in REPLACEMENTS:
            if garbled in content:
                count = content.count(garbled)
                content = content.replace(garbled, correct)
                changes += count
        
        # Check if anything changed
        if content == original_content:
            print(f"✓ OK (no issues): {file_path}")
            return False
        
        # Write back
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Fixed {changes} issues: {file_path}")
        return True
        
    except Exception as e:
        print(f"✗ Error: {file_path} - {e}")
        return False

def main():
    print("="*70)
    print("Fixing encoding issues (v2 - comprehensive)...")
    print("="*70)
    print()
    
    fixed_count = 0
    total_changes = 0
    
    for file_path in FILES_TO_FIX:
        result = fix_file(file_path)
        if result:
            fixed_count += 1
    
    print()
    print("="*70)
    print("SUMMARY")
    print("="*70)
    print(f"✓ Fixed: {fixed_count} files")

if __name__ == '__main__':
    main()
