import { GenerationResult } from '../types/generation';
export declare class TestFileWriter {
    private baseDirectory;
    constructor(baseDirectory: string);
    writeFiles(result: GenerationResult): Promise<void>;
    private writeFile;
    private writeSummaryReport;
    private writeMarkdownSummary;
    private ensureDirectory;
    private groupFilesByType;
    private formatFileType;
    createProjectStructure(): Promise<void>;
    private createPlaywrightConfig;
    private createPackageJson;
    private createGitignore;
}
//# sourceMappingURL=TestFileWriter.d.ts.map