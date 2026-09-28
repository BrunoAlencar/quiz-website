import pg from "pg";
import { createQuiz, listQuizzes, updateQuiz } from "@/server/repositories/quizzes";
import { validateQuizInput } from "@/lib/validation";
import type { QuizInput } from "@/types";

// Fisher-Yates shuffle so the correct option is not always the first slot.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const q = (
  text: string,
  correct: string,
  wrong: [string, string, string],
) => ({
  text,
  time_limit_seconds: 20,
  points_base: 1000,
  options: shuffle([
    { text: correct, is_correct: true },
    { text: wrong[0], is_correct: false },
    { text: wrong[1], is_correct: false },
    { text: wrong[2], is_correct: false },
  ]),
});

// ---------------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------------
const aiQuiz: QuizInput = {
  title: "IA: Conceitos Gerais",
  description:
    "8 perguntas sobre conceitos fundamentais de Inteligência Artificial: LLMs, tokens, treino e mais.",
  questions: [
    q(
      "O que significa a sigla \"IA\"?",
      "Inteligência Artificial",
      ["Interface Automática", "Integração de Aplicações", "Índice de Aprendizado"],
    ),
    q(
      "O que é um LLM (Large Language Model)?",
      "Um modelo treinado em grande volume de texto para prever e gerar linguagem",
      [
        "Um banco de dados de imagens",
        "Um protocolo de rede para IA",
        "Um tipo de placa de vídeo",
      ],
    ),
    q(
      "O que é \"fine-tuning\" em modelos de IA?",
      "Ajustar um modelo pré-treinado usando dados específicos de uma tarefa",
      [
        "Treinar um modelo do zero sem dados",
        "Aumentar a resolução das imagens de saída",
        "Reduzir o tamanho do disco do servidor",
      ],
    ),
    q(
      "O que é um \"token\" no contexto de modelos de linguagem?",
      "Uma unidade de texto (palavra ou fragmento) processada pelo modelo",
      [
        "Uma senha de acesso à API",
        "Um erro retornado pelo modelo",
        "Um arquivo de configuração do modelo",
      ],
    ),
    q(
      "O que é uma \"alucinação\" (hallucination) de um modelo de IA?",
      "Quando o modelo gera informação incorreta ou inventada com aparência de verdade",
      [
        "Quando o modelo recusa a responder",
        "Quando o modelo trava por falta de memória",
        "Quando o modelo responde em outro idioma",
      ],
    ),
    q(
      "O que é o \"prompt\" enviado a um modelo de linguagem?",
      "A instrução ou entrada em texto que orienta a resposta do modelo",
      [
        "O nome do modelo utilizado",
        "O limite de tokens da conta",
        "O log de erros da execução",
      ],
    ),
    q(
      "O que é aprendizado supervisionado (supervised learning)?",
      "Treinar o modelo com exemplos rotulados (entrada e saída esperada)",
      [
        "Treinar sem nenhum dado",
        "Treinar apenas com dados sem rótulos",
        "Treinar copiando outro modelo pronto",
      ],
    ),
    q(
      "O que é a \"janela de contexto\" (context window) de um LLM?",
      "A quantidade máxima de tokens que o modelo consegue considerar de uma vez",
      [
        "O tempo máximo de resposta do modelo",
        "O número de usuários simultâneos",
        "O tamanho do arquivo de pesos do modelo",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// MCP (Model Context Protocol)
// ---------------------------------------------------------------------------
const mcpQuiz: QuizInput = {
  title: "MCP: Model Context Protocol",
  description:
    "8 perguntas sobre o Model Context Protocol (MCP): objetivo, arquitetura cliente/servidor e recursos.",
  questions: [
    q(
      "No contexto de IA, o que significa a sigla MCP?",
      "Model Context Protocol",
      ["Machine Control Program", "Multi Cloud Platform", "Model Compression Pipeline"],
    ),
    q(
      "Qual é o principal objetivo do MCP?",
      "Padronizar como aplicações de IA se conectam a ferramentas e fontes de dados externas",
      [
        "Comprimir modelos para rodar no celular",
        "Substituir o treinamento de modelos",
        "Criptografar os pesos do modelo",
      ],
    ),
    q(
      "No MCP, o que um \"server\" normalmente expõe para o cliente?",
      "Ferramentas, recursos e prompts que o modelo pode usar",
      [
        "Apenas arquivos de log",
        "Somente imagens estáticas",
        "As credenciais do usuário em texto puro",
      ],
    ),
    q(
      "Quem criou e mantém o Model Context Protocol?",
      "Anthropic",
      ["Google", "Microsoft", "Meta"],
    ),
    q(
      "Qual arquitetura o MCP utiliza?",
      "Cliente-servidor (o host se conecta a um ou mais servidores MCP)",
      [
        "Ponto a ponto sem servidores",
        "Somente monolítica em um único processo",
        "Baseada apenas em e-mail",
      ],
    ),
    q(
      "No MCP, o que é uma \"tool\" (ferramenta)?",
      "Uma ação que o modelo pode invocar para executar algo ou obter dados",
      [
        "Um arquivo de imagem estático",
        "Um tema visual da interface",
        "Uma senha de administrador",
      ],
    ),
    q(
      "No MCP, o que é um \"resource\" (recurso)?",
      "Um dado ou conteúdo que o servidor disponibiliza para ser lido como contexto",
      [
        "Um usuário cadastrado no sistema",
        "Um erro de compilação",
        "Um limite de faturamento da API",
      ],
    ),
    q(
      "Qual é uma vantagem prática de usar MCP?",
      "Reaproveitar a mesma integração em diferentes aplicações de IA compatíveis",
      [
        "Eliminar a necessidade de qualquer modelo",
        "Impedir o acesso a dados externos",
        "Forçar o retreino do modelo a cada uso",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// RAG (Retrieval-Augmented Generation)
// ---------------------------------------------------------------------------
const ragQuiz: QuizInput = {
  title: "RAG: Retrieval-Augmented Generation",
  description:
    "8 perguntas sobre RAG: recuperação de contexto, embeddings, bancos vetoriais e chunking.",
  questions: [
    q(
      "O que significa a sigla RAG?",
      "Retrieval-Augmented Generation",
      ["Random Access Generation", "Rapid API Gateway", "Recursive Agent Graph"],
    ),
    q(
      "Qual é o objetivo principal do RAG?",
      "Enriquecer as respostas do modelo recuperando informações externas relevantes",
      [
        "Treinar o modelo continuamente em tempo real",
        "Remover o contexto para economizar tokens",
        "Gerar imagens a partir de texto",
      ],
    ),
    q(
      "Que tipo de banco de dados é comumente usado para busca semântica em RAG?",
      "Banco de dados vetorial (baseado em embeddings)",
      [
        "Banco de dados relacional puro",
        "Sistema de arquivos em texto plano",
        "Fila de mensagens",
      ],
    ),
    q(
      "O que são \"embeddings\" no contexto de RAG?",
      "Representações numéricas (vetores) que capturam o significado do texto",
      [
        "Comentários embutidos no código",
        "Imagens incorporadas no documento",
        "Chaves de API embutidas na resposta",
      ],
    ),
    q(
      "Por que dividir documentos em \"chunks\" antes de indexá-los?",
      "Para recuperar trechos menores e mais relevantes dentro do limite de contexto",
      [
        "Para aumentar o tamanho dos arquivos",
        "Para apagar informações duplicadas",
        "Para impedir a busca semântica",
      ],
    ),
    q(
      "Em um pipeline RAG típico, o que acontece antes de gerar a resposta?",
      "Recupera-se o contexto relevante e adiciona-se ao prompt do modelo",
      [
        "O modelo é retreinado do zero",
        "Todo o contexto é descartado",
        "O usuário precisa reescrever a pergunta",
      ],
    ),
    q(
      "Qual métrica é comumente usada para medir similaridade entre vetores em RAG?",
      "Similaridade de cosseno (cosine similarity)",
      [
        "Contagem de palavras",
        "Tamanho do arquivo em bytes",
        "Data de criação do documento",
      ],
    ),
    q(
      "Qual é um benefício de usar RAG em vez de depender só do conhecimento do modelo?",
      "Permite respostas baseadas em dados atualizados ou privados sem retreinar o modelo",
      [
        "Elimina a necessidade de qualquer modelo",
        "Garante respostas sempre mais curtas",
        "Impede o modelo de usar o contexto",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Harness (agentes de IA)
// ---------------------------------------------------------------------------
const harnessQuiz: QuizInput = {
  title: "Harness: Orquestração de Agentes de IA",
  description:
    "8 perguntas sobre o harness de agentes: o loop de execução, ferramentas e gerenciamento de contexto.",
  questions: [
    q(
      "No contexto de agentes de IA, o que é um \"harness\"?",
      "A camada que orquestra o modelo, as ferramentas e o loop de execução",
      [
        "Um tipo de modelo de linguagem",
        "Um formato de arquivo de dados",
        "Um banco de dados vetorial",
      ],
    ),
    q(
      "Qual é a função principal de um harness de agente?",
      "Coordenar as chamadas do modelo, a execução de ferramentas e o gerenciamento do contexto",
      [
        "Treinar o modelo com novos dados",
        "Armazenar embeddings de forma permanente",
        "Renderizar a interface gráfica do usuário",
      ],
    ),
    q(
      "O que o loop de um harness de agente normalmente repete?",
      "Enviar contexto ao modelo, executar as ferramentas solicitadas e devolver os resultados",
      [
        "Recompilar o modelo a cada iteração",
        "Apagar todo o histórico a cada passo",
        "Reiniciar o servidor entre as respostas",
      ],
    ),
    q(
      "Por que o gerenciamento de contexto é importante em um harness?",
      "Para manter o histórico relevante dentro do limite de tokens do modelo",
      [
        "Para aumentar a resolução das imagens",
        "Para acelerar o download dos pesos do modelo",
        "Para criptografar as ferramentas usadas",
      ],
    ),
    q(
      "Como um harness normalmente expõe capacidades externas ao modelo?",
      "Por meio de ferramentas (tools) que o modelo pode chamar",
      [
        "Alterando os pesos do modelo em tempo real",
        "Removendo o acesso à internet",
        "Compactando o histórico em imagens",
      ],
    ),
    q(
      "O que acontece quando o modelo, dentro do harness, solicita uma ferramenta?",
      "O harness executa a ferramenta e devolve o resultado ao modelo",
      [
        "O harness ignora a solicitação",
        "O modelo é encerrado imediatamente",
        "O usuário precisa executar manualmente",
      ],
    ),
    q(
      "Qual é uma estratégia comum quando o contexto excede o limite de tokens?",
      "Resumir ou compactar o histórico mais antigo",
      [
        "Duplicar todo o histórico",
        "Aumentar automaticamente o modelo",
        "Apagar a pergunta atual do usuário",
      ],
    ),
    q(
      "Por que um harness costuma pedir confirmação em ações sensíveis?",
      "Para evitar operações destrutivas ou irreversíveis sem autorização",
      [
        "Para consumir mais tokens de propósito",
        "Para impedir qualquer uso de ferramentas",
        "Porque o modelo não sabe ler o contexto",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------
const mongoQuiz: QuizInput = {
  title: "MongoDB: Fundamentos",
  description:
    "8 perguntas sobre fundamentos do MongoDB: documentos, collections, BSON e consultas.",
  questions: [
    q(
      "Que tipo de banco de dados é o MongoDB?",
      "NoSQL orientado a documentos",
      [
        "Relacional (SQL) tradicional",
        "Banco de dados em grafo",
        "Banco de dados chave-valor apenas em memória",
      ],
    ),
    q(
      "Em que formato o MongoDB armazena os documentos internamente?",
      "BSON (uma representação binária de JSON)",
      ["CSV", "XML", "Tabelas com linhas e colunas fixas"],
    ),
    q(
      "Como se chama o agrupamento de documentos no MongoDB?",
      "Collection (coleção)",
      ["Tabela", "Índice", "Schema"],
    ),
    q(
      "Qual campo identificador único cada documento do MongoDB possui por padrão?",
      "_id (normalmente um ObjectId)",
      ["primary_key", "row_id", "uuid_field"],
    ),
    q(
      "Qual comando insere um único documento em uma collection?",
      "insertOne()",
      ["addRow()", "putDocument()", "createRecord()"],
    ),
    q(
      "Qual método é usado para buscar documentos em uma collection?",
      "find()",
      ["select()", "query()", "fetchRows()"],
    ),
    q(
      "O que é uma \"aggregation pipeline\" no MongoDB?",
      "Uma sequência de estágios que processa e transforma documentos",
      [
        "Um backup automático do banco",
        "Uma conexão de rede criptografada",
        "Um índice único obrigatório",
      ],
    ),
    q(
      "Por que criar um índice (index) em um campo no MongoDB?",
      "Para acelerar as consultas que filtram por esse campo",
      [
        "Para reduzir o espaço em disco sempre",
        "Para impedir a leitura do campo",
        "Para converter o documento em CSV",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// MongoDB (avançado)
// ---------------------------------------------------------------------------
const mongoAdvancedQuiz: QuizInput = {
  title: "MongoDB: Avançado",
  description:
    "20 perguntas de nível avançado sobre MongoDB: aggregation, índices, sharding, replica sets, transações e desempenho.",
  questions: [
    q(
      "Qual estágio do aggregation pipeline permite juntar documentos de outra collection (equivalente a um join)?",
      "$lookup",
      ["$merge", "$join", "$union"],
    ),
    q(
      "No aggregation pipeline, qual a diferença entre $match posicionado antes ou depois de $group?",
      "$match antes de $group filtra cedo e pode usar índices, melhorando o desempenho",
      [
        "Não há diferença de desempenho em nenhum caso",
        "$match só funciona depois de $group",
        "$match antes de $group ignora o índice sempre",
      ],
    ),
    q(
      "O que é um índice composto (compound index) no MongoDB?",
      "Um índice sobre múltiplos campos, cuja ordem dos campos importa para as consultas",
      [
        "Um índice que só funciona em arrays",
        "Um índice criado automaticamente em todos os campos",
        "Um índice que combina duas collections",
      ],
    ),
    q(
      "Segundo a regra ESR para índices compostos, qual é a ordem recomendada dos campos?",
      "Equality, Sort, Range",
      ["Range, Sort, Equality", "Sort, Equality, Range", "Equality, Range, Sort"],
    ),
    q(
      "O que é um covered query no MongoDB?",
      "Uma consulta que é totalmente atendida pelo índice, sem ler os documentos",
      [
        "Uma consulta que percorre toda a collection",
        "Uma consulta protegida por transação",
        "Uma consulta que usa apenas o campo _id",
      ],
    ),
    q(
      "Qual comando/ferramenta mostra o plano de execução de uma consulta?",
      "explain()",
      ["analyze()", "profile()", "describe()"],
    ),
    q(
      "No output do explain(), o que indica um estágio COLLSCAN?",
      "Uma varredura completa da collection, sem uso de índice",
      [
        "Que um índice foi usado com eficiência",
        "Que a consulta usou uma transação",
        "Que houve um erro de sintaxe",
      ],
    ),
    q(
      "O que é a shard key no MongoDB?",
      "O campo (ou campos) usado para distribuir os documentos entre os shards",
      [
        "A chave de criptografia do cluster",
        "O identificador do replica set primário",
        "A senha de acesso ao mongos",
      ],
    ),
    q(
      "Qual componente roteia as consultas dos clientes em um cluster com sharding?",
      "O mongos (query router)",
      ["O config server", "O secondary", "O arbiter"],
    ),
    q(
      "Qual é uma desvantagem de uma shard key monotonicamente crescente (ex.: timestamp)?",
      "Concentra as escritas em um único shard (hotspotting)",
      [
        "Distribui as escritas de forma perfeitamente uniforme",
        "Impede totalmente a leitura dos dados",
        "Elimina a necessidade de índices",
      ],
    ),
    q(
      "Em um replica set, o que acontece quando o nó primário fica indisponível?",
      "Ocorre uma eleição e um secundário elegível pode se tornar o novo primário",
      [
        "O cluster para permanentemente",
        "Todos os dados são apagados",
        "Um novo shard é criado automaticamente",
      ],
    ),
    q(
      "Qual é o papel de um arbiter em um replica set?",
      "Participa das eleições votando, mas não armazena dados",
      [
        "Armazena uma cópia completa dos dados",
        "Roteia as consultas dos clientes",
        "Faz backup automático dos dados",
      ],
    ),
    q(
      "O que o write concern \"majority\" garante?",
      "Que a escrita foi reconhecida pela maioria dos nós que armazenam dados",
      [
        "Que a escrita foi feita apenas em memória",
        "Que a escrita ignora o journal",
        "Que a escrita foi replicada para todos os shards",
      ],
    ),
    q(
      "O que o read preference \"secondaryPreferred\" faz?",
      "Lê de um secundário quando disponível, caindo para o primário se necessário",
      [
        "Lê sempre apenas do primário",
        "Bloqueia todas as leituras",
        "Lê de todos os nós simultaneamente e mescla",
      ],
    ),
    q(
      "A partir de qual versão o MongoDB passou a suportar transações ACID multi-documento em replica sets?",
      "4.0",
      ["3.2", "2.6", "5.0"],
    ),
    q(
      "O que é o padrão de modelagem de dados por \"embedding\" (documentos aninhados)?",
      "Armazenar dados relacionados dentro do mesmo documento para leituras rápidas",
      [
        "Sempre separar os dados em collections distintas",
        "Criptografar os dados dentro do documento",
        "Distribuir os dados entre vários shards obrigatoriamente",
      ],
    ),
    q(
      "Qual limite de tamanho um único documento BSON possui no MongoDB?",
      "16 MB",
      ["1 MB", "256 MB", "1 GB"],
    ),
    q(
      "Para armazenar arquivos maiores que o limite de um documento, o que o MongoDB oferece?",
      "GridFS",
      ["BigDoc", "BlobStore", "FileShard"],
    ),
    q(
      "O que é um TTL index no MongoDB?",
      "Um índice que remove documentos automaticamente após um tempo definido",
      [
        "Um índice que acelera transações",
        "Um índice exclusivo para o campo _id",
        "Um índice que impede a exclusão de documentos",
      ],
    ),
    q(
      "Qual operador de atualização adiciona um elemento a um array apenas se ele ainda não existir?",
      "$addToSet",
      ["$push", "$append", "$insert"],
    ),
  ],
};

// ---------------------------------------------------------------------------
// System Design (Fácil)
// ---------------------------------------------------------------------------
const systemDesignEasyQuiz: QuizInput = {
  title: "System Design: Fundamentos (Fácil)",
  description:
    "15 perguntas de nível fácil sobre fundamentos de system design: cliente-servidor, cache, DNS, load balancer, escalabilidade e mais.",
  questions: [
    q(
      "O que descreve a arquitetura cliente-servidor?",
      "O cliente faz requisições e o servidor responde com recursos ou serviços",
      [
        "Todos os computadores têm exatamente o mesmo papel",
        "Um único computador executa tudo sem rede",
        "Os dados só existem no navegador do usuário",
      ],
    ),
    q(
      "O que faz um load balancer (balanceador de carga)?",
      "Distribui as requisições entre vários servidores",
      [
        "Armazena os dados de forma permanente",
        "Criptografa o banco de dados",
        "Compila o código da aplicação",
      ],
    ),
    q(
      "Para que serve o DNS?",
      "Traduzir nomes de domínio em endereços IP",
      [
        "Armazenar sessões de usuário",
        "Comprimir imagens do site",
        "Balancear a carga entre bancos de dados",
      ],
    ),
    q(
      "O que é latência em um sistema?",
      "O tempo que uma requisição leva para ir e voltar (o atraso)",
      [
        "A quantidade de dados armazenados",
        "O número de servidores disponíveis",
        "A quantidade de usuários cadastrados",
      ],
    ),
    q(
      "O que significa throughput (vazão)?",
      "A quantidade de requisições processadas por unidade de tempo",
      [
        "O tempo de resposta de uma única requisição",
        "O espaço livre em disco",
        "O número de linhas de código",
      ],
    ),
    q(
      "Qual a diferença entre escala vertical e horizontal?",
      "Vertical adiciona mais recursos a uma máquina; horizontal adiciona mais máquinas",
      [
        "Vertical adiciona máquinas; horizontal adiciona memória",
        "As duas significam exatamente a mesma coisa",
        "Vertical só funciona em bancos NoSQL",
      ],
    ),
    q(
      "Para que serve um cache?",
      "Armazenar dados acessados com frequência para respostas mais rápidas",
      [
        "Guardar backups de longo prazo",
        "Substituir o banco de dados principal para sempre",
        "Criptografar as senhas dos usuários",
      ],
    ),
    q(
      "O que é uma API?",
      "Uma interface que permite a comunicação entre sistemas",
      [
        "Um tipo de banco de dados relacional",
        "Um servidor físico de alta performance",
        "Um protocolo de criptografia de disco",
      ],
    ),
    q(
      "O que caracteriza um serviço \"stateless\" (sem estado)?",
      "Cada requisição é independente e não depende de estado guardado no servidor",
      [
        "O servidor guarda toda a sessão do usuário em memória",
        "O serviço só funciona com um único usuário por vez",
        "O serviço nunca acessa nenhum banco de dados",
      ],
    ),
    q(
      "O que é uma CDN (Content Delivery Network)?",
      "Uma rede de servidores distribuídos que entrega conteúdo próximo ao usuário",
      [
        "Um banco de dados central único",
        "Um algoritmo de compressão de vídeo",
        "Um protocolo de autenticação",
      ],
    ),
    q(
      "Qual protocolo é a base da comunicação na web?",
      "HTTP/HTTPS",
      ["FTP", "SMTP", "SSH"],
    ),
    q(
      "O que o HTTPS adiciona em relação ao HTTP?",
      "Criptografia da comunicação por meio de TLS",
      [
        "Maior velocidade sem qualquer segurança",
        "Compressão obrigatória de todas as imagens",
        "A eliminação da necessidade de servidores",
      ],
    ),
    q(
      "O que é um banco de dados relacional?",
      "Um banco que organiza os dados em tabelas com linhas e colunas",
      [
        "Um banco que só guarda arquivos de imagem",
        "Um banco sem qualquer estrutura ou esquema",
        "Um banco que roda apenas na memória do cliente",
      ],
    ),
    q(
      "Qual a função de uma fila (queue) em um sistema?",
      "Armazenar tarefas para processamento assíncrono, em ordem",
      [
        "Servir páginas HTML diretamente ao navegador",
        "Substituir o balanceador de carga",
        "Criptografar o tráfego de rede",
      ],
    ),
    q(
      "O que é redundância em system design?",
      "Ter componentes duplicados para evitar um ponto único de falha",
      [
        "Remover todos os componentes desnecessários",
        "Executar o sistema em um único servidor",
        "Apagar dados repetidos do banco",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// System Design (Médio)
// ---------------------------------------------------------------------------
const systemDesignMediumQuiz: QuizInput = {
  title: "System Design: Intermediário (Médio)",
  description:
    "15 perguntas de nível intermediário sobre system design: sharding, replicação, CAP, filas, rate limiting, microserviços e mais.",
  questions: [
    q(
      "O que é sharding (particionamento) de banco de dados?",
      "Dividir os dados em partições distribuídas entre vários servidores",
      [
        "Fazer uma cópia idêntica em cada servidor",
        "Criptografar todas as tabelas do banco",
        "Compactar os dados em um único arquivo",
      ],
    ),
    q(
      "Na replicação leader-follower, quem recebe as escritas?",
      "O leader (primário), que depois replica para os followers",
      [
        "Qualquer follower, aleatoriamente",
        "Todos os nós ao mesmo tempo, sem coordenação",
        "Apenas o cliente, sem envolver o servidor",
      ],
    ),
    q(
      "O que o teorema CAP afirma?",
      "Sob uma partição de rede, escolhe-se entre consistência e disponibilidade",
      [
        "É possível garantir consistência, disponibilidade e partição sempre",
        "Bancos NoSQL não podem ser distribuídos",
        "A latência é sempre igual à vazão",
      ],
    ),
    q(
      "O que é consistência eventual (eventual consistency)?",
      "As réplicas convergem para o mesmo valor com o tempo, sem garantia imediata",
      [
        "Todas as réplicas ficam idênticas instantaneamente",
        "Os dados nunca ficam consistentes entre réplicas",
        "A escrita é bloqueada até todos concordarem",
      ],
    ),
    q(
      "Para que serve o rate limiting?",
      "Limitar quantas requisições um cliente pode fazer em um período",
      [
        "Aumentar a velocidade de todas as requisições",
        "Armazenar as requisições em cache permanente",
        "Distribuir os dados entre shards",
      ],
    ),
    q(
      "Por que criar um índice em um banco de dados?",
      "Para acelerar as consultas que filtram por aquele campo",
      [
        "Para reduzir sempre o espaço em disco",
        "Para impedir a leitura de certos campos",
        "Para criptografar automaticamente a tabela",
      ],
    ),
    q(
      "Qual a vantagem de microserviços sobre um monólito?",
      "Permitem escalar e implantar serviços de forma independente",
      [
        "Eliminam totalmente a comunicação em rede",
        "Garantem que nunca haverá falhas",
        "Dispensam bancos de dados por completo",
      ],
    ),
    q(
      "O que é idempotência em uma operação?",
      "Executá-la várias vezes produz o mesmo resultado que executá-la uma vez",
      [
        "A operação só pode ser executada uma única vez para sempre",
        "A operação sempre falha na segunda tentativa",
        "A operação depende da ordem dos usuários",
      ],
    ),
    q(
      "Para que serve um health check em um serviço?",
      "Verificar se a instância está saudável para receber tráfego",
      [
        "Fazer backup automático dos dados",
        "Criptografar as respostas ao cliente",
        "Aumentar o limite de memória do servidor",
      ],
    ),
    q(
      "Qual a diferença entre cache write-through e write-back?",
      "Write-through grava no cache e no banco juntos; write-back grava no banco depois",
      [
        "Write-through nunca grava no banco de dados",
        "Write-back grava no cache e no banco ao mesmo tempo",
        "Não há diferença entre os dois",
      ],
    ),
    q(
      "O que é uma dead-letter queue?",
      "Uma fila que recebe mensagens que não puderam ser processadas",
      [
        "Uma fila que só aceita mensagens prioritárias",
        "Uma fila que apaga mensagens automaticamente sem processar",
        "Uma fila usada apenas para logs de acesso",
      ],
    ),
    q(
      "O que é um proxy reverso?",
      "Um servidor que recebe requisições dos clientes e as encaminha ao backend",
      [
        "Um cliente que acessa a internet sem servidor",
        "Um banco de dados replicado em cada região",
        "Um algoritmo de compressão de dados",
      ],
    ),
    q(
      "O que é a estratégia \"database per service\" em microserviços?",
      "Cada serviço possui seu próprio banco de dados privado",
      [
        "Todos os serviços compartilham um único banco global",
        "Nenhum serviço pode usar banco de dados",
        "O banco é substituído por arquivos de texto",
      ],
    ),
    q(
      "Qual a diferença entre polling e webhook?",
      "Polling consulta repetidamente; webhook notifica quando o evento ocorre",
      [
        "Polling notifica em tempo real; webhook consulta em loop",
        "Os dois consomem exatamente os mesmos recursos",
        "Webhook só funciona dentro de um monólito",
      ],
    ),
    q(
      "O que é uma sticky session?",
      "Quando o load balancer envia as requisições de um mesmo usuário ao mesmo servidor",
      [
        "Quando a sessão nunca expira no navegador",
        "Quando o servidor descarta o estado a cada requisição",
        "Quando todos os servidores compartilham a mesma senha",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// System Design (Difícil)
// ---------------------------------------------------------------------------
const systemDesignHardQuiz: QuizInput = {
  title: "System Design: Avançado (Difícil)",
  description:
    "15 perguntas de nível avançado sobre system design: consenso, consistent hashing, quorum, CRDTs, saga, WAL e mais.",
  questions: [
    q(
      "Qual é o objetivo de um algoritmo de consenso como Raft ou Paxos?",
      "Fazer múltiplos nós concordarem sobre um valor de forma tolerante a falhas",
      [
        "Comprimir os dados replicados entre os nós",
        "Criptografar a comunicação entre serviços",
        "Balancear a carga entre servidores web",
      ],
    ),
    q(
      "O que é consistent hashing?",
      "Uma técnica de distribuição que minimiza a realocação de chaves ao mudar de nós",
      [
        "Uma função de hash que gera sempre o mesmo IP",
        "Um algoritmo que criptografa as chaves do cache",
        "Uma forma de ordenar tabelas alfabeticamente",
      ],
    ),
    q(
      "Na configuração de quorum, o que a condição R + W > N garante?",
      "Que os conjuntos de leitura e escrita se sobrepõem, permitindo leitura consistente",
      [
        "Que a escrita é sempre mais rápida que a leitura",
        "Que nenhum nó precisa replicar dados",
        "Que o sistema nunca fica indisponível",
      ],
    ),
    q(
      "Para que servem os vector clocks?",
      "Detectar a ordem causal e conflitos entre eventos em sistemas distribuídos",
      [
        "Sincronizar o relógio físico de todos os servidores",
        "Medir a latência da rede em milissegundos",
        "Criptografar o timestamp de cada requisição",
      ],
    ),
    q(
      "O que é um CRDT (Conflict-free Replicated Data Type)?",
      "Uma estrutura de dados que converge automaticamente sem coordenação central",
      [
        "Um tipo de índice exclusivo para bancos SQL",
        "Um protocolo de commit em duas fases",
        "Um algoritmo de compressão sem perdas",
      ],
    ),
    q(
      "O que é o padrão Saga em transações distribuídas?",
      "Uma sequência de transações locais com compensações em caso de falha",
      [
        "Um bloqueio global em todos os serviços ao mesmo tempo",
        "Uma única transação ACID entre todos os bancos",
        "Um cache distribuído entre microserviços",
      ],
    ),
    q(
      "O que é o Two-Phase Commit (2PC)?",
      "Um protocolo de commit atômico coordenado em duas fases: prepare e commit",
      [
        "Um algoritmo de balanceamento de carga em dois níveis",
        "Uma técnica de particionamento de dados em dois shards",
        "Um esquema de cache com duas camadas",
      ],
    ),
    q(
      "O que é backpressure em um sistema de streaming?",
      "Um mecanismo para o consumidor sinalizar que não acompanha o produtor",
      [
        "Um aumento automático da taxa de envio do produtor",
        "Uma forma de comprimir mensagens na fila",
        "Um algoritmo de criptografia de fluxo",
      ],
    ),
    q(
      "Para que serve um Bloom filter?",
      "Testar de forma probabilística se um elemento pode estar em um conjunto",
      [
        "Garantir com certeza absoluta a presença de um elemento",
        "Ordenar elementos de um conjunto por relevância",
        "Criptografar as chaves de um índice",
      ],
    ),
    q(
      "O que é uma \"hot partition\" (partição quente)?",
      "Uma partição que recebe tráfego desproporcional e vira um gargalo",
      [
        "Uma partição mantida apenas em memória rápida",
        "Uma partição que nunca recebe requisições",
        "Uma partição criptografada por padrão",
      ],
    ),
    q(
      "Para que serve um Write-Ahead Log (WAL)?",
      "Registrar as alterações antes de aplicá-las, garantindo durabilidade e recuperação",
      [
        "Guardar apenas logs de acesso dos usuários",
        "Comprimir o banco de dados periodicamente",
        "Distribuir a carga entre réplicas de leitura",
      ],
    ),
    q(
      "O que caracteriza uma leitura linearizável (linearizability)?",
      "Toda leitura enxerga a escrita mais recente, como se houvesse uma única cópia",
      [
        "As leituras podem retornar valores antigos indefinidamente",
        "As escritas são aplicadas em ordem aleatória",
        "As leituras nunca bloqueiam, mesmo sob conflito",
      ],
    ),
    q(
      "O que é o problema de \"split-brain\" em sistemas distribuídos?",
      "Quando uma partição de rede faz dois nós agirem como líder ao mesmo tempo",
      [
        "Quando um nó perde toda a sua memória cache",
        "Quando o banco de dados excede o limite de disco",
        "Quando dois clientes usam a mesma senha",
      ],
    ),
    q(
      "Para que serve o mecanismo de leader election?",
      "Escolher um único nó coordenador entre vários nós",
      [
        "Distribuir dados uniformemente entre shards",
        "Criptografar a comunicação entre os nós",
        "Eliminar a necessidade de réplicas",
      ],
    ),
    q(
      "O que é MVCC (Multi-Version Concurrency Control)?",
      "Manter múltiplas versões dos dados para permitir leituras sem bloquear escritas",
      [
        "Executar uma única versão do dado por vez, com lock global",
        "Criar uma cópia física do banco a cada leitura",
        "Impedir qualquer escrita concorrente no sistema",
      ],
    ),
  ],
};

const quizzes: QuizInput[] = [
  aiQuiz,
  mcpQuiz,
  ragQuiz,
  harnessQuiz,
  mongoQuiz,
  mongoAdvancedQuiz,
  systemDesignEasyQuiz,
  systemDesignMediumQuiz,
  systemDesignHardQuiz,
];

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  for (const quiz of quizzes) {
    const check = validateQuizInput(quiz);
    if (!check.valid) {
      console.error(
        `Quiz "${quiz.title}" failed validation:\n` + check.errors.join("\n"),
      );
      process.exit(1);
    }
  }

  const pool = new pg.Pool({ connectionString });
  try {
    // Look up existing quizzes so we can upsert by title (title match is
    // case-insensitive, trimmed) instead of creating duplicates on re-runs.
    const existing = await listQuizzes(pool);
    const byTitle = new Map(
      existing.map((q) => [q.title.trim().toLowerCase(), q.id]),
    );

    let created = 0;
    let updated = 0;
    for (const quiz of quizzes) {
      const existingId = byTitle.get(quiz.title.trim().toLowerCase());
      if (existingId) {
        await updateQuiz(pool, existingId, quiz);
        updated++;
        console.log(
          `Updated quiz "${quiz.title}" (${quiz.questions.length} questions) — id: ${existingId}`,
        );
      } else {
        const id = await createQuiz(pool, quiz);
        created++;
        console.log(
          `Created quiz "${quiz.title}" (${quiz.questions.length} questions) — id: ${id}`,
        );
      }
    }
    console.log(`\nDone. Created ${created}, updated ${updated}.`);
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
