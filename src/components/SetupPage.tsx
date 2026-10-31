import { useMemo, useState } from 'react';
import type { AttemptConfig, Mode, PoolSource, Progress, Question } from '../types';
import { kindLabel, lectureLabel, type LoadedBank } from '../lib/bank';
import { filterPool, wrongIds } from '../lib/sampling';

interface Props {
  loaded: LoadedBank;
  progress: Progress;
  hasActive: boolean;
  onResume: () => void;
  onStart: (config: AttemptConfig, pool: Question[]) => void;
}

const PRESETS = [20, 40, 60, 100];

export default function SetupPage({ loaded, progress, hasActive, onResume, onStart }: Props) {
  const { bank, lectures, kinds } = loaded;
  const [selLectures, setSelLectures] = useState<number[]>(lectures);
  const [selKinds, setSelKinds] = useState<string[]>(kinds);
  const [topic, setTopic] = useState<string | null>(null);
  const [source, setSource] = useState<PoolSource>('all');
  const [mode, setMode] = useState<Mode>('practice');
  const [count, setCount] = useState(20);
  const [custom, setCustom] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [timed, setTimed] = useState(true);
  const [minutes, setMinutes] = useState<number | null>(null);

  const topics = useMemo(() => {
    const set = new Set(selLectures);
    return [...new Set(bank.questions.filter((q) => set.has(q.lecture)).map((q) => q.topic))].sort();
  }, [bank, selLectures]);
  const activeTopic = topic !== null && topics.includes(topic) ? topic : null;

  const pool = useMemo(
    () => filterPool(bank.questions, { lectures: selLectures, kinds: selKinds, topic: activeTopic, source }, progress),
    [bank, selLectures, selKinds, activeTopic, source, progress],
  );
  const families = useMemo(() => new Set(pool.map((q) => q.family_id)).size, [pool]);
  const available = pool.length;
  const tooMany = count > available;
  const validCount = Number.isInteger(count) && count >= 1 && !tooMany;
  const timeLimit = minutes ?? Math.max(5, Math.round(Math.min(count, available) * 1));

  const presetLectures = (from: number, to: number) => lectures.filter((l) => l >= from && l <= to);
  const quick: { label: string; value: number[] }[] = [
    { label: 'Tất cả', value: lectures },
    { label: 'Lecture 02–12', value: presetLectures(2, 12) },
    { label: 'Chỉ 11–12', value: presetLectures(11, 12) },
  ].filter((p) => p.value.length > 0);
  const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const q of bank.questions) m.set(q.lecture, (m.get(q.lecture) ?? 0) + 1);
    return m;
  }, [bank]);
  const wrongCount = useMemo(() => wrongIds(progress).size, [progress]);
  const excluded = (bank.metadata.excluded_lectures ?? []).filter((l) => !lectures.includes(l));

  const emptyReason = (): string => {
    if (selLectures.length === 0) return 'Chưa chọn lecture nào.';
    if (selKinds.length === 0) return 'Chưa chọn loại câu nào.';
    if (source === 'wrong') return 'Không có câu nào bạn làm sai (lần gần nhất) trong các lecture/loại câu đã chọn.';
    if (source === 'bookmarked') return 'Không có câu đã đánh dấu trong các lecture/loại câu đã chọn.';
    return 'Không có câu nào khớp bộ lọc.';
  };

  const startNow = () => {
    if (!validCount) return;
    onStart(
      {
        mode,
        lectures: selLectures.slice().sort((a, b) => a - b),
        kinds: selKinds,
        topic: activeTopic,
        source,
        count,
        shuffleOptions,
        timeLimitMin: mode === 'exam' && timed ? timeLimit : null,
      },
      pool,
    );
  };

  return (
    <div className="setup">
      <div className="notice info">
        <strong>Bộ câu đang được rà soát.</strong> Tất cả câu hiện ở trạng thái nháp, chưa qua kiểm duyệt độc lập. Đây là
        tài liệu tự luyện, không phải đề thi chính thức. Tiến độ chỉ lưu trên trình duyệt này.
      </div>

      {hasActive && (
        <div className="card resume">
          <span>Bạn đang có một bài làm dở.</span>
          <button className="primary" onClick={onResume}>
            Tiếp tục bài đang làm
          </button>
        </div>
      )}

      <section className="card">
        <h2>1. Chọn lecture</h2>
        <div className="row wrap">
          {quick.map((p) => (
            <button
              key={p.label}
              className={sameSet(selLectures, p.value) ? 'chip on' : 'chip'}
              onClick={() => setSelLectures(p.value)}
            >
              {p.label}
            </button>
          ))}
          <button className="chip" onClick={() => setSelLectures([])}>
            Bỏ chọn
          </button>
        </div>
        <div className="grid-checks">
          {lectures.map((l) => (
            <label key={l} className="check">
              <input
                type="checkbox"
                checked={selLectures.includes(l)}
                onChange={() => setSelLectures(toggle(selLectures, l))}
              />
              {lectureLabel(l)} <span className="muted">({counts.get(l)})</span>
            </label>
          ))}
        </div>
        {excluded.length > 0 && (
          <p className="muted small">Chưa có trong ngân hàng: {excluded.map(lectureLabel).join(', ')}.</p>
        )}
      </section>

      <section className="card">
        <h2>2. Loại câu và nguồn câu</h2>
        <div className="row wrap">
          {kinds.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={selKinds.includes(k)} onChange={() => setSelKinds(toggle(selKinds, k))} />
              {kindLabel(k)}
            </label>
          ))}
        </div>
        <div className="field">
          <label htmlFor="topic">Chủ đề</label>
          <select id="topic" value={activeTopic ?? ''} onChange={(e) => setTopic(e.target.value || null)}>
            <option value="">Tất cả chủ đề ({topics.length})</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="row wrap">
          <label className="check">
            <input type="radio" name="source" checked={source === 'all'} onChange={() => setSource('all')} />
            Toàn bộ ngân hàng
          </label>
          <label className="check">
            <input type="radio" name="source" checked={source === 'wrong'} onChange={() => setSource('wrong')} />
            Ôn câu làm sai ({wrongCount})
          </label>
          <label className="check">
            <input
              type="radio"
              name="source"
              checked={source === 'bookmarked'}
              onChange={() => setSource('bookmarked')}
            />
            Câu đã đánh dấu ({progress.bookmarks.length})
          </label>
        </div>
      </section>

      <section className="card">
        <h2>3. Số câu</h2>
        <p className="avail">
          Số câu phù hợp: <strong>{available}</strong>
          {available > 0 && <span className="muted"> · {families} dạng câu khác nhau</span>}
        </p>
        {available === 0 ? (
          <div className="notice warn">{emptyReason()} Hãy đổi bộ lọc ở trên.</div>
        ) : (
          <>
            <div className="row wrap">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  className={!custom && count === n ? 'chip on' : 'chip'}
                  disabled={n > available}
                  onClick={() => {
                    setCustom(false);
                    setCount(n);
                  }}
                >
                  {n}
                </button>
              ))}
              <button
                className={!custom && count === available ? 'chip on' : 'chip'}
                onClick={() => {
                  setCustom(false);
                  setCount(available);
                }}
              >
                Tất cả ({available})
              </button>
              <button className={custom ? 'chip on' : 'chip'} onClick={() => setCustom(true)}>
                Tùy chọn
              </button>
              {custom && (
                <input
                  type="number"
                  className="num"
                  min={1}
                  max={available}
                  value={Number.isFinite(count) ? count : ''}
                  onChange={(e) => setCount(Math.floor(Number(e.target.value)))}
                  aria-label="Số câu tùy chọn"
                />
              )}
            </div>
            {tooMany && (
              <div className="notice warn">
                Chỉ có {available} câu phù hợp, ít hơn {count} câu bạn yêu cầu.{' '}
                <button className="link" onClick={() => setCount(available)}>
                  Dùng {available} câu
                </button>
              </div>
            )}
            {!tooMany && count < 1 && <div className="notice warn">Số câu phải từ 1 trở lên.</div>}
            {validCount && count > families && (
              <p className="muted small">
                Số câu yêu cầu nhiều hơn số dạng câu khác nhau ({families}), nên đề sẽ có một số câu biến thể cùng dạng.
              </p>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2>4. Chế độ</h2>
        <div className="row wrap">
          <label className="check">
            <input type="radio" name="mode" checked={mode === 'practice'} onChange={() => setMode('practice')} />
            Luyện tập (xem đáp án sau từng câu)
          </label>
          <label className="check">
            <input type="radio" name="mode" checked={mode === 'exam'} onChange={() => setMode('exam')} />
            Thi thử trắc nghiệm (xem đáp án sau khi nộp)
          </label>
        </div>
        {mode === 'exam' && (
          <div className="row wrap">
            <label className="check">
              <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
              Giới hạn thời gian
            </label>
            {timed && (
              <label className="check">
                <input
                  type="number"
                  className="num"
                  min={1}
                  max={600}
                  value={timeLimit}
                  onChange={(e) => setMinutes(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                />
                phút
              </label>
            )}
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
          Đảo thứ tự phương án
        </label>
      </section>

      <div className="actions">
        <button className="primary big" disabled={!validCount || available === 0} onClick={startNow}>
          Bắt đầu {mode === 'exam' ? 'thi thử' : 'luyện tập'}
          {validCount ? ` (${count} câu)` : ''}
        </button>
      </div>
    </div>
  );
}
