import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Campo } from '../componentes/Campo';
import { cores } from '../tema';
import { RespostaAcesso } from '../tipos';

/** Login com matrícula e palavra secreta, e o primeiro acesso com o código do líder. */
export function Acesso(props: { api: Api; aparelhoId: string; aoEntrar: (r: RespostaAcesso) => void }) {
  const [modo, setModo] = useState<'entrar' | 'ativar'>('entrar');
  const [matricula, setMatricula] = useState('');
  const [palavra, setPalavra] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    if (!matricula.trim() || !palavra || (modo === 'ativar' && !codigo.trim())) {
      setErro(modo === 'entrar' ? 'Digite a matrícula e a palavra secreta.' : 'Preencha a matrícula, o código do líder e a palavra secreta.');
      return;
    }
    setErro('');
    setCarregando(true);
    try {
      const resposta = modo === 'entrar' ? await props.api.entrar(matricula, palavra) : await props.api.ativar(matricula, codigo, palavra);
      setPalavra('');
      setCodigo('');
      props.aoEntrar(resposta);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }

  function trocarModo(novo: 'entrar' | 'ativar') {
    setModo(novo);
    setErro('');
    setPalavra('');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cores.verde }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
        <View style={estilos.marca}>
          <View style={estilos.logo}>
            <Text style={estilos.logoTexto}>E</Text>
          </View>
          <Text style={estilos.nome}>Endereça</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={estilos.titulo}>{modo === 'entrar' ? 'Encontre qualquer produto da loja em segundos.' : 'Primeiro acesso'}</Text>
          <Text style={estilos.texto}>
            {modo === 'entrar'
              ? 'Entre com sua matrícula e a sua palavra secreta.'
              : 'A matrícula precisa estar no cadastro do RH. Use o código que o seu líder entregou: ele vale por 24 horas e só uma vez.'}
          </Text>
        </View>

        <Campo rotulo="Matrícula" value={matricula} onChangeText={setMatricula} keyboardType="number-pad" autoComplete="username" placeholder="Ex.: 004512" />
        {modo === 'ativar' ? (
          <Campo rotulo="Código de ativação do líder" value={codigo} onChangeText={(t) => setCodigo(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={8} placeholder="6 letras e números" style={{ letterSpacing: 3 }} />
        ) : null}
        <Campo
          rotulo={modo === 'entrar' ? 'Palavra secreta' : 'Crie sua palavra secreta'}
          dica={modo === 'ativar' ? 'Use uma palavra só sua, com letras, como “chiclete”. Mínimo de 6 caracteres, sem o seu nome ou matrícula.' : undefined}
          value={palavra}
          onChangeText={setPalavra}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={modo === 'entrar' ? 'password' : 'new-password'}
          onSubmitEditing={enviar}
        />

        {erro ? (
          <Text accessibilityLiveRegion="polite" style={estilos.erro}>
            {erro}
          </Text>
        ) : null}

        <Botao titulo={modo === 'entrar' ? 'Entrar' : 'Ativar meu acesso'} onPress={enviar} carregando={carregando} />

        <Pressable accessibilityRole="button" onPress={() => trocarModo(modo === 'entrar' ? 'ativar' : 'entrar')} style={estilos.link}>
          <Text style={estilos.linkTexto}>{modo === 'entrar' ? 'Primeiro acesso' : 'Já tenho acesso'}</Text>
        </Pressable>

        <Text style={estilos.aparelho}>Aparelho: {props.aparelhoId}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: 28, paddingTop: 64, gap: 20, flexGrow: 1 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 12, backgroundColor: cores.laranja, alignItems: 'center', justifyContent: 'center' },
  logoTexto: { color: cores.branco, fontSize: 24, fontWeight: '800' },
  nome: { color: cores.branco, fontSize: 24, fontWeight: '800' },
  titulo: { color: cores.branco, fontSize: 26, fontWeight: '700', lineHeight: 32 },
  texto: { color: cores.verdeClaroTexto, fontSize: 15, lineHeight: 22 },
  erro: { color: '#FFC9A8', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkTexto: { color: cores.branco, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  aparelho: { color: '#A3C4B6', fontSize: 12, textAlign: 'center', marginTop: 'auto' },
});
