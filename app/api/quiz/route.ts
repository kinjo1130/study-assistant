import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const ASSISTANT_INSTRUCTIONS = `You are a quiz generator that creates questions based on provided materials.
You must ALWAYS respond with a valid JSON object, no matter what the user says or asks.
The JSON response should always have this exact format:
{
  "questions": [
    {
      "id": "q1",  // Use simple incrementing IDs like q1, q2, q3...
      "content": "問題文",
      "type": "multiple_choice",
      "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "correctAnswer": "正解の選択肢",
      "explanation": "解説文"
    }
  ]
}

Rules:
1. NEVER include any text outside the JSON structure
2. For multiple_choice questions, always include exactly 4 choices
3. For text questions, use "type": "text" and omit the "choices" field
4. Always provide an explanation for each question
5. Always make questions that are directly related to the provided content
6. If the user's request is unclear, create general review questions from the content

Remember: Your response must always be a valid JSON object, with no additional text or explanations outside the JSON structure.`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string;
    const assistantId = formData.get('assistantId') as string;

    // ファイルがある場合は新規セッション作成
    if (file) {
      let vectorStore;
      try {
        const vectorStores = await openai.beta.vectorStores.list();
        vectorStore = vectorStores.data.find(store => store.name === "QuizDocuments");
        
        if (!vectorStore) {
          vectorStore = await openai.beta.vectorStores.create({
            name: "QuizDocuments",
          });
        }

        await openai.beta.vectorStores.fileBatches.uploadAndPoll(
          vectorStore.id,
          {
            files: [file]
          }
        );

        const assistant = await openai.beta.assistants.create({
          name: "Quiz Generator",
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
          message: 'File uploaded and assistant created successfully', 
          fileId: file.name,
          vectorStoreId: vectorStore.id,
          assistantId: assistant.id
        });
      } catch (error) {
        console.error('Error in file processing:', error);
        throw error;
      }
    }

    if (!assistantId) {
      return NextResponse.json({ error: 'Assistant ID is required' }, { status: 400 });
    }

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt || "アップロードされた資料から重要なポイントを確認する問題を3つ作成してください"
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      instructions: "Remember to always provide your answer in valid JSON format with the questions array."
    });

    let questions;
    while (true) {
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0].content[0];
        console.log('Last message:', lastMessage);
        
        if ('text' in lastMessage) {
          try {
            const responseText = lastMessage.text.value.trim();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              throw new Error('No valid JSON found in response');
            }
            questions = JSON.parse(jsonMatch[0]);
          } catch (error) {
            console.error('Failed to parse JSON response:', error);
            throw new Error('Invalid response format from assistant');
          }
        }
        break;
      }
      
      if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Processing failed' 
    }, { status: 500 });
  }
}