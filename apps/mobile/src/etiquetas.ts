/** Mesmo formato da API: ENDERECA:L:<código> é endereço, ENDERECA:V:<código> é caixa ou palete, o resto é produto. */
export function tipoDoCodigo(lido: string): 'endereco' | 'volume' | 'produto' {
  const qr = /^ENDERECA:([LV]):[A-Za-z0-9]{6,20}$/i.exec(lido.trim());
  if (!qr) return 'produto';
  return qr[1].toUpperCase() === 'L' ? 'endereco' : 'volume';
}
