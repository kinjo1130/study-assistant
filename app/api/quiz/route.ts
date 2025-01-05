import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Language = "ja" | "en" | "zh" | "ko";

const INSTRUCTIONS_BY_LANGUAGE: Record<Language, string> = {
  ja: `アップロードされたファイルの内容から問題を生成してください。

必ず以下の手順で処理を行ってください：
1. search_file関数を使用してファイルから重要な概念や用語を検索
2. 検索結果に基づいて問題を作成
3. 問題はファイルの内容に基づいた具体的なものにする`,

  en: `Generate questions based on the uploaded file content.

Please follow these steps:
1. Use search_file function to find important concepts and terms from the file
2. Create questions based on the search results
3. Questions should be specific and based on the file content`,

  zh: `请根据上传的文件内容生成问题。

请按照以下步骤操作：
1. 使用search_file函数从文件中搜索重要概念和术语
2. 基于搜索结果创建问题
3. 问题应具体且基于文件内容`,

  ko: `업로드된 파일 내용을 바탕으로 문제를 생성해 주세요.

다음 단계를 반드시 따라주세요:
1. search_file 함수를 사용하여 파일에서 중요한 개념과 용어 검색
2. 검색 결과를 바탕으로 문제 작성
3. 문제는 파일 내용에 기반한 구체적인 것이어야 함`
};

const getAssistantInstructions = (lang: Language) => `You are a JSON-only quiz generator for ${lang === "ja" ? "Japanese" : lang === "en" ? "English" : lang === "zh" ? "Chinese" : "Korean"} educational content.

${INSTRUCTIONS_BY_LANGUAGE[lang]}

Required JSON format:
{
  "questions": [
    {
      "id": "q1",
      "content": "問題文",
      "type": "multiple_choice | text | true_false | matching | ordering | fill_in_blank",
      "difficulty": "easy | medium | hard",
      "points": 1-10,
      "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "matchingPairs": [
        { "left": "左側の項目", "right": "右側の項目" }
      ],
      "orderItems": ["項目1", "項目2", "項目3"],
      "correctAnswer": "答え" or ["答え1", "答え2"],
      "explanation": "解説文"
    }
  ]
}

IMPORTANT:
- Return ONLY a valid JSON object
- DO NOT include any explanatory text
- Your entire response must be parseable by JSON.parse()
- Generate all content in ${lang === "ja" ? "Japanese" : lang === "en" ? "English" : lang === "zh" ? "Chinese" : "Korean"}`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string;
    const assistantId = formData.get('assistantId') as string;
    const lang = (formData.get('lang') as Language) || 'ja';

    if (file) {
      try {
        const vectorStores = await openai.beta.vectorStores.list();
        let vectorStore = vectorStores.data.find(store => 
          store.name === `QuizDocuments_${file.name}_${lang}`
        );
        
        if (!vectorStore) {
          vectorStore = await openai.beta.vectorStores.create({
            name: `QuizDocuments_${file.name}_${lang}`,
          });
        }

        await openai.beta.vectorStores.fileBatches.uploadAndPoll(
          vectorStore.id,
          { files: [file] }
        );

        const assistant = await openai.beta.assistants.create({
          name: `Quiz Generator - ${file.name} - ${lang}`,
          instructions: getAssistantInstructions(lang),
          model: "gpt-4-turbo-preview",
          tools: [{ type: "file_search" }]
        });

        await openai.beta.assistants.update(assistant.id, {
          tool_resources: { 
            file_search: { 
              vector_store_ids: [vectorStore.id] 
            } 
          }
        });

        return NextResponse.json({ 
          success: true,
          fileId: file.name,
          vectorStoreId: vectorStore.id,
          assistantId: assistant.id,
          language: lang
        });
      } catch (error) {
        console.error('File processing error:', error);
        throw error;
      }
    }

    if (!assistantId) {
      return NextResponse.json(
        { error: 'アシスタントIDが必要です' }, 
        { status: 400 }
      );
    }

    const thread = await openai.beta.threads.create();

    const searchPrompt = {
      ja: "ファイルから重要な概念、定義、プロセスを検索してください。",
      en: "Please search for important concepts, definitions, and processes from the file.",
      zh: "请从文件中搜索重要的概念、定义和流程。",
      ko: "파일에서 중요한 개념, 정의, 프로세스를 검색해 주세요."
    }[lang];

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `search_file関数を使用して、${searchPrompt}`
    });

    const defaultPrompt = {
      ja: "ファイルの内容から、選択式、記述式、正誤問題など様々なタイプの問題を3つ作成",
      en: "Create 3 questions of various types (multiple choice, text, true/false) based on the file content",
      zh: "根据文件内容创建3个不同类型的问题（选择题、文本题、判断题等）",
      ko: "파일 내용을 바탕으로 객관식, 주관식, 참/거짓 등 다양한 유형의 문제 3개 작성"
    }[lang];

    const userPrompt = `
${prompt || defaultPrompt}

Return JSON object only.`;

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userPrompt
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      instructions: "Return ONLY a valid JSON object. Do not include any explanatory text."
    });

    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const runStatus = await openai.beta.threads.runs.retrieve(
        thread.id, 
        run.id,
      );
      console.log('Run status:', runStatus);
      
      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id);
        console.log('Messages:', messages);
        const lastMessage = messages.data[0].content[0];
        console.log('Last message:', lastMessage);

        return NextResponse.json({
          success: true,
          questions: lastMessage,
          language: lang
        });
      }
      
      if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        throw new Error(`実行が失敗しました: ${runStatus.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('タイムアウトまたは無効な応答');
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '処理に失敗しました' 
    }, { status: 500 });
  }
}