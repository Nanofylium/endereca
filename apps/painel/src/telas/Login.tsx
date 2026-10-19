import { FormEvent, useState } from 'react';
import { Api, ErroApi } from '../api';
import { RespostaAcesso } from '../tipos';

export function Login(props: { api: Api; aparelhoId: string; aoEntrar: (r: RespostaAcesso) => void; avisoInicial?: string }) {
  const [modo, setModo] = useState<'entrar' | 'ativar'>('entrar');
  const [matricula, setMatricula] = useState('');
  const [palavra, setPalavra] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(props.avisoInicial ?? '');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const r = modo === 'entrar' ? await props.api.entrar(matricula, palavra) : await props.api.ativar(matricula, codigo, palavra);
      if (r.colaborador.papel === 'repositor') {
        setErro('O painel é para líderes e gerentes. Use o app Endereça no celular.');
        return;
      }
      props.aoEntrar(r);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setEnviando(false);
      setPalavra('');
    }
  }

  return (
    <main className="login">
      <form onSubmit={enviar}>
        <div>
          <h1>{modo === 'entrar' ? 'Painel do Endereça' : 'Primeiro acesso'}</h1>
          <p>
            {modo === 'entrar'
              ? 'Para líderes e gerentes operacionais. Entre com a matrícula e a sua palavra secreta.'
              : 'Use o código de ativação que você recebeu do seu gestor. Ele vale por 24 horas e só uma vez.'}
          </p>
        </div>
        <label>
          Matrícula
          <input value={matricula} onChange={(e) => setMatricula(e.target.value)} inputMode="numeric" autoComplete="username" required />
        </label>
        {modo === 'ativar' ? (
          <label>
            Código de ativação
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} autoComplete="one-time-code" maxLength={8} required />
          </label>
        ) : null}
        <label>
          {modo === 'entrar' ? 'Palavra secreta' : 'Crie sua palavra secreta'}
          <input
            type="password"
            value={palavra}
            onChange={(e) => setPalavra(e.target.value)}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            required
          />
          {modo === 'ativar' ? <span className="dica">Mínimo de 6 caracteres, com letras, sem o seu nome ou matrícula.</span> : null}
        </label>
        {erro ? (
          <p className="erro" role="alert">
            {erro}
          </p>
        ) : null}
        <button className="botao principal" type="submit" disabled={enviando}>
          {enviando ? 'Conferindo…' : modo === 'entrar' ? 'Entrar' : 'Ativar meu acesso'}
        </button>
        <button type="button" className="link" onClick={() => (setModo(modo === 'entrar' ? 'ativar' : 'entrar'), setErro(''))}>
          {modo === 'entrar' ? 'Primeiro acesso' : 'Já tenho acesso'}
        </button>
        <p className="aparelho">Identificador deste computador: {props.aparelhoId}</p>
      </form>
    </main>
  );
}
