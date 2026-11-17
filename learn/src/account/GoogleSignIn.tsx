import { useQuery } from '@tanstack/react-query'
import { useT } from '../i18n/useT'

export function GoogleSignIn({ link = false }: { link?: boolean }) {
  const { ui } = useT()
  const { data } = useQuery({
    queryKey: ['auth-options'],
    queryFn: async (): Promise<{ google: boolean; googleOrigin: string | null }> => {
      const res = await fetch('/api/learn/auth-options')
      if (!res.ok) return { google: false, googleOrigin: null }
      return res.json()
    },
    staleTime: 60_000,
    retry: false,
  })
  if (!data?.google || !data.googleOrigin) return null
  // Only our canonical host may receive the session and OAuth state cookies.
  const href = data.googleOrigin + '/api/learn/google/start' + (link ? '?link=1' : '')
  return <a className="btn outline block google-signin" href={href}>
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.8 6-15.1Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4A20.4 20.4 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.4a12.2 12.2 0 0 1 0-7.8v-5.4H5.7a20 20 0 0 0 0 18.6l6.9-5.4Z" />
      <path fill="#EA4335" d="M24 11.2c3 0 5.6 1 7.7 3l5.8-5.8A19.5 19.5 0 0 0 24 3a20.4 20.4 0 0 0-18.3 11.2l6.9 5.4c1.6-4.8 6.1-8.4 11.4-8.4Z" />
    </svg>
    {link ? (ui === 'fr' ? 'Connecter mon compte Google' : 'Connect my Google account') : (ui === 'fr' ? 'Continuer avec Google' : 'Continue with Google')}
  </a>
}

export function googleError(code: unknown, ui: string) {
  if (!code) return ''
  if (code === 'google_existing') return ui === 'fr'
    ? 'Un compte apprenant existe déjà avec cette adresse e-mail, mais il n’est pas encore lié à Google. Connectez-vous avec votre mot de passe habituel, puis allez dans Profil → « Connecter mon compte Google ». Votre progression sera conservée.'
    : 'A learner account already exists with this email address, but it isn’t linked to Google yet. Sign in with your usual password, then go to Profile → “Connect my Google account”. Your learning progress will be kept.'
  if (code === 'google_link') return ui === 'fr'
    ? 'Choisissez le compte Google avec la même adresse e-mail que votre compte apprenant.'
    : 'Choose the Google account with the same email as your learner account.'
  if (code === 'google_cancelled') return ui === 'fr' ? 'Connexion Google annulée. Vous pouvez réessayer.' : 'Google sign-in was cancelled. You can try again.'
  return ui === 'fr' ? 'La connexion Google a échoué ou a expiré. Veuillez réessayer.' : 'Google sign-in failed or expired. Please try again.'
}
