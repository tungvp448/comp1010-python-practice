# Ôn tập Python – COMP1010 (web tự luyện)

Website tĩnh để tự luyện câu hỏi lý thuyết môn Introduction to Programming (Python). Không có backend,
không đăng nhập, không gọi API. Mỗi trình duyệt lưu tiến độ riêng trong `localStorage`; nhiều người dùng
chung một đường link không ảnh hưởng tới nhau.

Đây là tài liệu tự luyện, **không phải đề thi chính thức**. Tất cả câu đang ở trạng thái `draft` (chờ
rà soát độc lập); web hiển thị ghi chú “Bộ câu đang được rà soát”.

## Yêu cầu

- Node.js 18 trở lên (đã thử với Node 26.13.0 LTS) và npm.

## Chạy

```bash
npm ci            # cài đúng phiên bản theo package-lock.json
npm run dev       # chạy dev server, mở địa chỉ in ra (thường http://localhost:5173)
npm test          # chạy test (vitest)
npm run build     # validate ngân hàng + TypeScript check + build ra dist/
npm run preview   # xem thử bản build tại http://localhost:4173
```

`npm run build` sẽ **dừng** nếu `data/question_bank.json` không qua validator.

## Cấu trúc

```
data/question_bank.json     ngân hàng câu hỏi (nguồn duy nhất; KHÔNG thêm lecture_XX.json vào đây)
scripts/bank-validator.mjs  kiểm tra schema + merge theo question.id (dùng chung cho CLI, test, web)
scripts/bank-cli.mjs        CLI cho người quản lý: validate / merge
src/lib/sampling.ts         lọc + lấy mẫu (không hoàn lại, cân bằng lecture, ưu tiên family_id khác nhau)
src/lib/attempt.ts          tạo bài, chấm điểm theo option.id, nộp bài idempotent
src/lib/storage.ts          localStorage có version, fallback bộ nhớ, export/import tiến độ
src/components/             giao diện (React)
tests/                      test vitest
```

### Quyết định chính

- Chấm theo `option.id` và `correct_option_ids`, không theo vị trí. Nhãn A/B/C/D gán theo thứ tự hiển thị.
- Thứ tự câu, thứ tự phương án và đáp án đúng được “đóng băng” vào bài làm lúc tạo (random chỉ chạy một
  lần), lưu trong `localStorage` → refresh không đổi đề. Bài đã nộp lưu kết quả đã chấm + hash nội dung câu,
  nên cập nhật ngân hàng sau này không chấm lại lịch sử; khi nội dung câu đã đổi, trang xem lại có ghi chú.
- Bài đang làm (`comp1010.active`) và tiến độ/lịch sử (`comp1010.progress`) ở hai key riêng, mỗi key có
  `version`. JSON hỏng → bỏ qua, giữ bản sao `.corrupt.<time>`, hiện thông báo. Không có storage → chạy trong bộ nhớ.
- Thi thử: deadline tuyệt đối lưu trong bài; đồng hồ tính từ deadline. Hết giờ thì tự nộp đúng một lần, kể cả
  khi tải lại trang hoặc quay lại tab sau deadline. Đáp án chỉ ẩn trên giao diện — dữ liệu tĩnh có chứa đáp án,
  nên trang **không** chống gian lận.
- Nội dung JSON được render bằng React text (không `innerHTML`); code trong câu hỏi chỉ để hiển thị, không bao
  giờ được chạy.
- Không có router: chỉ một trang `index.html`, nên refresh ở bất kỳ màn hình nào cũng không bị 404.

## Thêm Lecture 13–14 / cập nhật câu hỏi (người quản lý)

1. Chuẩn bị file JSON mới theo cùng schema (`{ metadata: { schema_version: "1.0" }, questions: [...] }`
   hoặc chỉ một mảng câu hỏi). Mỗi câu cần ID mới, duy nhất (ví dụ `L13-Q001`).
2. Kiểm tra trước, không ghi file:

   ```bash
   npm run merge -- path/to/lecture_13.json --dry-run
   ```

3. Gộp thật (ghi vào `data/question_bank.json`, cập nhật `question_count`, `excluded_lectures`, `bank_revision`):

   ```bash
   npm run merge -- path/to/lecture_13.json
   ```

   - Mặc định **từ chối** mọi ID đã có trong ngân hàng (tránh nhân đôi câu, ví dụ khi lỡ nhập
     `lecture_02.json` vào ngân hàng đã có Lecture 02).
   - Chỉ khi chủ động sửa chính các câu đó mới dùng `--replace`:

     ```bash
     npm run merge -- path/to/fixes.json --replace
     ```

4. Sửa tay `metadata.scope`/`title` nếu cần, chạy `npm test && npm run build`, commit và deploy lại.

Validator kiểm tra: `schema_version` hỗ trợ, ID duy nhất, đúng 4 options với ID và text duy nhất, đúng 1
đáp án đúng và đáp án đó tồn tại, `lecture` là số nguyên 1–14, `explanation`/`prompt`/`topic`/`family_id`
không rỗng, `status` hợp lệ, `sources` có `file` và `slides` hoặc `pages` là số nguyên dương.
Lecture, loại câu và chủ đề trên web đều suy ra từ dữ liệu, nên Lecture 13–14 tự xuất hiện sau khi merge.

Chỉ file được commit/deploy mới thay đổi ngân hàng chung. Chức năng “Nhập tiến độ” trên web chỉ gộp lịch sử
cá nhân trong trình duyệt đó, không sửa ngân hàng.

## Triển khai (static hosting)

Thư mục `dist/` sau `npm run build` là website hoàn chỉnh; upload lên bất kỳ static host nào.

- **Base path**: build mặc định dùng `base: './'` (đường dẫn tương đối), nên cùng một bản build chạy được ở
  domain gốc lẫn thư mục con như GitHub Pages `https://<user>.github.io/<tên-repo>/` mà không cần sửa gì.
  Nếu muốn đường dẫn tuyệt đối: `VITE_BASE=/<tên-repo>/ npm run build`.
- **Refresh không 404**: app không dùng client-side routing (mọi màn hình nằm trong `index.html`), nên không
  cần cấu hình rewrite/404.html.

### GitHub Pages

1. Tạo repo GitHub, đưa nội dung thư mục này lên làm gốc repo (giữ `package-lock.json` và `.github/`).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Push lên nhánh `main`; workflow `.github/workflows/pages.yml` chạy `npm ci`, test, build và deploy `dist/`.

### Netlify / Vercel / Cloudflare Pages

Build command `npm run build`, output directory `dist`. Không cần biến môi trường.

## Giới hạn đã biết

- Tiến độ không đồng bộ giữa thiết bị; dùng Xuất/Nhập tiến độ (JSON).
- Hai tab cùng trình duyệt dùng chung tiến độ; nên làm một bài ở một tab.
- “Báo câu có vấn đề” chỉ copy nội dung; người học tự gửi cho người quản lý (chưa có nơi nhận tự động).
- File JS khoảng 730 kB (≈100 kB gzip) vì ngân hàng câu hỏi được đóng gói cùng ứng dụng.
