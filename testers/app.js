const form = document.getElementById('signup');
let locale = navigator.language.startsWith('fr') ? 'fr' : 'en';
const words = (en, fr) => locale === 'fr' ? fr : en;
function translate() {
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset[locale]; });
  document.getElementById('language').textContent = locale === 'fr' ? 'English' : 'Français';
  document.getElementById('email-label').textContent = form.elements.platform.value === 'ios' ? words('Apple Account email', 'E-mail du compte Apple') : words('Google Play email', 'E-mail Google Play');
}
document.getElementById('language').onclick = () => { locale = locale === 'fr' ? 'en' : 'fr'; translate(); };
form.addEventListener('change', translate);
translate();
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type=submit]');
  const result = document.getElementById('result');
  button.disabled = true;
  result.textContent = words('Saving…', 'Enregistrement…');
  try {
    const response = await fetch('/api/testers', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:form.elements.name.value, email:form.elements.email.value, platform:form.elements.platform.value, consent:form.elements.consent.checked})});
    if (!response.ok) throw new Error();
    result.textContent = words('You’re on the list! Watch your inbox for your testing invitation.', 'Tu es sur la liste ! Surveille tes e-mails pour recevoir ton invitation.');
    form.reset();
    translate();
  } catch {
    result.textContent = words('We couldn’t save your signup. Please check your details and try again shortly.', 'Impossible d’enregistrer ton inscription. Vérifie les informations et réessaie dans un instant.');
  } finally { button.disabled = false; }
});
