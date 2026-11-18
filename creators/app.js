let locale = navigator.language.startsWith('fr') ? 'fr' : 'en';
function translate() {
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-en]').forEach(element => {
    element.textContent = element.dataset[locale];
  });
  document.getElementById('language').textContent = locale === 'fr' ? 'English' : 'Français';
}
document.getElementById('language').addEventListener('click', () => {
  locale = locale === 'fr' ? 'en' : 'fr';
  translate();
});
translate();
