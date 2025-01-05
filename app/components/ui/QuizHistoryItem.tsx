// components/ui/quiz-history-item.tsx
import { Check, X } from "lucide-react";
import { Card, CardHeader, CardContent } from "./Card";

interface Question {
  question: string;
  answer: string;
  source: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
}

interface QuizHistory {
  id: string;
  fileName: string;
  language: string;
  createdAt: string;
  questions: Question[];
}

interface QuizHistoryItemProps {
  history: QuizHistory;
}

export function QuizHistoryItem({ history }: QuizHistoryItemProps) {
  const getLanguageLabel = (lang: string) => {
    const labels = {
      ja: '日本語',
      en: 'English',
      zh: '中文',
      ko: '한국어'
    };
    return labels[lang as keyof typeof labels] || lang;
  };

  const calculateScore = (questions: Question[]): {
    total: number;
    answered: number;
    correct: number;
    percentage: number
  } => {
    // const answered = questions.filter(q => q.userAnswer !== null);
    // const correct = questions.filter(q => q.isCorrect);
    // return {
    //   total: questions.length,
    //   answered: answered.length,
    //   correct: correct.length,
    //   percentage: answered.length > 0 
    //     ? Math.round((correct.length / answered.length) * 100) 
    //     : 0
    // };
    return {
      total: 0,
      answered: 0,
      correct: 0,
      percentage: 0
    }
  };

  const score = calculateScore(history.questions);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-medium">{history.fileName}</h3>
            <p className="text-sm text-gray-500">
              {new Date(history.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1 text-right">
            <span className="text-sm font-medium">
              {score.correct} / {score.total} 正解
            </span>
            <p className="text-sm text-gray-500">
              {getLanguageLabel(history.language)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y">
        {history.questions.map((question, index) => (
          <div key={index} className="py-4 first:pt-0 last:pb-0">
            <div className="mb-2">
              <span className="mr-2 inline-block rounded bg-gray-100 px-2 py-1 text-sm font-medium">
                問題 {index + 1}
              </span>
            </div>
            <p className="mb-3 font-medium">{question.question}</p>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">正解: </span>
                {question.answer}
              </p>
              {question.userAnswer !== null && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">あなたの回答: </span>
                  <div className="flex items-center gap-1">
                    <span className={question.isCorrect ? "text-green-600" : "text-red-600"}>
                      {question.userAnswer}
                    </span>
                    {question.isCorrect ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </div>
              )}
              <p className="text-gray-500">
                <span className="font-medium">出典: </span>
                {question.source}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}