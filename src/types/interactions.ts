import { InteractiveElement } from './elements';

export interface InteractionStrategy {
  type: string;
  execute: (element: InteractiveElement, context: InteractionContext) => Promise<InteractionResult>;
  validate?: (element: InteractiveElement) => Promise<boolean>;
}

export interface InteractionContext {
  page: any; // Playwright Page
  testData?: any;
  options?: InteractionOptions;
}

export interface InteractionOptions {
  delay?: number;
  screenshot?: boolean;
  waitForNavigation?: boolean;
  timeout?: number;
  force?: boolean;
}

export interface InteractionResult {
  success: boolean;
  value?: any;
  timing: number;
  screenshot?: string;
  error?: string;
  networkActivity?: NetworkActivity[];
  stateChanges?: StateChange[];
}

export interface NetworkActivity {
  url: string;
  method: string;
  status?: number;
  timing: number;
}

export interface StateChange {
  type: 'url' | 'storage' | 'cookie' | 'dom';
  before: any;
  after: any;
  timing: number;
}

export interface TestData {
  value: any;
  type: string;
  generated: boolean;
  metadata?: Record<string, any>;
}