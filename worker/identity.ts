import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './http';

export type Permission = 'finance:read' | 'finance:write' | 'finance:export' | 'finance:advisor';
export type Principal = { subject: string; owner: string; permissions: readonly Permission[] };
export interface IdentityEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  LOCAL_DEV_AUTH?: string;
}
const personalPermissions: readonly Permission[] = ['finance:read', 'finance:write', 'finance:export', 'finance:advisor'];
// Only public verification keys are cached. No user, token or financial data.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Replace this trusted adapter when the Portal identity contract is defined.
 * Keep owner mapping explicit: existing rows are owned by the verified Access email.
 */
export async function authenticate(request: Request, env: IdentityEnv): Promise<Principal> {
  if (env.LOCAL_DEV_AUTH === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)) {
    return { subject: 'local-development', owner: 'owner@local', permissions: personalPermissions };
  }
  const domain = env.ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.ACCESS_AUD?.trim();
  if (!domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !audience) {
    throw new ApiError('Acesso indisponível. Configure o domínio e a audiência do Cloudflare Access.', 503);
  }
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new ApiError('Autenticação necessária. Entre pelo endereço protegido pelo Cloudflare Access.', 401);
  try {
    const issuer = `https://${domain}`;
    let keys = keySets.get(issuer);
    if (!keys) { keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)); keySets.set(issuer, keys); }
    const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'] });
    if (typeof payload.email !== 'string' || !payload.email.trim() || typeof payload.sub !== 'string') throw new Error('Invalid identity');
    return { subject: payload.sub, owner: payload.email, permissions: personalPermissions };
  } catch { throw new ApiError('Sessão inválida ou expirada. Autentique-se novamente.', 401); }
}

export function authorize(principal: Principal, permission: Permission) {
  if (!principal.permissions.includes(permission)) throw new ApiError('Você não tem permissão para esta operação.', 403);
}
