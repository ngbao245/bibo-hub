// SpendBot reply templates — 3 tones
// Placeholders: {name} tên món, {amt} số tiền, {total} tổng hôm nay
//
// TONES:
//   normal  — thân thiện, nhẹ nhàng
//   fun     — vui vẻ, khịa nhẹ
//   savage  — khịa láo, đau nhưng vui
//
// drink → food (xử lý ở getLocalReply)

const REPLY_TEMPLATES = {
    normal: {
        food: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}.',
            '{name} {amt} — ăn uống là cần thiết. Tổng {total}. 🙂',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}. 😄'
        ],

        transport: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            '{name} {amt} — đã lưu lại. Tổng {total}.',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}. 🙂',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}. 😄'
        ],

        shopping: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            '{name} {amt} — đã lưu. Tổng {total}.',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}. 🙂',
            '{name} {amt} — mua sắm vừa đủ nhé. Tổng {total}. 😄'
        ],

        tech: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            '{name} {amt} — chi cho công nghệ đã được lưu. Tổng {total}. 🤔',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}.',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}. 😄'
        ],

        travel: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            '{name} {amt} — chi cho chuyến đi đã được lưu. Tổng {total}. 😌',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}.',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}. 😄'
        ],

        gift: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            '{name} {amt} — quà tặng ý nghĩa. Tổng {total}. 😌',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}.',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}. 😄'
        ],

        course: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            '{name} {amt} — đầu tư học tập tốt mà. Tổng {total}. 🤔',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}. 😄',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}.'
        ],

        health: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}.',
            '{name} {amt} — sức khoẻ là ưu tiên. Tổng {total}. 😌',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}.',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}. 😄'
        ],

        other: [
            'Đã ghi {name} {amt}. Hôm nay tổng {total}. 🙂',
            '{name} {amt} — đã lưu vào mục khác. Tổng {total}. 😌',
            'Ghi nhận {name} {amt}. Tổng hôm nay {total}.',
            'Đã lưu {name} {amt}. Tổng chi hôm nay {total}.'
        ]
    },

    fun: {
        food: [
            '{name} {amt} — ăn sang vậy, ví bạn chắc đang giả chết. Tổng {total}. 😏',
            'Ghi {name} {amt}. Mồm vui 5 phút, cuối tháng buồn 5 ngày. Tổng {total}. 😅',
            '{name} {amt} — ăn như này mà còn hỏi sao hết tiền. Tổng {total}. 🤨',
            '{name} {amt}. Dạ dày được nuông chiều, ví thì bị bạo hành. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Ăn ngon đó, nhưng tài chính đang đi cấp cứu. Tổng {total}. 🫤',
            '{name} {amt} — một bữa ăn, một bước xa rời tiết kiệm. Tổng {total}. 😮‍💨',
            'Ghi {name} {amt}. Bụng no rồi, giờ tới lượt ví đói. Tổng {total}. 😑',
            '{name} {amt} — ăn uống kiểu này đúng chất “sống không cần nghĩ”. Tổng {total}. 😌',
            'Đã lưu {name} {amt}. Dạ dày cảm ơn, ngân sách chửi thề. Tổng {total}. 🤔',
            '{name} {amt} — ăn cho sướng miệng, trả giá bằng nước mắt. Tổng {total}. 🫠'
        ],

        transport: [
            '{name} {amt} — đi có mấy bước mà tiêu như đi xuyên Việt. Tổng {total}. 😏',
            'Ghi {name} {amt}. Chân thì khỏe nhưng bạn chọn làm ví què. Tổng {total}. 😅',
            '{name} {amt} — gọi xe riết như thể dị ứng đi bộ. Tổng {total}. 🤨',
            '{name} {amt}. Tiện một chút, nghèo một chút. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Di chuyển ngắn thôi, bay màu thì dài lâu. Tổng {total}. 🫤',
            '{name} {amt} — tiền xe hôm nay chạy nhanh hơn chính bạn. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Ví đang nhìn bạn bằng ánh mắt thất vọng. Tổng {total}. 😑',
            '{name} {amt} — đi chưa xa nhưng tài chính đã xa dần. Tổng {total}. 😌',
            'Ghi {name} {amt}. Mỗi cuốc xe là một nhát cắt vào hy vọng tiết kiệm. Tổng {total}. 🤔',
            '{name} {amt} — lười bước chân, chăm đốt tiền. Tổng {total}. 🫠'
        ],

        shopping: [
            '{name} {amt} — mua xong vui một lúc, nhìn số dư buồn cả tối. Tổng {total}. 😏',
            'Ghi {name} {amt}. Lại thêm một món “rất cần” theo lời bạn kể. Tổng {total}. 😅',
            '{name} {amt} — nhu cầu thật hay dopamine lên cơn? Tổng {total}. 🤨',
            '{name} {amt}. Mua thì nhanh, hối hận thì tới chậm thôi. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Ví bạn giờ mỏng như lời hứa tiết kiệm. Tổng {total}. 🫤',
            '{name} {amt} — chốt đơn rất mạnh, kiểm soát bản thân rất yếu. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Shopping xong rồi, chuẩn bị diễn cảnh “tháng này khó”. Tổng {total}. 😑',
            '{name} {amt} — tự thưởng bản thân riết như đang nuôi thói quen phá sản. Tổng {total}. 😌',
            'Ghi {name} {amt}. Món này có thể không cần, nhưng bạn thì rất muốn. Tổng {total}. 🤔',
            '{name} {amt} — ví đang co rúm lại vì chủ nhân sống quá cảm xúc. Tổng {total}. 🫠'
        ],

        tech: [
            '{name} {amt} — đồ công nghệ mới, còn tài chính thì cũ kỹ hẳn. Tổng {total}. 😏',
            'Ghi {name} {amt}. Đam mê công nghệ, kỹ năng chính là đốt tiền. Tổng {total}. 😅',
            '{name} {amt} — mua gear xịn để cảm giác mình chuyên nghiệp hơn thôi đúng không. Tổng {total}. 🤨',
            '{name} {amt}. Setup nâng cấp, số dư hạ cấp. Tổng {total}. 🙃',
            'Thêm {name} {amt}. FPS chưa chắc tăng, nhưng mức độ nghèo thì có. Tổng {total}. 🫤',
            '{name} {amt} — dân tech chính hiệu: thích tối ưu hiệu năng, bỏ qua tối ưu ví. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Mua xong nhìn rất ngầu, trả tiền xong rất sầu. Tổng {total}. 😑',
            '{name} {amt} — đồ công nghệ nào bạn cũng thấy “nên có”, trừ tiền. Tổng {total}. 😌',
            'Ghi {name} {amt}. Gear càng đẹp, tài khoản càng méo. Tổng {total}. 🤔',
            '{name} {amt} — tiêu chuẩn chọn đồ: đắt là mê. Tổng {total}. 🫠'
        ],

        travel: [
            '{name} {amt} — đi chữa lành, ví ở nhà bị tổn thương. Tổng {total}. 😏',
            'Ghi {name} {amt}. Kỷ niệm đẹp đó, nhưng hóa đơn cũng rất rõ nét. Tổng {total}. 😅',
            '{name} {amt} — xê dịch cho đã, về nhà xài mì. Tổng {total}. 🤨',
            '{name} {amt}. Tinh thần được nâng lên, tài chính bị dập xuống. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Đi một chuyến, số dư đi luôn. Tổng {total}. 🫤',
            '{name} {amt} — ảnh đăng lên sang, tài khoản nhìn vào tang thương. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Thanh xuân rực rỡ, ví thì héo úa. Tổng {total}. 😑',
            '{name} {amt} — “đi để trải nghiệm”, nghe hợp lý cho tới khi xem số dư. Tổng {total}. 😌',
            'Ghi {name} {amt}. Chuyến đi chill, hậu quả không chill lắm. Tổng {total}. 🤔',
            '{name} {amt} — vui vẻ ngắn hạn, nghèo bền vững. Tổng {total}. 🫠'
        ],

        gift: [
            '{name} {amt} — bạn đúng là người sống tình cảm, còn ví sống lay lắt. Tổng {total}. 😏',
            'Ghi {name} {amt}. Tặng quà xịn ghê, tự tặng áp lực cho bản thân luôn. Tổng {total}. 😅',
            '{name} {amt} — người nhận cười, ví bạn méo mặt. Tổng {total}. 🤨',
            '{name} {amt}. Tình nghĩa đậm sâu, số dư thì mỏng dần. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Hào phóng vậy, cuối tháng nhớ sống khiêm tốn. Tổng {total}. 🫤',
            '{name} {amt} — món quà đẹp, quyết định tài chính thì không. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Bạn chơi đẹp, ví chơi vơi. Tổng {total}. 😑',
            '{name} {amt} — đúng kiểu lấy tiền đổi lấy thiện cảm. Tổng {total}. 😌',
            'Ghi {name} {amt}. Tặng quà rất có tâm, giữ tiền thì không. Tổng {total}. 🤔',
            '{name} {amt} — hôm nay làm thiên thần, mai làm con nợ. Tổng {total}. 🫠'
        ],

        course: [
            '{name} {amt} — mua khóa học xong nhớ học, đừng mua để ngắm. Tổng {total}. 😏',
            'Ghi {name} {amt}. Kiến thức thì chưa thấy, tiền thì bay rồi. Tổng {total}. 😅',
            '{name} {amt} — đầu tư bản thân hay sưu tầm khóa học nữa đây? Tổng {total}. 🤨',
            '{name} {amt}. Mua rất nhiệt, học được bao nhiêu để tính sau. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Ví giảm mạnh, hy vọng não tăng lực. Tổng {total}. 🫤',
            '{name} {amt} — mong là lần này không “save for later” tới năm sau. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Học hành kiểu này mà còn lười là buồn cười lắm. Tổng {total}. 😑',
            '{name} {amt} — bạn đang đầu tư tương lai, hoặc đang góp vui cho nền giáo dục online. Tổng {total}. 😌',
            'Ghi {name} {amt}. Cầu mong khóa này không chung số phận với mấy khóa trước. Tổng {total}. 🤔',
            '{name} {amt} — chốt khóa học nhanh như thể chăm học lắm vậy. Tổng {total}. 🫠'
        ],

        health: [
            '{name} {amt} — ít ra khoản này tiêu còn có lý hơn mấy món linh tinh. Tổng {total}. 😌',
            'Ghi {name} {amt}. Ví đau chút, còn hơn để người đau nhiều. Tổng {total}. 🙂',
            '{name} {amt} — chăm sức khỏe đi, còn phải khỏe để kiếm lại số tiền này. Tổng {total}. 🤔',
            '{name} {amt}. Tiền mất nhưng được cái bớt lo. Tổng {total}. 😮‍💨',
            'Thêm {name} {amt}. Khoản này không khịa mạnh được, vì nó đáng. Tổng {total}. 😌',
            '{name} {amt} — tiêu để sống lâu hơn, hợp lý đấy. Tổng {total}. 🙂',
            'Đã lưu {name} {amt}. Người ổn lên là tốt, ví tính sau. Tổng {total}. 😄',
            '{name} {amt} — một trong số ít khoản tiêu mà bot không muốn mắng. Tổng {total}. 🤫',
            'Ghi {name} {amt}. Sức khỏe cứu bạn, còn số dư tự cứu sau. Tổng {total}. 😅',
            '{name} {amt} — lần hiếm hoi tiêu tiền mà bot thấy bạn khôn. Tổng {total}. 🙂'
        ],

        other: [
            '{name} {amt} — lại “khác”. Mục này đúng là bãi đáp của mọi quyết định mơ hồ. Tổng {total}. 😏',
            'Ghi {name} {amt}. Không biết xếp đâu thì quăng vào “khác”, tiện ghê. Tổng {total}. 😅',
            '{name} {amt} — chi linh tinh nhưng tốc độ bay tiền rất chuyên nghiệp. Tổng {total}. 🤨',
            '{name} {amt}. “Khác” là cách nói lịch sự của “tôi cũng không biết mình tiêu gì”. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Mục “khác” hôm nay lại đón thêm nạn nhân. Tổng {total}. 🫤',
            '{name} {amt} — không rõ là gì, chỉ rõ là tốn. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Lý do không quan trọng, mất tiền là chính. Tổng {total}. 😑',
            '{name} {amt} — cái gì không biết cứ nhét vào đây, giống cảm xúc của bạn vậy. Tổng {total}. 😌',
            'Ghi {name} {amt}. Mục “khác” càng to, tương lai càng mù. Tổng {total}. 🤔',
            '{name} {amt} — tóm lại là lại mất tiền. Tổng {total}. 🫠'
        ]
    },

    savage: {
        food: [
            '{name} {amt} — ăn dữ ha, tưởng ví nhà bạn biết đẻ tiền. Tổng {total}. 😏',
            'Ghi {name} {amt}. Mới đói cái là quất, tiết kiệm để trưng à? Tổng {total}. 🤨',
            '{name} {amt} — ăn như chưa từng thấy ngày mai. Tổng {total}. 😑',
            '{name} {amt}. Mồm thì sướng, ví thì méo. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Dạ dày bạn đang sống quá sung sướng. Tổng {total}. 🫤',
            '{name} {amt} — ăn kiểu này cuối tháng ngồi húp không khí nha. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Bụng no rồi, giờ tới ví đói. Tổng {total}. 🤫',
            '{name} {amt} — đúng kiểu vừa có tiền là quên mất mình nghèo. Tổng {total}. 🫠',
            'Ghi {name} {amt}. Ăn thì nhanh, tỉnh ngộ thì chậm. Tổng {total}. 😔',
            '{name} {amt} — thêm một bữa ngon, bớt một chút liêm sỉ tài chính. Tổng {total}. 😏'
        ],

        transport: [
            '{name} {amt} — đi có đoạn ngắn mà tiêu như thuê phi cơ. Tổng {total}. 😏',
            'Ghi {name} {amt}. Chân còn nguyên mà ví què trước rồi. Tổng {total}. 🤨',
            '{name} {amt} — lười đi bộ thì nói thẳng, bày đặt tối ưu thời gian. Tổng {total}. 😑',
            '{name} {amt}. Một cuốc xe, một cú tát vào ngân sách. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Tiện thì tiện thật, nghèo cũng thật. Tổng {total}. 🫤',
            '{name} {amt} — di chuyển ít thôi mà đốt tiền rất chăm. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Ví bạn đang chửi mà bạn không nghe thôi. Tổng {total}. 🤫',
            '{name} {amt} — đúng chất ngại bước chân, thích bước vào nghèo khó. Tổng {total}. 🫠',
            'Ghi {name} {amt}. Chưa tới nơi mà tài chính xuống dốc rồi. Tổng {total}. 😔',
            '{name} {amt} — gọi xe như gọi nước, bảo sao không toang. Tổng {total}. 😏'
        ],

        shopping: [
            '{name} {amt} — lại thêm một món “cần gấp” do bạn tự bịa ra. Tổng {total}. 😏',
            'Ghi {name} {amt}. Ham mua vậy ví nó ghét bạn cũng đúng. Tổng {total}. 🤨',
            '{name} {amt} — thấy thích là quất, thấy số dư thì tắt tiếng. Tổng {total}. 😑',
            '{name} {amt}. Mua nhanh lắm, kiểm soát bản thân như trò đùa. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Bạn không shopping, bạn đang tự dằn mặt ví. Tổng {total}. 🫤',
            '{name} {amt} — món này đẹp, còn quyết định của bạn thì xấu. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Lại tự thưởng bản thân như thể bạn vừa cứu thế giới. Tổng {total}. 🤫',
            '{name} {amt} — dopamine lên cái là tiền đi luôn. Tổng {total}. 🫠',
            'Ghi {name} {amt}. Ví mỏng như cách bạn tự nhủ “lần này cuối cùng”. Tổng {total}. 😔',
            '{name} {amt} — mua cho đã rồi về than nghèo tiếp nha. Tổng {total}. 😏'
        ],

        tech: [
            '{name} {amt} — dân hệ tech nhìn cái gì cũng tưởng mình cần. Tổng {total}. 😏',
            'Ghi {name} {amt}. Setup xịn lên, tài chính xịt xuống. Tổng {total}. 🤨',
            '{name} {amt} — cứ dính chữ pro là bạn tự động mất kiểm soát. Tổng {total}. 😑',
            '{name} {amt}. Đồ thì hiện đại, cách giữ tiền thì tiền sử. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Gear mới chưa chắc giúp bạn giỏi hơn đâu nha. Tổng {total}. 🫤',
            '{name} {amt} — mua xong thấy ngầu, nhìn số dư thấy ngu. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Hiệu năng tăng không rõ, độ nghèo tăng rõ. Tổng {total}. 🤫',
            '{name} {amt} — dân tech thật, tối ưu đủ thứ trừ tài khoản. Tổng {total}. 🫠',
            'Ghi {name} {amt}. FPS chưa thấy, ví tụt khung hình trước. Tổng {total}. 😔',
            '{name} {amt} — đam mê công nghệ, kỹ năng chính là phá két. Tổng {total}. 😏'
        ],

        travel: [
            '{name} {amt} — đi chữa lành, ví ở nhà bị đánh hội đồng. Tổng {total}. 😏',
            'Ghi {name} {amt}. Đi chơi cho sướng rồi về sống tiết kiệm giả vờ. Tổng {total}. 🤨',
            '{name} {amt} — ảnh đẹp lắm, số dư nhìn còn đẹp không? Tổng {total}. 😑',
            '{name} {amt}. Thanh xuân rực rỡ, tài khoản tàn tạ. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Đi một chuyến là ví đi luôn một khúc. Tổng {total}. 🫤',
            '{name} {amt} — trải nghiệm thì hay, hậu quả thì dài. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Bạn đi du lịch, ví đi cấp cứu. Tổng {total}. 🤫',
            '{name} {amt} — sống là phải đi, còn nghèo là do bạn. Tổng {total}. 🫠',
            'Ghi {name} {amt}. Vui vài ngày, méo mặt vài tuần. Tổng {total}. 😔',
            '{name} {amt} — xê dịch kiểu này thì chỉ có số dư đứng yên ở đáy. Tổng {total}. 😏'
        ],

        gift: [
            '{name} {amt} — người ta được quà, còn bạn được cảnh nghèo. Tổng {total}. 😏',
            'Ghi {name} {amt}. Sống tình cảm dữ, sống tài chính thì dở. Tổng {total}. 🤨',
            '{name} {amt} — tặng quà sang ghê, tự hành mình luôn. Tổng {total}. 😑',
            '{name} {amt}. Bạn chơi đẹp, ví chơi dởm. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Hào phóng cỡ này cuối tháng nhớ ăn bằng lòng tốt. Tổng {total}. 🫤',
            '{name} {amt} — lấy tiền đổi thiện cảm, nghe cũng hơi ngu ngu. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Người nhận vui, ví bạn thở oxy. Tổng {total}. 🤫',
            '{name} {amt} — quà xịn đó, quyết định thì không xịn lắm. Tổng {total}. 🫠',
            'Ghi {name} {amt}. Bạn là thiên thần, còn ví là vật tế. Tổng {total}. 😔',
            '{name} {amt} — hôm nay làm người tốt, mai làm người hết tiền. Tổng {total}. 😏'
        ],

        course: [
            '{name} {amt} — mua khóa học nữa à, học chưa hay sưu tầm vậy? Tổng {total}. 😏',
            'Ghi {name} {amt}. Chốt khóa nhanh như thể chăm học lắm. Tổng {total}. 🤨',
            '{name} {amt} — mong lần này học thật, đừng mua xong để mốc. Tổng {total}. 😑',
            '{name} {amt}. Tiền thì đóng nghiêm túc, động lực thì mất tích. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Não chưa nâng cấp nhưng ví đã tụt cấp. Tổng {total}. 🫤',
            '{name} {amt} — đầu tư bản thân nghe sang, bỏ ngang nghe quen. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Cầu mong khóa này không chung mộ với mấy khóa cũ. Tổng {total}. 🤫',
            '{name} {amt} — mua để tự thấy mình cố gắng, còn học để tính sau. Tổng {total}. 🫠',
            'Ghi {name} {amt}. Tương lai có sáng không chưa biết, hiện tại thì đang tốn. Tổng {total}. 😔',
            '{name} {amt} — thêm một lời hứa với bản thân, coi chừng lại thất hứa. Tổng {total}. 😏'
        ],

        health: [
            '{name} {amt} — khoản này còn đỡ, ít nhất không ngu như shopping. Tổng {total}. 😌',
            'Ghi {name} {amt}. Ví đau chút còn hơn người đau nhiều. Tổng {total}. 🙂',
            '{name} {amt} — tiêu để còn khỏe mà cày bù lại. Tổng {total}. 🤔',
            '{name} {amt}. Hiếm hoi lắm mới thấy bạn tiêu có lý. Tổng {total}. 😮‍💨',
            'Thêm {name} {amt}. Lần này bot tạm tha, vì cũng đáng. Tổng {total}. 😌',
            '{name} {amt} — người ổn lên là được, ví chịu tí cũng đành. Tổng {total}. 🙂',
            'Đã lưu {name} {amt}. Cuối cùng cũng có khoản không làm bot nổi nóng. Tổng {total}. 😄',
            '{name} {amt} — chăm sức khỏe đi, còn phải sống để trả đống kia nữa. Tổng {total}. 🤫',
            'Ghi {name} {amt}. Đây là một trong số ít cú chi tiêu có não. Tổng {total}. 😅',
            '{name} {amt} — tiêu kiểu này nghe còn cứu được danh dự. Tổng {total}. 🙂'
        ],

        other: [
            '{name} {amt} — lại “khác”. Nghĩa là bạn cũng đéo biết mình tiêu gì. Tổng {total}. 😏',
            'Ghi {name} {amt}. Mục “khác” đúng là bãi rác của mọi quyết định ngáo. Tổng {total}. 🤨',
            '{name} {amt} — không biết gọi gì, chỉ biết là mất tiền. Tổng {total}. 😑',
            '{name} {amt}. “Khác” là cách nói lịch sự của “tiêu linh tinh”. Tổng {total}. 🙃',
            'Thêm {name} {amt}. Mỗi lần vào mục này là bot mất niềm tin. Tổng {total}. 🫤',
            '{name} {amt} — lý do mơ hồ, hậu quả rất cụ thể. Tổng {total}. 😮‍💨',
            'Đã lưu {name} {amt}. Không rõ là gì nhưng rõ là tốn. Tổng {total}. 🤫',
            '{name} {amt} — mục “khác” càng dày, tương lai càng tối. Tổng {total}. 🫠',
            'Ghi {name} {amt}. Bạn không quản lý chi tiêu, bạn đang ghi log thảm họa. Tổng {total}. 😔',
            '{name} {amt} — tóm lại là lại mất tiền vì một cái gì đó rất nhảm. Tổng {total}. 😏'
        ]
    },
};

function getLocalReply(category, name, amt, total) {
    const tone = getCurrentTone();
    const cat = category === 'drink' ? 'food' : category;
    const toneTemplates = REPLY_TEMPLATES[tone] || REPLY_TEMPLATES.fun;
    const opts = toneTemplates[cat] || toneTemplates.other;
    const template = opts[Math.floor(Math.random() * opts.length)];
    return template
        .replace(/{name}/g, name)
        .replace(/{amt}/g, amt)
        .replace(/{total}/g, total);
}
