// Vercel Serverless Function - Deal Tracker API
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const dealsFilePath = path.join(process.cwd(), 'telegram', 'deals.txt');

        if (!fs.existsSync(dealsFilePath)) {
            return res.status(200).json([]);
        }

        const content = fs.readFileSync(dealsFilePath, 'utf-8');
        const deals = parseDeals(content);

        return res.status(200).json(deals);
    } catch (error) {
        console.error('Error reading deals:', error);
        return res.status(500).json({ error: 'Failed to load deals' });
    }
};

function parseDeals(content) {
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
                date: formatDate(rawDate),
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

function formatDate(date) {
    if (!date || isNaN(date.getTime())) return 'N/A';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
