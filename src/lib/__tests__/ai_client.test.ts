import { AiClient } from '../ai_client';
import { AiConfig } from '../types';

// Mock the global fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AiClient', () => {
  let client: AiClient;
  const defaultAiConfig: AiConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'test-ollama-model',
  };

  beforeEach(() => {
    client = new AiClient(defaultAiConfig);
    mockFetch.mockClear();
  });

  // Helper to mock successful fetch responses
  const mockSuccessFetch = (data: any) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });
  };

  // Helper to mock failed fetch responses
  const mockFailedFetch = (status: number, statusText: string, errorData: any = {}) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: status,
      statusText: statusText,
      json: () => Promise.resolve(errorData),
    });
  };

  it('should initialize with default config and allow updates', () => {
    const customConfig: AiConfig = {
      provider: 'gemini',
      baseUrl: 'http://custom-url',
      model: 'custom-model',
      apiKey: 'custom-key',
    };
    const newClient = new AiClient(); // Initialize with default
    newClient.updateConfig(customConfig);
    expect(newClient.getConfig()).toEqual(customConfig);
  });

  describe('Ollama Provider', () => {
    beforeEach(() => {
      client.updateConfig(defaultAiConfig); // Ensure Ollama is the provider
    });

    it('should call Ollama chat API and return content', async () => {
      const mockResponse = { message: { content: 'Ollama chat response' } };
      mockSuccessFetch(mockResponse);

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await client.chat(messages);

      expect(response).toBe('Ollama chat response');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/chat');
      expect(JSON.parse(options.body).model).toBe('test-ollama-model');
      expect(JSON.parse(options.body).messages[0].content).toBe('あなたは親切なAIアシスタントです。ユーザーのタスク管理や目標達成をサポートしてください。');
      expect(JSON.parse(options.body).messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should handle Ollama chat API errors', async () => {
      mockFailedFetch(500, 'Internal Server Error');

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await client.chat(messages);

      expect(response).toBe('申し訳ありませんが、エラーが発生しました。');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should call Ollama generateActions API and return actions', async () => {
      const mockResponse = { response: 'Action 1\nAction 2\nAction 3' };
      mockSuccessFetch(mockResponse);

      const actions = await client.generateActions('goal', 'means');

      expect(actions).toEqual(['Action 1', 'Action 2', 'Action 3']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/generate');
      expect(JSON.parse(options.body).model).toBe('test-ollama-model');
      expect(JSON.parse(options.body).prompt).toContain('目標: goal');
      expect(JSON.parse(options.body).prompt).toContain('手段: means');
    });

    it('should handle Ollama generateActions API errors and return fallback', async () => {
      mockFailedFetch(500, 'Internal Server Error');

      const actions = await client.generateActions('goal', 'means');

      expect(actions).toEqual([
        "関連する本を1章読む (Offline)",
        "5分間リサーチをする (Offline)",
        "ノートにアイデアを書き出す (Offline)"
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gemini Provider', () => {
    const geminiConfig: AiConfig = {
      provider: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      model: 'gemini-pro',
      apiKey: 'test-gemini-key',
    };

    beforeEach(() => {
      client.updateConfig(geminiConfig); // Ensure Gemini is the provider
    });

    it('should call Gemini chat API and return content', async () => {
      const mockResponse = { candidates: [{ content: { parts: [{ text: 'Gemini chat response' }] } }] };
      mockSuccessFetch(mockResponse);

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await client.chat(messages);

      expect(response).toBe('Gemini chat response');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(geminiConfig.baseUrl);
      expect(options.headers['x-goog-api-key']).toBe(geminiConfig.apiKey);
      expect(JSON.parse(options.body).contents[0].parts[0].text).toContain('あなたは親切なAIアシスタントです。ユーザーのタスク管理や目標達成をサポートしてください。');
      expect(JSON.parse(options.body).contents[0].parts[0].text).toContain('Hello');
    });

    it('should handle Gemini chat API errors', async () => {
      mockFailedFetch(400, 'Bad Request', { error: { message: 'Invalid API key' } });

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await client.chat(messages);

      expect(response).toBe('申し訳ありませんが、エラーが発生しました。');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should call Gemini generateActions API and return actions', async () => {
      const mockResponse = { candidates: [{ content: { parts: [{ text: 'Action G1\nAction G2\nAction G3' }] } }] };
      mockSuccessFetch(mockResponse);

      const actions = await client.generateActions('gemini goal', 'gemini means');

      expect(actions).toEqual(['Action G1', 'Action G2', 'Action G3']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(geminiConfig.baseUrl);
      expect(options.headers['x-goog-api-key']).toBe(geminiConfig.apiKey);
      expect(JSON.parse(options.body).contents[0].parts[0].text).toContain('目標: gemini goal');
      expect(JSON.parse(options.body).contents[0].parts[0].text).toContain('手段: gemini means');
    });

    it('should handle Gemini generateActions API errors and return fallback', async () => {
      mockFailedFetch(400, 'Bad Request', { error: { message: 'Invalid API key' } });

      const actions = await client.generateActions('gemini goal', 'gemini means');

      expect(actions).toEqual([
        "関連する本を1章読む (Offline)",
        "5分間リサーチをする (Offline)",
        "ノートにアイデアを書き出す (Offline)"
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('should return error for unsupported provider in chat', async () => {
    const customConfig: AiConfig = {
      provider: 'custom',
      baseUrl: 'http://custom-url',
      model: 'custom-model',
    };
    client.updateConfig(customConfig);
    const messages = [{ role: 'user', content: 'Hello' }];
    const response = await client.chat(messages);
    expect(response).toBe('申し訳ありませんが、選択されたAIプロバイダはサポートされていません。設定を確認してください。');
  });

  it('should return fallback for unsupported provider in generateActions', async () => {
    const customConfig: AiConfig = {
      provider: 'custom',
      baseUrl: 'http://custom-url',
      model: 'custom-model',
    };
    client.updateConfig(customConfig);
    const actions = await client.generateActions('goal', 'means');
    expect(actions).toEqual([
      "関連する本を1章読む (Offline)",
      "5分間リサーチをする (Offline)",
      "ノートにアイデアを書き出す (Offline)"
    ]);
  });
});
