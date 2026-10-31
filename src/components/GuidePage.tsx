import { lectureLabel, type LoadedBank } from '../lib/bank';

export default function GuidePage({ loaded }: { loaded: LoadedBank }) {
  const { bank, lectures } = loaded;
  const total = bank.questions.length;
  const withCode = bank.questions.filter((q) => q.code !== null).length;
  const drafts = bank.questions.filter((q) => q.status === 'draft').length;
  const runtime = typeof bank.metadata.python_validation_runtime === 'string' ? bank.metadata.python_validation_runtime : null;
  const missing = (bank.metadata.excluded_lectures ?? []).filter((l) => !lectures.includes(l));

  return (
    <div className="guide">
      <h2>Hướng dẫn ngắn</h2>
      <section className="card">
        <h3>Cách dùng</h3>
        <ul>
          <li>
            <strong>Luyện tập:</strong> chọn đáp án rồi bấm “Kiểm tra” để xem đáp án và giải thích. Chọn đáp án không tự
            chuyển câu.
          </li>
          <li>
            <strong>Thi thử trắc nghiệm:</strong> đáp án và giải thích chỉ hiện sau khi nộp. Có thể quay lại đổi đáp án
            trước khi nộp. Hết giờ bài sẽ tự nộp, kể cả khi bạn tải lại trang hoặc quay lại tab sau đó. Đây là bài trắc
            nghiệm tự luyện, không mô phỏng đầy đủ các phần của đề thi môn học.
          </li>
          <li>
            Mỗi câu đúng 1 điểm, sai hoặc bỏ trống 0 điểm. Câu hỏi, phương án và giải thích giữ nguyên tiếng Anh như
            ngôn ngữ môn học.
          </li>
          <li>
            Với câu hỏi output, phương án hiển thị đúng từng dấu nháy, khoảng trắng và xuống dòng. “(no output)” là một
            phương án hợp lệ.
          </li>
        </ul>
      </section>
      <section className="card">
        <h3>Lưu tiến độ</h3>
        <ul>
          <li>
            Tiến độ, lịch sử, câu sai và câu đã lưu chỉ nằm trong <strong>trình duyệt này</strong>. Không đồng bộ giữa
            thiết bị hay trình duyệt; xóa dữ liệu trình duyệt hoặc dùng chế độ ẩn danh sẽ mất tiến độ.
          </li>
          <li>Dùng mục “Tiến độ” để xuất/nhập file JSON khi đổi thiết bị.</li>
          <li>Không cần đăng nhập. Bài làm của bạn không ảnh hưởng tới người khác dùng cùng đường link.</li>
          <li>
            Việc ẩn đáp án khi thi thử chỉ là ẩn trên giao diện. Dữ liệu của trang là tĩnh và có chứa đáp án, nên trang
            không có tính năng chống gian lận hay bảo mật đề.
          </li>
        </ul>
      </section>
      <section className="card">
        <h3>Về ngân hàng câu hỏi</h3>
        <ul>
          <li>
            Hiện có {total} câu thuộc {lectures.map(lectureLabel).join(', ')}, gồm câu nền tảng và các biến thể luyện tập
            cùng dạng. Số câu không phải tỷ lệ bao phủ nội dung môn học.
          </li>
          {missing.length > 0 && <li>Chưa có: {missing.map(lectureLabel).join(', ')} (sẽ bổ sung sau nếu có).</li>}
          <li>
            {withCode} câu có code đã được chạy thử{runtime ? ` trên CPython ${runtime}` : ''} để đối chiếu đáp án. Đây
            chưa phải kiểm duyệt độc lập toàn bộ nội dung: {drafts} câu đang ở trạng thái nháp, chờ rà soát.
          </li>
          <li>Độ khó chỉ là ước lượng sơ bộ. Nguồn slide là trang tham chiếu chủ đề, không phải trích dẫn đầy đủ.</li>
          <li>Thấy câu có vấn đề? Mở “Chi tiết câu hỏi” → “Báo câu có vấn đề”, copy nội dung và gửi cho người quản lý.</li>
        </ul>
      </section>
    </div>
  );
}
