"use client"
import { useState, useRef, useEffect } from "react";
import { Send, Upload, Bot, User, Loader2, Check, X } from "lucide-react";

interface Question {
  id: string;
  content: string;
  type: "multiple_choice" | "text";
  choices?: string[];
  correctAnswer: string;
  explanation: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  questions?: Question[];
  answers?: {
    questionId: string;
    answer: string;
    isCorrect?: boolean;
  }[];
}

interface QuizSession {
  fileId: string;
  vectorStoreId: string;
  assistantId: string;
}

export default function QuizApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [session, setSession] = useState<QuizSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // セッション情報の復元
    const savedSession = sessionStorage.getItem('quizSession');
    if (savedSession) {
      setSession(JSON.parse(savedSession));
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    setIsProcessing(true);
  
    try {
      const file = event.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
  
      const response = await fetch('/api/quiz', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error(await response.text());
      }
  
      const result = await response.json();
      
      // セッション情報を保存
      const newSession = {
        fileId: result.fileId,
        vectorStoreId: result.vectorStoreId,
        assistantId: result.assistantId
      };
      
      sessionStorage.setItem('quizSession', JSON.stringify(newSession));
      setSession(newSession);
  
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `${file.name}を読み込みました。以下のような指示で問題を作成できます：
・重要なポイントから問題を3つ作成
・特定のトピックに関する問題を作成
・応用的な問題を作成
・キーワードを使った穴埋め問題`
      }]);
  
    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "ファイルのアップロードに失敗しました。もう一度お試しください。"
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuestionGeneration = async (prompt: string) => {
    if (!session?.assistantId) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "まずファイルをアップロードしてください。"
      }]);
      return;
    }

    setIsProcessing(true);
  
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('assistantId', session.assistantId);
  
      const response = await fetch('/api/quiz', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error(await response.text());
      }
  
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
  
      if (result.questions) {
        setMessages(prev => [...prev,
          {
            id: Date.now().toString(),
            role: "user",
            content: prompt
          },
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "以下の問題を作成しました：",
            questions: result.questions
          }
        ]);
        setCurrentAnswers({});  // 新しい問題セットのために回答をリセット
      }
  
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: error instanceof Error ? error.message : "エラーが発生しました。"
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    handleQuestionGeneration(input);
    setInput("");
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setCurrentAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitAnswers = (questions: Question[]) => {
    const answers = questions.map(question => ({
      questionId: question.id,
      answer: currentAnswers[question.id] || "",
      isCorrect: currentAnswers[question.id] === question.correctAnswer
    }));

    const score = answers.filter(a => a.isCorrect).length;
    
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: "回答を提出しました",
        answers
      },
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `採点結果: ${score}/${questions.length}点\n\n${questions.map(question => 
          `【問題】${question.content}\n` +
          `あなたの回答: ${currentAnswers[question.id] || "未回答"}\n` +
          `正解: ${question.correctAnswer}\n` +
          `解説: ${question.explanation}\n`
        ).join("\n")}`
      }
    ]);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI Study Assistant</h1>
        <p className="text-gray-600">PDFや画像をアップロードして、AIがオリジナルの問題を作成します</p>
      </div>

      <div className="mb-4">
        <label
          htmlFor="file-upload"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer w-fit disabled:opacity-50"
        >
          <Upload className="h-5 w-5" />
          <span>{isProcessing ? "処理中..." : "ファイルをアップロード"}</span>
          <input
            id="file-upload"
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isProcessing}
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 bg-gray-50 p-4 rounded-lg">
        {messages.map(message => (
          <div key={message.id} className={`flex gap-3 ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}>
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-lg p-4 ${
              message.role === "user" ? "bg-blue-600 text-white" : "bg-white shadow"
            }`}>
              <p className="whitespace-pre-wrap">{message.content}</p>

              {message.questions && (
                <div className="mt-4 space-y-6">
                  {message.questions.map(question => (
                    <div key={question.id} className="space-y-2">
                      <p className="font-medium">{question.content}</p>
                      {question.type === "multiple_choice" ? (
                        <div className="space-y-2">
                          {question.choices?.map((choice, index) => (
                            <label key={index} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name={question.id}
                                value={choice}
                                checked={currentAnswers[question.id] === choice}
                                onChange={e => handleAnswer(question.id, e.target.value)}
                                className="form-radio"
                              />
                              <span>{choice}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={currentAnswers[question.id] || ""}
                          onChange={e => handleAnswer(question.id, e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="回答を入力してください"
                        />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => submitAnswers(message.questions!)}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    回答を提出
                  </button>
                </div>
              )}

              {message.answers && (
                <div className="mt-4 space-y-2">
                  {message.answers.map(answer => (
                    <div key={answer.questionId} className="flex items-center gap-2">
                      {answer.isCorrect ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <X className="h-5 w-5 text-red-500" />
                      )}
                      <span>{answer.answer || "未回答"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {message.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={session ? "どんな問題を作成しますか？" : "まずファイルをアップロードしてください"}
          className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isProcessing || !session}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim() || !session}
          className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
}