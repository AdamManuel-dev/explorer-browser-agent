export interface DetectedElement {
    id: string;
    selector: string;
    type: string;
    text?: string;
    attributes: Record<string, string>;
    isVisible: boolean;
    isEnabled: boolean;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    metadata?: {
        label?: string;
        placeholder?: string;
        required?: boolean;
        options?: Array<{
            value: string;
            text: string;
        }>;
    };
}
//# sourceMappingURL=detector.d.ts.map