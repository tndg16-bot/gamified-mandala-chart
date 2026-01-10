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
                return text.split('\n').filter((line: string) => line.trim().length > 0).slice(0, 3);
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
            return text.split('\n').filter((line: string) => line.trim().length > 0).slice(0, 3);
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export const aiClient = new AiClient();
