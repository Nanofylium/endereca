import { useCallback, useEffect, useState } from 'react';
import { ErroApi } from './api';

/** Carrega dados da API e expõe recarregar; sessão caída é repassada para quem trata o login. */
export function usarDados<T>(carregar: () => Promise<T>, aoSessaoCair: (e: ErroApi) => void) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await carregar());
      setErro('');
    } catch (e) {
      if (e instanceof ErroApi && e.exigeNovoLogin) aoSessaoCair(e);
      else setErro(e instanceof Error ? e.message : 'Algo deu errado.');
    } finally {
      setCarregando(false);
    }
  }, [carregar, aoSessaoCair]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { dados, erro, carregando, recarregar };
}
