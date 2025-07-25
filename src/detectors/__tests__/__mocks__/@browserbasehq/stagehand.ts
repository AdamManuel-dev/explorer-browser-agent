export class Stagehand {
  page: any;
  browserbaseSessionID?: string;

  constructor(config: any) {
    // Mock constructor
  }

  async init() {
    // Mock init
  }

  async observe(options: { instruction: string }) {
    // Mock observe
    return [];
  }

  async act(options: { action: string }) {
    // Mock act
    return { success: true };
  }

  async extract(options: { instruction: string }) {
    // Mock extract
    return {};
  }

  async close() {
    // Mock close
  }
}