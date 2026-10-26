# Projetos de código aberto que podem entrar no Endereça

Pesquisa feita em 25/10/2026 no GitHub. A licença de cada projeto foi conferida no próprio repositório. O critério é simples: o Endereça é software fechado e licenciado para o cliente, então só entra o que permite uso comercial sem abrir o nosso código (MIT, Apache-2.0, BSD e parecidas). Ao incorporar qualquer um deles, os avisos de copyright e o arquivo NOTICE vão junto do build, e `scripts/licencas.mjs` barra no CI as dependências JavaScript com licença não permitida.

"IA que não precisa instalar" aqui quer dizer modelo que roda dentro do próprio app ou do navegador, sem a loja instalar outro programa e sem depender de internet para cada leitura. O custo é tamanho: um modelo de OCR leve soma de 10 a 20 MB ao APK.

## Já em uso

| Projeto | Licença | Para quê |
| --- | --- | --- |
| [expo-camera](https://github.com/expo/expo) | MIT | Lê QR Code e EAN no app. No Android usa o leitor do Google ML Kit, que roda no aparelho, é gratuito e permite uso comercial pelos termos do Google (não é código aberto). |
| [qrcode](https://github.com/soldair/node-qrcode) | MIT | Gera os QR Codes das etiquetas no painel. |

## Compatíveis e úteis (propostas)

| Projeto | Origem | Licença | Uso no Endereça |
| --- | --- | --- | --- |
| [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) | comunidade | Apache-2.0 | Leitor de código de barras e QR mais tolerante a etiqueta amassada. Alternativa ao ML Kit se o Atacadão não quiser componente do Google. |
| [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) | comunidade | MIT | O mesmo zxing-cpp no navegador: o painel do recebimento lê a etiqueta de volume pela webcam do PC, sem instalar nada. **Primeiro candidato.** |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Baidu (China) | Apache-2.0 | OCR com modelos móveis (PP-OCR) para ler validade e lote impressos na embalagem, direto no celular. |
| [RapidOCR](https://github.com/RapidAI/RapidOCR) | RapidAI (China) | Apache-2.0 | Os modelos do PaddleOCR já convertidos para ONNX Runtime e MNN, o caminho mais curto para rodar no app. **Segundo candidato.** |
| [MNN](https://github.com/alibaba/MNN) | Alibaba (China) | Apache-2.0 | Motor de IA no aparelho da própria Alibaba, roda modelos de visão e LLMs pequenos no Android. |
| [ncnn](https://github.com/Tencent/ncnn) | Tencent (China) | BSD-3-Clause (inclui componentes de terceiros com licenças próprias, listadas no repositório) | Alternativa ao MNN, muito usada com YOLOX e PaddleOCR no Android. |
| [OpenCV wechat_qrcode](https://github.com/opencv/opencv_contrib/tree/4.x/modules/wechat_qrcode) | WeChat/Tencent (China) | Apache-2.0 | Detector de QR com rede neural, lê QR pequeno, de longe ou danificado (etiqueta no aéreo). |
| [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) | Megvii (China) | Apache-2.0 | Detecção de objetos: foto da gôndola para apontar ruptura (espaço vazio) ou contar caixas. Precisa treinar com fotos das lojas. |
| [Chinese-CLIP](https://github.com/OFA-Sys/Chinese-CLIP) | Alibaba DAMO (China) | MIT (código) | Achar o produto por foto quando não há código para bipar, comparando com as imagens do catálogo. Conferir a licença dos pesos antes de usar. |
| [ONNX Runtime](https://github.com/microsoft/onnxruntime) | Microsoft | MIT | Roda os modelos acima no app (`onnxruntime-react-native`) e no navegador (`onnxruntime-web`). |
| [transformers.js](https://github.com/huggingface/transformers.js) | Hugging Face | Apache-2.0 | IA no navegador do painel, sem servidor de IA nem instalação. |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | comunidade | Apache-2.0 | OCR no navegador, mais simples e menos preciso que o PaddleOCR. |
| [Ant Design](https://github.com/ant-design/ant-design) | Ant Group/Alibaba (China) | MIT | Biblioteca de componentes do painel, o padrão visual dos sistemas internos da Alibaba. |
| [Tauri](https://github.com/tauri-apps/tauri) | comunidade | Apache-2.0 / MIT | Já adotado neste PR para o .exe do painel. |

Modelos de linguagem da família Qwen (Alibaba) também servem para resumir faltas e alertas para o gerente, mas a licença muda de modelo para modelo: a maior parte é Apache-2.0, e alguns tamanhos usam a licença própria "Qwen", com restrições. Se forem usados, rodam no servidor e cada modelo tem a licença conferida antes.

## Logística e reposição

Sistemas completos de armazém (WMS) de código aberto, a maioria chineses. Todos são programas inteiros em outras linguagens (Python, Java, C#), com banco e telas próprios. Juntar um deles ao Endereça significaria manter dois sistemas. O caminho escolhido é trazer as ideias que eles já provaram e implementá-las no nosso código: etiqueta por volume (o que eles chamam de LPN), endereçamento bipando volume e local, saída pela validade mais próxima (FEFO), baixa de volume e reposição por mínimo e máximo.

| Projeto | Origem | Licença | Para quê |
| --- | --- | --- | --- |
| [GreaterWMS](https://github.com/GreaterWMS/GreaterWMS) | China, nascido na logística pós-venda da Ford Ásia-Pacífico | Apache-2.0 | Referência de recebimento, armazenagem e inventário. |
| [ModernWMS](https://github.com/fjykTec/ModernWMS) | China (fjykTec) | Apache-2.0 | Referência de modelo de armazém, área e posição. |
| [Open WES](https://github.com/jingsewu/open-wes) | China | MIT | Referência de execução de tarefas no armazém. |
| [KopSoftWms](https://github.com/lysilver/KopSoftWms) | China | MIT | Referência de entrada, saída e inventário. |
| [JeecgBoot](https://github.com/jeecgboot/JeecgBoot) | China (JEECG) | Apache-2.0 | Plataforma de baixo código; não serve para o Endereça, que já tem a própria API. |
| [OpenWMS](https://github.com/openwms/org.openwms) | Alemanha | Apache-2.0 | Referência de modelo de dados de fluxo de material. |
| [Google OR-Tools](https://github.com/google/or-tools) | Google | Apache-2.0 | Otimização: ordem de coleta e rota no depósito, para quando houver volume que justifique. |

O [wms-ruoyi](https://github.com/zccbbg/wms-ruoyi) aparece com licença "Other" no GitHub, sem permissão clara de uso comercial, e fica de fora.

O que já entrou no Endereça a partir dessas ideias: etiqueta por caixa e por endereço, endereçamento bipando os dois, lista de caixas na ficha pela validade mais próxima e baixa da caixa vazia. O próximo passo natural é a reposição por mínimo e máximo: cadastrar quanto cabe em cada gôndola e gerar a tarefa de reposição sozinha quando ela baixar do mínimo.

## Inadequados para o Endereça

| Projeto | Licença | Por quê |
| --- | --- | --- |
| [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) (YOLOv8, YOLO11 e seguintes) | AGPL-3.0 | Distribuir ou oferecer pela rede obriga a abrir todo o código que o usa. Só com a licença comercial paga da Ultralytics. Use YOLOX no lugar. |
| ZBar | LGPL-2.1 | Embutido no app, exige permitir que o cliente troque a biblioteca, o que complica a distribuição fechada. O zxing-cpp faz o mesmo com Apache-2.0. |
| Projetos e modelos sem licença declarada | nenhuma | Sem licença não há permissão de uso. Vários modelos publicados em sites de modelos estão como "unknown" ou "uso em pesquisa". |
| Dynamsoft, Scandit e similares | proprietárias pagas | Funcionam bem, mas não são código aberto e cobram por aparelho. |

## Próximos passos sugeridos

1. Leitura pela webcam no painel com zxing-wasm, para o recebimento etiquetar e conferir volumes no PC.
2. Teste em loja do OCR de validade com RapidOCR (PP-OCR) no app, medindo acerto e o tamanho que soma ao APK antes de decidir.
3. Detecção de ruptura por foto (YOLOX) só depois de juntar fotos reais das gôndolas.

Nada disso foi incorporado ainda: cada item aumenta o app e precisa ser testado em celular de verdade, por isso fica para PRs separados.
