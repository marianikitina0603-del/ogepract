import { startLesson } from '../../../shared/lesson-core.js?v=4';
import {
  fmt, mark, dimensions, dimensionDiagram, tableModel, profileModel, diameterModel, compareModel, rollingModel,
} from './wheels.js?v=2';

const variants = [
  {
    label: 'Демоверсия · 1.3–5.3',
    source: 'ФИПИ · DEMO',
    pages: [10, 10, 10, 10, 11],
    factory: [175, 70, 12], profile: [165, 65, 14], compare: [[185, 60, 13], [175, 65, 13]],
    roll: [175, 65, 13], search: 'max', disc: 13,
    columns: [12, 13, 14],
    rows: [[175, '175/70', '175/65', ''], [185, '', '185/60', ''], [195, '', '195/60', '']],
  },
  {
    label: 'Аналог 2 · 1.3.2–5.3.2',
    source: 'Аналог из сборника',
    pages: [177, 177, 177, 177, 178],
    factory: [185, 60, 15], profile: [205, 55, 15], compare: [[185, 60, 15], [205, 45, 17]],
    roll: [205, 45, 17], search: 'min', disc: 16,
    columns: [14, 15, 16, 17],
    rows: [
      [175, '175/70', '175/65', '', ''], [185, '185/70', '185/60', '185/55', ''],
      [195, '195/65', '195/60', '195/50; 195/55', '195/45'],
      [205, '205/60', '205/55', '205/50', '205/45'], [215, '', '', '215/45', '215/40'],
    ],
  },
  {
    label: 'Аналог 3 · 1.3.3–5.3.3',
    source: 'Аналог из сборника',
    pages: [179, 179, 179, 179, 180],
    factory: [265, 60, 18], profile: [275, 65, 17], compare: [[265, 60, 18], [285, 50, 20]],
    roll: [285, 50, 20], search: 'max', disc: 17,
    columns: [17, 18, 19, 20],
    rows: [
      [245, '245/70', '', '', ''], [255, '255/70', '255/65', '', ''],
      [265, '265/65', '265/60; 265/65', '', ''], [275, '275/65', '275/60', '275/55', '275/50'],
      [285, '', '285/60', '285/55', '285/50'],
    ],
  },
  {
    label: 'Аналог 4 · 1.3.4–5.3.4',
    source: 'Аналог из сборника',
    pages: [181, 181, 181, 181, 182],
    factory: [205, 60, 16], profile: [275, 50, 17], compare: [[205, 60, 16], [215, 45, 18]],
    roll: [215, 60, 16], search: 'min', disc: 18,
    columns: [16, 17, 18],
    rows: [
      [205, '205/60', '205/55', ''], [215, '215/60; 215/55', '215/50', '215/45'],
      [225, '', '225/45; 225/40', '225/40'],
    ],
  },
];

const formula = tex => '$' + tex + '$';
const decimal = value => fmt(value).replace(/\s/g, '').replace(',', '{,}');
const times = ' \\cdot ';
const heightStep = ({ b, p, h }, name = 'H') => formula(`${name}=\\frac{${b}${times}${p}}{100}=${decimal(h)}`) + ' мм.';
const discStep = ({ n, disc }) => formula(`d=${n}${times}25{,}4=${decimal(disc)}`) + ' мм.';
const diameterStep = ({ disc, h, diameter }, name = 'D') =>
  formula(`${name}=${decimal(disc)}+2${times}${decimal(h)}=${decimal(diameter)}`) + ' мм.';
const factoryData = tire => `<p>Заводская маркировка шины <strong>${mark(tire)}</strong>.</p>`;
const heightFormula = formula('H=\\frac{B\\cdot p}{100}');
const diameterFormula = formula('D=d+2H');
const distanceFormula = formula('L=\\pi D');
const changeFormula = formula('\\frac{D_2-D_1}{D_1}\\cdot 100\\%');
const genericDiagram = dimensionDiagram([195, 65, 15]);

function buildSet(data, variant) {
  const factory = dimensions(data.factory);
  const profile = dimensions(data.profile);
  const [wheel1, wheel2] = data.compare.map(dimensions);
  const radiusTask = variant === 0;
  const key = radiusTask ? 'radius' : 'diameter';
  const difference = Math.abs(wheel2[key] - wheel1[key]);
  const smaller = wheel2.diameter < wheel1.diameter;
  const replacement = dimensions(data.roll);
  const percent = (replacement.diameter - factory.diameter) / factory.diameter * 100;
  const widths = data.rows.filter(row => row[data.columns.indexOf(data.disc) + 1]).map(row => row[0]);
  const extreme = data.search === 'min' ? 'наименьшей' : 'наибольшей';
  const best = Math[data.search](...widths);
  const compareHints = radiusTask
    ? ['Что можно исключить из сравнения, если диаметры дисков равны?',
      'Сравни высоты боковин.', 'Радиус колеса равен сумме радиуса диска и высоты одной боковины.']
    : ['Как определить полный диаметр каждого колеса по его маркировке?',
      'Переведи диаметры дисков в миллиметры и найди высоты боковин.', 'Для каждого колеса используй ' + diameterFormula + '.'];
  const tasks = [
    {
      title: 'Чтение таблицы',
      statement: `<p>Завод допускает установку шин с другими маркировками. В таблице показаны разрешённые размеры шин.</p>
        <div class="table-wrap"><table class="tire-table"><thead><tr><th scope="col">Ширина, мм</th>
        ${data.columns.map(size => `<th scope="col">${size}″</th>`).join('')}</tr></thead><tbody>
        ${data.rows.map(([width, ...cells]) => `<tr><th scope="row">${width}</th>${cells.map(cell => `<td>${cell || '—'}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
        <p>Шины какой ${extreme} ширины можно устанавливать на автомобиль, если диаметр диска равен ${data.disc} дюймам? Ответ дайте в миллиметрах.</p>`,
      answer: best,
      hints: ['Какой столбец соответствует указанному диаметру диска?', 'Прочерки обозначают неподходящие сочетания.', `Среди оставшихся строк выбери ${data.search === 'min' ? 'наименьшую' : 'наибольшую'} ширину.`],
      steps: [`Для диска ${data.disc}″ подходят ширины ${widths.join(', ')} мм.`, `Искомая ширина равна ${best} мм.`],
      context: '<p>Заголовок столбца задаёт диаметр диска в дюймах. Заголовок строки задаёт ширину шины в миллиметрах.</p>',
      error: 'Проверь, какой диаметр указан в условии и какую ширину просят найти.',
      mount: tableModel(data.columns, data.rows),
    },
    {
      title: 'Высота боковины',
      statement: `<p>Сколько миллиметров составляет высота боковины шины, имеющей маркировку <strong>${mark(data.profile)}</strong>?</p>`,
      notebook: genericDiagram,
      answer: profile.h,
      hints: ['Что означают первое и второе числа в маркировке?', 'Найди указанное в маркировке число процентов от ширины.', 'Используй формулу ' + heightFormula + ', где p задано в процентах.'],
      steps: [`Ширина равна ${profile.b} мм. Боковина составляет ${profile.p}% ширины.`, heightStep(profile)],
      context: '<p>Высоту боковины вычисляем по формуле ' + heightFormula + '.</p>',
      error: 'Проверь, от какой ширины ты вычисляешь процент и перевёл ли процент в долю.',
      mount: profileModel(data.profile),
    },
    {
      title: 'Диаметр колеса',
      statement: '<p>Найдите диаметр колеса автомобиля, выходящего с завода. Ответ дайте в миллиметрах.</p>' + factoryData(data.factory),
      notebook: genericDiagram,
      answer: factory.diameter,
      hints: ['Сколько боковин пересекает диаметр?', 'Сложи диаметр диска и высоты двух боковин. Приведи размеры к миллиметрам.', 'Используй ' + diameterFormula + ' и 1″ = 25,4 мм.'],
      steps: [heightStep(factory), discStep(factory), diameterStep(factory)],
      context: '<p>Полный диаметр состоит из диаметра диска и двух боковин.</p>',
      error: 'Проверь множитель при высоте боковины и перевод дюймов в миллиметры.',
      mount: diameterModel(data.factory),
    },
    {
      title: 'Сравнение размеров колёс',
      statement: radiusTask
        ? '<p>На сколько миллиметров радиус колеса с шиной 185/60 R13 меньше, чем радиус колеса с шиной 175/65 R13?</p>'
        : `<p>На сколько миллиметров ${smaller ? 'уменьшится' : 'увеличится'} диаметр колеса, если заменить колёса, установленные на заводе, колёсами с шинами <strong>${mark(data.compare[1])}</strong>?</p>` + factoryData(data.factory),
      notebook: genericDiagram,
      answer: difference,
      hints: compareHints,
      steps: radiusTask
        ? [heightStep(wheel1, 'H_1'), heightStep(wheel2, 'H_2'), formula(`r_2-r_1=H_2-H_1=${decimal(wheel2.h)}-${decimal(wheel1.h)}=${decimal(difference)}`) + ' мм.']
        : [diameterStep(wheel1, 'D_1'), diameterStep(wheel2, 'D_2'),
          formula(`\\Delta D=${decimal(Math.max(wheel1.diameter, wheel2.diameter))}-${decimal(Math.min(wheel1.diameter, wheel2.diameter))}=${decimal(difference)}`) + ' мм.'],
      context: '<p>Радиус равен половине диаметра. Сравнивай одну и ту же величину у обоих колёс.</p>',
      error: `Проверь, спрашивают разность ${radiusTask ? 'радиусов' : 'диаметров'} и какой размер больше.`,
      mount: compareModel(...data.compare, radiusTask),
    },
    {
      title: 'Процентное изменение пробега',
      statement: `<p>На сколько процентов увеличится пробег автомобиля при одном обороте колеса, если заменить колёса,
        установленные на заводе, колёсами с шинами <strong>${mark(data.roll)}</strong>? Результат округлите до десятых.</p>` + factoryData(data.factory),
      notebook: genericDiagram,
      answer: +percent.toFixed(1),
      hints: ['Какую длину проходит колесо за полный оборот?', 'Сравни длины окружностей. Дели прирост на исходный пробег.', 'По формуле ' + distanceFormula + ' множитель π сокращается. Можно сравнивать диаметры.'],
      steps: [diameterStep(factory, 'D_1'), diameterStep(replacement, 'D_2'),
        formula(`\\frac{${decimal(replacement.diameter)}-${decimal(factory.diameter)}}{${decimal(factory.diameter)}}${times}100\\%\\approx${decimal(+percent.toFixed(1))}\\%`) + '.'],
      context: '<p>Для процентного прироста за один оборот используй ' + changeFormula + '.</p>',
      error: 'Проверь, что делишь прирост на исходный пробег и округляешь результат до десятых.',
      mount: rollingModel(data.factory, data.roll),
    },
  ];
  tasks.forEach((task, i) => {
    const number = `${i + 1}.3${variant ? '.' + (variant + 1) : ''}`;
    task.source = `${number} · ${data.source} · стр. ${data.pages[i]}`;
  });
  return { label: data.label, tasks };
}

const cards = [
  ['Высота боковины', 'H=\\frac{B\\cdot p}{100}'],
  ['Диаметр диска в мм', 'd=25{,}4\\cdot n'],
  ['Диаметр колеса', 'D=d+2H'],
  ['Радиус колеса', 'r=\\frac{D}{2}'],
  ['Путь за один оборот', 'L=\\pi D'],
  ['Изменение пробега', '\\frac{D_2-D_1}{D_1}\\cdot100\\%'],
];

startLesson({
  key: 'oge-tires-v1',
  slug: 'shiny',
  legacySource: 'ФИПИ, сборник MathStart, стр. 9–11',
  shortTitle: 'ОГЭ · Шины',
  title: 'Шины<br>Математика в движении',
  intro: '<p>Прочитай маркировку шины, рассчитай размеры колеса и проверь на модели, как меняется пробег за один оборот.</p><p>В уроке пять заданий демоверсии и три комплекта аналогов из сборника.</p>',
  source: 'А. Д. Остромогильский, «Открытый банк задач ФИПИ. ОГЭ по математике», обновление 28.08.2026. Демоверсия — стр. 9–11, аналоги — стр. 176–182.',
  theoryTitle: 'Маркировка и формулы',
  theory: `<h3>Как читать 195/65 R15</h3>
    <p><strong>195</strong> — ширина B в миллиметрах. <strong>65</strong> — высота боковины H в процентах от ширины.
      <strong>R</strong> обозначает радиальную конструкцию. <strong>15</strong> — диаметр диска в дюймах.</p>
    <div class="theory-layout">${genericDiagram}<div class="formula-cards">${cards.map(([label, tex]) =>
      `<div class="formula-card"><small>${label}</small><div>${formula(tex)}</div></div>`).join('')}</div></div>
    <h3>Проверь себя</h3><p>Один дюйм равен 25,4 мм. В формулах полного диаметра, радиуса и длины окружности используй одни и те же единицы.</p>
    <p>В полном диаметре две высоты боковины. При процентном сравнении пробега дели разность на исходный пробег.</p>`,
  sets: variants.map(buildSet),
});
