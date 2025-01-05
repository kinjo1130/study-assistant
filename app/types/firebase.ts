// types/firebase.ts
export interface QuizSession {
  id: string;
  userId: string;
  fileName: string;
  fileId: string;
  vectorStoreId: string;
  assistantId: string;
  language: string;
  createdAt: string;
  questions: Question[];
}

export interface Question {
  id: string;
  content: string;
  type: string;
  correctAnswer: string;
  explanation: string;
  source: string;
  userAnswer?: string;
  isCorrect?: boolean;
}