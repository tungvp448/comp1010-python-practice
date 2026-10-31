import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rawBank from '../data/question_bank.json';
import type { ActiveAttempt, AttemptConfig, Progress, Question } from './types';
import { loadBank } from './lib/bank';
import { applySubmission, createAttempt, gradeAttempt, isExpired, recordResult } from './lib/attempt';
import { ACTIVE_KEY, PROGRESS_KEY, createStore, detectStorage } from './lib/storage';
import { applyTheme, loadTheme, type Theme } from './lib/theme';
import SetupPage from './components/SetupPage';
import AttemptPage from './components/AttemptPage';
import ResultPage from './components/ResultPage';
import HistoryPage from './components/HistoryPage';
import ProgressPage from './components/ProgressPage';
import GuidePage from './components/GuidePage';

type View =
  | { name: 'setup' }
  | { name: 'attempt' }
  | { name: 'result'; attemptId: string }
  | { name: 'history' }
  | { name: 'progress' }
  | { name: 'guide' };

const loaded = loadBank(rawBank);

export default function App() {
  const store = useMemo(() => createStore(detectStorage()), []);
  const [progress, setProgress] = useState<Progress>(() => store.loadProgress());
  const [active, setActive] = useState<ActiveAttempt | null>(() => store.loadActive());
  const [view, setView] = useState<View>(() => (active ? { name: 'attempt' } : { name: 'setup' }));
  const [notices, setNotices] = useState<string[]>(() => store.notices.slice());
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const changeTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  // Refs mirror state so submit can be made idempotent even if called twice in one tick
  // (timer + visibilitychange, double click, StrictMode).
  const activeRef = useRef(active);
  const progressRef = useRef(progress);
  const submittedIds = useRef(new Set<string>());

  const commitProgress = useCallback(
    (p: Progress) => {
      progressRef.current = p;
      setProgress(p);
      store.saveProgress(p);
      setNotices(store.notices.slice());
    },
    [store],
  );
  const commitActive = useCallback(
    (a: ActiveAttempt | null) => {
      activeRef.current = a;
      setActive(a);
      store.saveActive(a);
      setNotices(store.notices.slice());
    },
    [store],
  );

  const submit = useCallback(
    (attemptId: string, auto: boolean) => {
      const a = activeRef.current;
      if (!a || a.id !== attemptId || submittedIds.current.has(attemptId)) return;
      submittedIds.current.add(attemptId);
      const now = Date.now();
      // Practice: only checked answers count. Auto-submit uses the deadline as the finish time.
      const forGrading: ActiveAttempt =
        a.config.mode === 'practice'
          ? {
              ...a,
              responses: Object.fromEntries(
                Object.entries(a.responses).map(([id, r]) => [id, { chosen: r.checked ? r.chosen : null }]),
              ),
            }
          : a;
      const finishedAt = auto && a.deadline !== null ? Math.min(now, a.deadline) : now;
      const graded = gradeAttempt(forGrading, finishedAt, auto);
      commitProgress(applySubmission(progressRef.current, graded));
      commitActive(null);
      setView({ name: 'result', attemptId });
    },
    [commitActive, commitProgress],
  );

  // An exam whose deadline passed while the page was closed is submitted on load.
  useEffect(() => {
    const a = activeRef.current;
    if (a && isExpired(a, Date.now())) submit(a.id, true);
  }, [submit]);

  // Keep several tabs of the same browser consistent.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROGRESS_KEY) {
        const p = store.loadProgress();
        progressRef.current = p;
        setProgress(p);
      } else if (e.key === ACTIVE_KEY) {
        const a = store.loadActive();
        activeRef.current = a;
        setActive(a);
        if (!a) setView((v) => (v.name === 'attempt' ? { name: 'setup' } : v));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [store]);

  const start = (config: AttemptConfig, pool: Question[]) => {
    if (activeRef.current && !window.confirm('Bạn đang có một bài làm dở. Bỏ bài đó và tạo bài mới?')) return;
    commitActive(createAttempt(config, pool, loaded.bankHash, Date.now()));
    setView({ name: 'attempt' });
    window.scrollTo(0, 0);
  };

  const updateActive = (fn: (a: ActiveAttempt) => ActiveAttempt) => {
    const a = activeRef.current;
    if (a) commitActive(fn(a));
  };

  const checkPracticeAnswer = (id: string) => {
    const a = activeRef.current;
    const item = a?.items.find((i) => i.id === id);
    const r = a?.responses[id];
    if (!a || !item || !r || r.chosen === null || r.checked) return;
    commitActive({ ...a, responses: { ...a.responses, [id]: { ...r, checked: true } } });
    commitProgress(recordResult(progressRef.current, id, item.correctOptionIds[0] === r.chosen, Date.now()));
  };

  const toggleBookmark = (id: string) => {
    const p = progressRef.current;
    const bookmarks = p.bookmarks.includes(id) ? p.bookmarks.filter((b) => b !== id) : [...p.bookmarks, id];
    commitProgress({ ...p, bookmarks });
  };

  const abandon = () => {
    if (!window.confirm('Hủy bài đang làm? Các lựa chọn trong bài này sẽ không được lưu vào lịch sử.')) return;
    commitActive(null);
    setView({ name: 'setup' });
  };

  const go = (v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  };

  if (loaded.errors.length > 0) {
    return (
      <div className="page">
        <h1>Không tải được ngân hàng câu hỏi</h1>
        <p>Dữ liệu không qua kiểm tra cấu trúc. Người quản lý cần chạy <code>npm run validate</code> và sửa file.</p>
        <ul>
          {loaded.errors.slice(0, 20).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }

  const result = view.name === 'result' ? progress.history.find((h) => h.id === view.attemptId) : undefined;

  return (
    <div className="page">
      <header className="topbar">
        <button className="brand" onClick={() => go(active ? { name: 'attempt' } : { name: 'setup' })}>
          Ôn tập Python · COMP1010
        </button>
        <nav>
          <button className={view.name === 'setup' ? 'navlink on' : 'navlink'} onClick={() => go({ name: 'setup' })}>
            Tạo bài
          </button>
          {active && (
            <button className={view.name === 'attempt' ? 'navlink on' : 'navlink'} onClick={() => go({ name: 'attempt' })}>
              Bài đang làm
            </button>
          )}
          <button className={view.name === 'history' ? 'navlink on' : 'navlink'} onClick={() => go({ name: 'history' })}>
            Lịch sử
          </button>
          <button className={view.name === 'progress' ? 'navlink on' : 'navlink'} onClick={() => go({ name: 'progress' })}>
            Tiến độ
          </button>
          <button className={view.name === 'guide' ? 'navlink on' : 'navlink'} onClick={() => go({ name: 'guide' })}>
            Hướng dẫn
          </button>
          <select
            className="theme-select"
            value={theme}
            onChange={(e) => changeTheme(e.target.value as Theme)}
            aria-label="Giao diện sáng/tối"
          >
            <option value="auto">Giao diện: theo hệ thống</option>
            <option value="light">Giao diện: sáng</option>
            <option value="dark">Giao diện: tối</option>
          </select>
        </nav>
      </header>

      {notices.map((n) => (
        <div className="notice warn" key={n}>
          {n}
        </div>
      ))}

      <main>
        {view.name === 'setup' && (
          <SetupPage
            loaded={loaded}
            progress={progress}
            hasActive={active !== null}
            onResume={() => go({ name: 'attempt' })}
            onStart={start}
          />
        )}
        {view.name === 'attempt' && active && (
          <AttemptPage
            key={active.id}
            attempt={active}
            loaded={loaded}
            bookmarks={progress.bookmarks}
            onUpdate={updateActive}
            onCheck={checkPracticeAnswer}
            onToggleBookmark={toggleBookmark}
            onSubmit={submit}
            onAbandon={abandon}
          />
        )}
        {view.name === 'attempt' && !active && (
          <div className="card">
            <p>Không có bài nào đang làm.</p>
            <button className="primary" onClick={() => go({ name: 'setup' })}>
              Tạo bài mới
            </button>
          </div>
        )}
        {view.name === 'result' &&
          (result ? (
            <ResultPage
              attempt={result}
              loaded={loaded}
              bookmarks={progress.bookmarks}
              onToggleBookmark={toggleBookmark}
              onRetry={(config, pool) => start(config, pool)}
              onBack={() => go({ name: 'history' })}
            />
          ) : (
            <div className="card">Không tìm thấy bài làm này trong lịch sử.</div>
          ))}
        {view.name === 'history' && (
          <HistoryPage history={progress.history} onOpen={(id) => go({ name: 'result', attemptId: id })} />
        )}
        {view.name === 'progress' && (
          <ProgressPage loaded={loaded} progress={progress} onChange={commitProgress} />
        )}
        {view.name === 'guide' && <GuidePage loaded={loaded} />}
      </main>
      <footer className="footer">
        Tài liệu tự luyện, không phải đề thi chính thức. Câu hỏi đang được rà soát.
      </footer>
    </div>
  );
}
