import { useEffect, useState } from 'react';
import type { ActiveAttempt } from '../types';
import type { LoadedBank } from '../lib/bank';
import { formatDuration, isExpired } from '../lib/attempt';
import QuestionView from './QuestionView';

interface Props {
  attempt: ActiveAttempt;
  loaded: LoadedBank;
  bookmarks: string[];
  onUpdate: (fn: (a: ActiveAttempt) => ActiveAttempt) => void;
  onCheck: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onSubmit: (attemptId: string, auto: boolean) => void;
  onAbandon: () => void;
}

export default function AttemptPage({
  attempt,
  loaded,
  bookmarks,
  onUpdate,
  onCheck,
  onToggleBookmark,
  onSubmit,
  onAbandon,
}: Props) {
  const isExam = attempt.config.mode === 'exam';
  const [now, setNow] = useState(() => Date.now());

  // The countdown is derived from the stored absolute deadline, so throttled background tabs,
  // sleep, or reloads cannot make it drift. Expiry is checked on every tick and whenever the
  // tab becomes visible again.
  useEffect(() => {
    if (attempt.deadline === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (isExpired(attempt, t)) onSubmit(attempt.id, true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [attempt, onSubmit]);

  const total = attempt.items.length;
  const index = Math.min(attempt.current, total - 1);
  const item = attempt.items[index];
  const question = loaded.byId.get(item.id);
  const response = attempt.responses[item.id] ?? { chosen: null };
  const changed = question && loaded.qHash.get(item.id) !== item.qHash;
  const answered = attempt.items.filter((i) => attempt.responses[i.id]?.chosen != null).length;
  const checked = attempt.items.filter((i) => attempt.responses[i.id]?.checked).length;
  const flagged = attempt.flagged.includes(item.id);
  const bookmarked = bookmarks.includes(item.id);

  const goTo = (i: number) => {
    onUpdate((a) => ({ ...a, current: Math.max(0, Math.min(total - 1, i)) }));
    window.scrollTo(0, 0);
  };
  const choose = (optionId: string) => {
    if (!isExam && response.checked) return;
    onUpdate((a) => ({ ...a, responses: { ...a.responses, [item.id]: { ...a.responses[item.id], chosen: optionId } } }));
  };
  const clearChoice = () =>
    onUpdate((a) => ({ ...a, responses: { ...a.responses, [item.id]: { chosen: null } } }));
  const toggleFlag = () =>
    onUpdate((a) => ({
      ...a,
      flagged: a.flagged.includes(item.id) ? a.flagged.filter((f) => f !== item.id) : [...a.flagged, item.id],
    }));

  const submitEarly = () => {
    const blank = total - answered;
    const msg = isExam
      ? blank > 0
        ? `Còn ${blank} câu chưa trả lời. Câu bỏ trống tính 0 điểm. Vẫn nộp bài?`
        : 'Nộp bài? Sau khi nộp không thể đổi đáp án.'
      : `Kết thúc lượt luyện tập? ${total - checked} câu chưa kiểm tra sẽ tính là bỏ trống.`;
    if (window.confirm(msg)) onSubmit(attempt.id, false);
  };

  const remaining = attempt.deadline !== null ? attempt.deadline - now : null;

  return (
    <div className="attempt">
      <div className="attempt-head card">
        <div>
          <strong>{isExam ? 'Thi thử trắc nghiệm' : 'Luyện tập'}</strong>
          <span className="muted">
            {' '}
            · {isExam ? `Đã trả lời ${answered}/${total}` : `Đã kiểm tra ${checked}/${total}`}
          </span>
        </div>
        {remaining !== null && (
          <div className={remaining < 60_000 ? 'timer low' : 'timer'} role="timer" aria-live="off">
            Còn lại {formatDuration(remaining)}
          </div>
        )}
      </div>
      {attempt.familyRepeats > 0 && index === 0 && (
        <p className="muted small">Đề này có {attempt.familyRepeats} câu là biến thể cùng dạng với câu khác.</p>
      )}

      <nav className="palette" aria-label="Danh sách câu">
        {attempt.items.map((it, i) => {
          const r = attempt.responses[it.id];
          let cls = 'pal';
          if (r?.chosen != null) cls += ' answered';
          if (!isExam && r?.checked) cls += ' checked';
          if (attempt.flagged.includes(it.id)) cls += ' flagged';
          if (i === index) cls += ' current';
          return (
            <button key={it.id} className={cls} onClick={() => goTo(i)} aria-label={`Câu ${i + 1}`}>
              {i + 1}
            </button>
          );
        })}
      </nav>
      <p className="legend small muted">
        <span className="pal-demo answered" /> đã trả lời <span className="pal-demo" /> chưa trả lời{' '}
        <span className="pal-demo flagged" /> đánh dấu xem lại
      </p>

      {question ? (
        <>
          {changed && (
            <div className="notice warn small">
              Câu này đã được cập nhật trong ngân hàng sau khi tạo bài. Bài vẫn được chấm theo đáp án lúc tạo bài.
            </div>
          )}
          <QuestionView
            question={question}
            item={item}
            index={index}
            total={total}
            chosen={response.chosen}
            locked={!isExam && !!response.checked}
            reveal={!isExam && !!response.checked}
            onChoose={choose}
          />
        </>
      ) : (
        <div className="card">Câu {item.id} không còn trong ngân hàng hiện tại. Bạn có thể bỏ qua câu này.</div>
      )}

      <div className="qactions">
        {!isExam && (
          <button className="primary" disabled={response.chosen === null || !!response.checked} onClick={() => onCheck(item.id)}>
            Kiểm tra
          </button>
        )}
        {isExam && response.chosen !== null && <button onClick={clearChoice}>Bỏ chọn</button>}
        <button onClick={toggleFlag} aria-pressed={flagged}>
          {flagged ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu xem lại'}
        </button>
        <button onClick={() => onToggleBookmark(item.id)} aria-pressed={bookmarked}>
          {bookmarked ? '★ Đã lưu câu' : '☆ Lưu câu để ôn'}
        </button>
      </div>
      <div className="nav-buttons">
        <button disabled={index === 0} onClick={() => goTo(index - 1)}>
          ← Câu trước
        </button>
        <button disabled={index === total - 1} onClick={() => goTo(index + 1)}>
          Câu sau →
        </button>
      </div>

      <div className="attempt-foot">
        <button className="primary" onClick={submitEarly}>
          {isExam ? 'Nộp bài' : 'Kết thúc và xem tổng kết'}
        </button>
        <button className="link danger" onClick={onAbandon}>
          Hủy bài
        </button>
      </div>
    </div>
  );
}
