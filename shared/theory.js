import { typeset } from './math-keyboard.js?v=8';

export function renderTheory(container, config, { context, interactive = true } = {}) {
  if (context) {
    const section = document.createElement('section');
    section.className = 'task-context';
    section.innerHTML = '<h3>К этому заданию</h3>' + context;
    container.append(section);
  }
  const body = document.createElement('div');
  body.innerHTML = config.theory || '';
  container.append(body);
  if (interactive && config.mountTheory) {
    const model = document.createElement('section');
    model.className = 'interactive theory-interactive';
    config.mountTheory(model);
    container.append(model);
  }
  typeset(container);
}
