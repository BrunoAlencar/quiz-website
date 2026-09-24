import pg from "pg";
import { createQuiz } from "@/server/repositories/quizzes";
import { validateQuizInput } from "@/lib/validation";
import type { QuizInput } from "@/types";

const q = (
  text: string,
  correct: string,
  wrong: [string, string, string],
) => ({
  text,
  time_limit_seconds: 20,
  points_base: 1000,
  options: [
    { text: correct, is_correct: true },
    { text: wrong[0], is_correct: false },
    { text: wrong[1], is_correct: false },
    { text: wrong[2], is_correct: false },
  ],
});

const quiz: QuizInput = {
  title: "All About Ireland",
  description: "20 questions on the geography, history, language, and culture of the Emerald Isle.",
  questions: [
    q("What is the capital of the Republic of Ireland?", "Dublin", ["Cork", "Galway", "Belfast"]),
    q("Which plant is the traditional national symbol of Ireland?", "The shamrock", ["The rose", "The thistle", "The daffodil"]),
    q("What is the longest river in Ireland?", "The Shannon", ["The Liffey", "The Boyne", "The Barrow"]),
    q("On the Irish tricolour flag, which colour is on the hoist (left) side?", "Green", ["Orange", "White", "Blue"]),
    q("What is the currency of the Republic of Ireland?", "The euro", ["Pound sterling", "The punt", "The dollar"]),
    q("On what date is St. Patrick's Day celebrated?", "17 March", ["1 March", "25 March", "12 July"]),
    q("What is the highest mountain in Ireland?", "Carrauntoohil", ["Mount Brandon", "Lugnaquilla", "Croagh Patrick"]),
    q("The Cliffs of Moher are located in which county?", "County Clare", ["County Kerry", "County Galway", "County Donegal"]),
    q("Which Neolithic passage tomb in County Meath is older than the Egyptian pyramids?", "Newgrange", ["Blarney Castle", "The Rock of Cashel", "The Hill of Tara"]),
    q("Which traditional Irish sport is played with a stick called a hurley and a ball called a sliotar?", "Hurling", ["Gaelic football", "Road bowling", "Handball"]),
    q("Which Dublin-born author wrote the novel 'Ulysses'?", "James Joyce", ["Oscar Wilde", "W. B. Yeats", "Samuel Beckett"]),
    q("What is the name of the lower house of the Irish parliament?", "Dáil Éireann", ["Seanad Éireann", "House of Commons", "The Storting"]),
    q("Which sea separates Ireland from Great Britain?", "The Irish Sea", ["The North Sea", "The Celtic Sea", "The Baltic Sea"]),
    q("Which Irish stout is famously brewed at St. James's Gate in Dublin?", "Guinness", ["Murphy's", "Beamish", "Smithwick's"]),
    q("Which county is nicknamed 'The Kingdom'?", "County Kerry", ["County Cork", "County Mayo", "County Wicklow"]),
    q("In which county is the Giant's Causeway located?", "County Antrim", ["County Cork", "County Galway", "County Wexford"]),
    q("Which Irish greeting means 'hello'?", "Dia duit", ["Sláinte", "Slán", "Fáilte"]),
    q("Which Dublin rock band is fronted by the singer Bono?", "U2", ["The Cranberries", "Thin Lizzy", "Snow Patrol"]),
    q("Which traditional Irish dish is made from mashed potatoes and cabbage or kale?", "Colcannon", ["Haggis", "Paella", "Poutine"]),
    q("Roughly how many people live in the Republic of Ireland today?", "About 5 million", ["About 1 million", "About 15 million", "About 30 million"]),
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
