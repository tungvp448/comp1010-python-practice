import { useState } from 'react';
import type { AttemptItem, Question } from '../types';
import { labelFor } from '../lib/attempt';
import { lectureLabel } from '../lib/bank';

interface Props {
  question: Question;
  item: AttemptItem;
  chosen: string | null;
}

/**
 * There is no backend to receive reports. This only builds a text the learner copies and
 * sends to the bank maintainer themselves; it never claims the report was sent.
 */
export default function ReportButton({ question, item, chosen }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const text = [
    `Báo câu có vấn đề – ${question.id} (${lectureLabel(question.lecture)}, ${question.topic})`,
    `Thứ tự phương án đang hiển thị: ${item.optionOrder.map((id) => `${labelFor(item.optionOrder, id)}=${id}`).join(' ')}`,
    `Lựa chọn của tôi: ${chosen ? `${labelFor(item.optionOrder, chosen)} (${chosen})` : 'chưa chọn'}`,
    `Nội dung phản hồi: ${note.trim() || '(chưa nhập)'}`,
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  if (!open) {
    return (
      <button className="link small" onClick={() => setOpen(true)}>
        Báo câu có vấn đề
      </button>
    );
  }
  return (
    <div className="report">
      <label htmlFor={`report-${question.id}`} className="small">
        Mô tả vấn đề (đáp án sai, đề khó hiểu, lỗi hiển thị…)
      </label>
      <textarea
        id={`report-${question.id}`}
        rows={3}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setCopyState('idle');
        }}
      />
      <div className="row wrap">
        <button onClick={copy}>Copy nội dung báo lỗi</button>
        <button className="link" onClick={() => setOpen(false)}>
          Đóng
        </button>
      </div>
      {copyState === 'copied' && (
        <p className="small ok-text">Đã copy vào clipboard. Trang chưa có nơi nhận tự động — hãy dán và gửi nội dung này cho người quản lý ngân hàng câu hỏi.</p>
      )}
      {copyState === 'failed' && (
        <>
          <p className="small">Không copy tự động được. Hãy chọn và copy đoạn dưới đây rồi gửi cho người quản lý:</p>
          <textarea readOnly rows={5} value={text} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
      {copyState === 'idle' && (
        <p className="small muted">Trang chưa có nơi nhận báo lỗi tự động. Sau khi copy, bạn cần tự gửi nội dung cho người quản lý.</p>
      )}
    </div>
  );
}
