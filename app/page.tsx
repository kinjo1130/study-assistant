// app/page.tsx
'use client';

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Send, Upload, Bot, User, Loader2, Check, X } from "lucide-react";

interface Question {
  id: string;
  content: string;
  type: "multiple_choice" | "text";
  choices?: string[];
  correctAnswer: string;
  explanation?: string;
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  
      if (!response.ok) throw new Error('Upload failed');
  
      const result = await response.json();
      console.log('Upload result:', result);
  
      // セッション情報を保存
      sessionStorage.setItem('quizSession', JSON.stringify({
        fileId: result.fileId,
        vectorStoreId: result.vectorStoreId,
        assistantId: result.assistantId
      }));
  
      setContent(result.content);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `${file.name}を読み込みました。どのような問題を作成しますか？例えば：\n・重要なポイントから問題を3つ\n・応用的な問題を作成\n・キーワードを使った穴埋め問題`
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
  
  const handlePromptSubmit = async (prompt: string) => {
    setIsProcessing(true);
  
    try {
      // セッション情報を取得
      const sessionData = sessionStorage.getItem('quizSession');
      if (!sessionData) {
        throw new Error('セッション情報が見つかりません。ファイルを再度アップロードしてください。');
      }
  
      const { assistantId } = JSON.parse(sessionData);
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('assistantId', assistantId);
  
      const response = await fetch('/api/quiz', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) throw new Error('Failed to generate questions');
  
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
  
      if (result.questions) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "user",
          content: prompt
        }, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "問題を作成しました。",
          questions: result.questions
        }]);
      }
  
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: error instanceof Error ? error.message : "エラーが発生しました。もう一度お試しください。"
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // if (!input.trim() || !content || isProcessing) return;

    const userMessage = input;
    setInput("");
    setIsProcessing(true);

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: userMessage
    }]);

    await handlePromptSubmit(userMessage);
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

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: "回答を提出しました",
      answers
    }]);

    const explanations = questions.map(question => 
      `問題: ${question.content}\n` +
      `あなたの回答: ${currentAnswers[question.id] || "未回答"}\n` +
      `正解: ${question.correctAnswer}\n` +
      `解説: ${question.explanation}\n`
    ).join("\n");

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "assistant",
      content: `採点結果：\n${explanations}`
    }]);
  };

  const QuestionComponent = ({ question }: { question: Question }) => {
    if (question.type === "multiple_choice") {
      return (
        <div className="space-y-2">
          <p className="font-medium">{question.content}</p>
          <div className="space-y-2">
            {question.choices?.map((choice, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={question.id}
                  value={choice}
                  checked={currentAnswers[question.id] === choice}
                  onChange={(e) => handleAnswer(question.id, e.target.value)}
                  className="form-radio"
                />
                <span>{choice}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="font-medium">{question.content}</p>
        <input
          type="text"
          value={currentAnswers[question.id] || ""}
          onChange={(e) => handleAnswer(question.id, e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="回答を入力してください"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI Study Assistant</h1>
        <p className="text-gray-600">PDFや画像をアップロードして、好みの問題を作成できます</p>
      </div>

      <div className="mb-4">
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
          disabled={isProcessing}
        />
        <label
          htmlFor="file-upload"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer w-fit"
        >
          <Upload className="h-5 w-5" />
          <span>ファイルをアップロード</span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="space-y-4">
            <div className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}>
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg p-4 ${
                message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100"
              }`}>
                <p className="whitespace-pre-wrap">{message.content}</p>

                {message.questions && (
                  <div className="mt-4 space-y-6">
                    {message.questions.map((question) => (
                      <QuestionComponent key={question.id} question={question} />
                    ))}
                    <button
                      onClick={() => submitAnswers(message.questions)}
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      回答を提出
                    </button>
                  </div>
                )}

                {message.answers && (
                  <div className="mt-4 space-y-2">
                    {message.answers.map((answer) => (
                      <div key={answer.questionId} className="flex items-center gap-2">
                        {answer.isCorrect ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <X className="h-5 w-5 text-red-500" />
                        )}
                        <span>{answer.answer}</span>
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
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="どんな問題を作成しますか？"
          className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          // disabled={isProcessing || !content}
        />
        <button
          type="submit"
          // disabled={isProcessing || !input.trim() || !content}
          className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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