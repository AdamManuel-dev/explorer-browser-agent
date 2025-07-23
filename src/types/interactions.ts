import { InteractiveElement } from './elements';
import { Page } from 'playwright';

export interface InteractionStrategy {
  type: string;
  execute: (element: InteractiveElement, context: InteractionContext) => Promise<InteractionResult>;
  validate?: (element: InteractiveElement) => Promise<boolean>;
}

export interface InteractionContext {
  page: Page;
  testData?: TestData;
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
  value?: string | number | boolean | Record<string, unknown>;
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
  before: string | number | boolean | Record<string, unknown>;
  after: string | number | boolean | Record<string, unknown>;
  timing: number;
}

export interface TestData {
  value: string | number | boolean | Record<string, unknown>;
  type: string;
  generated: boolean;
  metadata?: Record<string, string | number | boolean>;
}
