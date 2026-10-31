import type { SubmittedAttempt } from '../types';
import { lectureLabel } from '../lib/bank';
import { formatDuration } from '../lib/attempt';

interface Props {
  history: SubmittedAttempt[];
  onOpen: (id: string) => void;
}

function lectureSummary(lectures: number[]): string {
  if (lectures.length <= 3) return lectures.map(lectureLabel).join(', ');
  return `${lectures.length} lecture (${String(lectures[0]).padStart(2, '0')}–${String(lectures[lectures.length - 1]).padStart(2, '0')})`;
}

export default function HistoryPage({ history, onOpen }: Props) {
  return (
    <div>
      <h2>Lịch sử bài đã nộp</h2>
      <p className="muted small">Lịch sử chỉ lưu trên trình duyệt này (tối đa 100 lượt gần nhất).</p>
      {history.length === 0 && <p>Chưa có bài nào được nộp.</p>}
      <ul className="history">
        {history.map((h) => (
          <li key={h.id} className="card">
            <button className="history-btn" onClick={() => onOpen(h.id)}>
              <span>
                <strong>{h.config.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}</strong> ·{' '}
                {new Date(h.submittedAt).toLocaleString('vi-VN')}
              </span>
              <span>
                {h.score.correct}/{h.score.total} đúng ({Math.round((h.score.correct / Math.max(1, h.score.total)) * 100)}%)
                · {formatDuration(h.submittedAt - h.createdAt)}
              </span>
              <span className="muted small">{lectureSummary(h.config.lectures)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
