export type ElementType = 'text-input' | 'password-input' | 'email-input' | 'number-input' | 'tel-input' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'multi-select' | 'date-picker' | 'time-picker' | 'color-picker' | 'range-slider' | 'file-upload' | 'button' | 'link' | 'toggle' | 'tab' | 'accordion' | 'modal-trigger' | 'dropdown-menu' | 'carousel' | 'drag-drop' | 'canvas' | 'video-player' | 'audio-player' | 'rich-text-editor' | 'unknown';
export interface InteractiveElement {
    id: string;
    type: ElementType;
    selector: string;
    xpath?: string;
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
    parentSelector?: string;
    children?: InteractiveElement[];
    metadata?: {
        label?: string;
        placeholder?: string;
        required?: boolean;
        validationRules?: string[];
        options?: Array<{
            value: string;
            text: string;
        }>;
    };
}
export interface ElementDetectionResult {
    elements: InteractiveElement[];
    totalFound: number;
    detectionTime: number;
    errors: Array<{
        selector: string;
        error: string;
    }>;
}
export interface ElementClassification {
    element: InteractiveElement;
    confidence: number;
    suggestedType: ElementType;
    reasoning: string;
}
//# sourceMappingURL=elements.d.ts.map