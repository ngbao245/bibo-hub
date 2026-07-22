#!/usr/bin/env python3
"""
Fix garbled Vietnamese characters in files from commit 1774297d
"""
import re
from pathlib import Path

# Mapping of garbled characters to correct Vietnamese
REPLACEMENTS = {
    # Vietnamese vowels with diacritics
    'vß╗¢i': 'với',
    'vu├┤ng': 'vuông',
    'vß╗⌐c': 'vức',
    '─æß╗ïnh': 'định',
    'ngh─⌐a': 'nghĩa',
    'd├╣ng': 'dùng',
    'chuß║⌐n': 'chuẩn',
    'dß╗à': 'dễ',
    'nß║┐u': 'nếu',
    'muß╗æn': 'muốn',
    'giß╗»': 'giữ',
    'tuyß╗çt': 'tuyệt',
    '─æß╗æi': 'đối',
    'vß║½n': 'vẫn',
    'ho├án': 'hoàn',
    'to├án': 'toàn',
    'chß╗ë': 'chỉ',
    'ph├⌐p': 'phép',
    'tr├▓n': 'tròn',
    'l├á': 'là',
    'kh├┤ng': 'không',
    'phß║úi': 'phải',
    '├íp': 'áp',
    'dß╗Ñng': 'dụng',
    '─æß╗ìc': 'đọc',
    'tß╗½': 'từ',
    't╞░╞íng': 'tương',
    'th├¡ch': 'thích',
    '─æ├ú': 'đã',
    'viß║┐t': 'viết',
    '├ính': 'ánh',
    's├íng': 'sáng',
    'chß║íy': 'chạy',
    'lß║ºn': 'lần',
    'tr├íi': 'trái',
    'phß║úi': 'phải',
    '─Éß║╖t': 'Đặt',
    'ß╗ƒ': 'ở',
    '─æß╗â': 'để',
    'dß║úi': 'dải',
    'nhß║Ñt': 'nhất',
    'tr├┤i': 'trôi',
    'nhiß╗üu': 'nhiều',
    'c├╣ng': 'cùng',
    'l├║c': 'lúc',
    'c├│': 'có',
    'cß║úm': 'cảm',
    'gi├íc': 'giác',
    'cß║ºn': 'cần',
    '─æß╗Ö': 'độ',
    'nghi├¬ng': 'nghiêng',
    '─æo': 'đo',
    'bß║▒ng': 'bằng',
    '─æß║ºy': 'đầy',
    '─æß╗º': 'đủ',
    'ß╗òn': 'ổn',
    '─æß╗ïnh': 'định',
    'vß║╜': 'vẽ',
    'k├╜': 'ký',
    'tß╗▒': 'tự',
    'd├áy': 'dày',
    'c├ích': 'cách',
    'chß╗ìng': 'chồng',
    'nhß╗Å': 'nhỏ',
    'th├¬m': 'thêm',
    'tr├¬': 'trên',
    'c├╣': 'cũ',
    'giao': 'giao',
    'diß╗çn': 'diện',
    '─æß║╣ng': 'đẹp',
    'mß║╖t': 'mặt',
    'nß╗òi': 'nội',
    'dung': 'dung',
    'qua': 'qua',
    'trß╗ng': 'trống',
    '─æß╗ìng': 'đồng',
    'bß╗Ö': 'bộ',
    'nhß║» nß║½t': 'nhẹ nhàng',
    'hiß╗âu': 'hiệu',
    'quß║ú': 'quả',
    '─æß║╣p': 'đẹp',
    'hß╗ìa': 'hòa',
    'thuß║¡n': 'thuận',
    'sß║ín': 'sẵn',
    's├áng': 'sàng',
    'phß╗æc': 'phức',
    'tß║íp': 'tạp',
    '─æß║╖t': 'đặt',
    'ví': 'ví',
    'dß╗Ñ': 'dụ',
    'th├áo': 'tháo',
    'b├ái': 'bỏ',
    'thiß║┐t': 'thiết',
    'kß║┐': 'kế',
    'tß╗½': 'từ',
    'ß╗æn': 'ổn',
    'nß╗öi': 'nội',
    'dung': 'dung',
    'tß╗ø': 'tự',
    '─æß╗Öng': 'động',
    'thay': 'thay',
    '─æß╗òi': 'đổi',
    'theo': 'theo',
    'chß╗ñ': 'chủ',
    '─æß╗ü': 'đề',
    'hiß╗ân': 'hiện',
    'tß║íi': 'tại',
    'Nß╗ôi': 'Nội',
    'chi': 'chi',
    'tiß║┐t': 'tiết',
    'xem': 'xem',
    'tß║íi': 'tại',
    'file': 'file',
    'tß╗½ng': 'từng',
    'file.': 'file.',
    'Tß║Ñt': 'Tất',
    'cß║ú': 'cả',
    'component': 'component',
    'trong': 'trong',
    'folder': 'folder',
    'n├áy': 'này',
    '─æß╗üu': 'đều',
    'theo': 'theo',
    'theme': 'theme',
    'token': 'token',
    '(tß╗ø': '(từ',
    'index.css).': 'index.css).',
    'Mß╗Öi': 'Mỗi',
    'component': 'component',
    'dß╗à': 'dễ',
    'customize': 'customize',
    'm├á': 'mà',
    'vß║½n': 'vẫn',
    'nhß║Ñt': 'nhất',
    'qu├¡n': 'quán',
    'vß╗ü': 'về',
    'color': 'color',
    'semantic.': 'semantic.',
    
    # Special characters
    'ΓÇö': '—',
    'ΓåÆ': '→',
    'ΓîÉ': 'ứ',
    'Γö£': 'ớ',
    'Γöñ': 'ợ',
    'Γö': 'ờ',
    '╬ô├ç├╢': '—',
    '├ª': 'ế',
    '├ƒ': 'ơ',
    '├º': 'ệ',
    '├╢': '—',
    '├╝': 'ử',
    '├»': 'ự',
    '├░': 'ư',
    '├¡': 'ả',
    '├í': 'á',
    '├á': 'ă',
    '├ú': 'ắ',
    '├ª': 'ế',
    '├│': 'ố',
    '├┤': 'ổ',
    '├╣': 'ũ',
    '├║': 'ú',
    '├╗': 'û',
    '├╝': 'ử',
    '├╜': 'ừ',
    '├╛': 'ứ',
    '├┐': 'ữ',
    '─æ': 'đ',
    '─Ç': 'Đ',
    'Γö£': 'ớ',
    
    # Common garbled patterns
    'v├ƒΓòù┬ói': 'với',
    'vu├ƒΓòù├»ng': 'vuông',
    'v├ƒΓòù├ºc': 'vức',
    '├ª├ƒΓòù├»nh': 'định',
    'ngh├ƒΓòù├¬a': 'nghĩa',
    'd├ƒΓòúng': 'dùng',
    'chu├ƒΓòæΓîÉn': 'chuẩn',
    'd├ƒΓòù├á': 'dễ',
    'n├ƒΓòæΓöÉu': 'nếu',
    'mu├ƒΓòù├ªn': 'muốn',
    'gi├ƒΓòù┬╻': 'giữ',
    'tuy├ƒΓòù├ºt': 'tuyệt',
    '├ª├ƒΓòù├ªi': 'đối',
    'v├ƒΓòæ┬╜n': 'vẫn',
    'Γöñng': 'ững',
    'Γöé': 'ề',
    'Γò': 'ò',
    'Γù': 'ù',
}

# Files to fix from the commit
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
        
        # Apply all replacements
        for garbled, correct in REPLACEMENTS.items():
            if garbled in content:
                content = content.replace(garbled, correct)
        
        # Check if anything changed
        if content == original_content:
            print(f"✓ OK (no issues): {file_path}")
            return False
        
        # Write back
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Fixed: {file_path}")
        return True
        
    except Exception as e:
        print(f"✗ Error: {file_path} - {e}")
        return False

def main():
    print("="*70)
    print("Fixing encoding issues in commit 1774297d files...")
    print("="*70)
    print()
    
    fixed_count = 0
    error_count = 0
    skip_count = 0
    ok_count = 0
    
    for file_path in FILES_TO_FIX:
        result = fix_file(file_path)
        if result is True:
            fixed_count += 1
        elif result is False:
            path = Path(file_path)
            if path.exists():
                ok_count += 1
            else:
                skip_count += 1
        else:
            error_count += 1
    
    print()
    print("="*70)
    print("SUMMARY")
    print("="*70)
    print(f"✓ Fixed:  {fixed_count} files")
    print(f"✓ OK:     {ok_count} files (no issues found)")
    print(f"⏭ Skipped: {skip_count} files (not found)")
    if error_count > 0:
        print(f"✗ Errors:  {error_count} files")

if __name__ == '__main__':
    main()
