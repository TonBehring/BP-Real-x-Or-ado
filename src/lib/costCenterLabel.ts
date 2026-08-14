/**
 * Monta o rótulo de exibição de um centro de custo.
 * Só mostra o código junto ao nome quando ele for um código numérico "de
 * verdade" (ex: "930600"). Códigos gerados automaticamente pela importação
 * (ex: "CUSTO_VARIAVEL") ficam escondidos, já que não têm valor pra quem olha
 * a tela — só o nome já basta.
 */
export function costCenterLabel(codigo: string, nome: string): string {
  return /^\d+$/.test(codigo) ? `${codigo} — ${nome}` : nome;
}
