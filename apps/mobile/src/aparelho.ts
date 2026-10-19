import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * Identificador do aparelho, cadastrado pela TI na tabela de aparelhos da loja.
 * A API recusa qualquer aparelho que não esteja cadastrado.
 */
export async function identificarAparelho(): Promise<string> {
  if (Platform.OS === 'android') return `AND-${Application.getAndroidId()}`;
  if (Platform.OS === 'ios') return `IOS-${(await Application.getIosIdForVendorAsync()) ?? 'desconhecido'}`;
  return 'DESCONHECIDO';
}
