import { useRef, useState } from 'react';
import type { Progress } from '../types';
import { lectureLabel, type LoadedBank } from '../lib/bank';
import { wrongIds } from '../lib/sampling';
import { emptyProgress, exportProgress, mergeProgress, parseImport } from '../lib/storage';

interface Props {
  loaded: LoadedBank;
  progress: Progress;
  onChange: (p: Progress) => void;
}

export default function ProgressPage({ loaded, progress, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);

  const wrong = [...wrongIds(progress)];
  const answered = Object.keys(progress.stats).length;
  const listIds = (ids: string[]) =>
    ids
      .slice()
      .sort()
      .map((id) => {
        const q = loaded.byId.get(id);
        return { id, label: q ? `${lectureLabel(q.lecture)} · ${q.topic}` : '(không còn trong ngân hàng)' };
      });

  const doExport = () => {
    const blob = new Blob([exportProgress(progress, Date.now())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comp1010-tien-do-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: 'ok', text: 'Đã tạo file export. Mở trang này trên thiết bị khác và chọn “Nhập tiến độ”.' });
  };

  const doImport = async (file: File) => {
    const result = parseImport(await file.text());
    if (!result.ok) {
      setMessage({ kind: 'warn', text: `Không nhập được: ${result.error}` });
      return;
    }
    const merged = mergeProgress(progress, result.progress);
    const added = merged.history.length - progress.history.length;
    if (
      !window.confirm(
        `Gộp tiến độ từ file? Lịch sử hiện có được giữ nguyên; sẽ thêm ${Math.max(0, added)} lượt làm mới và hợp nhất câu đã lưu/câu sai.`,
      )
    )
      return;
    onChange(merged);
    setMessage({ kind: 'ok', text: `Đã gộp tiến độ. Thêm ${Math.max(0, added)} lượt làm vào lịch sử.` });
  };

  const clearHistory = () => {
    if (!window.confirm('Xóa toàn bộ lịch sử bài đã nộp? Câu đã lưu và thống kê câu sai được giữ lại.')) return;
    onChange({ ...progress, history: [] });
    setMessage({ kind: 'ok', text: 'Đã xóa lịch sử bài đã nộp.' });
  };
  const clearAll = () => {
    if (!window.confirm('Xóa TOÀN BỘ tiến độ trên trình duyệt này (lịch sử, câu sai, câu đã lưu)? Không thể hoàn tác.'))
      return;
    onChange(emptyProgress());
    setMessage({ kind: 'ok', text: 'Đã xóa toàn bộ tiến độ.' });
  };

  return (
    <div>
      <h2>Tiến độ trên trình duyệt này</h2>
      {message && <div className={`notice ${message.kind === 'ok' ? 'info' : 'warn'}`}>{message.text}</div>}
      <section className="card">
        <ul className="stats">
          <li>Số câu đã từng trả lời: {answered}</li>
          <li>Câu làm sai (lần gần nhất): {wrong.length}</li>
          <li>Câu đã lưu để ôn: {progress.bookmarks.length}</li>
          <li>Lượt đã nộp: {progress.history.length}</li>
        </ul>
        <p className="muted small">
          Muốn ôn câu sai hoặc câu đã lưu: vào “Tạo bài” và chọn nguồn câu tương ứng. Một câu rời khỏi danh sách câu sai khi
          bạn làm đúng nó ở lần sau.
        </p>
      </section>

      <section className="card">
        <h3>Chuyển tiến độ sang thiết bị khác</h3>
        <p className="small">
          Tiến độ không tự đồng bộ giữa các thiết bị hay trình duyệt. Xuất file JSON rồi nhập trên thiết bị kia. Nhập là gộp
          thêm, không xóa lịch sử đang có. Nhập tiến độ chỉ ảnh hưởng trình duyệt của bạn, không thay đổi ngân hàng câu hỏi.
        </p>
        <div className="row wrap">
          <button onClick={doExport}>Xuất tiến độ (JSON)</button>
          <button onClick={() => fileRef.current?.click()}>Nhập tiến độ…</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void doImport(f);
            }}
          />
        </div>
      </section>

      <section className="card">
        <h3>Xóa dữ liệu</h3>
        <div className="row wrap">
          <button className="danger" onClick={clearHistory} disabled={progress.history.length === 0}>
            Xóa lịch sử bài đã nộp
          </button>
          <button className="danger" onClick={clearAll}>
            Xóa toàn bộ tiến độ
          </button>
        </div>
      </section>

      <details className="card">
        <summary>Danh sách câu sai ({wrong.length})</summary>
        <ul className="small idlist">
          {listIds(wrong).map((x) => (
            <li key={x.id}>
              <code>{x.id}</code> {x.label}
            </li>
          ))}
        </ul>
      </details>
      <details className="card">
        <summary>Danh sách câu đã lưu ({progress.bookmarks.length})</summary>
        <ul className="small idlist">
          {listIds(progress.bookmarks).map((x) => (
            <li key={x.id}>
              <code>{x.id}</code> {x.label}{' '}
              <button
                className="link small"
                onClick={() => onChange({ ...progress, bookmarks: progress.bookmarks.filter((b) => b !== x.id) })}
              >
                bỏ lưu
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
