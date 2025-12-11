export interface StudentProfile {
  name: string;
  educationLevel: string;
  subjects: string[];
}

export interface StudentMemory {
  misconceptions: string[];
  strengths: string[];
  lastTopic?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // HTML string for rich text
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface RoadmapNode {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface Roadmap {
  id: string;
  topic: string;
  nodes: RoadmapNode[];
  createdAt: number;
  completed?: boolean;
}

export interface ConceptNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface ConceptLink {
  source: string;
  target: string;
  label?: string;
}

export interface ConceptMap {
  nodes: ConceptNode[];
  links: ConceptLink[];
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  description: string;
  condition: (stats: UserStats) => boolean;
}

export interface UserStats {
  xp: number;
  streak: number;
  lastLoginDate: string; // YYYY-MM-DD
  completedNodes: number;
  studyTimeSeconds: number;
  dailyStudyTime: Record<string, number>; // YYYY-MM-DD -> seconds
  badges: string[]; // List of Badge IDs
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 encoded image
  audioData?: string; // Base64 encoded audio
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastUpdated: number;
}

export enum AppView {
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  ROADMAP = 'ROADMAP',
  TUTOR_TEXT = 'TUTOR_TEXT',
  TUTOR_LIVE = 'TUTOR_LIVE',
  EXAM = 'EXAM',
  NOTEBOOK = 'NOTEBOOK',
  CONCEPT_BUILDER = 'CONCEPT_BUILDER',
}

export enum SocraticLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  RESEARCH = 'RESEARCH',
  EMOTION_ADAPTIVE = 'EMOTION_ADAPTIVE',
  DECOMPOSITION = 'DECOMPOSITION',
  WRONG_FIRST = 'WRONG_FIRST'
}

export interface ExamQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'short_answer' | 'fill_in_blank' | 'ordering';
  options?: string[]; // For multiple choice or ordering items
}

export interface Exam {
  id: string;
  topic: string;
  questions: ExamQuestion[];
  createdAt: number;
}

export interface ExamResult {
  score: number; // 0 to 100
  feedback: string;
  areasForImprovement: string[]; // Specific topics to review
  corrections: {
    questionId: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export const BASE_SYSTEM_INSTRUCTION = `
You are a Socratic AI Tutor. Your goal is to guide the student to the answer through questioning.
1. **Never give the answer directly.** Ask probing questions.
2. **Be encouraging and friendly.**
3. **Strictly Educational.** Ignore non-educational topics.
4. **Math Formatting.** ALWAYS use LaTeX formatting for equations. Use $$ for display math (e.g. $$x^2 = 4$$) and $ for inline math (e.g. $x=2$).
`;

export const SOCRATIC_LEVEL_INSTRUCTIONS = {
  [SocraticLevel.EASY]: "Level: EASY. Be helpful. If the user struggles slightly, provide strong hints. Keep the questioning chain short (1-2 questions) before guiding them to the conclusion.",
  [SocraticLevel.MEDIUM]: "Level: MEDIUM. Standard Socratic method. Guide the user step-by-step. Do not give the answer until the user has effectively derived it themselves.",
  [SocraticLevel.HARD]: "Level: HARD. Relentless questioning. Challenge the user's assumptions. Ask 'Why?' repeatedly. Demand deep understanding and rigorous proof before accepting an answer. Do not offer hints unless the user is completely stuck.",
  [SocraticLevel.RESEARCH]: "Level: RESEARCH / CURIOSITY. Act as a Research Assistant. Provide deep, comprehensive answers. Cite sources or concepts clearly. After your explanation, ALWAYS ask a 'Curiosity Question'—an intriguing follow-up question related to the topic that sparks wonder and encourages further exploration.",
  [SocraticLevel.EMOTION_ADAPTIVE]: "Level: EMOTION ADAPTIVE. First, analyze the user's tone. If they seem frustrated, tired, or overwhelmed, switch to a supportive, gentle persona, offer easier questions, and validate their feelings. If they seem confident, challenge them. Your priority is maintaining their motivation.",
  [SocraticLevel.DECOMPOSITION]: "Level: TASK DECOMPOSITION. Do NOT explain concepts. Instead, ask questions that force the student to break the problem down into the smallest possible sub-tasks. Example: 'Before we calculate force, what variables do we need to know?'",
  [SocraticLevel.WRONG_FIRST]: "Level: WRONG ANSWERS FIRST. Before helping them solve it correctly, ask: 'What do you think is a common mistake people make with this type of problem, and why?'. Guide them to identify potential pitfalls first."
};