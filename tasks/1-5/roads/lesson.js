import { startLesson } from '../../../shared/lesson-core.js?v=3';
import { legend, roadMap, roadNetwork, namesModel, segmentModel, rideModel, shoppingModel } from './map.js?v=2';

const maslovka = {
  names: ['Масловка', 'Вёсенка', 'Полянка', 'Захарово'],
  from: ['деревни Масловка', 'деревни Вёсенка'],
  destination: 'села Захарово', through: ['деревню Полянка', 'деревне Вёсенка'],
  person: 'Саша', speed: [20, 15], horizontal: 20, vertical: 21, upper: 15, numbers: [1, 2, 3, 4],
  prices: [[45, 40, 42, 52], [29, 28, 31, 22], [250, 270, 290, 280], [350, 380, 360, 390], [35, 25, 32, 24]],
};
const osinovka = {
  names: ['Осиновка', 'Зябликово', 'Старая', 'Николаево'],
  from: ['деревни Осиновка', 'деревни Зябликово'],
  destination: 'села Николаево', through: ['деревню Старая', 'деревне Зябликово'],
  person: 'Гриша', speed: [15, 10], horizontal: 15, vertical: 20, upper: 8, numbers: [4, 2, 1, 3],
  prices: [[44, 48, 54, 60], [26, 19, 23, 18], [310, 330, 340, 290], [370, 320, 330, 360], [24, 26, 25, 27]],
};
const variants = [
  { ...maslovka, order: [0, 3, 1], side: false, goods: [2, 0, 0, 2, 4], page: 5, mix: false },
  { ...maslovka, order: [2, 3, 1], side: true, goods: [0, 3, 2, 0, 5], page: 129, mix: true },
  { ...osinovka, order: [0, 3, 1], side: false, goods: [3, 2, 0, 0, 3], page: 131, mix: false },
  { ...osinovka, order: [2, 3, 1], side: true, goods: [5, 0, 2, 2, 0], page: 133, mix: true },
];
const products = ['Молоко (1 л)', 'Хлеб (1 батон)', 'Сыр (1 кг)', 'Говядина (1 кг)', 'Картофель (1 кг)'];
const itemNames = ['молока', 'хлеба', 'сыра', 'говядины', 'картофеля'];
const unit = ['л', 'батона', 'кг', 'кг', 'кг'];
const f = number => number.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const texNum = number => String(Number(number.toFixed(5))).replace('.', '{,}');
const math = tex => '$' + tex + '$';

function buildSet(data, index) {
  const { names, from, through, destination, person, speed, order, goods, prices } = data;
  const [start, via, turn, end] = names;
  const network = roadNetwork(data);
  const sourceMap = roadMap(network) + legend;
  const common = `<p>${person} отдыхает у дедушки в деревне ${start}. Они едут на велосипедах в село ${end}.
    Напрямик из ${from[0]} до ${destination} ведёт лесная дорожка. По шоссе сначала проезжают деревню ${via}, а в деревне ${turn} поворачивают направо под прямым углом на шоссе к селу ${end}.
    Из ${from[1]} можно свернуть к ${destination} на прямую тропинку мимо пруда.</p>
    <p>Сторона клетки — 1 км. Скорость по шоссе — ${speed[0]} км/ч, по лесной дорожке и тропинке — ${speed[1]} км/ч.</p>`;
  const open = `<div class="road-context"><details><summary>Описание местности и скорости</summary>${common}</details></div>`;
  const [near, upper, cross, straight, shortcut] = network.edges;
  const vertical = data.side ? upper.km : near.km + upper.km;
  const distance = data.side ? shortcut.km : straight.km;
  const ride = data.mix ? [near, shortcut] : [straight];
  const minutes = ride.reduce((total, edge) => total + edge.minutes, 0);
  const nameAnswer = order.map(i => network.numbers[i]).join('');
  const shops = [start, end, via, turn];
  const totals = shops.map((_, j) => goods.reduce((total, quantity, i) => total + quantity * prices[i][j], 0));
  const basket = goods.map((quantity, i) => quantity ? `${quantity} ${unit[i]} ${itemNames[i]}` : '').filter(Boolean);
  const routeTable = `<div class="table-wrap"><table><thead><tr><th scope="col">Пункт</th>${order.map(i => `<th scope="col">${names[i]}</th>`).join('')}</tr></thead>
    <tbody><tr><th scope="row">Цифра</th><td></td><td></td><td></td></tr></tbody></table></div>`;
  const priceTable = `<div class="table-wrap"><table class="shopping-table"><thead><tr><th scope="col">Продукт</th>${shops.map(shop => `<th scope="col">${shop}</th>`).join('')}</tr></thead>
    <tbody>${prices.map((row, i) => `<tr><th scope="row">${products[i]}</th>${row.map(price => `<td>${price}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const sourceLabel = index ? 'Аналог из сборника' : 'Задание из сборника';
  const taskDefinitions = [
    {
      title: 'Пункты на карте',
      statement: common + `<p>Определи, какими цифрами на плане обозначены пункты в таблице.
        Запиши три цифры в указанном порядке без пробелов, запятых и других знаков.</p>` + routeTable,
      answer: +nameAnswer,
      check: value => value.trim() === nameAnswer,
      hints: ['Найди на шоссе поворот под прямым углом.', 'У дороги мимо пруда один конец на шоссе между стартом и поворотом.', 'Проверь порядок пунктов в таблице.'],
      steps: [
        `На прямоугольном повороте находится ${turn}, пункт ${network.numbers[2]}.`,
        `Тропинка мимо пруда начинается в пункте ${network.numbers[1]} (${via}) и ведёт в пункт ${network.numbers[3]} (${end}).`,
        `Пункт ${network.numbers[0]} — ${start}. Получается ${nameAnswer}.`,
      ],
      error: 'Проверь расположение поворота, тропинки мимо пруда и порядок цифр в таблице.',
      mount: namesModel(network, names, order),
    },
    {
      title: 'Расстояние по шоссе',
      statement: `<p>Сколько километров проедут ${person} с дедушкой от ${from[Number(data.side)]} до ${destination},
        если поедут по шоссе через ${through[0]}?</p>` + open,
      notebookStatement: common,
      answer: vertical + cross.km,
      hints: ['Найди начало и конец пути на плане.', 'Посчитай клетки по каждому отрезку шоссе, начиная с нужной деревни.', 'Сложи длины, полученные до и после поворота.'],
      steps: [`До поворота — ${vertical} км. После поворота — ${cross.km} км.`, math(`${vertical}+${cross.km}=${vertical+cross.km}`) + ' км.'],
      error: 'Проверь стартовую точку и учти весь путь после поворота.',
      mount: segmentModel(network),
    },
    {
      title: 'Расстояние по прямой',
      statement: `<p>Найди расстояние от ${from[Number(data.side)]} до ${destination} по прямой. Ответ дай в километрах.</p>` + open,
      notebookStatement: common,
      answer: distance,
      hints: ['Какую сторону прямоугольного треугольника нужно найти?', 'Длины катетов можно посчитать по клеткам.', 'По теореме Пифагора сложи квадраты катетов и извлеки квадратный корень.'],
      steps: [`Длины катетов — ${vertical} и ${cross.km} км.`,
        math(`c^2=${vertical}^2+${cross.km}^2=${vertical**2+cross.km**2}`),
        math(`c=\\sqrt{${vertical**2+cross.km**2}}=${distance}`) + ' км.'],
      error: 'При подсчёте длины прямой дороги используй гипотенузу. Перепроверь катеты.',
      mount: segmentModel(network, true),
    },
    {
      title: 'Время в пути',
      statement: `<p>Сколько минут затратят на дорогу из ${from[0]} в село ${end} ${person} с дедушкой,
        если ${data.mix ? `сначала поедут по шоссе и затем свернут в ${through[1]} на тропинку мимо пруда` : 'поедут по прямой лесной дорожке'}?</p>` + open,
      notebookStatement: common,
      answer: minutes,
      hints: ['Из каких участков состоит выбранный маршрут?', 'Для каждого участка раздели длину на его скорость.', 'Переведи часы в минуты, умножив на 60, и сложи времена.'],
      steps: [
        ...ride.map(edge => `${edge.highway ? 'Участок шоссе' : 'Лесной участок'} · ${f(edge.km)} км. ` +
          math(`\\frac{${edge.km}}{${speed[edge.highway ? 0 : 1]}}\\cdot60=${texNum(edge.minutes)}`) + ' мин.'),
        `Весь маршрут займёт ${f(minutes)} мин.`,
      ],
      error: 'Для шоссе и лесных участков используются разные скорости. Проверь перевод часов в минуты.',
      mount: rideModel(network),
    },
    {
      title: 'Сравнение стоимости покупки',
      statement: '<p>В таблице указаны цены на продукты в четырёх магазинах, в рублях.</p>' + priceTable +
        `<p>${person} с дедушкой хотят купить ${basket.slice(0, -1).join(', ')} и ${basket.at(-1)}.
        В ответ запиши стоимость набора в магазине, где он обойдётся дешевле всего.</p>`,
      answer: Math.min(...totals),
      hints: ['Какие строки таблицы относятся к этому набору продуктов?', 'Умножь цену каждого продукта на количество в корзине.', 'Сравни полные стоимости одной и той же корзины во всех магазинах.'],
      steps: [
        ...shops.map((shop, j) => {
          const calculation = goods.map((quantity, i) => quantity ? quantity + '\\cdot' + prices[i][j] : '').filter(Boolean).join('+');
          return `${shop}. ${math(calculation + '=' + totals[j])} руб.`;
        }),
        `Наименьшая стоимость — ${Math.min(...totals)} руб.`,
      ],
      error: 'Для каждого магазина вычисли цену всей корзины и выбери наименьшую.',
      mount: shoppingModel(prices, products, shops),
    },
  ];
  const tasks = taskDefinitions.map((task, i) => {
    const number = `${i + 1}.1${index ? '.' + index : ''}`;
    const page = data.page + Number(i > 0);
    return { ...task,
      source: `${number} · ${sourceLabel} · стр. ${page}`,
      notebookStatement: task.notebookStatement ? task.statement.replace(open, task.notebookStatement) : task.statement,
      notebook: i < 4 ? sourceMap : '',
    };
  });
  return { label: index ? `Аналог ${index} · 1.1.${index}–5.1.${index}` : 'Прототип · 1.1–5.1', tasks };
}

const theory = `<div class="theory-layout"><div>${roadMap(roadNetwork(maslovka), { angle: true })}${legend}</div>
  <div><p>Считай отрезки между линиями сетки. Одна клетка соответствует одному километру.
    Чтобы получить длину маршрута с поворотами, сложи длины всех его участков.</p>
  <div class="formula-cards">
    <div class="formula-card"><small>Прямая дорога</small><div>${math('c=\\sqrt{a^2+b^2}')}</div></div>
    <div class="formula-card"><small>Время участка в часах</small><div>${math('t=\\frac{s}{v}')}</div></div>
    <div class="formula-card"><small>Время в минутах</small><div>${math('t=\\frac{s}{v}\\cdot60')}</div></div>
    <div class="formula-card"><small>Стоимость двух товаров</small><div>${math('C=p_1q_1+p_2q_2')}</div></div>
  </div>
  <p>Если скорости на участках различаются, рассчитай время каждого участка. Для стоимости умножь цену каждого товара на количество и сложи результаты.</p></div></div>`;

startLesson({
  key: 'oge-roads-v1',
  slug: 'dorogi',
  shortTitle: 'ОГЭ · Дороги',
  title: 'Дороги<br>От карты до маршрута',
  intro: '<p>Найди деревни на плане, сравни пути по шоссе и лесным дорожкам, измерь время поездки и выбери магазин с самой дешёвой корзиной.</p><p>Пять задач прототипа и три комплекта аналогов из сборника.</p>',
  source: 'А. Д. Остромогильский, «Открытый банк задач ФИПИ. ОГЭ по математике», обновление 28.08.2026. Прототип — стр. 5–6, аналоги — стр. 129–134.',
  theoryTitle: 'План, расстояние и время',
  theory,
  sets: variants.map(buildSet),
});
