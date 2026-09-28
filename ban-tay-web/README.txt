BÀN TAY VÔ HÌNH / BÀN TAY HỮU HÌNH — Trang thuyết trình CQ2 (SS008, Nhóm 2)
=========================================================================

CÁCH MỞ (phải chạy qua HTTP server — không nháy đúp index.html)
- Lý do: js/scene3d.js là ES module; mở bằng file:// thì trình duyệt chặn nên mất sân khấu 3D.
- Cách 1 (Windows): nháy đúp chay-web.cmd ở thư mục gốc dự án. Muốn cổng khác: chay-web.cmd 9000
- Cách 2 (Python): cd ban-tay-web  →  python -m http.server 8080 --bind 127.0.0.1
                   rồi mở http://127.0.0.1:8080/index.html
- Cách 3 (VS Code): extension Live Server → chuột phải index.html → Open with Live Server.
- KHÔNG cần Internet: three.js, GSAP, Lenis và phông chữ đều nằm sẵn trong vendor/ và fonts/.

CẤU TRÚC
  index.html        Nội dung (hero + 8 mục + trắc nghiệm)
  css/style.css     Hệ màu theo chương (night / paper / dusk), bố cục, in ấn
  css/fonts.css     Phông Be Vietnam Pro, Newsreader (lưu cục bộ trong fonts/)
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

TINH CHỈNH BÀN TAY (js/scene3d.js, mảng CUES)
- Mỗi dòng là một cảnh, neo vào một phần tử trong trang (at: '#s3 .section__head' ...).
- H(show, x, y, size, angle, tilt, roll, pose):
    show   1 = hiện, 0 = ẩn (bàn tay hữu hình tan rã / hiện ra)
    x, y   vị trí cổ tay trên màn hình (-1..1; x = 1 là mép phải, y = -1 là mép dưới)
    size   chiều dài bàn tay so với chiều cao màn hình
    angle  hướng ngón tay (0 = lên, 90 = sang trái, -90 = sang phải)
    tilt   nghiêng ngón về phía người xem; roll: xoay quanh cánh tay (0 = lòng bàn tay hướng người xem)
    pose   'open' 'reach' 'relax' 'cup' 'flat' 'point' 'ok' 'thumb' 'grip' 'fist'
- labels: nhãn neo vào đầu ngón, ví dụ ['inv', 'index_dist', 'Cạnh tranh'].
- Console trình duyệt: __hands.CUES để thử giá trị trực tiếp.

HIỆU NĂNG
- Trang tự đo tốc độ khung hình; nếu máy chậm sẽ tự giảm độ phân giải, số hạt, rồi tắt hiệu ứng phát sáng.
- Ép mức chất lượng bằng tham số địa chỉ: index.html?q=2 (đầy đủ), ?q=1 (vừa), ?q=0 (nhẹ nhất).
  Nên thử trước trên chính máy sẽ chiếu; nếu mượt ở ?q=2 thì dùng địa chỉ đó khi thuyết trình.

KHI THUYẾT TRÌNH
- Phím ↑ / ↓ (hoặc PageUp / PageDown): chuyển giữa các mục.
- Mục 2: bấm "Hồi 1 / Hồi 2 / Hồi 3" — bàn tay 3D phản ứng theo từng hồi.
- Mục 5: kéo chấm trên đồ thị để ấn định giá — giá càng thấp, bàn tay hữu hình càng nắm chặt.
- Mục 7.2: cuộn chậm để thấy lớp da tan dần, lộ bàn tay vô hình bên trong.
- In / xuất PDF: Ctrl + P.

GHI CÔNG
- Mô hình bàn tay: 3D Rigged Hand Model © 2026 Emma L. D. Lieker, giấy phép CC BY-NC 4.0
  (dùng cho mục đích học tập, không thương mại; đã chỉnh vật liệu và tư thế).
