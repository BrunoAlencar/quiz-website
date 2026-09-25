import pg from "pg";
import { createQuiz } from "@/server/repositories/quizzes";
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

const quiz: QuizInput = {
  title: "Styleguide QueroDelivery",
  description:
    "25 perguntas sobre o guia de estilo JavaScript/TypeScript da QueroDelivery: interfaces, imports, rotas, Kafka, tempo de resposta e mais.",
  questions: [
    q(
      "Como deve ser nomeada uma interface segundo o styleguide?",
      "Iniciando com a letra I maiúscula, ex.: IUser",
      [
        "Com o sufixo Interface, ex.: UserInterface",
        "Em kebab-case, ex.: i-user",
        "Somente com o nome da entidade, ex.: User",
      ],
    ),
    q(
      "Por que o styleguide evita o uso de 'export default'?",
      "Para manter a consistência do nome do módulo exportado entre todos os arquivos",
      [
        "Porque 'export default' não é suportado em TypeScript",
        "Para reduzir o tamanho final do bundle",
        "Porque impede o tree-shaking do módulo",
      ],
    ),
    q(
      "Como um módulo deve ser importado, já que não usamos export default?",
      "Usando importação nomeada, ex.: import { User } from './user'",
      [
        "Usando import default, ex.: import User from './user'",
        "Usando require, ex.: const User = require('./user')",
        "Importando tudo, ex.: import * as User from './user'",
      ],
    ),
    q(
      "Qual prática é considerada um 'bad smell' no styleguide?",
      "Utilizar variáveis de ambiente (process.env) diretamente na funcionalidade",
      [
        "Centralizar variáveis de ambiente em um arquivo de constantes",
        "Importar constantes de um arquivo env-constants.ts",
        "Tipar as variáveis de ambiente com String()",
      ],
    ),
    q(
      "Qual padrão de nomenclatura deve ser usado para construir os paths das rotas?",
      "Kebab case, combinando as palavras com traço",
      ["camelCase", "snake_case", "PascalCase"],
    ),
    q(
      "Como as entidades devem ser referenciadas nos paths das rotas?",
      "No plural e sem informações redundantes, ex.: /api/categories",
      [
        "No singular, ex.: /api/category",
        "No plural com o verbo da ação, ex.: /api/create-categories",
        "No singular com o id repetido, ex.: /api/category/:categoryId/categoryId",
      ],
    ),
    q(
      "Onde os parâmetros de consulta (filtros) devem ser definidos?",
      "Como parâmetros de query, ex.: /api/categories?status=APPROVED",
      [
        "Como parâmetros do path, ex.: /api/categories/:status/:brand",
        "No corpo (body) da requisição GET",
        "Nos headers da requisição",
      ],
    ),
    q(
      "Qual é o padrão para rotas de remoção de recursos em lote?",
      "Verbo POST, recurso no plural e o sub-recurso batch-delete, ex.: /api/products/batch-delete",
      [
        "Verbo DELETE com os ids no path, ex.: /api/products/:ids/delete",
        "Verbo POST com o sufixo /delete-all",
        "Verbo PUT com o sub-recurso /batch",
      ],
    ),
    q(
      "Como deve ser nomeado um arquivo segundo o styleguide?",
      "Em kebab-case, com o tipo do arquivo após o ponto, ex.: my-new-file.controller.ts",
      [
        "Em camelCase, ex.: myNewFile.controller.ts",
        "Em PascalCase, ex.: MyNewFile.Controller.ts",
        "Em snake_case, ex.: my_new_file_controller.ts",
      ],
    ),
    q(
      "Como devem ser definidos os 'particular parameters'?",
      "Como tipo ENUM com letras maiúsculas, ex.: enum EProductStatus { APPROVED = 'APPROVED' }",
      [
        "Como um objeto constante em minúsculas",
        "Como constantes soltas do tipo string",
        "Como um array de strings",
      ],
    ),
    q(
      "Qual deve ser a resposta de uma requisição de remoção em lote bem-sucedida?",
      "statusCode 200 com um body do tipo array (vazio se todos forem removidos)",
      [
        "statusCode 204 sem corpo (No Content)",
        "statusCode 200 com um objeto contendo a contagem removida",
        "statusCode 202 com o id do job de remoção",
      ],
    ),
    q(
      "Quando algum recurso falha na remoção em lote, o que o array de resposta deve conter para ele?",
      "O identificador, o código de status e a mensagem explicando o motivo da falha",
      [
        "Apenas o identificador do recurso que falhou",
        "Somente a mensagem de erro genérica",
        "O recurso completo que não pôde ser removido",
      ],
    ),
    q(
      "Qual é a regra do styleguide sobre chaves {} em blocos condicionais (if)?",
      "São obrigatórias em todos os casos, mesmo quando o bloco tem apenas uma linha",
      [
        "São opcionais quando o bloco tem apenas uma linha",
        "Devem ser omitidas em blocos de linha única",
        "São obrigatórias apenas em blocos com mais de três linhas",
      ],
    ),
    q(
      "Qual é o formato padrão para nomear tópicos do Kafka?",
      "SERVICE.ENTITY.EVENT, ex.: QD-PRODUCTS-SERVICE.PRODUCT.CREATED",
      [
        "SERVICE_ENTITY_EVENT, ex.: QD_PRODUCTS_PRODUCT_CREATED",
        "EVENT.ENTITY.SERVICE, ex.: CREATED.PRODUCT.QD-PRODUCTS",
        "service.entity.event em minúsculas",
      ],
    ),
    q(
      "Segundo a tabela de tempo de resposta, qual latência ponta a ponta é classificada como 'Ruim'?",
      "Acima de 500ms",
      ["Abaixo de 100ms", "Entre 100ms e 300ms", "Entre 300ms e 500ms"],
    ),
    q(
      "Qual guia de estilo é usado como base para o styleguide da QueroDelivery?",
      "O Airbnb JavaScript Style Guide",
      [
        "O Google JavaScript Style Guide",
        "O StandardJS",
        "O guia de estilo oficial do TypeScript",
      ],
    ),
    q(
      "Na parte SERVICE do nome de um tópico Kafka, como nomes compostos devem ser escritos?",
      "Em maiúsculas e separados por hífen, ex.: QD-PRODUCTS-SERVICE",
      [
        "Em maiúsculas separados por underscore, ex.: QD_PRODUCTS_SERVICE",
        "Em camelCase, ex.: qdProductsService",
        "Em minúsculas separados por ponto, ex.: qd.products.service",
      ],
    ),
    q(
      "Como a parte ENTITY do nome de um tópico Kafka deve ser escrita?",
      "Em maiúsculas, separando por hífen quando composta, ex.: SHOPPING-CART",
      [
        "Em minúsculas, ex.: shopping-cart",
        "Em PascalCase, ex.: ShoppingCart",
        "Em maiúsculas separada por underscore, ex.: SHOPPING_CART",
      ],
    ),
    q(
      "Na tabela de tempo de resposta, como é classificada uma latência abaixo de 100ms?",
      "Excelente",
      ["Bom", "Degradando", "Ruim"],
    ),
    q(
      "Na tabela de tempo de resposta, como é classificada uma latência entre 100ms e 300ms?",
      "Bom",
      ["Excelente", "Degradando", "Ruim"],
    ),
    q(
      "Na tabela de tempo de resposta, como é classificada uma latência entre 300ms e 500ms?",
      "Degradando",
      ["Bom", "Excelente", "Ruim"],
    ),
    q(
      "Qual limite endpoints de conteúdo above-the-fold nunca devem ultrapassar?",
      "500ms",
      ["100ms", "300ms", "1000ms"],
    ),
    q(
      "Os valores de referência de tempo de resposta representam qual latência?",
      "A latência ponta a ponta percebida pelo usuário (usuário → frontend → BFF → serviço)",
      [
        "A latência isolada de cada serviço interno",
        "Apenas o tempo de processamento do banco de dados",
        "Apenas a latência de rede entre o BFF e o serviço",
      ],
    ),
    q(
      "Segundo a FAQ, devemos ter obrigatoriamente um tópico Kafka por domínio?",
      "Não necessariamente; preferimos tópicos genéricos por domínio, com exceções bem justificadas",
      [
        "Sim, sempre um tópico dedicado por domínio",
        "Sim, e também um tópico por status de cada entidade",
        "Não, devemos usar um único tópico global para tudo",
      ],
    ),
    q(
      "Segundo a FAQ, o que fazer quando já existe um producer publicando em um tópico específico de status?",
      "Depreciar o tópico específico e passar a publicar no tópico genérico",
      [
        "Manter o tópico específico e criar um novo genérico em paralelo",
        "Criar tópicos adicionais para migrar 'no futuro'",
        "Duplicar as mensagens em ambos os tópicos permanentemente",
      ],
    ),
  ],
};

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const check = validateQuizInput(quiz);
  if (!check.valid) {
    console.error("Quiz failed validation:\n" + check.errors.join("\n"));
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  try {
    const id = await createQuiz(pool, quiz);
    console.log(`Created quiz "${quiz.title}" (${quiz.questions.length} questions)`);
    console.log(`id: ${id}`);
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
