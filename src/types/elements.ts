export type ElementType =
  | 'text-input'
  | 'password-input'
  | 'email-input'
  | 'number-input'
  | 'tel-input'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'multi-select'
  | 'date-picker'
  | 'time-picker'
  | 'color-picker'
  | 'range-slider'
  | 'file-upload'
  | 'button'
  | 'link'
  | 'toggle'
  | 'tab'
  | 'accordion'
  | 'modal-trigger'
  | 'dropdown-menu'
  | 'carousel'
  | 'drag-drop'
  | 'canvas'
  | 'video-player'
  | 'audio-player'
  | 'rich-text-editor'
  | 'input'
  | 'file'
  | 'navigation'
  | 'dialog'
  | 'hidden'
  | 'form'
  | 'fieldset'
  | 'custom'
  | 'unknown';

export interface InteractiveElement {
  id: string;
  type: ElementType;
  selector: string;
  xpath?: string;
  text?: string;
  attributes: Record<string, string | boolean | number> & {
    inputType?: string;
    buttonType?: string;
    href?: string;
    opensInNewTab?: boolean;
    isAnchor?: boolean;
    role?: string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    ariaModal?: boolean;
    ariaControls?: string;
    isAccessible?: boolean;
    accept?: string;
    multiple?: boolean;
    maxLength?: number;
    action?: string;
  };
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
    options?: Array<{ value: string; text: string }>;
    name?: string;
    pattern?: string;
    hasClickHandler?: boolean;
    childCount?: number;
    ariaLive?: string;
    ariaAtomic?: boolean;
    legend?: string;
    isWebComponent?: boolean;
    hasShadowRoot?: boolean;
    dataAttributes?: Record<string, string>;
    context?: string;
    inIframe?: boolean;
    iframeSrc?: string;
    aiDetected?: boolean;
    aiConfidence?: number;
  };
  interactionType?: string[];
  state?: {
    checked?: boolean;
    visible?: boolean;
    expanded?: boolean;
    selected?: boolean;
    enabled?: boolean;
    readonly?: boolean;
  };
  interactionHints?: string[];
  classification?: {
    purpose?: string;
    action?: string;
    formRelated?: boolean;
    navigationType?: string;
  };
  complexity?: 'simple' | 'complex' | 'multi-step';
  interactionSteps?: string[];
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
