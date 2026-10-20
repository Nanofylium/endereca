import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { cores } from '../tema';

/** Lê o QR Code das etiquetas do Endereça e os códigos de barras comuns de produto. */
export function Scanner(props: {
  aoLer: (codigo: string) => void;
  aoVoltar: () => void;
  titulo?: string;
  subtitulo?: string;
  instrucao?: string;
  rotuloDigitar?: string;
}) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [digitado, setDigitado] = useState('');
  const lido = useRef(false);

  function aoEscanear(resultado: BarcodeScanningResult) {
    // A câmera dispara várias leituras seguidas do mesmo código.
    if (lido.current || !resultado.data) return;
    lido.current = true;
    props.aoLer(resultado.data);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0F1A' }}>
      <Cabecalho titulo={props.titulo ?? 'Escanear produto'} subtitulo={props.subtitulo ?? 'QR Code ou código de barras'} onVoltar={props.aoVoltar} />
      <View style={estilos.area}>
        {permissao?.granted ? (
          <View style={estilos.moldura}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code128'] }}
              onBarcodeScanned={aoEscanear}
            />
          </View>
        ) : (
          <View style={{ gap: 16, alignItems: 'stretch', width: '100%' }}>
            <Text style={estilos.texto}>O Endereça precisa da câmera para ler o QR Code e o código de barras.</Text>
            <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
          </View>
        )}
        <Text style={estilos.texto}>{props.instrucao ?? 'Aponte para o QR Code da etiqueta da gôndola ou do palete, ou para o código de barras do produto.'}</Text>
        <View style={{ width: '100%', gap: 10 }}>
          <TextInput
            accessibilityLabel="Digitar o código"
            value={digitado}
            onChangeText={setDigitado}
            placeholder={props.rotuloDigitar ?? 'Ou digite o EAN ou SKU'}
            placeholderTextColor="#8A94A6"
            keyboardType={props.rotuloDigitar ? 'default' : 'number-pad'}
            autoCapitalize="characters"
            style={estilos.campo}
            onSubmitEditing={() => digitado.trim() && props.aoLer(digitado)}
          />
          <Botao titulo={props.rotuloDigitar ? 'Continuar' : 'Abrir ficha'} variante="escuro" desabilitado={!digitado.trim()} onPress={() => props.aoLer(digitado)} />
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, padding: 24, gap: 20, alignItems: 'center', justifyContent: 'center' },
  moldura: { width: 280, height: 280, borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: cores.branco },
  texto: { color: '#DCEBE4', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  campo: { height: 52, borderRadius: 12, backgroundColor: '#1A2333', color: cores.branco, fontSize: 17, paddingHorizontal: 16 },
});
