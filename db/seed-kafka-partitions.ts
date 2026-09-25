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
  title: "Kafka: Partitions (Fácil)",
  description:
    "15 perguntas fáceis sobre partitions no Apache Kafka: ordem, offsets, chaves, consumer groups e replicação.",
  questions: [
    q(
      "O que é uma partition (partição) no Kafka?",
      "Uma subdivisão de um tópico que permite paralelismo",
      [
        "Um servidor (broker) do cluster Kafka",
        "Um consumidor de mensagens",
        "Um tipo específico de mensagem",
      ],
    ),
    q(
      "Quantas partitions um tópico Kafka pode ter?",
      "Uma ou mais",
      ["Exatamente uma", "No máximo duas", "Nenhuma"],
    ),
    q(
      "Dentro de uma única partition, a ordem das mensagens é:",
      "Garantida (as mensagens ficam ordenadas)",
      [
        "Aleatória",
        "Nunca garantida",
        "Sempre invertida (da última para a primeira)",
      ],
    ),
    q(
      "Quando uma mensagem tem uma chave (key), o que determina em qual partition ela é gravada?",
      "A chave da mensagem (via hash da key)",
      [
        "O tamanho da mensagem",
        "O horário em que foi enviada",
        "O nome do consumidor",
      ],
    ),
    q(
      "Quando as mensagens não têm chave, como são distribuídas entre as partitions?",
      "De forma balanceada entre as partitions (round-robin/sticky)",
      [
        "Sempre na partition 0",
        "Sempre na última partition",
        "Não são gravadas",
      ],
    ),
    q(
      "Como cada partition é armazenada internamente?",
      "Como um log ordenado e imutável (append-only)",
      [
        "Como uma tabela relacional",
        "Como um arquivo temporário apagado a cada leitura",
        "Apenas em cache na memória",
      ],
    ),
    q(
      "O que é o offset de uma mensagem?",
      "A posição sequencial da mensagem dentro da partition",
      [
        "O tamanho da mensagem em bytes",
        "O identificador do tópico",
        "O número de consumidores do grupo",
      ],
    ),
    q(
      "Para aumentar o paralelismo de consumo de um tópico, o que você deve fazer?",
      "Aumentar o número de partitions",
      [
        "Diminuir o número de partitions",
        "Aumentar apenas o número de réplicas",
        "Reduzir o número de consumidores",
      ],
    ),
    q(
      "Dentro de um mesmo consumer group, quantos consumidores podem ler de uma mesma partition ao mesmo tempo?",
      "Apenas um",
      ["Todos os consumidores do grupo", "Exatamente dois", "Um número ilimitado"],
    ),
    q(
      "Se um consumer group tem mais consumidores do que partitions, o que acontece com os consumidores extras?",
      "Ficam ociosos, sem nenhuma partition atribuída",
      [
        "Compartilham a mesma partition simultaneamente",
        "Causam um erro no cluster",
        "Criam novas partitions automaticamente",
      ],
    ),
    q(
      "É possível diminuir o número de partitions de um tópico já existente no Kafka?",
      "Não; só é possível aumentar o número de partitions",
      [
        "Sim, a qualquer momento",
        "Sim, mas apenas pela metade",
        "Sim, o Kafka ajusta automaticamente",
      ],
    ),
    q(
      "O que garante a tolerância a falhas (durabilidade) de uma partition?",
      "A replicação da partition em outros brokers (réplicas)",
      [
        "O offset das mensagens",
        "A chave das mensagens",
        "A quantidade de consumer groups",
      ],
    ),
    q(
      "Em uma partition replicada, quem atende as leituras e escritas dos clientes?",
      "A réplica líder (leader) da partition",
      [
        "Qualquer réplica, escolhida ao acaso",
        "O próprio consumidor",
        "Todas as réplicas ao mesmo tempo",
      ],
    ),
    q(
      "A ordem total das mensagens no Kafka é garantida em qual escopo?",
      "Apenas dentro de cada partition, não entre partitions",
      [
        "Em todo o tópico, entre todas as partitions",
        "Em todo o cluster, entre todos os tópicos",
        "Nunca é garantida em lugar nenhum",
      ],
    ),
    q(
      "Para garantir que mensagens relacionadas (ex.: de um mesmo pedido) fiquem ordenadas, o que você deve fazer?",
      "Usar a mesma chave (key) para que caiam na mesma partition",
      [
        "Enviar as mensagens sem nenhuma chave",
        "Enviar cada mensagem em um tópico diferente",
        "Aumentar o número de partitions do tópico",
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
