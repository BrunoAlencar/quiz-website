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
  time_limit_seconds: 30,
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
      ["Interface Automática", "Integração de Aplicações e Algoritmos", "Índice de Aprendizado"],
    ),
    q(
      "O que é um LLM (Large Language Model)?",
      "Um modelo treinado em muito texto para gerar linguagem",
      [
        "Um banco de dados especializado em imagens de alta resolução",
        "Um protocolo de rede para IA",
        "Um tipo de placa de vídeo para jogos",
      ],
    ),
    q(
      "O que é \"fine-tuning\" em modelos de IA?",
      "Ajustar um modelo pré-treinado com dados de uma tarefa",
      [
        "Treinar um modelo do zero, sem usar nenhum dado prévio",
        "Aumentar a resolução das imagens de saída",
        "Reduzir o espaço em disco do servidor onde o modelo está rodando",
      ],
    ),
    q(
      "O que é um \"token\" no contexto de modelos de linguagem?",
      "Uma unidade de texto processada pelo modelo",
      [
        "Uma senha de acesso à API usada para autenticar as chamadas",
        "Um erro retornado pelo modelo",
        "Um arquivo de configuração",
      ],
    ),
    q(
      "O que é uma \"alucinação\" (hallucination) de um modelo de IA?",
      "Quando o modelo inventa uma informação falsa que parece verdadeira",
      [
        "Quando o modelo se recusa a responder",
        "Quando o modelo trava por falta de memória e reinicia sozinho",
        "Quando o modelo passa a responder sempre em um idioma diferente do pedido",
      ],
    ),
    q(
      "O que é o \"prompt\" enviado a um modelo de linguagem?",
      "A instrução em texto que orienta a resposta",
      [
        "O nome do modelo utilizado na conta",
        "O limite de tokens disponível na assinatura contratada",
        "O log de erros da execução",
      ],
    ),
    q(
      "O que é aprendizado supervisionado (supervised learning)?",
      "Treinar o modelo com exemplos rotulados (entrada e saída)",
      [
        "Treinar sem nenhum dado",
        "Treinar apenas com dados sem rótulos, deixando o modelo agrupar sozinho",
        "Treinar copiando outro modelo pronto",
      ],
    ),
    q(
      "O que é a \"janela de contexto\" (context window) de um LLM?",
      "O máximo de tokens que o modelo considera de uma vez",
      [
        "O tempo máximo que o modelo pode levar para responder cada pergunta",
        "O número de usuários simultâneos",
        "O tamanho do arquivo de pesos",
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
      "Padronizar como a IA se conecta a ferramentas e dados externos",
      [
        "Comprimir modelos grandes para rodar localmente em celulares e tablets",
        "Substituir o treinamento de modelos",
        "Criptografar os pesos",
      ],
    ),
    q(
      "No MCP, o que um \"server\" normalmente expõe para o cliente?",
      "Ferramentas, recursos e prompts que o modelo pode usar",
      [
        "Apenas os arquivos de log e o histórico de execução do servidor",
        "Somente imagens estáticas guardadas no servidor",
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
      "Cliente-servidor (o host se conecta a servidores MCP)",
      [
        "Ponto a ponto entre os hosts, sem nenhum servidor central envolvido",
        "Somente monolítica em um único processo",
        "Baseada apenas em e-mail",
      ],
    ),
    q(
      "No MCP, o que é uma \"tool\" (ferramenta)?",
      "Uma ação que o modelo pode invocar para obter dados",
      [
        "Um arquivo de imagem estático guardado no servidor",
        "Um tema visual que muda a aparência da interface do usuário",
        "Uma senha de administrador",
      ],
    ),
    q(
      "No MCP, o que é um \"resource\" (recurso)?",
      "Um dado que o servidor disponibiliza para ser lido como contexto",
      [
        "Um usuário previamente cadastrado no sistema de contas e permissões",
        "Um erro de compilação que impede o build do projeto",
        "Um limite de faturamento da API",
      ],
    ),
    q(
      "Qual é uma vantagem prática de usar MCP?",
      "Reaproveitar a mesma integração em várias aplicações compatíveis",
      [
        "Eliminar a necessidade de qualquer modelo",
        "Impedir por completo o acesso a dados que estejam fora do modelo",
        "Forçar o retreino a cada uso",
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
      "Enriquecer as respostas recuperando informação externa relevante",
      [
        "Treinar o modelo continuamente, em tempo real, a cada pergunta feita",
        "Remover o contexto para poupar tokens",
        "Gerar imagens a partir de texto",
      ],
    ),
    q(
      "Que tipo de banco de dados é comumente usado para busca semântica em RAG?",
      "Banco de dados vetorial, baseado em embeddings",
      [
        "Banco de dados relacional puro",
        "Sistema de arquivos em texto plano, sem nenhum índice",
        "Fila de mensagens",
      ],
    ),
    q(
      "O que são \"embeddings\" no contexto de RAG?",
      "Vetores numéricos que capturam o significado do texto",
      [
        "Comentários embutidos no meio do código-fonte",
        "Imagens incorporadas diretamente dentro do documento",
        "Chaves de API na resposta",
      ],
    ),
    q(
      "Por que dividir documentos em \"chunks\" antes de indexá-los?",
      "Para recuperar trechos menores e mais relevantes",
      [
        "Para aumentar o tamanho total dos arquivos armazenados no índice",
        "Para apagar informações duplicadas",
        "Para impedir a busca semântica",
      ],
    ),
    q(
      "Em um pipeline RAG típico, o que acontece antes de gerar a resposta?",
      "Recupera-se o contexto relevante e o adiciona ao prompt",
      [
        "O modelo é retreinado do zero a cada nova pergunta recebida",
        "Todo o contexto é descartado",
        "O usuário reescreve a pergunta",
      ],
    ),
    q(
      "Qual métrica é comumente usada para medir similaridade entre vetores em RAG?",
      "Similaridade de cosseno (cosine similarity)",
      [
        "Contagem de palavras",
        "O tamanho do arquivo do documento medido em bytes",
        "Data de criação",
      ],
    ),
    q(
      "Qual é um benefício de usar RAG em vez de depender só do conhecimento do modelo?",
      "Responder com dados atualizados ou privados sem retreinar o modelo",
      [
        "Elimina a necessidade de qualquer modelo",
        "Garante que as respostas geradas serão sempre bem mais curtas e diretas",
        "Impede o modelo de usar o contexto recuperado na busca",
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
      "A camada que orquestra o modelo, as ferramentas e o loop",
      [
        "Um tipo de modelo de linguagem",
        "Um formato de arquivo de dados usado no treino",
        "Um banco de dados vetorial usado para guardar os embeddings do modelo",
      ],
    ),
    q(
      "Qual é a função principal de um harness de agente?",
      "Coordenar as chamadas do modelo, a execução de ferramentas e o contexto",
      [
        "Treinar o modelo com novos dados",
        "Armazenar embeddings de forma permanente em disco",
        "Renderizar a interface gráfica e todos os elementos visuais da aplicação",
      ],
    ),
    q(
      "O que o loop de um harness de agente normalmente repete?",
      "Enviar contexto, executar as ferramentas pedidas e devolver o resultado",
      [
        "Recompilar o modelo inteiro a cada nova iteração do loop de execução do agente",
        "Apagar todo o histórico acumulado a cada passo do loop",
        "Reiniciar o servidor entre respostas",
      ],
    ),
    q(
      "Por que o gerenciamento de contexto é importante em um harness?",
      "Para manter o histórico relevante dentro do limite de tokens",
      [
        "Para aumentar a resolução das imagens",
        "Para acelerar o download dos pesos do modelo ao iniciar",
        "Para criptografar as ferramentas usadas",
      ],
    ),
    q(
      "Como um harness normalmente expõe capacidades externas ao modelo?",
      "Por meio de ferramentas (tools) que o modelo pode chamar",
      [
        "Alterando os pesos do modelo em tempo real, a cada chamada",
        "Removendo o acesso à internet",
        "Compactando o histórico em imagens",
      ],
    ),
    q(
      "O que acontece quando o modelo, dentro do harness, solicita uma ferramenta?",
      "O harness executa a ferramenta e devolve o resultado ao modelo",
      [
        "O harness ignora a solicitação",
        "O modelo é encerrado imediatamente, sem devolver resposta",
        "O usuário executa manualmente",
      ],
    ),
    q(
      "Qual é uma estratégia comum quando o contexto excede o limite de tokens?",
      "Resumir ou compactar o histórico mais antigo",
      [
        "Duplicar todo o histórico existente e concatenar no início",
        "Aumentar automaticamente o modelo",
        "Apagar a pergunta atual do usuário",
      ],
    ),
    q(
      "Por que um harness costuma pedir confirmação em ações sensíveis?",
      "Para evitar operações destrutivas ou irreversíveis sem autorização",
      [
        "Para consumir mais tokens de propósito",
        "Para impedir por completo qualquer uso de ferramentas pelo modelo",
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
        "Chave-valor apenas em memória, sem persistência em disco",
      ],
    ),
    q(
      "Em que formato o MongoDB armazena os documentos internamente?",
      "BSON, uma representação binária de JSON",
      ["CSV", "XML", "Tabelas com linhas e colunas de tamanho fixo"],
    ),
    q(
      "Como se chama o agrupamento de documentos no MongoDB?",
      "Collection (coleção)",
      ["Tabela de registros relacionais", "Índice do banco", "Schema fixo"],
    ),
    q(
      "Qual campo identificador único cada documento do MongoDB possui por padrão?",
      "_id, normalmente um ObjectId",
      ["primary_key (chave primária automática)", "row_id", "uuid_field"],
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
        "Uma conexão de rede criptografada entre o cliente e o servidor",
        "Um índice único obrigatório",
      ],
    ),
    q(
      "Por que criar um índice (index) em um campo no MongoDB?",
      "Para acelerar as consultas que filtram por esse campo",
      [
        "Para reduzir o espaço em disco em qualquer situação",
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
      "$match antes de $group filtra cedo e pode aproveitar índices",
      [
        "$match posicionado após $group não altera em nada o plano de execução da consulta",
        "$match só funciona depois de $group",
        "$match antes de $group sempre ignora o índice",
      ],
    ),
    q(
      "O que é um índice composto (compound index) no MongoDB?",
      "Um índice sobre múltiplos campos, onde a ordem deles importa",
      [
        "Um índice que só funciona em arrays",
        "Um índice criado automaticamente em todos os campos da collection",
        "Um índice que junta duas collections",
      ],
    ),
    q(
      "Segundo a regra ESR para índices compostos, qual é a ordem recomendada dos campos?",
      "Equality, Sort, Range",
      ["Range, Sort, Equality", "Sort, Equality, Range", "Equality, Range, Sort"],
    ),
    q(
      "O que é um covered query no MongoDB?",
      "Uma consulta atendida totalmente pelo índice, sem ler os documentos",
      [
        "Uma consulta que percorre toda a collection",
        "Uma consulta protegida por uma transação ACID de múltiplos documentos",
        "Uma consulta que usa apenas o campo _id como filtro principal",
      ],
    ),
    q(
      "Qual comando/ferramenta mostra o plano de execução de uma consulta?",
      "explain()",
      ["analyze()", "profile()", "describe()"],
    ),
    q(
      "No output do explain(), o que indica um estágio COLLSCAN?",
      "Uma varredura completa da collection, sem usar índice",
      [
        "Que um índice foi usado com a máxima eficiência na consulta",
        "Que a consulta usou uma transação",
        "Que houve um erro de sintaxe",
      ],
    ),
    q(
      "O que é a shard key no MongoDB?",
      "O campo usado para distribuir os documentos entre os shards",
      [
        "A chave de criptografia usada para proteger todo o cluster",
        "O identificador do replica set primário",
        "A senha de acesso ao mongos",
      ],
    ),
    q(
      "Qual componente roteia as consultas dos clientes em um cluster com sharding?",
      "O mongos (query router)",
      ["O config server do cluster de metadados", "O secondary", "O arbiter"],
    ),
    q(
      "Qual é uma desvantagem de uma shard key monotonicamente crescente (ex.: timestamp)?",
      "Concentra as escritas em um único shard (hotspotting)",
      [
        "Distribui as escritas de forma perfeitamente uniforme entre os shards",
        "Impede totalmente a leitura dos dados",
        "Elimina a necessidade de índices",
      ],
    ),
    q(
      "Em um replica set, o que acontece quando o nó primário fica indisponível?",
      "Ocorre uma eleição e um secundário elegível vira o novo primário",
      [
        "O cluster para permanentemente",
        "Todos os dados são apagados",
        "Um novo shard é criado automaticamente para assumir o papel",
      ],
    ),
    q(
      "Qual é o papel de um arbiter em um replica set?",
      "Participa das eleições votando, mas não armazena dados",
      [
        "Armazena uma cópia completa de todos os dados do replica set",
        "Roteia as consultas dos clientes",
        "Faz backup automático dos dados",
      ],
    ),
    q(
      "O que o write concern \"majority\" garante?",
      "Que a escrita foi reconhecida pela maioria dos nós com dados",
      [
        "Que a escrita foi feita apenas em memória",
        "Que a escrita ignora completamente o journal de recuperação",
        "Que a escrita replicou para todos os shards",
      ],
    ),
    q(
      "O que o read preference \"secondaryPreferred\" faz?",
      "Lê de um secundário quando há um disponível, senão do primário",
      [
        "Lê sempre apenas do primário",
        "Bloqueia todas as leituras até a replicação terminar",
        "Lê de todos os nós disponíveis ao mesmo tempo e mescla os resultados",
      ],
    ),
    q(
      "A partir de qual versão o MongoDB passou a suportar transações ACID multi-documento em replica sets?",
      "4.0",
      ["3.2", "2.6", "5.0"],
    ),
    q(
      "O que é o padrão de modelagem de dados por \"embedding\" (documentos aninhados)?",
      "Guardar dados relacionados no mesmo documento para leituras rápidas",
      [
        "Sempre separar os dados em collections distintas",
        "Criptografar os dados aninhados dentro do documento principal",
        "Distribuir entre vários shards",
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
      "Um índice que remove documentos automaticamente após um tempo",
      [
        "Um índice especial que acelera as transações e as escritas concorrentes",
        "Um índice exclusivo reservado apenas para o campo _id",
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
      "O cliente faz requisições e o servidor responde com recursos",
      [
        "Todos os computadores têm exatamente o mesmo papel na rede",
        "Um único computador executa tudo, sem rede",
        "Os dados só existem no navegador",
      ],
    ),
    q(
      "O que faz um load balancer (balanceador de carga)?",
      "Distribui as requisições entre vários servidores",
      [
        "Armazena os dados de forma permanente em disco redundante",
        "Criptografa o banco de dados",
        "Compila o código da aplicação",
      ],
    ),
    q(
      "Para que serve o DNS?",
      "Traduzir nomes de domínio em endereços IP",
      [
        "Armazenar as sessões ativas de cada usuário logado",
        "Comprimir imagens do site",
        "Balancear a carga entre bancos",
      ],
    ),
    q(
      "O que é latência em um sistema?",
      "O tempo que uma requisição leva para ir e voltar",
      [
        "A quantidade total de dados armazenados no sistema",
        "O número de servidores disponíveis",
        "A quantidade de usuários cadastrados",
      ],
    ),
    q(
      "O que significa throughput (vazão)?",
      "A quantidade de requisições processadas por unidade de tempo",
      [
        "O tempo de resposta de uma única requisição isolada",
        "O espaço livre em disco disponível para novas gravações no sistema",
        "O número de linhas de código",
      ],
    ),
    q(
      "Qual a diferença entre escala vertical e horizontal?",
      "Vertical adiciona recursos a uma máquina; horizontal adiciona máquinas",
      [
        "Vertical adiciona máquinas; horizontal adiciona memória",
        "As duas significam exatamente a mesma coisa",
        "A escala vertical só funciona em bancos de dados NoSQL modernos, nunca em SQL",
      ],
    ),
    q(
      "Para que serve um cache?",
      "Guardar dados acessados com frequência para respostas mais rápidas",
      [
        "Guardar cópias de backup de longo prazo dos dados mais importantes do sistema",
        "Substituir o banco de dados principal de forma permanente",
        "Criptografar as senhas dos usuários",
      ],
    ),
    q(
      "O que é uma API?",
      "Uma interface que permite a comunicação entre sistemas",
      [
        "Um tipo de banco de dados relacional",
        "Um servidor físico de altíssima performance e disponibilidade",
        "Um protocolo de criptografia",
      ],
    ),
    q(
      "O que caracteriza um serviço \"stateless\" (sem estado)?",
      "Cada requisição é independente e não depende de estado no servidor",
      [
        "O servidor guarda toda a sessão do usuário em memória",
        "O serviço só funciona com um único usuário por vez",
        "O serviço nunca acessa o banco de dados durante o processamento das requisições",
      ],
    ),
    q(
      "O que é uma CDN (Content Delivery Network)?",
      "Servidores distribuídos que entregam conteúdo perto do usuário",
      [
        "Um banco de dados central único",
        "Um algoritmo de compressão de vídeo em tempo real",
        "Um protocolo de autenticação que valida cada usuário antes do acesso",
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
        "Maior velocidade, porém sem nenhuma segurança adicional",
        "Compressão obrigatória de todas as imagens",
        "A eliminação da necessidade de servidores",
      ],
    ),
    q(
      "O que é um banco de dados relacional?",
      "Um banco que organiza os dados em tabelas com linhas e colunas",
      [
        "Um banco de dados que só guarda arquivos de imagem e vídeo em disco",
        "Um banco totalmente sem estrutura ou esquema definido",
        "Um banco que roda só na memória do cliente",
      ],
    ),
    q(
      "Qual a função de uma fila (queue) em um sistema?",
      "Armazenar tarefas para processamento assíncrono, em ordem",
      [
        "Servir páginas HTML diretamente ao navegador do usuário",
        "Substituir o balanceador de carga",
        "Criptografar o tráfego de rede",
      ],
    ),
    q(
      "O que é redundância em system design?",
      "Ter componentes duplicados para evitar um ponto único de falha",
      [
        "Remover todos os componentes considerados desnecessários",
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
        "Criptografar todas as tabelas do banco de dados por padrão",
        "Compactar todos os dados em um único arquivo salvo em um servidor central",
      ],
    ),
    q(
      "Na replicação leader-follower, quem recebe as escritas?",
      "O leader (primário), que depois replica para os followers",
      [
        "Qualquer follower, escolhido aleatoriamente a cada escrita",
        "Todos os nós ao mesmo tempo, sem coordenação",
        "Apenas o cliente, sem envolver o servidor",
      ],
    ),
    q(
      "O que o teorema CAP afirma?",
      "Sob partição de rede, escolhe-se entre consistência e disponibilidade",
      [
        "É possível garantir consistência, disponibilidade e partição sempre",
        "Bancos NoSQL não podem ser distribuídos",
        "A latência é sempre igual à vazão",
      ],
    ),
    q(
      "O que é consistência eventual (eventual consistency)?",
      "As réplicas convergem para o mesmo valor com o tempo",
      [
        "Todas as réplicas ficam idênticas de forma instantânea",
        "Os dados nunca ficam consistentes entre as réplicas do sistema",
        "A escrita é bloqueada até todos concordarem",
      ],
    ),
    q(
      "Para que serve o rate limiting?",
      "Limitar quantas requisições um cliente pode fazer num período",
      [
        "Aumentar a velocidade de todas as requisições recebidas",
        "Armazenar as requisições em cache permanente",
        "Distribuir os dados entre vários shards para equilibrar a carga do banco",
      ],
    ),
    q(
      "Por que criar um índice em um banco de dados?",
      "Para acelerar as consultas que filtram por aquele campo",
      [
        "Para reduzir sempre o espaço ocupado em disco pela tabela",
        "Para impedir a leitura de certos campos",
        "Para criptografar a tabela",
      ],
    ),
    q(
      "Qual a vantagem de microserviços sobre um monólito?",
      "Permitem escalar e implantar serviços de forma independente",
      [
        "Eliminam totalmente a comunicação pela rede entre os serviços",
        "Garantem que nunca haverá falhas",
        "Dispensam bancos de dados por completo",
      ],
    ),
    q(
      "O que é idempotência em uma operação?",
      "Executá-la várias vezes dá o mesmo resultado que executá-la uma vez",
      [
        "A operação só pode ser executada uma única vez, para sempre",
        "A operação sempre falha na segunda tentativa feita",
        "O resultado da operação depende sempre da ordem em que os usuários a chamam",
      ],
    ),
    q(
      "Para que serve um health check em um serviço?",
      "Verificar se a instância está saudável para receber tráfego",
      [
        "Fazer backup automático de todos os dados periodicamente",
        "Criptografar as respostas enviadas ao cliente",
        "Aumentar o limite de memória do servidor",
      ],
    ),
    q(
      "Qual a diferença entre cache write-through e write-back?",
      "Write-through grava no cache e no banco juntos; write-back adia o banco",
      [
        "Write-through nunca grava no banco de dados",
        "Write-back grava no cache e no banco ao mesmo tempo",
        "Na prática não existe nenhuma diferença relevante entre as duas estratégias",
      ],
    ),
    q(
      "O que é uma dead-letter queue?",
      "Uma fila que recebe mensagens que não puderam ser processadas",
      [
        "Uma fila que só aceita mensagens marcadas como prioritárias",
        "Uma fila que apaga mensagens sozinha, sem processar",
        "Uma fila usada apenas para logs de acesso",
      ],
    ),
    q(
      "O que é um proxy reverso?",
      "Um servidor que recebe requisições e as encaminha ao backend",
      [
        "Um cliente que acessa a internet sem passar por servidor",
        "Um banco de dados replicado em cada região do mundo",
        "Um algoritmo de compressão de dados",
      ],
    ),
    q(
      "O que é a estratégia \"database per service\" em microserviços?",
      "Cada serviço tem seu próprio banco de dados privado",
      [
        "Todos os serviços compartilham um único banco de dados global",
        "Nenhum serviço pode usar banco de dados algum",
        "O banco é substituído por arquivos de texto",
      ],
    ),
    q(
      "Qual a diferença entre polling e webhook?",
      "Polling consulta repetidamente; webhook notifica quando o evento ocorre",
      [
        "Polling notifica em tempo real; webhook consulta em loop",
        "Os dois consomem exatamente os mesmos recursos",
        "O webhook só funciona dentro de um monólito, nunca entre serviços distribuídos",
      ],
    ),
    q(
      "O que é uma sticky session?",
      "O load balancer manda um mesmo usuário sempre ao mesmo servidor",
      [
        "Quando a sessão nunca expira no navegador do usuário",
        "Quando o servidor descarta o estado a cada requisição recebida",
        "Quando todos compartilham a mesma senha",
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
      "Fazer vários nós concordarem sobre um valor, tolerando falhas",
      [
        "Comprimir os dados replicados que trafegam entre os nós",
        "Criptografar toda a comunicação que trafega entre os serviços do sistema",
        "Balancear a carga entre servidores web",
      ],
    ),
    q(
      "O que é consistent hashing?",
      "Distribuição que minimiza a realocação de chaves ao mudar de nós",
      [
        "Uma função de hash que sempre gera o mesmo endereço IP",
        "Um algoritmo que criptografa as chaves do cache",
        "Uma forma de ordenar as tabelas do banco de dados em ordem alfabética",
      ],
    ),
    q(
      "Na configuração de quorum, o que a condição R + W > N garante?",
      "Que leitura e escrita se sobrepõem, permitindo leitura consistente",
      [
        "Que a escrita será sempre mais rápida do que qualquer leitura",
        "Que nenhum nó do cluster precisa replicar os seus dados para os demais",
        "Que o sistema nunca fica indisponível",
      ],
    ),
    q(
      "Para que servem os vector clocks?",
      "Detectar a ordem causal e conflitos entre eventos distribuídos",
      [
        "Sincronizar o relógio físico de todos os servidores do cluster",
        "Medir a latência da rede em milissegundos",
        "Criptografar o timestamp da requisição",
      ],
    ),
    q(
      "O que é um CRDT (Conflict-free Replicated Data Type)?",
      "Estrutura de dados que converge sozinha, sem coordenação central",
      [
        "Um tipo de índice exclusivo usado apenas em bancos SQL",
        "Um protocolo de commit distribuído executado em exatamente duas fases",
        "Um algoritmo de compressão sem perdas",
      ],
    ),
    q(
      "O que é o padrão Saga em transações distribuídas?",
      "Uma sequência de transações locais com compensações em caso de falha",
      [
        "Um bloqueio global em todos os serviços ao mesmo tempo",
        "Uma única transação ACID abrangendo todos os bancos",
        "Um cache distribuído e compartilhado entre todos os microserviços do sistema",
      ],
    ),
    q(
      "O que é o Two-Phase Commit (2PC)?",
      "Um commit atômico coordenado em duas fases: prepare e commit",
      [
        "Um algoritmo de balanceamento de carga em dois níveis distintos",
        "Uma técnica de particionamento de dados em dois shards",
        "Um esquema de cache com duas camadas",
      ],
    ),
    q(
      "O que é backpressure em um sistema de streaming?",
      "Deixar o consumidor sinalizar que não acompanha o produtor",
      [
        "Um aumento automático da taxa de envio feita pelo produtor",
        "Uma forma de comprimir mensagens na fila",
        "Um algoritmo de criptografia de fluxo",
      ],
    ),
    q(
      "Para que serve um Bloom filter?",
      "Testar de forma probabilística se um elemento pode estar no conjunto",
      [
        "Garantir, com certeza absoluta, a presença de um elemento",
        "Ordenar os elementos de um conjunto por relevância",
        "Criptografar as chaves de um índice para proteger a busca dentro do conjunto",
      ],
    ),
    q(
      "O que é uma \"hot partition\" (partição quente)?",
      "Uma partição que recebe tráfego desproporcional e vira gargalo",
      [
        "Uma partição mantida apenas em memória rápida, do tipo cache",
        "Uma partição que nunca recebe requisições",
        "Uma partição criptografada por padrão",
      ],
    ),
    q(
      "Para que serve um Write-Ahead Log (WAL)?",
      "Registrar as alterações antes de aplicá-las, garantindo recuperação",
      [
        "Guardar apenas os logs de acesso feitos pelos usuários",
        "Comprimir o banco de dados periodicamente para economizar espaço em disco",
        "Distribuir a carga entre réplicas de leitura",
      ],
    ),
    q(
      "O que caracteriza uma leitura linearizável (linearizability)?",
      "Toda leitura enxerga a escrita mais recente, como se fosse uma só cópia",
      [
        "As leituras podem retornar valores antigos por tempo indefinido",
        "As escritas são aplicadas em ordem aleatória",
        "As leituras nunca bloqueiam e sempre retornam o dado imediatamente ao cliente",
      ],
    ),
    q(
      "O que é o problema de \"split-brain\" em sistemas distribuídos?",
      "Uma partição de rede faz dois nós agirem como líder ao mesmo tempo",
      [
        "Quando um nó perde todo o conteúdo da sua memória cache",
        "Quando o banco de dados excede o limite de disco",
        "Quando dois clientes diferentes acabam usando a mesma senha de acesso",
      ],
    ),
    q(
      "Para que serve o mecanismo de leader election?",
      "Escolher um único nó coordenador entre vários",
      [
        "Distribuir os dados de forma uniforme entre todos os shards",
        "Criptografar a comunicação entre os nós",
        "Eliminar a necessidade de réplicas",
      ],
    ),
    q(
      "O que é MVCC (Multi-Version Concurrency Control)?",
      "Manter várias versões dos dados para ler sem bloquear escritas",
      [
        "Executar uma única versão do dado por vez, com um lock global",
        "Criar uma cópia física do banco a cada leitura feita",
        "Impedir qualquer escrita concorrente no sistema",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Sistemas Distribuídos (Fácil)
// ---------------------------------------------------------------------------
const distributedSystemsEasyQuiz: QuizInput = {
  title: "Sistemas Distribuídos: Fundamentos (Fácil)",
  description:
    "15 perguntas de nível fácil sobre sistemas distribuídos: nós, replicação, tolerância a falhas, partição de rede e mais.",
  questions: [
    q(
      "O que é um sistema distribuído?",
      "Vários computadores que trabalham juntos como um só sistema",
      [
        "Um único computador que executa vários programas ao mesmo tempo",
        "Um programa que roda apenas no navegador",
        "Um banco de dados em um só disco",
      ],
    ),
    q(
      "O que é um \"nó\" (node) em um sistema distribuído?",
      "Um computador ou processo individual que faz parte do sistema",
      [
        "Um erro de comunicação que ocorre entre dois servidores",
        "Uma tabela armazenada dentro do banco de dados do sistema distribuído",
        "Uma requisição enviada pelo cliente",
      ],
    ),
    q(
      "Por que usar um sistema distribuído em vez de um único servidor?",
      "Para obter maior escalabilidade e tolerância a falhas",
      [
        "Para reduzir a quantidade total de código que se escreve",
        "Para eliminar por completo a necessidade de rede",
        "Para impedir o acesso de múltiplos usuários",
      ],
    ),
    q(
      "O que é tolerância a falhas (fault tolerance)?",
      "Continuar funcionando mesmo com falhas de alguns componentes",
      [
        "A garantia absoluta de que nenhuma falha jamais vai ocorrer",
        "A remoção de todos os logs de erro",
        "A execução do sistema em um único nó",
      ],
    ),
    q(
      "O que é um timeout em uma chamada entre nós?",
      "Um limite de espera após o qual a chamada é dada como falha",
      [
        "Um erro de sintaxe encontrado no código-fonte do nó",
        "Um backup automático que é feito periodicamente entre todos os nós",
        "Um índice criado para acelerar as consultas",
      ],
    ),
    q(
      "O que significa \"alta disponibilidade\" (high availability)?",
      "O sistema fica acessível quase o tempo todo, com pouca interrupção",
      [
        "O sistema sempre responde com os dados já criptografados",
        "O sistema só fica disponível e funcionando durante o horário comercial",
        "O sistema roda em um único servidor potente",
      ],
    ),
    q(
      "O que é replicação de dados?",
      "Manter cópias dos mesmos dados em vários nós",
      [
        "Apagar dados duplicados que existem no banco de dados",
        "Comprimir todos os dados em um único arquivo",
        "Mover os dados para um disco mais rápido",
      ],
    ),
    q(
      "Por que replicar dados em vários nós?",
      "Para aumentar a disponibilidade e a tolerância a falhas",
      [
        "Para reduzir o espaço total ocupado em disco pelo sistema",
        "Para impedir a leitura dos dados",
        "Para desativar o cache do sistema",
      ],
    ),
    q(
      "O que é escalabilidade horizontal?",
      "Adicionar mais máquinas para lidar com mais carga",
      [
        "Adicionar mais memória a uma única máquina já existente",
        "Reduzir o número de servidores ativos",
        "Trocar o banco relacional por um em memória",
      ],
    ),
    q(
      "O que é latência de rede?",
      "O tempo que uma mensagem leva para ir de um nó a outro",
      [
        "A quantidade total de nós que existem no sistema",
        "O espaço em disco que cada nó do sistema tem disponível para uso",
        "O número de falhas por dia",
      ],
    ),
    q(
      "O que é um ponto único de falha (single point of failure)?",
      "Um componente cuja falha derruba todo o sistema",
      [
        "Um nó extra usado apenas para guardar cópias de backup",
        "Um erro que ocorre uma única vez",
        "Um componente que nunca pode falhar",
      ],
    ),
    q(
      "O que é comunicação assíncrona entre serviços?",
      "Os serviços trocam mensagens sem esperar uma resposta imediata",
      [
        "Os serviços só se comunicam por meio de arquivos locais",
        "Um serviço sempre bloqueia até o outro responder",
        "Os serviços sempre compartilham a mesma área de memória entre si",
      ],
    ),
    q(
      "O que é um heartbeat em sistemas distribuídos?",
      "Um sinal periódico que indica que um nó está vivo",
      [
        "Um backup completo de tudo feito a cada uma hora",
        "Uma mensagem de erro enviada ao cliente",
        "Um índice criado automaticamente no banco",
      ],
    ),
    q(
      "O que é consistência de dados em um sistema distribuído?",
      "Garantir que todos os nós enxerguem os mesmos dados",
      [
        "Garantir que cada nó tenha um conjunto de dados diferente",
        "Apagar os dados antigos periodicamente",
        "Criptografar os dados em cada nó",
      ],
    ),
    q(
      "O que é um cluster?",
      "Um grupo de nós que trabalham juntos como uma única unidade",
      [
        "Um único servidor totalmente isolado da rede",
        "Um tipo especial de índice usado internamente no banco de dados",
        "Um arquivo de configuração do sistema",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Event Sourcing
// ---------------------------------------------------------------------------
const eventSourcingQuiz: QuizInput = {
  title: "Event Sourcing: Fundamentos",
  description:
    "15 perguntas sobre Event Sourcing: eventos imutáveis, event store, snapshots, projeções e a relação com CQRS.",
  questions: [
    q(
      "O que é Event Sourcing?",
      "Armazena o estado como uma sequência de eventos imutáveis",
      [
        "Guarda apenas o estado atual, sem manter nenhum histórico",
        "Uma técnica de compressão de banco de dados",
        "Um protocolo de comunicação entre serviços",
      ],
    ),
    q(
      "No Event Sourcing, qual é a fonte da verdade (source of truth)?",
      "O log de eventos (event store)",
      [
        "A última linha da tabela de estado",
        "O cache em memória do serviço",
        "O arquivo de configuração da aplicação",
      ],
    ),
    q(
      "Como o estado atual é obtido no Event Sourcing?",
      "Reproduzindo (replay) os eventos desde o início",
      [
        "Lendo uma única coluna que guarda o status atual",
        "Consultando um cache que nunca expira",
        "Somando todos os registros de log de erro",
      ],
    ),
    q(
      "O que caracteriza um evento no Event Sourcing?",
      "Um fato imutável que já aconteceu no passado",
      [
        "Uma intenção de mudança que ainda não foi confirmada",
        "Um comando que pode ser cancelado a qualquer momento",
        "Uma consulta de leitura ao banco de dados",
      ],
    ),
    q(
      "Por que os eventos são imutáveis?",
      "Porque representam fatos que já ocorreram e não mudam",
      [
        "Porque assim ocupam bem menos espaço em disco do que o estado",
        "Porque são criptografados por padrão",
        "Porque só existem em memória temporária",
      ],
    ),
    q(
      "O que é um \"event store\"?",
      "Um armazenamento append-only que guarda todos os eventos",
      [
        "Um cache que guarda apenas o estado atual do sistema",
        "Uma fila que descarta os eventos mais antigos",
        "Um índice para acelerar consultas relacionais",
      ],
    ),
    q(
      "O que significa \"append-only\" no contexto de Event Sourcing?",
      "Só dá para adicionar eventos, nunca alterar ou remover os antigos",
      [
        "Os eventos podem ser editados livremente a qualquer momento",
        "Apenas o último evento registrado pode ser mantido no armazenamento",
        "Os eventos são sobrescritos a cada atualização",
      ],
    ),
    q(
      "O que é um \"snapshot\" no Event Sourcing?",
      "Uma captura do estado para evitar reprocessar todos os eventos",
      [
        "Uma cópia de segurança feita do código-fonte da aplicação",
        "Um evento que apaga o histórico anterior",
        "Uma foto da interface do usuário",
      ],
    ),
    q(
      "Qual é a vantagem de ter um histórico completo de eventos?",
      "Permite auditar e reconstruir o estado em qualquer ponto no tempo",
      [
        "Reduz o espaço em disco que o sistema precisa",
        "Elimina a necessidade de qualquer banco de dados no sistema",
        "Impede por completo a leitura concorrente dos dados por vários serviços",
      ],
    ),
    q(
      "O que é uma \"projection\" (projeção) no Event Sourcing?",
      "Uma visão de leitura derivada da reprodução dos eventos",
      [
        "Um evento que foi agendado para acontecer no futuro",
        "Uma cópia criptografada do event store",
        "Um comando que altera o estado diretamente",
      ],
    ),
    q(
      "Qual padrão é comumente usado em conjunto com Event Sourcing?",
      "CQRS (Command Query Responsibility Segregation)",
      ["MVC (Model-View-Controller)", "REST (Representational State Transfer, o padrão web)", "Singleton"],
    ),
    q(
      "O que o CQRS separa?",
      "As operações de escrita (commands) das de leitura (queries)",
      [
        "O frontend do backend em toda a arquitetura da aplicação inteira",
        "O banco de dados do sistema de arquivos do servidor",
        "Os usuários administradores dos comuns",
      ],
    ),
    q(
      "Como se corrige um erro no Event Sourcing, já que os eventos são imutáveis?",
      "Adicionando um novo evento compensatório ou corretivo",
      [
        "Editando diretamente o evento que foi registrado errado",
        "Apagando o evento errado do event store",
        "Reiniciando o serviço para limpar o histórico",
      ],
    ),
    q(
      "Como os nomes dos eventos costumam ser escritos?",
      "No passado, descrevendo algo que já ocorreu (ex.: PedidoCriado)",
      [
        "No imperativo, como uma ordem a ser executada (ex.: CriarPedido)",
        "Como perguntas (ex.: PedidoExiste?)",
        "Apenas com números sequenciais",
      ],
    ),
    q(
      "Qual é uma desvantagem do Event Sourcing?",
      "Maior complexidade e o custo de reprocessar muitos eventos",
      [
        "A impossibilidade completa de auditar o que houve no sistema",
        "A perda total do histórico de mudanças",
        "A incapacidade de escalar horizontalmente",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Quero Delivery — Roadmap do Engenheiro de Software
// ---------------------------------------------------------------------------
const qdRoadmapQuiz: QuizInput = {
  title: "Quero Delivery: Roadmap do Engenheiro de Software",
  description:
    "15 perguntas sobre o roadmap de engenharia da Quero Delivery: stack, padrões de código, mensageria, arquitetura e práticas de time.",
  questions: [
    q(
      "Qual framework web é usado nos backends modernos da Quero Delivery?",
      "Express",
      ["NestJS", "Fastify", "Koa"],
    ),
    q(
      "Qual é o banco de dados principal dos serviços da Quero Delivery?",
      "MongoDB com Mongoose",
      [
        "PostgreSQL com Prisma",
        "MySQL com Sequelize",
        "DynamoDB com TypeORM",
      ],
    ),
    q(
      "Qual tecnologia de mensageria é usada nos microserviços modernos da QD?",
      "Kafka",
      ["RabbitMQ", "Amazon SQS", "Redis Streams"],
    ),
    q(
      "Qual tecnologia é usada para cache nos serviços da Quero Delivery?",
      "Redis (via ioredis)",
      ["Memcached (em memória)", "Hazelcast", "Ehcache"],
    ),
    q(
      "Qual abordagem de APIs a Quero Delivery adota?",
      "REST com OpenAPI 3 contract-first",
      [
        "GraphQL como padrão único",
        "gRPC em todos os serviços",
        "SOAP com contratos WSDL e troca de envelopes em XML",
      ],
    ),
    q(
      "Qual é o monólito legado ainda ativo na Quero Delivery?",
      "qd-api-geral",
      ["qd-orders", "qd-checkout-service", "qd-users-service"],
    ),
    q(
      "Segundo o Pull Request Guide, qual é o tamanho máximo recomendado de um PR?",
      "200 linhas alteradas",
      ["100 linhas alteradas", "2000 linhas alteradas", "Não há limite recomendado"],
    ),
    q(
      "Qual padrão de mensagens de commit a Quero Delivery utiliza?",
      "Conventional Commits",
      ["Gitmoji", "Mensagens livres, sem padrão", "Somente o número da issue"],
    ),
    q(
      "Como os tópicos Kafka são nomeados no padrão da QD?",
      "SERVICE.ENTITY.EVENT",
      ["EVENT-ENTITY-SERVICE", "kafka_topic_<numero>", "ENTITY/EVENT/SERVICE"],
    ),
    q(
      "Na arquitetura em camadas dos serviços QD, para onde as dependências devem apontar?",
      "Para dentro, com o domain no centro da aplicação",
      [
        "Para fora, com a infraestrutura no centro da arquitetura",
        "Do domain direto para o banco",
        "Não há regra de direção de dependência",
      ],
    ),
    q(
      "Qual prefixo o styleguide da QD usa para interfaces em TypeScript?",
      "I (ex.: IUser)",
      ["T (ex.: TUser)", "Interface (ex.: InterfaceUser)", "Nenhum prefixo"],
    ),
    q(
      "Qual pacote interno fornece factories como App, Health e Kafka aos serviços?",
      "@querodelivery/qd-packages",
      [
        "@querodelivery/qd-core",
        "@nestjs/common",
        "@querodelivery/qd-orm",
      ],
    ),
    q(
      "Qual endpoint todos os microserviços da QD expõem para verificação de saúde?",
      "GET /health",
      ["GET /status", "GET /ping", "GET /api/alive"],
    ),
    q(
      "Por que o consumer de Kafka na QD deve ser idempotente?",
      "Porque a entrega é at-least-once e um evento pode se repetir",
      [
        "Porque a entrega é exactly-once e nunca acontece de novo",
        "Porque o Kafka não garante ordem alguma",
        "Porque o consumer não pode acessar o banco de dados",
      ],
    ),
    q(
      "Qual é o caminho de deploy do CI/CD na Quero Delivery?",
      "GitHub Actions → ECR → EKS",
      [
        "Jenkins → Docker Hub → ECS",
        "GitLab CI → GCR → GKE",
        "CircleCI → ECR → Lambda",
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Quero Delivery — Infraestrutura (Intraweb e Workers)
// ---------------------------------------------------------------------------
const qdInfraQuiz: QuizInput = {
  title: "Quero Delivery: Infraestrutura (Intraweb e Workers)",
  description:
    "10 perguntas sobre a infraestrutura da Quero Delivery: comunicação intraweb no cluster Kubernetes e workers assíncronos.",
  questions: [
    q(
      "O que é comunicação intraweb na Quero Delivery?",
      "Tráfego HTTP entre serviços dentro do mesmo cluster Kubernetes",
      [
        "Tráfego HTTPS entre o cluster e clientes externos na internet",
        "Comunicação por e-mail entre os times de infraestrutura",
        "Acesso público às APIs via domínios da internet",
      ],
    ),
    q(
      "Qual protocolo é usado na comunicação intraweb (dentro do cluster)?",
      "HTTP",
      ["HTTPS com mTLS obrigatório", "gRPC sobre TLS", "FTP"],
    ),
    q(
      "Qual é o padrão de URL interna de um serviço em produção?",
      "http://{service-name}.services.local.quero.io/api",
      [
        "https://{service-name}.services.local.quero.io/api",
        "http://{service-name}.stg.services.local.quero.io/api",
        "https://api.quero.io/{service-name}",
      ],
    ),
    q(
      "Por que a QD usa HTTP e não HTTPS na comunicação intraweb?",
      "Porque a rede interna é confiável e evita o custo de certificados",
      [
        "Porque o Kubernetes não suporta HTTPS na comunicação entre pods",
        "Porque o HTTPS fica mais lento apenas em produção",
        "Porque os serviços não trocam dados entre si",
      ],
    ),
    q(
      "Como os serviços resolvem o nome uns dos outros dentro do cluster?",
      "Via DNS interno do cluster Kubernetes (CoreDNS)",
      [
        "Consultando um arquivo hosts mantido em cada pod do cluster",
        "Por meio de um balanceador externo público",
        "Usando endereços IP fixos escritos no código",
      ],
    ),
    q(
      "As URLs intraweb podem ser usadas em front-ends ou apps móveis?",
      "Não; são apenas para comunicação serviço-a-serviço no cluster",
      [
        "Sim, desde que a chamada seja feita sempre por HTTPS",
        "Sim, são as URLs públicas oficiais do produto",
        "Sim, mas somente quando a chamada é feita dentro do ambiente de stage",
      ],
    ),
    q(
      "Por que separar o processamento assíncrono em um worker próprio?",
      "Porque o Node tem um só event loop e o consumer disputaria com o HTTP",
      [
        "Porque o Node é incapaz de rodar qualquer consumer Kafka",
        "Porque cada worker precisa de um banco de dados separado",
        "Porque a API roda em outro processo e não consegue acessar o Kafka de forma alguma",
      ],
    ),
    q(
      "Subir uma réplica a mais de um worker sempre aumenta a vazão de consumo?",
      "Não; as partições são divididas e réplicas acima do nº delas ficam ociosas",
      [
        "Sim, cada réplica adicionada dobra a vazão do consumo",
        "Sim, o Kafka replica as mensagens para todas as réplicas",
        "Sim, desde que todas as réplicas usem exatamente o mesmo consumer group configurado",
      ],
    ),
    q(
      "Qual é a regra para a contagem de réplicas de um worker em produção?",
      "Uma réplica por partição, até o número de partições do tópico",
      [
        "O dobro do número de partições que o tópico possui",
        "Uma réplica por serviço, sem contar as partições",
        "Sempre o número máximo de réplicas permitido pelo cluster Kubernetes",
      ],
    ),
    q(
      "O worker usa uma imagem Docker própria, diferente da API?",
      "Não; usa a mesma imagem da API, subida com outro entrypoint",
      [
        "Sim, tem repositório, build e imagem totalmente próprios",
        "Sim, mas compartilha a tag da imagem da API",
        "Não; roda dentro do mesmo processo da API",
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
  distributedSystemsEasyQuiz,
  eventSourcingQuiz,
  qdRoadmapQuiz,
  qdInfraQuiz,
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
