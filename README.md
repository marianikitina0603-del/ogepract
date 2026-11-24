# Практикум ОГЭ

Главная страница — index.html. Каталог — catalog.js. Папки tasks/1-5, tasks/6 … tasks/25 предназначены для самостоятельных HTML-уроков и их ресурсов.

## Добавление материала
1. Поместите HTML и связанные ресурсы в папку соответствующего номера, например tasks/1-5/roads/index.html.
2. Добавьте объект в массив window.OGE_MATERIALS в catalog.js:

```js
{topic: '1-5', type: 'lesson', title: 'Дороги', description: 'Интерактивный урок', path: 'tasks/1-5/roads/index.html'}
```

Типы: lesson, theory, trainer, practice, game, test. Путь должен быть относительным к корню сайта. Пустые разделы не содержат фиктивных ссылок. Общие инструменты уроков можно в дальнейшем разместить в shared/.

## Публикация
Settings → Pages → Deploy from a branch → main → / (root).
