import { UserPath } from '../types/recording';
import { TestFile } from '../types/generation';
export declare class PageObjectGenerator {
    private pageObjects;
    generateFromPath(path: UserPath): TestFile[];
    private groupStepsByPage;
    private generatePageObject;
    private extractSelectors;
    private generateActions;
    private identifyActionPatterns;
    private createPageAction;
    private generateActionStep;
    private generateAssertions;
    private generatePageObjectFile;
    private renderPageObjectClass;
    private generatePageName;
    private generateSelectorName;
    private generateParameterName;
    private generateActionDescription;
    private toCamelCase;
    private capitalize;
}
//# sourceMappingURL=PageObjectGenerator.d.ts.map