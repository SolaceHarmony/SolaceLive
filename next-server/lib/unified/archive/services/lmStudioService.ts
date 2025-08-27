import axios from 'axios';

export class LMStudioService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:1234/v1') {
    this.baseUrl = baseUrl;
  }

  async processWithLLM(text: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: 'local-model',
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are a helpful AI assistant. Respond naturally and conversationally.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        stream: false,
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error processing with LM Studio:', error);
      throw new Error('Failed to process with LM Studio');
    }
  }

  async streamProcessWithLLM(
    text: string,
    onChunk: (chunk: string) => void,
    systemPrompt?: string
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'local-model',
          messages: [
            {
              role: 'system',
              content: systemPrompt || 'You are a helpful AI assistant. Respond naturally and conversationally.',
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.choices[0]?.delta?.content;
              if (chunk) {
                onChunk(chunk);
              }
            } catch (e) {
              console.error('Error parsing SSE chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming from LM Studio:', error);
      throw new Error('Failed to stream from LM Studio');
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      console.error('LM Studio health check failed:', error);
      return false;
    }
  }
}