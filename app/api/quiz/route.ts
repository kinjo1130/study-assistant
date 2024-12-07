import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const ASSISTANT_INSTRUCTIONS = `You are a JSON-only quiz generator for Japanese educational content.

CRITICAL RULES:
1. ONLY output a valid JSON object
2. DO NOT include any explanatory text or markdown
3. DO NOT add any text before or after the JSON
4. DO NOT include any Japanese text outside the JSON structure
5. Your entire response must be parseable by JSON.parse()

Required JSON format:
{
  "questions": [
    {
      "id": "q1",
      "content": "問題文",
      "type": "multiple_choice",
      "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "correctAnswer": "正解の選択肢",
      "explanation": "解説文"
    }
  ]
}

Required behavior:
- For multiple_choice type, always include exactly 4 choices
- For text type, omit the choices field
- Always use sequential IDs (q1, q2, q3...)
- Always create questions based on the provided content
- Keep all content-related text in Japanese
- Keep the JSON structure in English`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string;
    const assistantId = formData.get('assistantId') as string;

    if (file) {
      try {
        const vectorStores = await openai.beta.vectorStores.list();
        let vectorStore = vectorStores.data.find(store => 
          store.name === `QuizDocuments_${file.name}`
        );
        
        if (!vectorStore) {
          vectorStore = await openai.beta.vectorStores.create({
            name: `QuizDocuments_${file.name}`,
          });
        }

        await openai.beta.vectorStores.fileBatches.uploadAndPoll(
          vectorStore.id,
          { files: [file] }
        );

        const assistant = await openai.beta.assistants.create({
          name: `Quiz Generator - ${file.name}`,
          instructions: ASSISTANT_INSTRUCTIONS,
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
          assistantId: assistant.id
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

    // プロンプトにもJSON形式での返答を強調
    const userPrompt = `${prompt || "アップロードされた資料から重要なポイントを確認する問題を3つ作成してください"}

Return ONLY a JSON object containing the questions. Do not include any other text.`;

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userPrompt
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      instructions: "IMPORTANT: Return ONLY a valid JSON object. Do not include any explanatory text or markdown. The entire response must be parseable by JSON.parse()",
     
      
    });

    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const runStatus = await openai.beta.threads.runs.retrieve(
        thread.id, 
        run.id,
      );
      
      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0].content[0];
        
        if ('text' in lastMessage) {
          try {
            const responseText = lastMessage.text.value.trim();
            
            // 余分なテキストを除去してJSONを抽出
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              throw new Error('JSONが見つかりません');
            }

            const cleanJson = jsonMatch[0].trim();
            const questions = JSON.parse(cleanJson);
            
           // 基本的な構造の検証
           if (!questions.questions || !Array.isArray(questions.questions)) {
            console.log('Invalid structure:', questions);
            throw new Error('questions配列が見つかりません');
          }

          // 各質問を正規化
          const normalizedQuestions = questions.questions.map((q: any, index: number) => {
            // 必須フィールドが無い場合はデフォルト値を設定
            return {
              id: q.id || `q${index + 1}`,
              content: q.content || '問題文が設定されていません',
              type: q.type || 'multiple_choice',
              choices: q.type !== 'text' ? (q.choices || ['選択肢1', '選択肢2', '選択肢3', '選択肢4']) : undefined,
              correctAnswer: q.correctAnswer || '正解が設定されていません',
              explanation: q.explanation || '解説が設定されていません'
            };
          });


            return NextResponse.json({
              success: true,
              questions: normalizedQuestions
            });
          } catch (error) {
            console.error('Response parsing error:', error);
            throw error;
          }
        }
        break;
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