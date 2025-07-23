import { UserPath, InteractionStep } from '../types/recording';
export declare class PathOptimizer {
    /**
     * Optimizes a recorded path by removing redundant steps and improving assertions
     */
    optimize(path: UserPath): UserPath;
    private optimizeSteps;
    private optimizeAssertions;
    private deduplicateAssertions;
    private getAssertionKey;
    private isMoreSpecific;
    /**
     * Identifies critical steps that must not be removed
     */
    identifyCriticalSteps(path: UserPath): Set<string>;
    /**
     * Groups related steps together for better test organization
     */
    groupSteps(path: UserPath): InteractionStep[][];
}
//# sourceMappingURL=PathOptimizer.d.ts.map