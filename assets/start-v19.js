/* Optional guidance: destination links remain usable without JavaScript. */
(() => {
  'use strict';
  document.querySelectorAll('[data-start-guide]').forEach(guide => {
    const choices = guide.querySelector('[data-start-choices]');
    const inputs = [...guide.querySelectorAll('input[data-start-choice]')];
    const panels = [...guide.querySelectorAll('[data-start-panel]')];
    if (!choices || inputs.length !== 3 || panels.length !== 3 ||
        !inputs.every(input => panels.some(panel => panel.dataset.startPanel === input.value))) return;

    const showChoice = () => {
      const selected = inputs.find(input => input.checked) || inputs[0];
      selected.checked = true;
      panels.forEach(panel => { panel.hidden = panel.dataset.startPanel !== selected.value; });
      inputs.forEach(input => {
        input.closest('label')?.toggleAttribute('data-start-selected', input === selected);
      });
    };

    inputs.forEach(input => input.addEventListener('change', showChoice));
    showChoice();
    choices.hidden = false;
    guide.setAttribute('data-start-ready', '');
  });
})();
