export interface RuntimeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
