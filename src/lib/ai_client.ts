export type AiProvider = 'ollama' | 'gemini' | 'custom';

export interface AiConfig {
    provider: AiProvider;
    baseUrl: string; // e.g. "http://localhost:11434"
    model: string;   // e.g. "llama3"
    apiKey?: string; // For Gemini/OpenAI
}

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
            }
            return "申し訳ありませんが、現在チャット機能は使用できません。";
        } catch (error) {
            console.error("AI Chat Failed:", error);
            return "申し訳ありませんが、エラーが発生しました。";
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
            }
            return this.getFallbackActions();
        } catch (error) {
            console.error("AI Generation Failed (Using Fallback):", error);
            // Fallback to ensure UI never breaks
            return this.getFallbackActions();
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
