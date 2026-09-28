BÀN TAY VÔ HÌNH / BÀN TAY HỮU HÌNH — Trang thuyết trình CQ2 (SS008, Nhóm 2)
=========================================================================

CÁCH MỞ (phải chạy qua HTTP server — KHÔNG nháy đúp index.html)
- Lý do: js/scene3d.js là ES module; mở bằng file:// thì Chrome / Edge / Firefox chặn vì CORS
  (origin 'null') nên mất toàn bộ sân khấu 3D, chỉ còn phần chữ và hiệu ứng CSS.
- Cách 1 (tiện nhất trên Windows): nháy đúp chay-web.cmd ở thư mục gốc dự án — tự chạy server
  cổng 8080 rồi mở trình duyệt. Muốn cổng khác: chay-web.cmd 9000
- Cách 2 (Python, có sẵn): cd ban-tay-web
                           python -m http.server 8080 --bind 127.0.0.1
                           rồi mở http://127.0.0.1:8080/index.html
- Cách 3 (Node): npx --yes serve . -l 8080   (hoặc npx --yes http-server -p 8080 -c-1)
- Cách 4 (VS Code): cài extension Live Server, chuột phải index.html > Open with Live Server.
  (Không khuyến nghị: chrome --allow-file-access-from-files — hạ bảo mật, có máy vẫn chặn.)
- Không cần cài đặt hay build.
- Cần Internet khi mở trang: three.js (unpkg), GSAP + Lenis (jsdelivr) và phông Be Vietnam Pro,
  Newsreader (Google Fonts) — vì các thư viện này nạp từ CDN.
  Nếu offline: phần chữ vẫn hiện (phông hệ thống thay thế) nhưng mất sân khấu 3D và hiệu ứng cuộn.

CẤU TRÚC
  index.html      Toàn bộ nội dung tiếng Việt (hero + 8 mục + chân trang)
  css/style.css   Giao diện, hiệu ứng, responsive, chế độ in
  js/main.js      Thanh tiến độ, điều hướng, ba hồi truyện, đồ thị cung – cầu, nền hạt ở hero
  js/scene3d.js   Sân khấu 3D ở nền: hai bàn tay (lưới khung + da thật), hạt lơ lửng, đèn, bloom

TUỲ CHỈNH NHANH SÂN KHẤU 3D (js/scene3d.js, đầu tệp)
  HAND_FLIP        Góc xoay hai bàn tay quanh trục Y (mặc định Math.PI = 180°, chiều trái → phải)
  HAND_SIZE        Cỡ bàn tay (mặc định 5.6; trước đây 4.4 — càng lớn càng phóng to)
  HAND_BRIGHTNESS  Độ sáng bàn tay (mặc định 0.72; đặt 1 để sáng như cũ)
  WIRE_BRIGHTNESS  Độ sáng lưới khung bàn tay vô hình (mặc định 0.8)
  state.dust       Độ hiện của các lớp hạt lơ lửng; trong bảng "chapters" màn mở đầu
                   (opening) đặt dust: 0 nên lúc mới vào không còn hiệu ứng khối lơ lửng.
                   Muốn thấy hạt ngay từ màn đầu, đổi dust của opening thành 0.2 – 0.4.
  (Ngoài ra: cường độ 4 đèn ở đầu tệp, renderer.toneMappingExposure và thông số
   UnrealBloomPass đều đã được hạ xuống để hai bàn tay dịu mắt hơn.)

KHI THUYẾT TRÌNH
- Phím ↑ / ↓ (hoặc PageUp / PageDown): chuyển giữa các mục.
- Mục 2: bấm ba tab "Hồi 1 / Hồi 2 / Hồi 3" để đổi cảnh minh họa phiên chợ.
- Mục 5: kéo chấm đỏ trên đồ thị (hoặc dùng phím mũi tên khi đang chọn chấm) để thấy khan hàng / dư thừa khi giá bị ấn định;
  nút "Đưa về mức giá cân bằng" để đặt lại.
- Hero: di chuột để thấy vòng xanh (bàn tay hữu hình) tác động lên đàn hạt (thị trường tự tổ chức).

TUỲ CHỈNH NHANH
- Màu: đổi biến --gold (bàn tay vô hình) và --steel (bàn tay hữu hình) ở đầu css/style.css.
- Người dùng bật "giảm chuyển động" trong hệ điều hành sẽ tự động thấy bản ít hiệu ứng.
- In / xuất PDF: Ctrl/Cmd + P (đã có kiểu in sáng, gọn).
