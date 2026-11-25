export function resetMailer(apiKey, from) {
  if (!apiKey || !from) return null;
  return async (email, secret, french, mobile = false) => {
    const subject = french ? 'Réinitialiser votre mot de passe CongoLingo' : 'Reset your CongoLingo password';
    const instruction = french ? 'Copiez ce code dans l’application CongoLingo.' : 'Paste this code into the CongoLingo app.';
    const message = mobile
      ? (french ? 'Ce code expire dans 30 minutes. Si vous n’avez pas fait cette demande, ignorez ce message.' : 'This code expires in 30 minutes. If you did not request it, ignore this message.')
      : french
      ? 'Ce lien est valable 30 minutes. Si vous n’avez pas demandé ce changement, ignorez ce message.'
      : 'This link expires in 30 minutes. If you did not request this change, you can ignore this email.';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: {Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json'},
      body: JSON.stringify({from, to: [email], subject, text: [mobile ? instruction : subject, secret, message].join('\n\n')}),
    });
    if (!response.ok) throw new Error('Password reset email delivery failed');
  };
}
