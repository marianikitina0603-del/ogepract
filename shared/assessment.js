import { numberAnswer, typeset } from './math-keyboard.js?v=8';

export function checkAnswer(task, raw) {
  return task.check ? Boolean(task.check(raw)) : Math.abs(numberAnswer(raw) - task.answer) < 1e-8;
}

export function assistance(state, key) {
  if (state.revealed[key] || state.modelHelp[key]) return 'solution';
  return state.hints[key] || state.stepHelp[key] ? 'hint' : 'independent';
}

export function checkFinal(state, key, task, raw) {
  state.attempts[key] = (state.attempts[key] || 0) + 1;
  const correct = checkAnswer(task, raw);
  state.correct[key] = correct;
  if (correct) state.solved[key] ||= assistance(state, key);
  else delete state.solved[key];
  return correct;
}

export function gradeTest(state, entries) {
  if (state.completed.test) return;
  for (const { key, task } of entries) {
    const answer = state.answers[key]?.trim();
    if (answer) checkFinal(state, key, task, answer);
  }
  state.completed.test = true;
}

export function taskFeedback(task, raw) {
  const value = numberAnswer(raw);
  if (!Number.isFinite(value) && !task.check) return 'Введи число, десятичную дробь или дробь вида a/b.';
  return task.mistakes?.find(item => Math.abs(item.value - value) < 1e-8)?.text
    || task.error || 'Пока неверно. Проверь вычисления и единицы.';
}

export function mountCheckpoints(root, { task, key, state, save }) {
  const details = document.createElement('details');
  details.className = 'task-checkpoints';
  const summary = document.createElement('summary');
  summary.textContent = 'Проверить промежуточные шаги';
  details.append(summary);
  for (const [index, item] of task.checkpoints.entries()) {
    const form = document.createElement('form');
    form.className = 'lesson-row checkpoint-row';
    const label = document.createElement('label');
    label.textContent = item.label;
    const input = document.createElement('input');
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.maxLength = 80;
    input.value = state.checkpointAnswers[key]?.[index] ?? '';
    label.append(' ', input);
    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Проверить шаг';
    const feedback = document.createElement('span');
    feedback.setAttribute('role', 'status');
    form.append(label, button, feedback);
    details.append(form);
    function updateFeedback() {
      const correct = state.checkpointMarks[key]?.[index];
      feedback.className = correct === undefined ? '' : correct ? 'good' : 'bad';
      feedback.textContent = correct === undefined ? '' : correct ? 'Шаг верный.' : (item.hint || 'Перепроверь этот шаг.');
    }
    input.oninput = () => {
      (state.checkpointAnswers[key] ??= {})[index] = input.value;
      if (state.checkpointMarks[key]) delete state.checkpointMarks[key][index];
      updateFeedback();
      save();
    };
    form.onsubmit = event => {
      event.preventDefault();
      if (!input.value.trim()) {
        feedback.textContent = 'Введи результат шага.';
        input.focus();
        return;
      }
      state.stepHelp[key] = true;
      (state.checkpointMarks[key] ??= {})[index] = checkAnswer(item, input.value);
      updateFeedback();
      save();
    };
    updateFeedback();
  }
  root.append(details);
  typeset(details);
}
