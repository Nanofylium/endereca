import * as SecureStore from 'expo-secure-store';
import { RespostaAcesso } from './tipos';

const CHAVE = 'endereca.sessao';

// O token fica no armazenamento criptografado do sistema, nunca em texto aberto.
export async function lerSessao(): Promise<RespostaAcesso | null> {
  const bruto = await SecureStore.getItemAsync(CHAVE);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as RespostaAcesso;
  } catch {
    return null;
  }
}

export async function salvarSessao(sessao: RespostaAcesso): Promise<void> {
  await SecureStore.setItemAsync(CHAVE, JSON.stringify(sessao));
}

export async function apagarSessao(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE);
}
