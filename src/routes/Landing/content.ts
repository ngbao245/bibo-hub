import type { LucideIcon } from 'lucide-react';
import { Compass, Zap, LayoutDashboard, BarChart3 } from 'lucide-react';

// ============================================================
// Content cho Landing BiBo Studio.
// Positioning: hướng tới khách non-tech / non-code — chủ shop,
// người quản lý, người có ý tưởng chưa có team code.
// Framework: "Vấn đề bạn gặp → Cách mình giúp".
// ============================================================

export interface Service {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface PortfolioItem {
  title: string;
  brief: string;
  tags: string[];
}

export const HERO = {
  name: 'BiBo Studio',
  tagline:
    'Bạn có ý tưởng. Bạn có công việc đang loay hoay chưa gọn. Mình biến chúng thành phần mềm chạy được thật.',
  ctaLabel: 'Xem mình giải quyết gì',
};

export const ABOUT = {
  title: 'Về BiBo Studio',
  body: 'Mình là Nguyễn Hoàng Bảo. Mình làm phần mềm cho những người không phải dân kỹ thuật — chủ shop, người quản lý, người có ý tưởng nhưng chưa có team code. Cách mình làm việc đơn giản: bạn kể vấn đề bằng ngôn ngữ thường ngày, mình dịch nó thành phần mềm chạy được. Không báo giá theo giờ mập mờ, không phải quay lại hỏi 20 câu tech mới bắt đầu. Bạn thấy kết quả sau vài tuần, dùng thật, góp ý, mình chỉnh tiếp.',
};

export const SERVICES: Service[] = [
  {
    icon: Compass,
    title: 'Không biết bắt đầu từ đâu để cải thiện công việc hằng ngày',
    description:
      'Bạn kể mình đang làm gì mỗi ngày — nhập gì, gọi cho ai, gõ lại cái gì nhiều lần. Mình nghe, chỉ ra chỗ đang tốn giờ, gợi ý cách sửa. Có thể là 1 tool nhỏ, có thể là 1 hệ thống, có thể chỉ là đổi cách làm. Buổi đầu miễn phí, không cam kết.',
  },
  {
    icon: Zap,
    title: 'Có những việc làm tay lặp lại mỗi ngày, mỗi tuần',
    description:
      'Nhập Excel, copy dữ liệu từ chỗ này sang chỗ khác, gửi tin nhắn giống nhau cho 20 khách — mình làm cho máy tự chạy phần đó. Bạn còn thời gian cho khách quan trọng, cho việc bán, cho nghỉ ngơi. Tuần đầu chạy đã thấy khác.',
  },
  {
    icon: LayoutDashboard,
    title: 'Cần một website để bán, để quản lý, và để được tìm thấy',
    description:
      'Không dùng ké Google Sheet, không xài chung phần mềm không hợp. Mình dựng hệ thống riêng theo cách bạn làm việc — nơi khách đặt hàng / đặt lịch, chỗ bạn quản lý danh sách. Kèm tối ưu SEO để khách gõ nghề của bạn trên Google là ra top, không phải trả tiền quảng cáo liên tục.',
  },
  {
    icon: BarChart3,
    title: 'Cuối tháng ngồi làm báo cáo mất cả ngày',
    description:
      'Doanh thu, chi phí, khách quay lại, sản phẩm bán chạy — bạn đang gõ tay từ nhiều file. Mình dựng chỗ tự tính, tự vẽ biểu đồ. Mở lên là thấy, xuất ra PDF gửi kế toán khi cần. Không phải cuối tháng nào cũng "hôm nay bận báo cáo".',
  },
];

export const PORTFOLIO: PortfolioItem[] = [
  {
    title: 'Hệ thống quản lý nhà hàng Pizza',
    brief:
      'Web + mobile app kết nối khách, phục vụ, bếp và quản lý. Đặt món nhanh, đơn đúng, xếp ca nhân viên tự động. Realtime cập nhật giữa các màn hình.',
    tags: ['.NET', 'React', 'React Native', 'Realtime'],
  },
  {
    title: 'Tool nội bộ ngân hàng OCB',
    brief:
      'Hệ thống log time, log effort cho team dev. Thêm loạt tool nhỏ tự động hoá việc lặp lại hàng ngày, giảm giờ làm tay đáng kể cho team.',
    tags: ['Web nội bộ', 'Automation', 'Ngân hàng'],
  },
  {
    title: 'Migrate database & refactor Bosch',
    brief:
      'Chuyển hơn 1 triệu bản ghi giữa 2 hệ thống database khác nhau, không mất data, không downtime dài. Refactor codebase quản lý xuất nhập khẩu theo chuẩn clean code.',
    tags: ['Migration', 'Refactor', 'Enterprise'],
  },
];

export const CONTACT = {
  title: 'Sẵn sàng bắt đầu?',
  description:
    'Nhắn mình vài dòng về việc bạn đang cần. Không cần chuẩn bị brief đẹp, không cần biết dùng từ tech. Cứ kể như đang kể với bạn bè, mình sẽ hỏi thêm phần còn thiếu.',
  zaloLink: 'https://zalo.me/0934140524',
  emailLink: 'mailto:ng.hoangbao03@gmail.com',
};