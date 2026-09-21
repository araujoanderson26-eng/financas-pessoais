"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="empty-state" role="alert"><h1>Não foi possível abrir esta tela</h1><p>Os dados salvos permanecem no banco. Tente carregar a tela novamente.</p><button className="primary-button" onClick={reset}>Tentar novamente</button></section>;
}
