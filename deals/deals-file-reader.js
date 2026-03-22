// Deal File Reader - Đọc trực tiếp từ file deals.txt
// Sử dụng File System Access API hoặc file input

class DealsFileReader {
    constructor() {
        this.dealsFilePath = '../telegram/deals.txt';
    }

    // Đọc file deals.txt trực tiếp
    async readDealsFile() {
        try {
            // Thử đọc bằng fetch (chỉ hoạt động nếu file được serve qua web server)
            const response = await fetch(this.dealsFilePath);
            if (response.ok) {
                const content = await response.text();
                return this.parseDealsFile(content);
            }
        } catch (error) {
            console.warn('Không thể đọc file trực tiếp:', error);
        }

        return null;
    }

    // Parse nội dung file deals.txt
    parseDealsFile(content) {
        const deals = [];
        const sections = content.split('============================================================');

        sections.forEach((section, index) => {
            if (!section.trim()) return;

            const lines = section.trim().split('\n');
            let date = '';
            let link = '';
            let contentLines = [];
            let isContent = false;

            lines.forEach(line => {
                if (line.startsWith('📅 Ngày:')) {
                    date = line.replace('📅 Ngày:', '').trim();
                } else if (line.startsWith('🔗 Link:')) {
                    link = line.replace('🔗 Link:', '').trim();
                } else if (line.startsWith('📝 Nội dung:')) {
                    isContent = true;
                } else if (isContent) {
                    contentLines.push(line);
                }
            });

            if (date && link && contentLines.length > 0) {
                // Format date
                let formattedDate = date;
                try {
                    const dateObj = new Date(date);
                    formattedDate = dateObj.toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } catch (e) {
                    // Keep original if parse fails
                }

                deals.push({
                    id: `deal_${index}_${Date.now()}`,
                    date: formattedDate,
                    rawDate: date,
                    link: link,
                    content: contentLines.join('\n').trim()
                });
            }
        });

        // Sort by date (newest first)
        deals.sort((a, b) => {
            try {
                const dateA = new Date(a.rawDate);
                const dateB = new Date(b.rawDate);
                return dateB - dateA;
            } catch (e) {
                return 0;
            }
        });

        return deals;
    }

    // Cho phép user chọn file thủ công
    async selectFile() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const content = await file.text();
                    const deals = this.parseDealsFile(content);
                    resolve(deals);
                } else {
                    resolve(null);
                }
            };

            input.click();
        });
    }
}

// Export
window.DealsFileReader = DealsFileReader;
