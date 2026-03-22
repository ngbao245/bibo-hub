// Deal File Reader - Đọc deals.txt trực tiếp
async function loadDealsFromFile() {
    try {
        const response = await fetch('telegram/deals.txt');
        if (!response.ok) throw new Error('Cannot load deals.txt');

        const content = await response.text();
        return parseDealsFromFile(content);
    } catch (error) {
        console.error('Error loading deals:', error);
        return [];
    }
}

function parseDealsFromFile(content) {
    const deals = [];
    const sections = content.split('============================================================').filter(s => s.trim());

    sections.forEach((section, index) => {
        const lines = section.trim().split('\n').filter(line => line.trim());

        let date = '';
        let link = '';
        let contentText = '';
        let images = [];
        let rawDate = null;

        lines.forEach(line => {
            if (line.startsWith('📅 Ngày:')) {
                date = line.replace('📅 Ngày:', '').trim();
                rawDate = new Date(date);
            } else if (line.startsWith('🔗 Link:')) {
                link = line.replace('🔗 Link:', '').trim();
            } else if (line.startsWith('🖼️ Hình ảnh:')) {
                const imageUrls = line.replace('🖼️ Hình ảnh:', '').trim();
                images = imageUrls.split(',').map(url => url.trim()).filter(url => url);
            } else if (line.startsWith('📝 Nội dung:')) {
                contentText = line.replace('📝 Nội dung:', '').trim();
            } else if (contentText) {
                contentText += '\n' + line;
            }
        });

        if (date && link && contentText) {
            const id = link.split('/').pop() || `deal_${index}`;
            deals.push({
                id,
                date: formatDealDate(rawDate),
                rawDate: rawDate ? rawDate.getTime() : 0,
                link,
                content: contentText.trim(),
                images
            });
        }
    });

    deals.sort((a, b) => b.rawDate - a.rawDate);
    return deals;
}

function formatDealDate(date) {
    if (!date || isNaN(date.getTime())) return 'N/A';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
