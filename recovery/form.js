const token = location.hash.slice(1);
history.replaceState(null, '', location.pathname + location.search);
const lang = new URLSearchParams(location.search).get('lang') || navigator.language;
const fr = lang.startsWith('fr');
const t = (english, french) => fr ? french : english;
const form = document.querySelector('form');
const field = document.querySelector('#field');
const confirmField = document.querySelector('#confirm');
const button = form.querySelector('button');
const status = document.querySelector('[role=status]');
const heading = t('Reset your password', 'Réinitialiser votre mot de passe');
document.documentElement.lang = fr ? 'fr' : 'en';
document.title = heading + ' · CongoLingo';
document.querySelector('h1').textContent = heading;
document.querySelector('a').textContent = t('Back to sign in', 'Retour à la connexion');
form.querySelector('label').textContent = token ? t('New password (8–256 characters)', 'Nouveau mot de passe (8 à 256 caractères)') : t('Account email', 'Adresse e-mail du compte');
field.type = token ? 'password' : 'email';
field.autocomplete = token ? 'new-password' : 'email';
field.maxLength = token ? 256 : 254;
if (token) {
  field.minLength = 8;
  const label = form.querySelector('[for=confirm]');
  label.hidden = confirmField.hidden = confirmField.disabled = false;
  label.textContent = t('Confirm new password', 'Confirmer le nouveau mot de passe');
  confirmField.required = true;
}
button.textContent = token ? t('Save new password', 'Enregistrer le mot de passe') : t('Email me a reset link', 'Recevoir un lien par e-mail');
form.hidden = false;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  if (token && field.value !== confirmField.value) {
    status.textContent = t('The passwords must match.', 'Les mots de passe doivent être identiques.');
    confirmField.focus();
    return;
  }
  button.disabled = true;
  status.textContent = '';
  try {
    const res = await fetch('/api/learn/' + (token ? 'reset-password' : 'forgot-password'), {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(token ? {token, password:field.value} : {email:field.value, lang: fr ? 'fr' : 'en'}),
    });
    if (!res.ok) {
      if (res.status === 400 && token) {
        status.textContent = t('This link is invalid or expired.', 'Ce lien est invalide ou a expiré.');
        const retry = document.createElement('a');
        retry.href = location.pathname + location.search;
        retry.textContent = t('Request another link', 'Demander un autre lien');
        status.append(' ', retry);
        form.hidden = true;
      } else if (res.status === 429) {
        status.textContent = t('Try again in 15 minutes.', 'Réessayez dans 15 minutes.');
      } else throw new Error();
      return;
    }
    form.reset();
    form.hidden = true;
    status.textContent = token
      ? t('Password updated. Return to CongoLingo and sign in with your new password.', 'Mot de passe modifié. Retournez dans CongoLingo pour vous connecter.')
      : t('If this email has a password account, check your inbox for a link valid for 30 minutes.', 'Si cette adresse correspond à un compte avec mot de passe, consultez vos e-mails. Le lien est valable 30 minutes.');
  } catch {
    status.textContent = t('Password recovery is unavailable. Please try again later.', 'La récupération est indisponible. Réessayez plus tard.');
  } finally { button.disabled = false; }
});
