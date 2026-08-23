/**
 * Validações de veracidade do cadastro do passageiro (espelham o trigger do
 * banco `clientes_validar_cadastro`). Usadas no formulário para bloquear antes
 * de enviar; o banco é a barreira final.
 */

/** CPF válido pelos dígitos verificadores (rejeita 000..., 111..., etc.). */
export function cpfValido(cpf: string): boolean {
  const c = (cpf || "").replace(/\D/g, "");
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(c[i]) * (10 - i);
  let d1 = 11 - (soma % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(c[i]) * (11 - i);
  let d2 = 11 - (soma % 11);
  if (d2 >= 10) d2 = 0;
  if (d2 !== Number(c[10])) return false;

  return true;
}

/** Telefone celular BR válido: 11 dígitos, 9 na 3ª posição, sem repetição fake. */
export function telefoneCelularValido(tel: string): boolean {
  const t = (tel || "").replace(/\D/g, "");
  if (!/^[1-9][0-9]9[0-9]{8}$/.test(t)) return false;
  if (/^(\d)\1{10}$/.test(t)) return false; // todos iguais
  if (/^(\d)\1{7}$/.test(t.slice(3))) return false; // 8 dígitos finais iguais (ex.: 13999999999)
  return true;
}

/** Nome completo: nome + sobrenome, cada um com 2+ letras. */
export function nomeCompletoValido(nome: string): boolean {
  const n = (nome || "").trim().replace(/\s+/g, " ");
  if (!n.includes(" ")) return false;
  const partes = n.split(" ");
  return partes[0].length >= 2 && partes[partes.length - 1].length >= 2;
}
