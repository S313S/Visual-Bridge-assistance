export enum Sender {
  User = 'user',
  AI = 'ai',
  System = 'system'
}

export interface ThoughtStep {
  id: string;
  icon: string;
  title: string;
  content: string;
  status: 'loading' | 'done' | 'error';
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: number;
  isThinking?: boolean;
  thoughts?: ThoughtStep[];
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  selected: boolean;
}

export interface AppState {
  messages: Message[];
  currentImages: GeneratedImage[];
  isGenerating: boolean;
  iterationCount: number;
  maxIterations: number;
  currentVisualPrompts: string[];
  currentAspectRatio: string;
}

export enum Scenario {
  SocialMedia = 'Social Media Images',
  VideoDrama = 'Video/Short Drama Resources',
  Advertising = 'Advertising Image Resources',
  StageBackground = 'Stage Background Images'
}