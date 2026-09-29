BÀN TAY VÔ HÌNH / BÀN TAY HỮU HÌNH — Trang thuyết trình CQ2 (SS008, Nhóm 2)
=========================================================================
Phần giới thiệu đầy đủ kèm ảnh chụp nằm trong README.md ở thư mục gốc của repo.

CÁCH MỞ (phải chạy qua HTTP server — không nháy đúp index.html)
- Lý do: js/scene3d.js là ES module; mở bằng file:// thì trình duyệt chặn nên mất sân khấu 3D.
- Cách 1 (Windows): nháy đúp chay-web.cmd ở thư mục gốc dự án. Muốn cổng khác: chay-web.cmd 9000
- Cách 2 (Python): cd ban-tay-web  →  python -m http.server 8080 --bind 127.0.0.1
                   rồi mở http://127.0.0.1:8080/index.html
- Cách 3 (VS Code): extension Live Server → chuột phải index.html → Open with Live Server.
- KHÔNG cần Internet: three.js, GSAP, Lenis và phông chữ đều nằm sẵn trong vendor/ và fonts/.

CẤU TRÚC
  index.html        Nội dung (trang đầu + 8 mục + 3 đoạn chữ lớn chuyển chương + trắc nghiệm)
  css/style.css     Hệ màu theo chương (night / paper / dusk), bố cục, in ấn
  css/fonts.css     Phông Be Vietnam Pro, Newsreader, Anton, Unbounded (lưu cục bộ trong fonts/)
  js/main.js        Cuộn mượt, đổi chủ đề theo mục, điều hướng, câu chuyện ba hồi, đồ thị cung – cầu
  js/scene3d.js     Sân khấu 3D: hai bàn tay có xương, kịch bản theo cuộn, nhãn neo vào ngón tay
  js/poses.js       Thư viện tư thế (xòe, OK, khép, chỉ, chìa ngón cái, nắm)
  js/quiz.js        Trắc nghiệm 5 câu
  models/hand-visible.glb    Bàn tay hữu hình (mô hình giải phẫu, texture đã nén, sửa vật liệu da)
  models/hand-invisible.glb  Bàn tay vô hình (cùng bộ 21 xương, hiển thị bằng hạt + viền sáng)
  vendor/           three.js 0.186, GSAP 3.15, Lenis 1.3 (lấy từ node_modules.zip của nhóm)

HỆ MÀU
- Vô hình = ánh sáng lạnh (--inv), hữu hình = đất nung (--vis), đỏ (--danger) chỉ dùng cho khuyết tật.
- Nền đổi theo chương: tối (mục 1, 3, 4), giấy sáng (mục 5), than (mục 2, 6, 7, 8).
  Mỗi <section> khai báo data-theme="night|paper|dusk" và data-hand="inv|vis".

TINH CHỈNH BÀN TAY (js/scene3d.js, mảng KEYS_SPEC)
- Ngôn ngữ chung: bàn tay vô hình luôn rủ từ trên xuống, ngón chỉ xuống; bàn tay hữu hình
  luôn vươn từ dưới lên, ngón chỉ lên. Cảnh chạm tay (trang đầu, đoạn chữ lớn mục 7, trắc nghiệm)
  dựng dọc: hai đầu ngón trỏ gặp nhau qua một khe sáng.
- Mỗi dòng là một khóa, neo vào một phần tử: at: '#s3 .section__head' ...
    p     tiến độ trong đoạn được ghim (0..1), dùng cho #hero, #i1, #i2, #i3
    line  vạch trên màn hình mà đỉnh phần tử chạm tới (mặc định 0,55)
    hold  tỉ lệ đứng yên trước khi chuyển sang khóa sau
    stage x tính trong vùng sân khấu bên phải cột chữ; abs: x tính trên toàn màn hình
  Thông số không ghi thì kế thừa từ khóa trước.
- Bàn tay (inv, vis):
    show   0..1 hiện / ẩn          x, y   vị trí cổ tay (-1..1; y = 1 mép trên, y = -1 mép dưới)
    size   chiều dài bàn tay so với nửa chiều cao màn hình
    angle  hướng ngón (0 lên, 180 xuống, 90 trái, -90 phải)
    tilt   ngả ngón về phía người xem     roll   xoay quanh trục cánh tay
    dim    chìm tối, chỉ còn viền sáng    fade   cổ tay tan vào bóng tối (0..1)
    pose   'open' 'reach' 'relax' 'cup' 'flat' 'point' 'ok' 'thumb' 'grip' 'fist' 'god'
- Toàn cảnh (g): meet (tự khớp hai đầu ngón trỏ), mx, my (điểm gặp), gap (khe hở),
  spark (tia sáng ở khe), ghost (bóc lớp da ở mục 7.2), f0 f1 f2 (làm sáng nhóm ngón ở mục 4).
- PAIR(mx, my, size, gap, spark) dựng sẵn một cặp chạm tay dọc tại điểm (mx, my).
- labels: nhãn neo vào đầu ngón, ví dụ ['inv', 'index_dist', 'Cạnh tranh'].
- Console trình duyệt: __hands.KEYS để xem và thử giá trị trực tiếp.

ĐOẠN CHỮ LỚN VÀ HIỆU ỨNG CUỘN (js/main.js, hàm initScrollMotion)
- Trang đầu: tiêu đề phóng to bay qua camera, cặp bàn tay ra giữa, luận điểm hiện ở cột trái.
- #i1, #i2, #i3: hai dòng chữ lớn trượt vào từ hai phía rồi phóng to xuyên qua màn hình,
  bàn tay hiện ra phía sau. #i2 có lá chớp phủ nền giấy trước mục 5.
- Tiêu đề mục và tiêu đề nhỏ: từng chữ trồi lên một lần khi cuộn tới.

HIỆU NĂNG
- Trang tự đo tốc độ khung hình; nếu máy chậm sẽ tự giảm độ phân giải, số hạt, rồi tắt hiệu ứng phát sáng.
- Ép mức chất lượng bằng tham số địa chỉ: index.html?q=2 (đầy đủ), ?q=1 (vừa), ?q=0 (nhẹ nhất).
  Nên thử trước trên chính máy sẽ chiếu; nếu mượt ở ?q=2 thì dùng địa chỉ đó khi thuyết trình.

KHI THUYẾT TRÌNH
- Phím ↑ / ↓ (hoặc PageUp / PageDown): chuyển giữa các mục và các điểm dừng của trang đầu,
  đoạn chữ lớn (luận điểm, lúc bàn tay hiện ra).
- Mục 2: bấm "Hồi 1 / Hồi 2 / Hồi 3" — bàn tay 3D phản ứng theo từng hồi.
- Mục 5: kéo đường giá màu đỏ trên đồ thị — giá càng thấp, bàn tay hữu hình đứng cạnh khung càng nắm chặt.
- Mục 7.2: cuộn chậm để thấy lớp da tan dần, lộ bàn tay vô hình bên trong.
- In / xuất PDF: Ctrl + P.

GHI CÔNG
- Mô hình bàn tay: 3D Rigged Hand Model © 2026 Emma L. D. Lieker, giấy phép CC BY-NC 4.0
  (dùng cho mục đích học tập, không thương mại; đã chỉnh vật liệu và tư thế).
