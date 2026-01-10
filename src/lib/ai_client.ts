import { AiConfig, AiProvider } from './types';

const DEFAULT_CONFIG: AiConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'gemma3:1b', // Lightweight model for speed
};

export class AiClient {
    private config: AiConfig;

    constructor(config?: Partial<AiConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Update config at runtime (e.g. from UI settings)
    updateConfig(newConfig: Partial<AiConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    setBaseUrl(url: string) {
        // Remove trailing slash if present
        this.config.baseUrl = url.replace(/\/$/, "");
    }

    getConfig() {
        return this.config;
    }

    async chat(messages: { role: string; content: string }[]): Promise<string> {
        const systemPrompt = `あなたは親切なAIアシスタントです。ユーザーのタスク管理や目標達成をサポートしてください。`;

        try {
            if (this.config.provider === 'ollama') {
                return await this.chatOllama(messages, systemPrompt);
            } else if (this.config.provider === 'gemini') {
                return await this.chatGemini(messages, systemPrompt);
            }
            return "申し訳ありませんが、選択されたAIプロバイダはサポートされていません。設定を確認してください。";
        } catch (error) {
            console.error("AI Chat Failed:", error);
            // Gemini API Keyが見つからない場合のエラーメッセージを追加
            if (this.config.provider === 'gemini' && (!this.config.apiKey || !this.config.baseUrl)) {
                return "Gemini APIのBase URLまたはAPI Keyが設定されていません。設定画面で確認してください。";
            }
            return "申し訳ありませんが、エラーが発生しました。";
        }
    }

    private async chatGemini(messages: { role: string; content: string }[], systemPrompt: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s Timeout

        try {
            // Gemini APIはシステムプロンプトをuserメッセージとして結合する形式を推奨
            const formattedMessages = [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt + "\n" + messages[0].content }]
                },
                ...messages.slice(1).map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : msg.role, // Gemini APIでは'assistant'ではなく'model'を使用
                    parts: [{ text: msg.content }]
                }))
            ];

            const response = await fetch(`${this.config.baseUrl}`, { // baseUrlはGeminiのエンドポイントURLになる想定
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.config.apiKey || '', // API Keyを使用
                },
                body: JSON.stringify({
                    contents: formattedMessages,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 800,
                    },
                    // safetySettings: [...] // 必要に応じて設定
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gemini Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                return data.candidates[0].content.parts[0].text;
            }
            throw new Error("Gemini APIからの応答が不正です。");
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async chatOllama(messages: { role: string; content: string }[], systemPrompt: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(`${this.config.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages
                    ],
                    stream: false,
                    options: { temperature: 0.7 }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.message.content;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async generateActions(goal: string, means: string): Promise<string[]> {
        const prompt = `
    目標: ${goal}
    手段: ${means}
    
    上記の「目標」と「手段」を達成するための、具体的で実行可能な「行動」を3つ提案してください。
    
    【出力ルール】
    1. 言語: **必ず日本語で**出力してください（英語は不可）。
    2. 形式: 3行の箇条書きのみ。
    3. 内容: 具体的で、すぐに実行できるアクション。
    `;

        try {
            if (this.config.provider === 'ollama') {
                return await this.callOllama(prompt);
            } else if (this.config.provider === 'gemini') {
                return await this.callGeminiGenerate(prompt);
            }
            return this.getFallbackActions();
        } catch (error) {
            console.error("AI Generation Failed (Using Fallback):", error);
            // Gemini API Keyが見つからない場合のエラーメッセージを追加
            if (this.config.provider === 'gemini' && (!this.config.apiKey || !this.config.baseUrl)) {
                console.error("Gemini APIのBase URLまたはAPI Keyが設定されていません。設定画面で確認してください。");
            }
            // Fallback to ensure UI never breaks
            return this.getFallbackActions();
        }
    }

    private async callGeminiGenerate(prompt: string): Promise<string[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s Timeout

        try {
            const response = await fetch(`${this.config.baseUrl}`, { // baseUrlはGeminiのエンドポイントURLになる想定
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.config.apiKey || '', // API Keyを使用
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 800,
                    },
                    // safetySettings: [...] // 必要に応じて設定
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gemini Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                const text = data.candidates[0].content.parts[0].text;
                return text.split('\n').filter((line: string) => line.trim().length > 0).slice(0, 5);
            }
            throw new Error("Gemini APIからの応答が不正です。");
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private getFallbackActions(): string[] {
        return [
            "関連する本を1章読む (Offline)",
            "5分間リサーチをする (Offline)",
            "ノートにアイデアを書き出す (Offline)"
        ];
    }

    private async callOllama(prompt: string): Promise<string[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s Timeout

        try {
            const response = await fetch(`${this.config.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    model: this.config.model,
                    prompt: prompt,
                    stream: false,
                    options: { temperature: 0.7 }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.response;
            return text.split('\n').filter((line: string) => line.trim().length > 0).slice(0, 5);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // New method for generating Mandala Chart structure
    async generateMandalaChart(userGoal: string): Promise<{ centerGoal: string; surroundingGoals: string[] }> {
        const prompt = `
あなたは世界で最も優れたマンダラチャート作成AIです。ユーザーの「目標」を受け取り、その目標を達成するための「中心目標」と、それを囲む8つの「周辺目標」を提案してください。

出力は必ず以下のJSON形式にしてください。

{
  "centerGoal": "中心目標のタイトル",
  "surroundingGoals": [
    "周辺目標1のタイトル",
    "周辺目標2のタイトル",
    "周辺目標3のタイトル",
    "周辺目標4のタイトル",
    "周辺目標5のタイトル",
    "周辺目標6のタイトル",
    "周辺目標7のタイトル",
    "周辺目標8のタイトル"
  ]
}

制約:
- 各目標のタイトルは簡潔にしてください。（例: 「健康維持」ではなく「健康」）
- 周辺目標は必ず8つ提案してください。
- 出力はJSONのみで、他の説明や前置きは一切含めないでください。

ユーザーの目標: ${userGoal}
`;

        try {
            let jsonString: string;
            if (this.config.provider === 'ollama') {
                jsonString = await this.callOllamaGenerateMandala(prompt);
            } else if (this.config.provider === 'gemini') {
                jsonString = await this.callGeminiGenerateMandala(prompt);
            } else {
                return this.getFallbackMandalaChart();
            }

            const parsed = JSON.parse(jsonString);
            if (parsed.centerGoal && Array.isArray(parsed.surroundingGoals) && parsed.surroundingGoals.length === 8) {
                return parsed;
            } else {
                console.error("AI generated an invalid Mandala Chart structure:", jsonString);
                return this.getFallbackMandalaChart();
            }
        } catch (error) {
            console.error("AI Mandala Chart Generation Failed (Using Fallback):", error);
            // Gemini API Keyが見つからない場合のエラーメッセージを追加
            if (this.config.provider === 'gemini' && (!this.config.apiKey || !this.config.baseUrl)) {
                console.error("Gemini APIのBase URLまたはAPI Keyが設定されていません。設定画面で確認してください。");
            }
            return this.getFallbackMandalaChart();
        }
    }

    private getFallbackMandalaChart(): { centerGoal: string; surroundingGoals: string[] } {
        return {
            centerGoal: "新しい目標",
            surroundingGoals: [
                "行動1", "行動2", "行動3", "行動4", "行動5", "行動6", "行動7", "行動8"
            ]
        };
    }

    private async callOllamaGenerateMandala(prompt: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s Timeout

        try {
            const response = await fetch(`${this.config.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    model: this.config.model,
                    prompt: prompt,
                    stream: false,
                    options: { temperature: 0.7 }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.response; // Expecting raw JSON string
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async callGeminiGenerateMandala(prompt: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s Timeout

        try {
            const response = await fetch(`${this.config.baseUrl}`, { // baseUrlはGeminiのエンドポイントURLになる想定
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.config.apiKey || '', // API Keyを使用
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 800,
                    },
                    // safetySettings: [...] // 必要に応じて設定
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gemini Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                return data.candidates[0].content.parts[0].text; // Expecting raw JSON string
            }
            throw new Error("Gemini APIからの応答が不正です。");
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export const aiClient = new AiClient();
