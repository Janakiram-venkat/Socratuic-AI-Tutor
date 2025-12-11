import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Roadmap, BASE_SYSTEM_INSTRUCTION, SOCRATIC_LEVEL_INSTRUCTIONS, SocraticLevel, Exam, ExamResult, StudentProfile, StudentMemory, ConceptMap } from "../types";
import { decode, decodeAudioData } from "./audioUtils";
import { StorageService } from "./storageService";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper for cleaning and parsing JSON output from LLM
const parseJSON = (text: string | undefined, fallback: any = {}) => {
    if (!text) return fallback;
    try {
        // 1. Try simple parse first
        return JSON.parse(text);
    } catch (e) {
        try {
            // 2. Strip Markdown Code Blocks (```json ... ```)
            let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // 3. Extract JSON object/array if there's extra text around it
            const firstBrace = clean.indexOf('{');
            const firstBracket = clean.indexOf('[');
            const lastBrace = clean.lastIndexOf('}');
            const lastBracket = clean.lastIndexOf(']');
            
            let start = 0;
            let end = clean.length;

            // Determine if we are looking for an object or an array
            if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                start = firstBrace;
                end = lastBrace + 1;
            } else if (firstBracket !== -1) {
                start = firstBracket;
                end = lastBracket + 1;
            }

            if (start !== -1 && end !== 0 && end > start) {
                clean = clean.substring(start, end);
            }

            return JSON.parse(clean);
        } catch (e2) {
            console.error("Failed to parse JSON response:", e2);
            // Return fallback on failure to prevent app crash
            return fallback;
        }
    }
};

/**
 * Generates a structured roadmap for a topic.
 */
export const generateRoadmap = async (topic: string, profile?: StudentProfile): Promise<Roadmap> => {
  const context = profile ? `The student is ${profile.name}, in ${profile.educationLevel}, studying ${profile.subjects.join(', ')}.` : '';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Context: ${context}. Create a detailed study roadmap for the topic: "${topic}". 
      Break it down into 5-8 sequential milestones (nodes).
      Each node should have a title and a short description appropriate for their education level.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["title", "description"],
              },
            },
          },
          required: ["topic", "nodes"],
        },
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    const data = parseJSON(response.text, { topic: topic, nodes: [] });
    
    return {
      id: crypto.randomUUID(),
      topic: data.topic || topic,
      createdAt: Date.now(),
      nodes: (data.nodes || []).map((n: any) => ({
        id: crypto.randomUUID(),
        title: n.title,
        description: n.description,
        completed: false
      })),
    };
  } catch (error) {
    console.error("Roadmap generation failed:", error);
    throw error;
  }
};

/**
 * Text-based Chat with Socratic Method, Difficulty Levels, Memory, and Emotion.
 */
export const sendTextMessage = async (
  history: {role: string, parts: any[]}[], 
  message: string,
  image: string | undefined,
  level: SocraticLevel = SocraticLevel.MEDIUM,
  profile?: StudentProfile
) => {
  let contextInstruction = "";
  if (profile) {
    contextInstruction = `You are tutoring ${profile.name}, who is in ${profile.educationLevel}. Tailor your analogies and complexity to this level.`;
  }

  // Load Memory
  const memory: StudentMemory = StorageService.getMemory();
  let memoryInstruction = "";
  if (memory.misconceptions.length > 0) {
      memoryInstruction = `\n[MEMORY] The student has previously struggled with: ${memory.misconceptions.join(', ')}. Be careful to check for these specific misunderstandings.`;
  }

  const systemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n${contextInstruction}\n${memoryInstruction}\n\n${SOCRATIC_LEVEL_INSTRUCTIONS[level]}`;
  
  // Adjust thinking budget based on level
  let thinkingBudget = 2048;
  if (level === SocraticLevel.HARD || level === SocraticLevel.WRONG_FIRST) thinkingBudget = 8192; 
  if (level === SocraticLevel.RESEARCH || level === SocraticLevel.DECOMPOSITION) thinkingBudget = 4096;
  if (level === SocraticLevel.EASY || level === SocraticLevel.EMOTION_ADAPTIVE) thinkingBudget = 1024;

  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    history: history,
    config: {
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingBudget }
    }
  });

  // Construct message content
  const parts: any[] = [];
  if (image) {
      parts.push({
          inlineData: {
              mimeType: 'image/jpeg',
              data: image
          }
      });
  }
  parts.push({ text: message });

  const response = await chat.sendMessage({ message: parts });
  return response.text;
};

/**
 * Generates an update for a concept map based on the conversation.
 */
export const generateConceptMapUpdate = async (conversation: string, currentMap: ConceptMap): Promise<ConceptMap> => {
  // We only ask for NEW nodes to be efficient
  const existingLabels = currentMap.nodes.map(n => n.label).join(", ");
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", 
    contents: `
      Analyze the recent conversation and update the concept map.
      The goal is to build a simple, elegant graph that explains relationships between concepts.

      Existing Concepts: ${existingLabels}
      
      Recent Conversation:
      ${conversation}

      CRITICAL INSTRUCTIONS:
      1. Identify ONLY the most important NEW key concepts (Max 2-3 new nodes per turn to keep it clean).
      2. Concepts should be short (1-3 words).
      3. Connect NEW concepts to EACH OTHER or EXISTING concepts. **Orphan nodes are strictly prohibited.**
      4. Label links with VERBS that explain the relationship (e.g., "causes", "is part of", "requires", "leads to").
      5. If you add a node, you MUST add a link to it.

      Return JSON with 'newNodes' (label) and 'newLinks' (source, target, label).
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newNodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { label: { type: Type.STRING } },
              required: ["label"]
            }
          },
          newLinks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { 
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                label: { type: Type.STRING }
              },
              required: ["source", "target"]
            }
          }
        }
      }
    }
  });

  const data = parseJSON(response.text, { newNodes: [], newLinks: [] });
  
  const newNodes = [...currentMap.nodes];
  const newLinks = [...currentMap.links];
  
  data.newNodes?.forEach((n: any) => {
    // Basic deduplication
    if (!newNodes.find(en => en.label.toLowerCase() === n.label.toLowerCase())) {
      newNodes.push({
        id: n.label, // Simple ID
        label: n.label,
        x: 0, // Placeholder, will be set by Layout engine
        y: 0
      });
    }
  });

  data.newLinks?.forEach((l: any) => {
    // Check existence case-insensitively
    const sourceNode = newNodes.find(n => n.label.toLowerCase() === l.source.toLowerCase());
    const targetNode = newNodes.find(n => n.label.toLowerCase() === l.target.toLowerCase());

    if (sourceNode && targetNode) {
       // Use proper casing from matched nodes
       const safeSource = sourceNode.label;
       const safeTarget = targetNode.label;

       // Prevent duplicate links
       if (!newLinks.find(el => 
           (el.source === safeSource && el.target === safeTarget)
       )) {
         newLinks.push({ source: safeSource, target: safeTarget, label: l.label });
       }
    }
  });

  return { nodes: newNodes, links: newLinks };
};

/**
 * Generate an Exam from notes (text or image)
 */
export const generateExam = async (content: string, type: 'text' | 'image', profile?: StudentProfile): Promise<Exam> => {
  const parts: any[] = [];
  const profileContext = profile ? `For a student in ${profile.educationLevel}.` : "";
  
  if (type === 'image') {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: content // base64 string
      }
    });
    parts.push({ text: `Generate a varied quiz based on the visible content in this image. ${profileContext} Include multiple choice, short answer, fill in the blanks, and ordering questions.` });
  } else {
    parts.push({ text: `Generate a varied quiz based on the following notes: \n\n${content}\n\n${profileContext} Include multiple choice, short answer, fill in the blanks, and ordering questions.` });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: "A short title for the exam" },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["multiple_choice", "short_answer", "fill_in_blank", "ordering"] },
                options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }, 
                    description: "For 'multiple_choice' provide choices. For 'ordering' provide the items in RANDOM order." 
                }
              },
              required: ["id", "question", "type"]
            }
          }
        },
        required: ["topic", "questions"]
      },
      thinkingConfig: { thinkingBudget: 4096 } // Think to create good questions
    }
  });

  const data = parseJSON(response.text, { topic: "Exam", questions: [] });
  return {
    id: crypto.randomUUID(),
    topic: data.topic || "Exam",
    questions: data.questions || [],
    createdAt: Date.now()
  };
};

/**
 * Evaluate Exam Answers
 */
export const evaluateExam = async (exam: Exam, userAnswers: Record<string, string>): Promise<ExamResult> => {
  const prompt = `
    Evaluate the student's answers for the following exam on "${exam.topic}".
    
    Questions and User Answers:
    ${exam.questions.map(q => `
      Q (${q.type}): ${q.question}
      Options/Items (if applicable): ${q.options?.join(', ')}
      User Answer: ${userAnswers[q.id] || "No Answer"}
    `).join('\n\n')}

    Provide:
    1. Score (0-100)
    2. Overall encouraging feedback.
    3. A list of specific "Areas for Improvement" (concepts they missed).
    4. Corrections for each question.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          areasForImprovement: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of specific topics or concepts the student should review." 
          },
          corrections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionId: { type: Type.STRING },
                isCorrect: { type: Type.BOOLEAN },
                explanation: { type: Type.STRING }
              },
              required: ["questionId", "isCorrect", "explanation"]
            }
          }
        },
        required: ["score", "feedback", "areasForImprovement", "corrections"]
      },
      thinkingConfig: { thinkingBudget: 4096 }
    }
  });

  const result = parseJSON(response.text, { score: 0, feedback: "Error evaluating exam", areasForImprovement: [], corrections: [] });

  // Simple logic to add misconceptions to memory
  if (result.areasForImprovement) {
      result.areasForImprovement.forEach((concept: string) => StorageService.addMisconception(concept));
  }

  return result;
};

/**
 * Text-to-Speech Generation.
 */
export const playTextToSpeech = async (text: string): Promise<void> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return;

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);

    const audioBuffer = await decodeAudioData(
      decode(base64Audio),
      outputAudioContext,
      24000,
      1,
    );
    
    const source = outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputNode);
    source.start();

  } catch (e) {
    console.error("TTS Error", e);
  }
};