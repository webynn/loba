import { OAuth2Client } from 'google-auth-library';

/** Google verifies signature, issuer, audience and expiry; we additionally bind the nonce. */
export function googleIdentity(payload, nonce) {
  if (!payload || payload.nonce !== nonce || payload.email_verified !== true ||
      typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 ||
      typeof payload.email !== 'string' || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error('Invalid Google identity');
  }
  const name = String(payload.given_name || payload.name || 'Learner').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0,40) || 'Learner';
  return {sub:payload.sub, email:payload.email.toLowerCase().trim(), name};
}

export function createGoogleAuth({clientId, clientSecret, redirectUri}) {
  if (!clientId && !clientSecret) return null;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Google OAuth configuration is incomplete');
  const callback = new URL(redirectUri);
  if (callback.pathname !== '/api/learn/google/callback' || callback.search || callback.hash || callback.username || callback.password ||
      (callback.protocol !== 'https:' && callback.hostname !== 'localhost')) throw new Error('Invalid Google redirect URI');
  const client = new OAuth2Client({clientId, clientSecret, redirectUri});
  return {
    origin: callback.origin,
    authorizationUrl({state, nonce, challenge}) {
      return client.generateAuthUrl({scope:['openid','email','profile'], state, nonce, prompt:'select_account', code_challenge:challenge, code_challenge_method:'S256'});
    },
    async exchange(code, verifier, nonce) {
      const {tokens} = await client.getToken({code, codeVerifier:verifier});
      if (!tokens.id_token) throw new Error('Missing Google identity');
      const ticket = await client.verifyIdToken({idToken:tokens.id_token, audience:clientId});
      return googleIdentity(ticket.getPayload(), nonce);
    },
  };
}
