// Trilha de treinamento do repositor. O conteúdo fica no código para ser revisado em PR, como qualquer regra da loja.

export interface Pergunta {
  pergunta: string;
  opcoes: string[];
  /** Índice da opção certa. Nunca vai para o app antes da resposta. */
  correta: number;
  explicacao: string;
}

export interface Licao {
  id: string;
  titulo: string;
  resumo: string;
  minutos: number;
  topicos: string[];
  perguntas: Pergunta[];
}

export const PONTOS_POR_ACERTO = 10;
export const PONTOS_POR_DESAFIO = 5;
/** Acertos mínimos (em fração) para a lição contar como concluída. */
export const APROVACAO = 0.7;

export const TRILHA: Licao[] = [
  {
    id: 'coracao-da-loja',
    titulo: 'O repositor é quem faz a loja vender',
    resumo: 'Por que a gôndola cheia é o trabalho mais visível do atacarejo.',
    minutos: 3,
    topicos: [
      'Produto que não está na gôndola não vende. Cada ruptura é um cliente que leva menos ou vai embora.',
      'No atacarejo o cliente compra em volume: um fardo que falta derruba a compra inteira de um comerciante.',
      'Você é quem mais conhece a loja por dentro: onde cada produto mora, o que gira rápido e o que está parado.',
      'Quem domina o setor vira referência e é o primeiro nome lembrado quando abre vaga de líder.',
    ],
    perguntas: [
      {
        pergunta: 'O que acontece quando o produto está no depósito mas não está na gôndola?',
        opcoes: ['Nada, o cliente pede ao repositor', 'A loja perde a venda, mesmo tendo o produto', 'O sistema repõe sozinho'],
        correta: 1,
        explicacao: 'Estoque parado no depósito não vende. É a reposição que transforma estoque em venda.',
      },
      {
        pergunta: 'Por que uma ruptura pesa mais no atacarejo?',
        opcoes: ['Porque o cliente compra em volume e pode desistir da compra toda', 'Porque o preço é mais alto', 'Não pesa mais'],
        correta: 0,
        explicacao: 'O comerciante que veio buscar dez fardos e não encontra costuma levar a compra inteira para outro lugar.',
      },
    ],
  },
  {
    id: 'enderecos',
    titulo: 'Lendo um endereço: R-07 · Módulo 5 · Nível 3',
    resumo: 'Rua, módulo, nível e posição: o mapa da área de venda.',
    minutos: 4,
    topicos: [
      'R-07 é a rua (o corredor) da área de venda.',
      'O módulo é o trecho da gôndola dentro da rua, contado a partir da ponta.',
      'O nível é a prateleira, contada de baixo para cima: nível 1 é a de baixo.',
      'A posição, quando existe, é a ordem do produto dentro do nível, da esquerda para a direita.',
      'Bipe a embalagem e a ficha mostra o endereço. Você não precisa decorar: precisa saber ler.',
    ],
    perguntas: [
      {
        pergunta: 'No endereço R-07 · Módulo 5 · Nível 3, o que é o "3"?',
        opcoes: ['O corredor', 'A prateleira, contando de baixo para cima', 'A quantidade na frente'],
        correta: 1,
        explicacao: 'O nível é a prateleira. O nível 1 fica embaixo.',
      },
      {
        pergunta: 'Onde começa a contagem dos módulos?',
        opcoes: ['Na ponta da gôndola', 'No meio do corredor', 'Na porta da loja'],
        correta: 0,
        explicacao: 'Os módulos são contados a partir da ponta da gôndola.',
      },
    ],
  },
  {
    id: 'estoque',
    titulo: 'Depósito, caixaria, gaveta, intermédio e aéreo',
    resumo: 'Os lugares onde o produto espera antes de ir para a gôndola.',
    minutos: 4,
    topicos: [
      'Depósito: a área de estoque fora da loja, em ruas, módulos e níveis próprios.',
      'Caixaria: blocos de caixas empilhadas, em geral perto do recebimento.',
      'Gaveta: itens pequenos ou de valor, guardados em gaveteiros.',
      'Intermédio e aéreo: estoque em cima da própria gôndola. O aéreo é o mais alto e só se acessa com equipamento.',
      'A ficha do produto lista cada lugar com a quantidade. Comece pelo que a ficha marca como "pegue esta primeiro".',
    ],
    perguntas: [
      {
        pergunta: 'Onde fica o estoque "aéreo"?',
        opcoes: ['No depósito, no chão', 'Em cima da gôndola, no ponto mais alto', 'Na gaveta do balcão'],
        correta: 1,
        explicacao: 'O aéreo fica no alto da gôndola e exige escada ou plataforma, nunca a própria prateleira.',
      },
      {
        pergunta: 'A ficha mostra três caixas no estoque. Qual você pega?',
        opcoes: ['A mais perto de mim', 'A marcada como "pegue esta primeiro"', 'A maior'],
        correta: 1,
        explicacao: 'O Endereça ordena as caixas pela validade. A primeira é a que vence antes.',
      },
    ],
  },
  {
    id: 'validade',
    titulo: 'Validade primeiro: o que vence antes sai antes',
    resumo: 'Como evitar perda por vencimento na hora de repor.',
    minutos: 3,
    topicos: [
      'Na reposição, o produto que vence antes vai para a frente da gôndola.',
      'Produto novo entra atrás do antigo, nunca na frente.',
      'Achou produto vencido ou perto de vencer? Tire da gôndola e avise o líder pelo app.',
      'Perda por validade é dinheiro jogado fora. Quem cuida disso é notado.',
    ],
    perguntas: [
      {
        pergunta: 'Chegou uma caixa nova de iogurte. Onde ela entra na gôndola?',
        opcoes: ['Na frente, para chamar atenção', 'Atrás do que já estava lá', 'Tanto faz'],
        correta: 1,
        explicacao: 'O que já estava vence antes, então fica na frente e sai primeiro.',
      },
      {
        pergunta: 'Encontrou um produto vencido na prateleira. O que fazer?',
        opcoes: ['Deixar para o cliente decidir', 'Tirar da gôndola e avisar o líder', 'Mudar de lugar'],
        correta: 1,
        explicacao: 'Produto vencido não pode ficar à venda. Retire e registre.',
      },
    ],
  },
  {
    id: 'celular',
    titulo: 'O celular de trabalho: bipar, guardar e dar baixa',
    resumo: 'Os três gestos que mantêm o estoque certo.',
    minutos: 4,
    topicos: [
      'Bipar o produto abre a ficha: endereço, estoque, caixas pela validade, preço e vendas.',
      'Guardar: bipe a etiqueta da caixa e depois a do endereço onde guardou. Assim todo mundo acha a caixa depois.',
      'Dar baixa: a caixa acabou? Bipe a etiqueta e toque em "A caixa acabou". Ela sai do estoque.',
      'Sem produto na gôndola? Toque em "Não tem na gôndola": o app diz onde buscar ou avisa o líder.',
      'Sua matrícula e sua palavra secreta são só suas. Nunca empreste o acesso.',
    ],
    perguntas: [
      {
        pergunta: 'Você guardou uma caixa no depósito. O que precisa bipar?',
        opcoes: ['Só a caixa', 'A caixa e depois o endereço', 'Só o endereço'],
        correta: 1,
        explicacao: 'Com os dois, o sistema sabe que aquela caixa está naquele lugar.',
      },
      {
        pergunta: 'Um colega pede sua palavra secreta para entrar no app. O que fazer?',
        opcoes: ['Emprestar, é rápido', 'Não emprestar: o acesso é pessoal', 'Trocar de celular com ele'],
        correta: 1,
        explicacao: 'Tudo o que é feito com sua matrícula fica registrado no seu nome.',
      },
    ],
  },
  {
    id: 'seguranca',
    titulo: 'Segurança: carga, altura e estilete',
    resumo: 'Voltar para casa inteiro todo dia.',
    minutos: 4,
    topicos: [
      'Levante peso dobrando os joelhos e com as costas retas. Caixa pesada demais se leva no carrinho ou com ajuda.',
      'Nunca suba na prateleira. Para o intermédio e o aéreo, use escada ou plataforma.',
      'Estilete com lâmina retrátil, cortando sempre para longe do corpo, e lâmina recolhida ao terminar.',
      'Use o EPI da sua função, como luva e calçado de segurança. Perto da empilhadeira, atenção redobrada.',
      'Corredor livre: palete e caixa vazia não ficam no caminho de cliente nem de colega.',
    ],
    perguntas: [
      {
        pergunta: 'O produto está no aéreo. Como você pega?',
        opcoes: ['Subindo na prateleira de baixo', 'Com escada ou plataforma', 'Puxando com o gancho'],
        correta: 1,
        explicacao: 'A prateleira não é feita para aguentar uma pessoa.',
      },
      {
        pergunta: 'Como usar o estilete?',
        opcoes: ['Cortando em direção ao corpo, para ter firmeza', 'Cortando para longe do corpo e recolhendo a lâmina depois', 'Com a lâmina toda para fora'],
        correta: 1,
        explicacao: 'Cortar para longe do corpo e recolher a lâmina evita os acidentes mais comuns.',
      },
    ],
  },
  {
    id: 'gondola',
    titulo: 'Gôndola sem etiqueta e o leitor de preço',
    resumo: 'Como a loja funciona sem papel na prateleira.',
    minutos: 3,
    topicos: [
      'O Endereça guarda o que vai em cada nível de cada módulo, com o preço de varejo e o de atacado.',
      'Mudou um produto de lugar? Informe o nível e bipe a embalagem. O leitor de preço já mostra o lugar novo.',
      'Se outro produto estava naquela posição, o app pergunta se ele saiu dali antes de trocar.',
      'O cliente consulta o preço no leitor. Se um leitor não funcionar, avise o líder na hora.',
    ],
    perguntas: [
      {
        pergunta: 'Você mudou o arroz do nível 3 para o nível 2. O que fazer no app?',
        opcoes: ['Nada', 'Conferir na gôndola: informar o nível 2 e bipar a embalagem', 'Imprimir uma etiqueta nova'],
        correta: 1,
        explicacao: 'A conferência atualiza o planograma e o leitor de preço, sem papel.',
      },
    ],
  },
];

export interface Nivel {
  nome: string;
  apartir: number;
  descricao: string;
}

/** Níveis por pontos, do primeiro dia até estar pronto para liderar. É uma trilha de exemplo: cada loja ajusta. */
export const NIVEIS: Nivel[] = [
  { nome: 'Aprendiz', apartir: 0, descricao: 'Conhecendo a loja e o celular de trabalho.' },
  { nome: 'Repositor', apartir: 100, descricao: 'Acha qualquer produto e repõe pela validade.' },
  { nome: 'Repositor de referência', apartir: 160, descricao: 'Ensina os novos e mantém o setor sem ruptura.' },
  { nome: 'Pronto para liderar', apartir: 250, descricao: 'Domina o setor, a equipe e os números. Candidato natural a líder.' },
];

export const CARREIRA = [
  { cargo: 'Repositor', foco: 'Gôndola cheia, validade em dia e estoque no lugar certo.' },
  { cargo: 'Líder de setor', foco: 'Organiza a equipe, passa a Boa do Dia e cuida das faltas do setor.' },
  { cargo: 'Gerente operacional', foco: 'Cuida da loja inteira: setores, líderes e resultados.' },
];

export function nivelPorPontos(pontos: number) {
  let atual = NIVEIS[0];
  for (const n of NIVEIS) if (pontos >= n.apartir) atual = n;
  const proximo = NIVEIS[NIVEIS.indexOf(atual) + 1] ?? null;
  return { atual, proximo, faltam: proximo ? proximo.apartir - pontos : 0 };
}
