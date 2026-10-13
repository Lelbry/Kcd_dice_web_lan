# KCD2 Dice Reference

All dice from the Steam guide: https://steamcommunity.com/sharedfiles/filedetails/?id=3440227498

Format: `id | Name | weights [1,2,3,4,5,6] (%) | Notes`

Already implemented dice are marked with [+].

## Implemented

| id | Name | 1 | 2 | 3 | 4 | 5 | 6 | Notes |
|----|------|---|---|---|---|---|---|-------|
| normal | Обычная игральная кость | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 | [+] Default |
| antioch | Кость Святого Антиоха | 0 | 0 | 100 | 0 | 0 | 0 | [+] Always 3 |
| painted | Раскрашенная игральная кость | 18.7 | 6.2 | 6.2 | 6.2 | 43.7 | 18.7 | [+] Favors 5 |
| lucky | Удачливая игральная кость | 33.3 | 0 | 5.6 | 5.6 | 33.3 | 22.2 | [+] Favors 1,5,6 |
| sad_trickster | Кость печального ловкача | 26.1 | 26.1 | 4.3 | 4.3 | 26.1 | 13 | [+] Favors 1,2,5 |
| charioteer | Игральная кость возницы | 5.6 | 27.8 | 33.3 | 11.1 | 11.1 | 11.1 | [+] Favors 2,3 |
| even | Четная кость | 6.7 | 26.7 | 6.7 | 26.7 | 6.7 | 26.7 | [+] Favors even |
| odd | Нечетная игральная кость | 26.7 | 6.7 | 26.7 | 6.7 | 16.7 | 6.7 | [+] Favors odd |
| loaded | Заряженная игральная кость | 66.7 | 6.7 | 6.7 | 6.7 | 6.7 | 6.7 | [+] 67% chance of 1 |
| shrewd_cheat | Кость осмотрительного жулика | 23.8 | 14.3 | 9.6 | 14.3 | 23.8 | 14.3 | [+] Favors 1,5 |
| unbalanced | Несбалансированная кость | 25 | 33.3 | 8.3 | 8.3 | 16.7 | 8.3 | [+] Favors 1,2 |

## Not Yet Implemented

### Weighted (gameplay-affecting)

| id (proposed) | Name | 1 | 2 | 3 | 4 | 5 | 6 | Notes |
|---------------|------|---|---|---|---|---|---|-------|
| diminishing | Уменьшающая кость | 22.2 | 11.1 | 11.1 | 11.1 | 11.1 | 33.3 | Favors 1,6 |
| unlucky | Невезучая игральная кость | 4.5 | 27.7 | 27.7 | 27.7 | 27.7 | 4.5 | Anti-1,6 |
| stripping | Раздевальная игральная кость | 25 | 12.5 | 12.5 | 12.5 | 18.7 | 18.7 | Favors 1,5,6 |
| holy_trinity | Игральная кость Святой Троицы | 18.2 | 22.7 | 45.4 | 4.5 | 4.5 | 4.5 | Favors 3 (45%) |
| lu | Игральная кость Лю | 13 | 13 | 13 | 13 | 13 | 34.8 | Favors 6 |
| royal | Королевская игральная кость | 12.5 | 18.7 | 21.9 | 25 | 12.5 | 9.4 | Favors 3,4 |
| mathematician | Кость математика | 16.7 | 20.8 | 25 | 29.2 | 4.2 | 4.2 | Favors 3,4 |
| triple | Игральная кость с тройкой | 12.5 | 6.2 | 56.2 | 6.2 | 12.5 | 6.2 | 56% chance of 3 |
| aranki | Игральная кость Аранки | 28.6 | 4.8 | 28.6 | 4.8 | 28.6 | 4.8 | Favors odd (1,3,5) |
| qi | Игральная кость Ци | 13 | 13 | 13 | 13 | 13 | 34.8 | Favors 6 |
| fer | Игральная кость Фер | 13 | 13 | 13 | 13 | 13 | 34.8 | Favors 6 |
| greasy | Засаленная игральная кость | 17.6 | 11.8 | 17.6 | 11.8 | 17.6 | 23.5 | Favors odd,6 |
| dirty | Грязная игральная кость | 6.2 | 31.2 | 6.2 | 6.2 | 43.7 | 6.2 | Favors 2,5 |
| grozav_lucky | Счастливая игральная кость Грозава | 6.7 | 66.7 | 6.7 | 6.7 | 6.7 | 6.7 | 67% chance of 2 |
| swindler | Игральная кость мошенников | 10 | 15 | 10 | 15 | 35 | 15 | Favors 5 (35%) |
| lucky_alt | Счастливая игральная кость | 27.3 | 4.5 | 9.1 | 13.6 | 18.2 | 27.3 | Favors 1,6 |
| pie | Пирог в виде игральной кости | 46.2 | 7.7 | 23.1 | 23.1 | 0 | 0 | No 5 or 6! |
| unlucky_alt | Несчастливая кость | 9.1 | 27.3 | 18.2 | 18.2 | 18.2 | 9.1 | Favors 2,3,4,5 |
| pearl | Перламутровая кость | 25 | 8.3 | 8.3 | 8.3 | 25 | 25 | Favors 1,5,6 |

### Cosmetic (equal weights, unique appearance only)

| id (proposed) | Name | Notes |
|---------------|------|-------|
| devil_head | Игральная кость с головой дьявола | Equal weights, cosmetic |
| hugo | Кость Гуго | Equal weights, cosmetic |
| molar | Игральная кость из коренного зуба | Equal weights, cosmetic |
| wisdom_tooth | Кость из зуба мудрости | Equal weights, cosmetic |
| tooth | Кость из зуба | Equal weights, cosmetic |
| st_stefan | Кость Святого Стефана | Equal weights, cosmetic |
| kingdom_heaven | Игральная кость Царства небесного | Equal weights, cosmetic |
| artist_g | Кость художника (зеленая) | Equal weights, cosmetic |
| artist_r | Кость художника (красная) | Equal weights, cosmetic |
| artist_b | Кость художника (синяя) | Equal weights, cosmetic |

## How to Add a New Die

Add an entry to `DICE_TYPES` in both:
- `public/js/engine/dice-types.js`
- `server/engine/dice-types.js`

```js
{
  id: 'proposed_id',           // unique kebab-case ID
  name: 'Русское название',
  description: 'Описание кости.',
  weights: [w1, w2, w3, w4, w5, w6],  // relative weights for faces 1-6
  color: '#RRGGBB',           // unique saturated hex color
  special: true,              // false for cosmetic-only
},
```

Keep both files identical. Colors should be bold and distinct from existing dice.
Max 3 special dice per player loadout (controlled by `MAX_SPECIAL_DICE`).
