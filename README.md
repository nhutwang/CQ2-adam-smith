# CQ2 — Bàn Tay Vô Hình / Bàn Tay Hữu Hình (SS008 — Nhóm 2)

Trang web thuyết trình tương tác 3D kết hợp minh họa lý thuyết kinh tế chính trị: **"Bàn tay vô hình"** (Adam Smith — Cơ chế thị trường tự điều tiết) và **"Bàn tay hữu hình"** (Sự can thiệp, điều tiết của Nhà nước).

---

## 🚀 Hướng Dẫn Khởi Chạy (Bắt Buộc Chạy Qua HTTP Server)

> ⚠️ **LƯU Ý QUAN TRỌNG:**  
> Không nháy đúp trực tiếp vào tệp `index.html` (giao thức `file://`).  
> Trình duyệt chặn nạp module JavaScript (`scene3d.js`) do chính sách bảo mật CORS, khiến sân khấu 3D không hiển thị được. Hãy dùng một trong các cách chạy dưới đây:

### Cách 1: Nhanh nhất trên Windows (Khuyên dùng)
- Nháy đúp vào tệp **`chay-web.cmd`** (ở thư mục gốc dự án, cạnh thư mục `ban-tay-web`).
- Cần có Python 3 (hoặc Node.js). Nếu cổng 8080 đang bận, script tự chuyển sang cổng kế tiếp.
- Trình duyệt sẽ tự động mở địa chỉ: `http://127.0.0.1:8080/index.html`.
- Để đổi cổng: mở cmd gõ `chay-web.cmd 9000`.

### Cách 2: Dùng Python (Sẵn có trên máy)
Mở terminal tại thư mục `ban-tay-web/` và chạy:
```bash
python -m http.server 8080 --bind 127.0.0.1
```
Sau đó truy cập: `http://127.0.0.1:8080/index.html`

### Cách 3: Dùng Node.js
```bash
cd ban-tay-web
npx --yes serve . -l 8080
```

### Cách 4: Dùng Visual Studio Code
- Cài đặt extension **Live Server**.
- Mở thư mục `ban-tay-web` trong VS Code.
- Chuột phải vào `index.html` và chọn **Open with Live Server**.

---

## 🌐 Yêu Cầu Kết Nối Mạng
- Khi tải trang lần đầu, trình duyệt cần kết nối Internet để nạp các thư viện từ CDN:
  - **Three.js** (WebGL 3D Engine & Loaders)
  - **GSAP & Lenis** (Hiệu ứng cuộn mượt và timeline chuyển động)
  - **Google Fonts** (Be Vietnam Pro, Newsreader)
- Nếu không có mạng: chữ và giao diện vẫn hiển thị nhưng sân khấu 3D sẽ không thể khởi tạo.

---

## 📂 Cấu Trúc Dự Án

```text
SS008-ktct/
├── ban-tay-web/
│   ├── index.html                  # Giao diện chính (Hero + 8 phần nội dung + chân trang)
│   ├── README.txt                  # Ghi chú hướng dẫn kỹ thuật chi tiết
│   ├── V2_FEATURES.md              # Ghi chú tính năng phiên bản V2
│   ├── css/
│   │   └── style.css               # Phong cách thẩm mỹ, hiệu ứng responsive và chế độ in
│   ├── js/
│   │   ├── main.js                 # Điều hướng, tiến độ đọc, 3 hồi kịch bản, đồ thị cung-cầu
│   │   └── scene3d.js              # Sân khấu Three.js 3D: hạt không gian, mô hình bàn tay, ánh sáng
│   ├── models/
│   │   └── rigged-hand/
│   │       ├── handRig_02.fbx      # Mô hình 3D bàn tay xương (Rigged hand)
│   │       └── ...                 # Các texture map (Albedo, Normal, Roughness, Specular)
│   └── dist/                       # Bản dựng tĩnh đóng gói
├── chay-web.cmd                    # File thực thi 1 chạm khởi động web server
├── NOI_DUNG_THUYET_TRINH.txt       # Toàn văn nội dung báo cáo & dàn ý thuyết trình
└── README.md                       # Tài liệu hướng dẫn tổng quan dự án
```

---

## 🎮 Hướng Dẫn Tương Tác Khi Thuyết Trình
- **Điều hướng nhanh**: Dùng phím `↑` / `↓` hoặc `PageUp` / `PageDown` để cuộn qua các phần.
- **Phần 2 (Chợ truyền thống)**: Bấm chọn các tab *Hồi 1 / Hồi 2 / Hồi 3* để diễn giải sự biến động giá theo cung cầu.
- **Phần 5 (Đồ thị tương tác)**: Kéo điểm giá cân bằng trên biểu đồ để xem trạng thái dư thừa / thiếu hụt khi có giá trần hoặc giá sàn. Bấm *Đưa về mức giá cân bằng* để hoàn tác.
- **Màn hình mở đầu (Hero)**: Di chuyển chuột trên nền để kích hoạt hiệu ứng lực hấp dẫn tương tác giữa các hạt năng lượng và bàn tay điều tiết.
- **In ấn / Xuất báo cáo PDF**: Bấm `Ctrl + P` (hoặc `Cmd + P` trên macOS) để xem bản in dàn trang chuẩn tối ưu.
