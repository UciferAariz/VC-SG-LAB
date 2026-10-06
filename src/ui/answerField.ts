/**
 * An answer box: label, input, unit suffix, Check button and a feedback line.
 * Feedback never relies on colour alone: each kind has a text prefix and an
 * icon, and the line is an aria-live region.
 */
import { h, uid } from './controls';
import { icons } from './icons';
import { t } from './i18n';

export type FeedbackKind = 'correct' | 'close' | 'wrong' | 'info' | 'shown';

const PREFIX: Record<FeedbackKind, string> = { correct: '✓ Correct.', close: '≈ Close.', wrong: '✗ Not quite.', info: 'ℹ', shown: '➜ Answer:' };

export interface AnswerField {
  el: HTMLElement;
  input: HTMLInputElement;
  feedback(kind: FeedbackKind | null, text?: string): void;
  /** Lock the box (answered or revealed). */
  done(value?: string): void;
  reset(): void;
  isDone(): boolean;
  focus(): void;
}

export function answerField(label: string, suffix: string, onCheck: (raw: string) => void, opts: { inputMode?: 'decimal' | 'numeric' } = {}): AnswerField {
  const id = uid('ans');
  const fbId = uid('fb');
  const input = h('input', { type: 'text', id, inputmode: opts.inputMode ?? 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': fbId, class: 'answer-input' });
  const btn = h('button', { type: 'button', class: 'btn btn-check' });
  btn.innerHTML = icons.check;
  btn.append(h('span', { class: 'btn-text' }, [t.check]));
  const fb = h('p', { id: fbId, class: 'feedback', 'aria-live': 'polite' });
  const submit = () => {
    if (!input.disabled) onCheck(input.value);
  };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  const el = h('div', { class: 'answer' }, [
    h('label', { for: id }, [label]),
    h('div', { class: 'answer-row' }, [input, suffix ? h('span', { class: 'answer-unit' }, [suffix]) : null, btn]),
    fb,
  ]);
  let isDone = false;
  return {
    el,
    input,
    feedback(kind, text = '') {
      fb.className = `feedback${kind ? ` fb-${kind}` : ''}`;
      fb.textContent = kind ? `${PREFIX[kind]} ${text}`.trim() : '';
    },
    done(value) {
      isDone = true;
      if (value !== undefined) input.value = value;
      input.disabled = true;
      btn.disabled = true;
      el.classList.add('answered');
    },
    reset() {
      isDone = false;
      input.value = '';
      input.disabled = false;
      btn.disabled = false;
      el.classList.remove('answered');
      fb.className = 'feedback';
      fb.textContent = '';
    },
    isDone: () => isDone,
    focus: () => input.focus(),
  };
}
