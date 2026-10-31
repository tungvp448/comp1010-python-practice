import { useMemo, useState } from 'react';
import type { AttemptConfig, Question, SubmittedAttempt } from '../types';
import { lectureLabel, type LoadedBank } from '../lib/bank';
import { formatDuration } from '../lib/attempt';
import QuestionView from './QuestionView';

interface Props {
  attempt: SubmittedAttempt;
  loaded: LoadedBank;
  bookmarks: string[];
  onToggleBookmark: (id: string) => void;
  onRetry: (config: AttemptConfig, pool: Question[]) => void;
  onBack: () => void;
}

type Filter = 'all' | 'wrong' | 'blank' | 'correct';

export default function ResultPage({ attempt, loaded, bookmarks, onToggleBookmark, onRetry, onBack }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const { score, config } = attempt;
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 1000) / 10 : 0;

  const byLecture = useMemo(() => {
    const m = new Map<number, { correct: number; total: number }>();
    for (const i of attempt.items) {
      const r = m.get(i.lecture) ?? { correct: 0, total: 0 };
      r.total += 1;
      if (i.correct) r.correct += 1;
      m.set(i.lecture, r);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [attempt]);

  const shown = attempt.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      filter === 'all'
        ? true
        : filter === 'correct'
          ? item.correct
          : filter === 'blank'
            ? item.chosen === null
            : !item.correct && item.chosen !== null,
    );

  const retry = (onlyMissed: boolean) => {
    const ids = attempt.items.filter((i) => !onlyMissed || !i.correct).map((i) => i.id);
    const pool = ids.map((id) => loaded.byId.get(id)).filter((q): q is Question => q !== undefined);
    if (pool.length === 0) return;
    onRetry({ ...config, source: 'all', topic: null, count: pool.length }, pool);
  };

  return (
    <div className="result">
      <section className="card">
        <h2>
          Kết quả {config.mode === 'exam' ? 'thi thử trắc nghiệm' : 'luyện tập'}
          {attempt.autoSubmitted && <span className="tag">tự nộp khi hết giờ</span>}
        </h2>
        <p className="score">
          {score.correct}/{score.total} câu đúng · {pct}%
        </p>
        <ul className="stats">
          <li>Đúng: {score.correct}</li>
          <li>Sai: {score.wrong}</li>
          <li>Bỏ trống{config.mode === 'practice' ? ' / chưa kiểm tra' : ''}: {score.blank}</li>
          <li>Thời gian làm: {formatDuration(attempt.submittedAt - attempt.createdAt)}</li>
          <li>Nộp lúc: {new Date(attempt.submittedAt).toLocaleString('vi-VN')}</li>
        </ul>
        <p className="muted small">Mỗi câu đúng 1 điểm; sai hoặc bỏ trống 0 điểm; tính trên tất cả câu trong bài.</p>
        {attempt.bankHash !== loaded.bankHash && (
          <p className="muted small">
            Ngân hàng câu hỏi đã được cập nhật sau lượt này. Điểm được giữ theo đáp án tại thời điểm làm bài.
          </p>
        )}

        <h3>Theo lecture</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Lecture</th>
              <th>Đúng</th>
              <th>Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {byLecture.map(([l, r]) => (
              <tr key={l}>
                <td>{lectureLabel(l)}</td>
                <td>
                  {r.correct}/{r.total}
                </td>
                <td>{Math.round((r.correct / r.total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row wrap">
          <button className="primary" onClick={() => retry(false)}>
            Làm lại đề này
          </button>
          <button disabled={score.correct === score.total} onClick={() => retry(true)}>
            Làm lại các câu sai/bỏ trống
          </button>
          <button className="link" onClick={onBack}>
            Về lịch sử
          </button>
        </div>
      </section>

      <section>
        <h3>Xem lại từng câu</h3>
        <div className="row wrap">
          {(
            [
              ['all', `Tất cả (${score.total})`],
              ['wrong', `Sai (${score.wrong})`],
              ['blank', `Bỏ trống (${score.blank})`],
              ['correct', `Đúng (${score.correct})`],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button key={f} className={filter === f ? 'chip on' : 'chip'} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        {shown.length === 0 && <p className="muted">Không có câu nào trong mục này.</p>}
        {shown.map(({ item, index }) => {
          const q = loaded.byId.get(item.id);
          return (
            <div key={item.id} className="card review-item">
              {!q ? (
                <p>
                  Câu {index + 1} ({item.id}) không còn trong ngân hàng hiện tại. Kết quả đã chấm:{' '}
                  {item.correct ? 'đúng' : item.chosen === null ? 'bỏ trống' : 'sai'}.
                </p>
              ) : (
                <>
                  {loaded.qHash.get(item.id) !== item.qHash && (
                    <div className="notice warn small">
                      Nội dung câu đã thay đổi sau lượt làm này; phần hiển thị là bản hiện tại, điểm giữ theo bản cũ.
                    </div>
                  )}
                  <QuestionView
                    question={q}
                    item={item}
                    index={index}
                    total={attempt.items.length}
                    chosen={item.chosen}
                    locked
                    reveal
                    gradedCorrectIds={item.correctOptionIds}
                  />
                  <button className="link small" onClick={() => onToggleBookmark(item.id)}>
                    {bookmarks.includes(item.id) ? '★ Bỏ lưu câu' : '☆ Lưu câu để ôn'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
