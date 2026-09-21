export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
    throw new ApiError('Origem da solicitação não permitida.', 403);
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw new ApiError('Envie os dados em JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('Informe os dados.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 524288) { await reader.cancel(); throw new ApiError('Solicitação muito grande (máximo 512 KB).', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError('JSON inválido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('Informe um objeto JSON.');
  return value as Record<string, unknown>;
}

export function apiFailure(error: unknown): Response {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  // Constraint messages are mapped, never returned with SQL, bindings or private data.
  const message = error instanceof Error ? error.message : '';
  if (/FINANCE_CONFLICT|UNIQUE constraint/.test(message)) return Response.json({ error: 'Registro duplicado ou referências em conflito. Atualize os dados antes de tentar novamente.' }, { status: 409 });
  if (/FINANCE_REFERENCE/.test(message)) return Response.json({ error: 'Categoria ou conta em uso ou indisponível. Atualize os dados.' }, { status: 409 });
  console.error(JSON.stringify({ event: 'finance_error', code: 'internal_error' }));
  return Response.json({ error: 'Não foi possível concluir a operação. Tente novamente.' }, { status: 500 });
}

export function privateResponse(response: Response): Response {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'no-store');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('Referrer-Policy', 'same-origin');
  return result;
}
