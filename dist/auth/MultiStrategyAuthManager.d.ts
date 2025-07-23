import { Page } from 'playwright';
export type AuthStrategy = 'basic' | 'oauth' | 'mfa' | 'api' | 'custom';
export interface AuthCredentials {
    username?: string;
    password?: string;
    email?: string;
    apiKey?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    mfaCode?: string;
    customFields?: Record<string, string>;
}
export interface AuthConfig {
    strategy: AuthStrategy;
    loginUrl?: string;
    credentials: AuthCredentials;
    sessionPersistence: boolean;
    cookieFile?: string;
    timeout?: number;
    selectors?: AuthSelectors;
    customFlow?: (page: Page, credentials: AuthCredentials) => Promise<boolean>;
}
export interface AuthSelectors {
    usernameField?: string;
    passwordField?: string;
    emailField?: string;
    submitButton?: string;
    mfaField?: string;
    mfaSubmitButton?: string;
    successIndicator?: string;
    errorIndicator?: string;
    logoutButton?: string;
}
export interface AuthSession {
    strategy: AuthStrategy;
    authenticated: boolean;
    userId?: string;
    sessionToken?: string;
    expiresAt?: Date;
    cookies: any[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    metadata: Record<string, any>;
}
export interface AuthResult {
    success: boolean;
    session?: AuthSession;
    error?: string;
    requiresMFA?: boolean;
    redirectUrl?: string;
}
export declare class MultiStrategyAuthManager {
    private currentSession;
    private defaultSelectors;
    constructor();
    authenticate(page: Page, config: AuthConfig): Promise<AuthResult>;
    private performAuthentication;
    private basicAuth;
    private oauthAuth;
    private mfaAuth;
    private apiAuth;
    private customAuth;
    private createSession;
    logout(page: Page): Promise<boolean>;
    validateSession(page: Page, session: AuthSession): Promise<boolean>;
    restoreSession(page: Page, session: AuthSession): Promise<void>;
    private saveSession;
    private loadSession;
    private checkAuthSuccess;
    private getErrorMessage;
    private fillOAuthCredentials;
    private extractSessionToken;
    private initializeDefaultSelectors;
    getCurrentSession(): AuthSession | null;
    isAuthenticated(): boolean;
}
//# sourceMappingURL=MultiStrategyAuthManager.d.ts.map