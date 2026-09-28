# CQ2 — Bàn tay vô hình / Bàn tay hữu hình (SS008 — Nhóm 2)

Trang thuyết trình tương tác 3D cho câu hỏi CQ2: *Nền kinh tế thị trường hoàn hảo nên được vận hành bởi "bàn tay vô hình" hay "bàn tay hữu hình"?* Hai bàn tay 3D có xương diễn theo từng mục khi cuộn: bàn tay vô hình là ánh sáng và hạt, bàn tay hữu hình là da thật; nền trang đổi theo bàn tay đang được nói tới.

## Chạy trang

Nháy đúp `chay-web.cmd` (cần Python 3 hoặc Node.js). Trình duyệt tự mở `http://127.0.0.1:8080/index.html`. Không cần Internet: thư viện và phông chữ đã nằm sẵn trong `ban-tay-web/vendor` và `ban-tay-web/fonts`.

Không nháy đúp trực tiếp `index.html`, vì trình duyệt chặn ES module khi mở bằng `file://`.

## Cấu trúc

```text
ktct-main/
├── ban-tay-web/
│   ├── index.html          Nội dung báo cáo
│   ├── css/                style.css (hệ màu theo chương) + fonts.css
│   ├── js/                 main.js, scene3d.js, poses.js, quiz.js
│   ├── models/             hand-visible.glb, hand-invisible.glb
│   ├── vendor/             three.js, GSAP, Lenis (cục bộ)
│   ├── fonts/              Be Vietnam Pro, Newsreader (cục bộ)
│   └── README.txt          Hướng dẫn kỹ thuật và cách tinh chỉnh bàn tay
├── chay-web.cmd            Khởi động máy chủ cục bộ
├── NOI_DUNG_THUYET_TRINH.txt
└── README.md
```

## Khi thuyết trình

Dùng phím `↑` / `↓` để chuyển mục. Ở mục 2, bấm ba hồi của câu chuyện để bàn tay phản ứng. Ở mục 5, kéo chấm trên đồ thị để thấy bàn tay hữu hình nắm chặt khi giá bị ấn định. Ở mục 7.2, cuộn chậm để thấy lớp da tan dần, lộ bàn tay vô hình bên trong.

## Ghi công

Mô hình bàn tay: *3D Rigged Hand Model* © 2026 Emma L. D. Lieker, giấy phép CC BY-NC 4.0, dùng cho mục đích học tập, đã chỉnh vật liệu và tư thế.
