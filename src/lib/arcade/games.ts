// Prebuilt game catalogue. To add a game, add one object here (see types.ts).
import type { ArcadeGame } from "./types";

export const ARCADE_GAMES: ArcadeGame[] = [
  // ---------------------------------------------------------------- MATCH
  {
    id: "animals-homes",
    template: "MATCH",
    title: "Animals and Their Homes",
    subject: "EVS",
    fromGrade: 1,
    toGrade: 3,
    emoji: "🐾",
    blurb: "Match each animal to where it lives.",
    rounds: [
      { title: "Round 1", pairs: [["🐶 Dog", "Kennel"], ["🐦 Bird", "Nest"], ["🐟 Fish", "Water"], ["🐄 Cow", "Shed"]] },
      { title: "Round 2", pairs: [["🐝 Bee", "Hive"], ["🦁 Lion", "Den"], ["🕷️ Spider", "Web"], ["🐴 Horse", "Stable"]] },
    ],
  },
  {
    id: "shapes-sides",
    template: "MATCH",
    title: "Shapes and Sides",
    subject: "Maths",
    fromGrade: 2,
    toGrade: 4,
    emoji: "🔷",
    blurb: "Match each shape to its clue.",
    rounds: [
      { title: "Round 1", pairs: [["Triangle", "3 sides"], ["Square", "4 equal sides"], ["Pentagon", "5 sides"], ["Hexagon", "6 sides"]] },
      { title: "Round 2", pairs: [["Circle", "No corners"], ["Rectangle", "Opposite sides are equal"], ["Octagon", "8 sides"], ["Cube", "6 flat faces"]] },
    ],
  },
  {
    id: "plant-parts",
    template: "MATCH",
    title: "Plant Parts Match",
    subject: "Science",
    fromGrade: 6,
    toGrade: 8,
    emoji: "🌱",
    blurb: "Photosynthesis words and what they mean.",
    rounds: [
      { title: "Plant parts", pairs: [["Chlorophyll", "Green pigment that traps sunlight"], ["Stomata", "Tiny pores for gas exchange"], ["Xylem", "Carries water upward"], ["Phloem", "Carries food to all parts"]] },
      { title: "Big words", pairs: [["Photosynthesis", "Plants make food using sunlight"], ["Transpiration", "Loss of water vapour from leaves"], ["Glucose", "Simple sugar made as food"], ["Chloroplast", "Cell part where food is made"]] },
      { title: "Boss round", pairs: [["Autotroph", "Makes its own food"], ["Heterotroph", "Depends on others for food"], ["Starch", "Stored form of glucose"], ["Respiration", "Releases energy from food"]] },
    ],
  },
  {
    id: "element-symbols",
    template: "MATCH",
    title: "Element Symbols",
    subject: "Chemistry",
    fromGrade: 9,
    toGrade: 10,
    emoji: "⚗️",
    blurb: "Match elements to their chemical symbols.",
    rounds: [
      { title: "Round 1", pairs: [["Sodium", "Na"], ["Potassium", "K"], ["Iron", "Fe"], ["Gold", "Au"]] },
      { title: "Round 2", pairs: [["Silver", "Ag"], ["Lead", "Pb"], ["Copper", "Cu"], ["Mercury", "Hg"]] },
    ],
  },

  // ----------------------------------------------------------------- QUIZ
  {
    id: "colours-shapes",
    template: "QUIZ",
    title: "Colours and Shapes Quiz",
    subject: "General",
    fromGrade: 1,
    toGrade: 3,
    emoji: "🎨",
    blurb: "Six easy questions. Take your time!",
    secondsPerQuestion: 25,
    questions: [
      { q: "What colour do you get by mixing blue and yellow?", options: ["Green", "Red", "Purple", "Orange"], answer: 0, why: "Blue and yellow make green." },
      { q: "How many sides does a triangle have?", options: ["2", "3", "4", "5"], answer: 1, why: "Tri means three." },
      { q: "Which shape is round with no corners?", options: ["Square", "Triangle", "Circle", "Rectangle"], answer: 2, why: "A circle is round and has no corners." },
      { q: "On a clear day the sky looks…", options: ["Green", "Blue", "Pink", "Black"], answer: 1, why: "The sky looks blue in daylight." },
      { q: "How many days are there in a week?", options: ["5", "6", "7", "10"], answer: 2, why: "A week has 7 days." },
      { q: "Which one is the biggest?", options: ["Ant", "Cat", "Rabbit", "Elephant"], answer: 3, why: "An elephant is the biggest of these." },
    ],
  },
  {
    id: "computer-basics",
    template: "QUIZ",
    title: "Computer Basics",
    subject: "Computer",
    fromGrade: 3,
    toGrade: 6,
    emoji: "💻",
    blurb: "Parts of a computer and everyday shortcuts.",
    secondsPerQuestion: 20,
    questions: [
      { q: "Which part is called the brain of the computer?", options: ["Monitor", "CPU", "Mouse", "Speaker"], answer: 1, why: "The CPU processes all instructions." },
      { q: "Which device do you use to type?", options: ["Keyboard", "Printer", "Scanner", "Monitor"], answer: 0, why: "A keyboard is an input device for typing." },
      { q: "Which is an output device?", options: ["Keyboard", "Mouse", "Monitor", "Microphone"], answer: 2, why: "A monitor shows output to you." },
      { q: "What does Ctrl + C do?", options: ["Cut", "Copy", "Close", "Create"], answer: 1, why: "Ctrl + C copies the selected item." },
      { q: "What does WWW stand for?", options: ["World Wide Web", "Web Wide World", "Wide World Web", "World Web Wide"], answer: 0, why: "WWW means World Wide Web." },
      { q: "Which of these is a web browser?", options: ["Excel", "Chrome", "Paint", "Notepad"], answer: 1, why: "Chrome is used to browse websites." },
    ],
  },
  {
    id: "mental-maths",
    template: "QUIZ",
    title: "Mental Maths Blitz",
    subject: "Maths",
    fromGrade: 4,
    toGrade: 6,
    emoji: "➗",
    blurb: "Ten quick sums against the clock.",
    secondsPerQuestion: 15,
    questions: [
      { q: "7 × 8 = ?", options: ["54", "56", "58", "64"], answer: 1, why: "7 × 8 = 56." },
      { q: "144 ÷ 12 = ?", options: ["10", "11", "12", "14"], answer: 2, why: "12 × 12 = 144." },
      { q: "15 + 28 = ?", options: ["41", "43", "45", "53"], answer: 1, why: "15 + 28 = 43." },
      { q: "100 − 37 = ?", options: ["67", "73", "63", "57"], answer: 2, why: "100 − 37 = 63." },
      { q: "What is 25% of 80?", options: ["15", "20", "25", "40"], answer: 1, why: "25% is one quarter. 80 ÷ 4 = 20." },
      { q: "12 × 12 = ?", options: ["124", "132", "144", "148"], answer: 2, why: "12 × 12 = 144." },
      { q: "Which of these is a prime number?", options: ["27", "29", "33", "39"], answer: 1, why: "29 can only be divided by 1 and itself." },
      { q: "3/4 as a decimal is…", options: ["0.34", "0.7", "0.75", "0.8"], answer: 2, why: "3 ÷ 4 = 0.75." },
      { q: "What is the LCM of 4 and 6?", options: ["10", "12", "24", "2"], answer: 1, why: "12 is the smallest number both 4 and 6 divide." },
      { q: "A square has sides of 5 cm. What is its perimeter?", options: ["10 cm", "20 cm", "25 cm", "15 cm"], answer: 1, why: "4 × 5 = 20 cm." },
    ],
  },
  {
    id: "grammar-fixer",
    template: "QUIZ",
    title: "Grammar Fixer",
    subject: "English",
    fromGrade: 5,
    toGrade: 8,
    emoji: "✏️",
    blurb: "Pick the correct word or sentence.",
    secondsPerQuestion: 20,
    questions: [
      { q: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], answer: 1, why: "A singular subject takes “goes”." },
      { q: "They ___ playing when it started to rain.", options: ["was", "were", "is", "be"], answer: 1, why: "“They” takes “were”." },
      { q: "What is the plural of “child”?", options: ["childs", "childrens", "children", "childes"], answer: 2, why: "Child has an irregular plural: children." },
      { q: "Which sentence is correct?", options: ["I have a umbrella.", "I have an umbrella.", "I has an umbrella.", "I am have an umbrella."], answer: 1, why: "Use “an” before a vowel sound." },
      { q: "What is the opposite of “ancient”?", options: ["Old", "Modern", "Historic", "Huge"], answer: 1, why: "Ancient means very old; modern is its opposite." },
      { q: "He is taller ___ his brother.", options: ["then", "that", "than", "as"], answer: 2, why: "Use “than” to compare." },
      { q: "What is the past tense of “buy”?", options: ["buyed", "boughted", "bought", "buys"], answer: 2, why: "Buy is irregular: bought." },
      { q: "Which word is a noun?", options: ["Quickly", "Beautiful", "Happiness", "Sing"], answer: 2, why: "Happiness names a feeling, so it is a noun." },
    ],
  },
  {
    id: "india-quiz",
    template: "QUIZ",
    title: "India Quiz",
    subject: "Social Science",
    fromGrade: 5,
    toGrade: 8,
    emoji: "🇮🇳",
    blurb: "How well do you know India?",
    secondsPerQuestion: 20,
    questions: [
      { q: "What is the capital of India?", options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], answer: 1, why: "New Delhi is the capital." },
      { q: "Which is the national animal of India?", options: ["Lion", "Elephant", "Tiger", "Leopard"], answer: 2, why: "The Bengal tiger is the national animal." },
      { q: "Who was the first Prime Minister of India?", options: ["Mahatma Gandhi", "Jawaharlal Nehru", "Sardar Patel", "Rajendra Prasad"], answer: 1, why: "Jawaharlal Nehru took office in 1947." },
      { q: "In which year did India become independent?", options: ["1942", "1945", "1947", "1950"], answer: 2, why: "Independence came on 15 August 1947." },
      { q: "Which is the largest state of India by area?", options: ["Maharashtra", "Rajasthan", "Madhya Pradesh", "Uttar Pradesh"], answer: 1, why: "Rajasthan is the largest by area." },
      { q: "In which city is the Taj Mahal?", options: ["Delhi", "Jaipur", "Agra", "Lucknow"], answer: 2, why: "The Taj Mahal is in Agra." },
      { q: "How many spokes does the Ashoka Chakra have?", options: ["12", "18", "24", "30"], answer: 2, why: "The wheel on the flag has 24 spokes." },
      { q: "When did the Constitution of India come into effect?", options: ["15 Aug 1947", "26 Jan 1950", "2 Oct 1949", "26 Nov 1949"], answer: 1, why: "It came into effect on 26 January 1950." },
    ],
  },
  {
    id: "algebra-warmup",
    template: "QUIZ",
    title: "Algebra Warm-up",
    subject: "Maths",
    fromGrade: 9,
    toGrade: 10,
    emoji: "🧮",
    blurb: "Identities, quadratics and sequences.",
    secondsPerQuestion: 25,
    questions: [
      { q: "If x + 5 = 12, what is x?", options: ["5", "6", "7", "17"], answer: 2, why: "x = 12 − 5 = 7." },
      { q: "(a + b)² equals…", options: ["a² + b²", "a² + 2ab + b²", "a² − 2ab + b²", "2a + 2b"], answer: 1, why: "This is the standard identity." },
      { q: "What are the roots of x² − 5x + 6 = 0?", options: ["1 and 6", "2 and 3", "−2 and −3", "5 and 1"], answer: 1, why: "(x − 2)(x − 3) = 0." },
      { q: "The discriminant of ax² + bx + c is…", options: ["b² − 4ac", "b² + 4ac", "4ac − b", "−b/2a"], answer: 0, why: "D = b² − 4ac decides the nature of roots." },
      { q: "The sum of the first n natural numbers is…", options: ["n(n − 1)/2", "n(n + 1)/2", "n²", "2n + 1"], answer: 1, why: "Sum = n(n + 1)/2." },
      { q: "The nth term of an AP is…", options: ["a + nd", "a + (n − 1)d", "a × rⁿ", "a − (n + 1)d"], answer: 1, why: "aₙ = a + (n − 1)d." },
      { q: "What is the value of sin 30°?", options: ["1", "√3/2", "1/2", "0"], answer: 2, why: "sin 30° = 1/2." },
      { q: "If 2x − 3 = 9, what is x?", options: ["3", "4", "6", "12"], answer: 2, why: "2x = 12, so x = 6." },
    ],
  },

  // ---------------------------------------------------------------- ORDER
  {
    id: "sentence-builder",
    template: "ORDER",
    title: "Sentence Builder",
    subject: "English",
    fromGrade: 1,
    toGrade: 4,
    emoji: "🧱",
    blurb: "Tap the words in the right order.",
    rounds: [
      { title: "Sentence 1", prompt: "Tap the words to make a sentence.", steps: ["The", "cat", "sat", "on", "the", "mat"] },
      { title: "Sentence 2", prompt: "Tap the words to make a sentence.", steps: ["I", "like", "to", "eat", "apples"] },
      { title: "Sentence 3", prompt: "Tap the words to make a sentence.", steps: ["Birds", "can", "fly", "in", "the", "sky"] },
    ],
  },
  {
    id: "water-cycle",
    template: "ORDER",
    title: "Water Cycle and Life Cycles",
    subject: "EVS",
    fromGrade: 3,
    toGrade: 6,
    emoji: "💧",
    blurb: "Put the stages in the correct order.",
    rounds: [
      {
        title: "The water cycle",
        prompt: "Tap the steps in the order they happen.",
        steps: ["The sun heats water in oceans and rivers", "Water evaporates into vapour", "Vapour cools and forms clouds", "Water falls as rain or snow", "Water flows back to rivers and the sea"],
      },
      {
        title: "Butterfly life cycle",
        prompt: "Tap the stages in order.",
        steps: ["Egg", "Caterpillar", "Pupa (chrysalis)", "Adult butterfly"],
      },
    ],
  },
  {
    id: "photosynthesis-steps",
    template: "ORDER",
    title: "How Plants Make Food",
    subject: "Science",
    fromGrade: 7,
    toGrade: 9,
    emoji: "🌿",
    blurb: "Order the steps of photosynthesis.",
    rounds: [
      {
        title: "Photosynthesis",
        prompt: "Tap the steps in the order they happen.",
        steps: ["Roots absorb water from the soil", "Leaves take in carbon dioxide through stomata", "Chlorophyll absorbs sunlight", "Water and carbon dioxide change into glucose", "Oxygen is released into the air"],
      },
    ],
  },
  {
    id: "freedom-timeline",
    template: "ORDER",
    title: "Freedom Struggle Timeline",
    subject: "Social Science",
    fromGrade: 8,
    toGrade: 10,
    emoji: "📜",
    blurb: "Put key events in the order they happened.",
    rounds: [
      { title: "Early years", prompt: "Tap the events from earliest to latest.", steps: ["1857: First War of Independence", "1885: Indian National Congress founded", "1919: Jallianwala Bagh massacre"] },
      { title: "Road to freedom", prompt: "Tap the events from earliest to latest.", steps: ["1930: Dandi Salt March", "1942: Quit India Movement", "1947: India becomes independent", "1950: India becomes a Republic"] },
    ],
  },
];

export const ALL_SUBJECTS = Array.from(new Set(ARCADE_GAMES.map((g) => g.subject)));

/** "Class 7", "7th", "7" -> 7. Returns null when the grade is not a plain class number. */
export function parseGrade(grade?: string | null): number | null {
  const m = String(grade ?? "").match(/\d{1,2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= 10 ? n : null;
}

export const gamesForGrade = (grade: number | null) =>
  grade === null ? ARCADE_GAMES : ARCADE_GAMES.filter((g) => grade >= g.fromGrade && grade <= g.toGrade);
