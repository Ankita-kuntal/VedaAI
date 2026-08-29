import { Question, MatchedAnswer, UnmatchedAnswer } from "@/context/AppContext";

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "1",
    number: "1",
    subpart: "",
    text: "Which blood vessel carries blood away from the heart?",
    page: 1,
  },
  {
    id: "2",
    number: "2",
    subpart: "",
    text: "Which of the following organelles is primarily involved in photosynthesis?",
    page: 1,
  },
  {
    id: "3",
    number: "3",
    subpart: "",
    text: "Explain the role of chloroplasts in photosynthesis, naming the main pigments involved and briefly outlining the two major stages of the process.",
    page: 1,
  },
  {
    id: "4",
    number: "4",
    subpart: "",
    text: "Describe the flow of blood through the human heart starting from the right atrium and ending at the aorta; include the names of valves crossed.",
    page: 1,
  },
  {
    id: "5",
    number: "5",
    subpart: "",
    text: "Draw a labelled diagram of an alveolus showing capillaries and air space (label alveolar sac, capillary, and direction of gas exchange).",
    page: 1,
  },
  {
    id: "6",
    number: "6",
    subpart: "",
    text: "Draw a neat labelled diagram of the human digestive system (stomach, small intestine, large intestine, liver, pancreas) and label the site where most absorption occurs.",
    page: 2,
  },
  {
    id: "7",
    number: "7",
    subpart: "",
    text: "Draw and label a nephron (Bowman's capsule, glomerulus, proximal tubule, loop of Henle, distal tubule, collecting duct).",
    page: 2,
  },
  {
    id: "8",
    number: "8",
    subpart: "",
    text: "Explain the structural differences between palisade mesophyll and spongy mesophyll and state how each structure aids its function in the leaf.",
    page: 2,
  },
  {
    id: "9",
    number: "9",
    subpart: "",
    text: "Describe the process of transpiration in plants in two to three sentences and name two environmental factors that increase its rate.",
    page: 3,
  },
  {
    id: "10",
    number: "10",
    subpart: "",
    text: "Explain how the structure of xylem vessels facilitates water transport in plants (mention one structural feature and its role).",
    page: 3,
  },
  {
    id: "11a",
    number: "11",
    subpart: "a",
    text: "A diagram shows two potted plants — Plant A in bright light with broad green leaves, Plant B kept in dim light with pale, elongated leaves.",
    page: 4,
  },
  {
    id: "11b",
    number: "11",
    subpart: "b",
    text: "Suggest one practical measure to help Plant B recover.",
    page: 4,
  },
  {
    id: "12",
    number: "12",
    subpart: "",
    text: "A resting person has tidal volume (air per breath) of 0.5 L and breathes 12 times per minute.",
    page: 4,
  },
  {
    id: "13",
    number: "13",
    subpart: "",
    text: "If dead space is 0.15 L per breath, calculate the alveolar ventilation per minute. Show working.",
    page: 4,
  },
];

export const SAMPLE_MATCHED_ANSWERS: MatchedAnswer[] = [
  {
    questionId: "1",
    answered: true,
    extractedText:
      "Photosynthesis is the process used by green plants and some other organisms to convert light energy into chemical energy.\n\n6CO2 + 6H2O --(Light / Chlorophyll)--> C6H12O6 + 6O2",
    regions: [
      {
        page: 1,
        bbox: [80, 45, 410, 960],
      },
    ],
    feedback:
      "Arteries carry oxygenated blood away from the heart to various body tissues, while the pulmonary artery carries deoxygenated blood to the lungs.",
    score: "2/2",
  },
  {
    questionId: "2",
    answered: true,
    extractedText:
      "The process mainly occurs in the chloroplast of the plant cell. It has two main stages:\n1. Light reaction – Captures light energy.\n2. Dark reaction – Uses energy to make glucose.",
    regions: [
      {
        page: 1,
        bbox: [430, 35, 580, 975],
      },
    ],
    feedback:
      "Excellent work! You correctly identified the chloroplast as the organelle responsible for photosynthesis. Keep it up!",
    score: "2/2",
  },
  {
    questionId: "3",
    answered: true,
    extractedText:
      "Chloroplasts contain chlorophyll (a and b) and carotenoids which absorb light. The light stage occurs in thylakoid membranes releasing ATP and NADPH, and the Calvin cycle occurs in the stroma synthesizing sugar.",
    regions: [
      {
        page: 1,
        bbox: [610, 45, 890, 960],
      },
    ],
    feedback:
      "Clear explanation of both pigments and dual stages of photosynthesis.",
    score: "2/2",
  },
  {
    questionId: "4",
    answered: false,
    extractedText: "",
    regions: [],
    feedback: "No handwritten answer was detected for question 4.",
    score: "0/2",
  },
  {
    questionId: "5",
    answered: true,
    extractedText:
      "Alveoli diagram showing capillary network, thin epithelial wall (0.1 µm), diffusion of O2 into red blood cells and CO2 into alveolar lumen.",
    regions: [
      {
        page: 2,
        bbox: [80, 45, 390, 960],
      },
    ],
    feedback:
      "Well-labelled diagram depicting capillary proximity and exchange direction.",
    score: "2/2",
  },
  {
    questionId: "6",
    answered: true,
    extractedText:
      "Diagram of digestive tract showing esophagus, stomach, liver, pancreas, duodenum, ileum, and large intestine. Villi marked in the small intestine as principal absorption site.",
    regions: [
      {
        page: 2,
        bbox: [410, 45, 750, 960],
      },
    ],
    feedback:
      "Accurate labeling of stomach and pancreas; small intestine villi highlighted correctly.",
    score: "4/5",
  },
  {
    questionId: "7",
    answered: true,
    extractedText:
      "Nephron schematic showing renal corpuscle (Bowman's capsule + glomerulus), PCT, loop of Henle in medulla, DCT, and collecting duct.",
    regions: [
      {
        page: 2,
        bbox: [760, 45, 960, 960],
      },
    ],
    feedback:
      "Outstanding diagram with clear demarcation of cortex and medulla zones.",
    score: "5/5",
  },
  {
    questionId: "8",
    answered: true,
    extractedText:
      "Palisade mesophyll cells are columnar, packed tightly with abundant chloroplasts near the upper surface to maximize light capture. Spongy mesophyll has loose irregular cells with air spaces facilitating gas diffusion.",
    regions: [
      {
        page: 3,
        bbox: [80, 45, 360, 960],
      },
    ],
    feedback:
      "Good structural comparison between palisade and spongy layers.",
    score: "3/5",
  },
  {
    questionId: "9",
    answered: true,
    extractedText:
      "Transpiration is the evaporative loss of water vapor from aerial plant parts, mainly via stomata. Factors increasing rate: 1. Higher temperature 2. Increased wind speed / low humidity.",
    regions: [
      {
        page: 3,
        bbox: [380, 45, 620, 960],
      },
    ],
    feedback: "Accurate definition and correct environmental determinants.",
    score: "2/2",
  },
  {
    questionId: "10",
    answered: true,
    extractedText:
      "Xylem vessels are composed of dead hollow cells with lignified walls that withstand negative pressure (transpiration pull) and lack cross-walls for unimpeded water column flow.",
    regions: [
      {
        page: 3,
        bbox: [640, 45, 920, 960],
      },
    ],
    feedback: "Lignification and continuous lumen correctly identified.",
    score: "4/5",
  },
  {
    questionId: "11a",
    answered: true,
    extractedText:
      "Plant B exhibited etiolation due to lack of light, causing elongated stems and chlorosis (lack of chlorophyll). Plant A had normal photomorphogenesis.",
    regions: [
      {
        page: 4,
        bbox: [80, 45, 320, 960],
      },
    ],
    feedback: "Correctly identified etiolation syndrome.",
    score: "2/2",
  },
  {
    questionId: "11b",
    answered: true,
    extractedText:
      "Gradually move Plant B to bright indirect sunlight over several days and ensure adequate watering to restore chlorophyll synthesis without photo-bleaching.",
    regions: [
      {
        page: 4,
        bbox: [340, 45, 550, 960],
      },
    ],
    feedback:
      "Acclimatization to bright light is an effective corrective measure.",
    score: "1/3",
  },
  {
    questionId: "12",
    answered: true,
    extractedText:
      "Total ventilation = Tidal Volume × Respiratory Rate = 0.5 L × 12 breaths/min = 6.0 L/min.",
    regions: [
      {
        page: 4,
        bbox: [570, 45, 760, 960],
      },
    ],
    feedback: "Correct formula and unit calculation for minute ventilation.",
    score: "4/5",
  },
  {
    questionId: "13",
    answered: true,
    extractedText:
      "Alveolar ventilation = (Tidal Volume - Dead Space) × Rate = (0.5 L - 0.15 L) × 12 = 0.35 L × 12 = 4.2 L/min.",
    regions: [
      {
        page: 4,
        bbox: [780, 45, 970, 960],
      },
    ],
    feedback: "Dead space accurately deducted to compute alveolar exchange.",
    score: "4/5",
  },
];

export const SAMPLE_UNMATCHED_ANSWERS: UnmatchedAnswer[] = [
  {
    extractedText:
      "Note in margin: Remember to review the Hill reaction equations before practical exams on Friday.",
    regions: [
      {
        page: 1,
        bbox: [920, 120, 980, 880],
      },
    ],
  },
];
