import type { AttemptItem, Question } from '../types';
import { OPTION_LABELS, labelFor } from '../lib/attempt';
import { formatSource, kindLabel, lectureLabel } from '../lib/bank';
import ReportButton from './ReportButton';

interface Props {
  question: Question;
  item: AttemptItem;
  index: number;
  total: number;
  chosen: string | null;
  /** Radio group disabled (checked practice answer, or review). */
  locked: boolean;
  /** Show the correct answer and explanation. */
  reveal: boolean;
  onChoose?: (optionId: string) => void;
  /** Answer that was graded for this item (frozen at submission), used in review. */
  gradedCorrectIds?: string[];
}

export default function QuestionView({
  question,
  item,
  index,
  total,
  chosen,
  locked,
  reveal,
  onChoose,
  gradedCorrectIds,
}: Props) {
  const correctIds = gradedCorrectIds ?? item.correctOptionIds;
  const textById = new Map(question.options.map((o) => [o.id, o.text]));
  const monoOptions = question.code !== null || question.options.some((o) => o.text.includes('\n'));
  const correctLabel = correctIds.map((id) => labelFor(item.optionOrder, id)).join(', ');
  const isRight = chosen !== null && correctIds.includes(chosen);

  return (
    <article className="question">
      <div className="qmeta">
        <span>
          Câu {index + 1}/{total}
        </span>
        <span className="tag">{question.id}</span>
        <span className="tag">{lectureLabel(question.lecture)}</span>
        <span className="tag">{kindLabel(question.kind)}</span>
      </div>
      <p className="prompt">{question.prompt}</p>
      {question.code !== null && (
        <pre className="code" aria-label="Đoạn code">
          <code>{question.code}</code>
        </pre>
      )}

      <fieldset className="options" disabled={locked}>
        <legend className="sr-only">Chọn một đáp án</legend>
        {item.optionOrder.map((oid, i) => {
          const isCorrect = correctIds.includes(oid);
          let cls = 'option';
          if (chosen === oid) cls += ' chosen';
          if (reveal && isCorrect) cls += ' correct';
          if (reveal && chosen === oid && !isCorrect) cls += ' wrong';
          return (
            <label key={oid} className={cls}>
              <input
                type="radio"
                name={`q-${item.id}`}
                value={oid}
                checked={chosen === oid}
                onChange={() => onChoose?.(oid)}
              />
              <span className="olabel">{OPTION_LABELS[i]}.</span>
              <span className={monoOptions ? 'otext mono' : 'otext'}>{textById.get(oid) ?? '(phương án không còn trong ngân hàng)'}</span>
            </label>
          );
        })}
      </fieldset>

      {reveal && (
        <div className={isRight ? 'feedback ok' : 'feedback bad'}>
          <p>
            <strong>{chosen === null ? 'Chưa trả lời.' : isRight ? 'Đúng.' : 'Sai.'}</strong> Đáp án đúng: {correctLabel}
            {chosen !== null && !isRight && <> · Bạn chọn: {labelFor(item.optionOrder, chosen)}</>}
          </p>
          <p className="explanation">{question.explanation}</p>
        </div>
      )}

      <details className="details">
        <summary>Chi tiết câu hỏi</summary>
        <ul className="small">
          <li>Chủ đề: {question.topic}</li>
          <li>Độ khó (ước lượng): {question.difficulty}</li>
          <li>Trạng thái: {question.status === 'draft' ? 'nháp – đang rà soát' : question.status}</li>
          {question.sources.map((s) => (
            <li key={s.file}>Nguồn: {formatSource(s)}</li>
          ))}
        </ul>
        <ReportButton question={question} item={item} chosen={chosen} />
      </details>
    </article>
  );
}
