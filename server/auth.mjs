import { createRemoteJWKSet, jwtVerify } from 'jose';

const keys = new Map();
export async function authenticate(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) {
    throw Object.assign(new Error('O acesso dos professores ainda precisa ser ativado.'), { status: 503 });
  }
  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)) throw new Error('Invalid Access issuer');
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw Object.assign(new Error('Entre com seu e-mail autorizado.'), { status: 401 });
  try {
    if (!keys.has(issuer)) keys.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    const { payload } = await jwtVerify(token, keys.get(issuer), { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'] });
    const email = String(payload.email || '').toLowerCase();
    const allowed = env.ADMIN_EMAILS.split(',').map(x => x.trim().toLowerCase());
    if (!email || !allowed.includes(email)) throw new Error('Not authorized');
    return email;
  } catch {
    throw Object.assign(new Error('Acesso não autorizado. Entre novamente com um e-mail permitido.'), { status: 403 });
  }
}
