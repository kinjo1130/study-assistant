"use client"
import { useState, useRef, useEffect } from "react";
import { Send, Upload, Bot, User, Loader2, Check, X } from "lucide-react";

interface APIQuestion {
  question: string;
  answer: string;
  source: string;
}

interface APIResponse {
  questions: APIQuestion[];
}

interface Question {
  id: string;
  content: string | undefined;
  type: "text";
  correctAnswer: string;
  explanation: string;
  source: string;
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
  const [lang, setLang] = useState<string>("ja");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      formData.append('lang', lang);
  
      const response = await fetch('/api/quiz', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error(await response.text());
      }
  
      const result = await response.json();
      
      const newSession = {
        fileId: result.fileId,
        vectorStoreId: result.vectorStoreId,
        assistantId: result.assistantId
      };
      
      sessionStorage.setItem('quizSession', JSON.stringify(newSession));
      setSession(newSession);
  
      const welcomeMessage = {
        ja: `${file.name}を読み込みました。以下のような指示で問題を作成できます：
・重要なポイントから問題を3つ作成
・特定のトピックに関する問題を作成
・応用的な問題を作成
・キーワードを使った問題を作成`,
        en: `${file.name} has been loaded. You can create questions with instructions like:
・Create 3 questions from important points
・Create questions about specific topics
・Create application questions
・Create questions using keywords`,
        zh: `已读取${file.name}。您可以通过以下指示创建问题：
・从重要观点创建3个问题
・创建特定主题的问题
・创建应用型问题
・使用关键词创建问题`,
        ko: `${file.name}를 읽었습니다. 다음과 같은 지시로 문제를 만들 수 있습니다:
・중요 포인트에서 3개의 문제 작성
・특정 주제에 관한 문제 작성
・응용 문제 작성
・키워드를 사용한 문제 작성`
      }[lang];

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: welcomeMessage ?? ""
      }]);
  
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = {
        ja: "ファイルのアップロードに失敗しました。もう一度お試しください。",
        en: "Failed to upload file. Please try again.",
        zh: "文件上传失败。请重试。",
        ko: "파일 업로드에 실패했습니다. 다시 시도해주세요."
      }[lang];

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: errorMessage ?? ""
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // QuizApp.tsx内のhandleQuestionGeneration関数を修正

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

    if (result.questions?.text?.value) {
      try {
        // JSON文字列から実際のオブジェクトを抽出
        const jsonMatch = result.questions.text.value.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[1]);

          // conceptsとquestionsの両方のフォーマットに対応
          let formattedQuestions;
          if (parsedData.concepts) {
            // concepts形式からquestions形式に変換
            formattedQuestions = parsedData.concepts.map((concept: any, index: number) => ({
              id: `q${index + 1}`,
              content: concept.definition,
              type: "text",
              correctAnswer: concept.concept,
              explanation: `手順: ${concept.process.join(' → ')}`,
              source: concept.source
            }));
          } else if (parsedData.questions) {
            // 既存のquestions形式をそのまま使用
            formattedQuestions = parsedData.questions.map((q: any, index: number) => ({
              id: `q${index + 1}`,
              content: q.question,
              type: "text",
              correctAnswer: q.answer,
              explanation: q.explanation || q.source,
              source: q.source
            }));
          }

          if (formattedQuestions) {
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
                questions: formattedQuestions
              }
            ]);
            setCurrentAnswers({});
          }
        }
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        throw new Error('問題データの解析に失敗しました');
      }
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
    
    const scoreMessage = {
      ja: `採点結果: ${score}/${questions.length}点\n\n`,
      en: `Score: ${score}/${questions.length}\n\n`,
      zh: `得分: ${score}/${questions.length}\n\n`,
      ko: `채점 결과: ${score}/${questions.length}점\n\n`
    }[lang];

    const answersSubmittedMessage = {
      ja: "回答を提出しました",
      en: "Answers submitted",
      zh: "已提交答案",
      ko: "답안을 제출했습니다"
    }[lang];

    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: answersSubmittedMessage ?? "",
        answers
      },
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `${scoreMessage}${questions.map(question => 
          `【${lang === 'ja' ? '問題' : lang === 'en' ? 'Question' : lang === 'zh' ? '问题' : '문제'}】${question.content}\n` +
          `${lang === 'ja' ? 'あなたの回答' : lang === 'en' ? 'Your answer' : lang === 'zh' ? '你的答案' : '당신의 답'}: ${currentAnswers[question.id] || (
            lang === 'ja' ? '未回答' : 
            lang === 'en' ? 'No answer' : 
            lang === 'zh' ? '未答' : 
            '무응답'
          )}\n` +
          `${lang === 'ja' ? '正解' : lang === 'en' ? 'Correct answer' : lang === 'zh' ? '正确答案' : '정답'}: ${question.correctAnswer}\n` +
          `${lang === 'ja' ? '解説' : lang === 'en' ? 'Explanation' : lang === 'zh' ? '解释' : '해설'}: ${question.explanation}\n`
        ).join("\n")}`
      }
    ]);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Study Assistant</h1>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="ko">한국어</option>
          </select>
        </div>
        <p className="text-gray-600">
          {lang === 'ja' ? 'PDFや画像をアップロードして、AIがオリジナルの問題を作成します' :
           lang === 'en' ? 'Upload PDFs or images, and AI will create original questions' :
           lang === 'zh' ? '上传PDF或图片，AI将创建原创题目' :
           'PDF나 이미지를 업로드하면 AI가 오리지널 문제를 만듭니다'}
        </p>
      </div>

      <div className="mb-4">
        <label
          htmlFor="file-upload"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer w-fit disabled:opacity-50"
        >
          <Upload className="h-5 w-5" />
          <span>
            {isProcessing ? 
              (lang === 'ja' ? '処理中...' :
               lang === 'en' ? 'Processing...' :
               lang === 'zh' ? '处理中...' :
               '처리 중...') :
              (lang === 'ja' ? 'ファイルをアップロード' :
               lang === 'en' ? 'Upload file' :
               lang === 'zh' ? '上传文件' :
               '파일 업로드')}
          </span>
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
                      <input
                        type="text"
                        value={currentAnswers[question.id] || ""}
                        onChange={e => handleAnswer(question.id, e.target.value)}
                        className="w-full p-2 border rounded"
                        placeholder={
                          lang === 'ja' ? '回答を入力してください' :
                          lang === 'en' ? 'Enter your answer' :
                          lang === 'zh' ? '请输入答案' :
                          '답을 입력해주세요'
                        }
                      />
                      <p className="text-sm text-gray-500">
                        {lang === 'ja' ? '出典' : 
                         lang === 'en' ? 'Source' : 
                         lang === 'zh' ? '来源' : 
                         '출처'}: {question.source}
                      </p>
                    </div>
                  ))}
                  <button
                    onClick={() => submitAnswers(message.questions!)}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {lang === 'ja' ? '回答を提出' :
                     lang === 'en' ? 'Submit answers' :
                     lang === 'zh' ? '提交答案' :
                     '답안 제출'}
                  </button>
                </div>
              )}

              {message.answers && message.questions && (
                <div className="mt-4 space-y-2">
                  {message.answers.map(answer => (
                    <div key={answer.questionId} className="space-y-1">
                      <div className="flex items-center gap-2">
                        {answer.isCorrect ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <X className="h-5 w-5 text-red-500" />
                        )}
                        <span>{answer.answer || (
                          lang === 'ja' ? '未回答' :
                          lang === 'en' ? 'No answer' :
                          lang === 'zh' ? '未答' :
                          '무응답'
                        )}</span>
                      </div>
                      {message.questions?.find(q => q.id === answer.questionId) && (
                        <p className="text-sm text-gray-500 ml-7">
                          {lang === 'ja' ? '出典' : 
                           lang === 'en' ? 'Source' : 
                           lang === 'zh' ? '来源' : 
                           '출처'}: {message.questions.find(q => q.id === answer.questionId)?.source}
                        </p>
                      )}
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
          placeholder={
            !session ? 
              (lang === 'ja' ? 'まずファイルをアップロードしてください' :
               lang === 'en' ? 'Please upload a file first' :
               lang === 'zh' ? '请先上传文件' :
               '먼저 파일을 업로드해주세요') :
              (lang === 'ja' ? 'どんな問題を作成しますか？' :
               lang === 'en' ? 'What kind of questions would you like to create?' :
               lang === 'zh' ? '想要创建什么样的问题？' :
               '어떤 문제를 만들까요?')
          }
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