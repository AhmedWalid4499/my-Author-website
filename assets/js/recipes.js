/* =============================================================
   Recipes from the Aoi Shiori Kitchen  ·  the book page

   Each pastry card opens a <dialog> with two tabs: the way Mirai makes it,
   and the way you actually can. Data is inlined by tools/render.mjs from
   tools/recipes.json, so nothing is fetched.

   With JavaScript off the cards are still the illustrations with their names;
   only the recipes are unavailable.
   ============================================================= */
(function () {
  'use strict';

  var dataEl = document.getElementById('recipe-data');
  var dialog = document.getElementById('recipe-dialog');
  if (!dataEl || !dialog || typeof dialog.showModal !== 'function') return;

  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var opener = null;          // the card that opened it, to restore focus
  var current = null;

  var el = {
    art: dialog.querySelector('[data-recipe-art]'),
    chapter: dialog.querySelector('[data-recipe-chapter]'),
    name: dialog.querySelector('[data-recipe-name]'),
    jp: dialog.querySelector('[data-recipe-jp]'),
    tabMirai: dialog.querySelector('[data-tab="mirai"]'),
    tabRecipe: dialog.querySelector('[data-tab="recipe"]'),
    panelMirai: document.getElementById('panel-mirai'),
    panelRecipe: document.getElementById('panel-recipe'),
    intro: dialog.querySelector('[data-mirai-intro]'),
    method: dialog.querySelector('[data-mirai-method]'),
    hare: dialog.querySelector('[data-mirai-hare]'),
    facts: dialog.querySelector('[data-recipe-facts]'),
    ingredients: dialog.querySelector('[data-recipe-ingredients]'),
    steps: dialog.querySelector('[data-recipe-steps]'),
    tip: dialog.querySelector('[data-recipe-tip]')
  };

  el.tabMirai.textContent = DATA.tabs.mirai;
  el.tabRecipe.textContent = DATA.tabs.recipe;

  function fill(list, items, cls) {
    list.textContent = '';
    items.forEach(function (text) {
      var li = document.createElement('li');
      if (cls) li.className = cls;
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function showTab(which) {
    var mirai = which === 'mirai';
    el.tabMirai.setAttribute('aria-selected', String(mirai));
    el.tabRecipe.setAttribute('aria-selected', String(!mirai));
    el.tabMirai.tabIndex = mirai ? 0 : -1;
    el.tabRecipe.tabIndex = mirai ? -1 : 0;
    el.panelMirai.hidden = !mirai;
    el.panelRecipe.hidden = mirai;
  }

  function open(key, fromEl) {
    var r = DATA.recipes[key];
    if (!r) return;
    current = key;
    opener = fromEl || null;

    el.art.src = r.image + '-640.webp';
    el.art.alt = r.name;
    el.chapter.textContent = r.chapter;
    el.name.textContent = r.name;
    el.jp.textContent = r.japanese;

    // Mirai's way
    el.intro.textContent = r.mirai.intro;
    fill(el.method, r.mirai.method);
    el.hare.textContent = r.mirai.hare;

    // The real recipe
    var facts = [];
    if (r.recipe.serves) facts.push(['Makes', r.recipe.serves]);
    if (r.recipe.prep) facts.push(['Prep', r.recipe.prep]);
    if (r.recipe.cook) facts.push(['Cook', r.recipe.cook]);
    if (r.recipe.rest) facts.push(['Rest', r.recipe.rest]);
    el.facts.textContent = '';
    facts.forEach(function (pair) {
      var li = document.createElement('li');
      var k = document.createElement('span');
      k.className = 'recipe__facts-key';
      k.textContent = pair[0];
      var v = document.createElement('span');
      v.textContent = pair[1];
      li.appendChild(k); li.appendChild(v);
      el.facts.appendChild(li);
    });

    el.ingredients.textContent = '';
    r.recipe.ingredients.forEach(function (group) {
      var h = document.createElement('p');
      h.className = 'recipe__group';
      h.textContent = group.group;
      var ul = document.createElement('ul');
      ul.className = 'recipe__items';
      fill(ul, group.items);
      el.ingredients.appendChild(h);
      el.ingredients.appendChild(ul);
    });

    fill(el.steps, r.recipe.steps);
    el.tip.textContent = r.recipe.tip ? 'Tip — ' + r.recipe.tip : '';
    el.tip.hidden = !r.recipe.tip;

    showTab('mirai');
    dialog.showModal();
    dialog.querySelector('.recipe__sheet').scrollTop = 0;
    el.tabMirai.focus();
  }

  function close() {
    dialog.close();
  }

  /* ---- wiring ---- */
  [].forEach.call(document.querySelectorAll('[data-recipe]'), function (btn) {
    btn.addEventListener('click', function () { open(btn.getAttribute('data-recipe'), btn); });
  });

  dialog.querySelector('[data-recipe-close]').addEventListener('click', close);

  // Clicking the backdrop closes it. The sheet fills the dialog, so a click
  // that lands on the dialog itself was outside the sheet.
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) close();
  });

  dialog.addEventListener('close', function () {
    if (opener) { opener.focus(); opener = null; }
  });

  el.tabMirai.addEventListener('click', function () { showTab('mirai'); });
  el.tabRecipe.addEventListener('click', function () { showTab('recipe'); });

  // Left/right arrows move between tabs, which is what a tablist should do.
  dialog.querySelector('[role="tablist"]').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    var toRecipe = el.tabMirai.getAttribute('aria-selected') === 'true';
    showTab(toRecipe ? 'recipe' : 'mirai');
    (toRecipe ? el.tabRecipe : el.tabMirai).focus();
  });
})();
