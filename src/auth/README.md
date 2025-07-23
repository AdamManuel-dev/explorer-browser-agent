# Authentication Module

The authentication module provides comprehensive authentication strategies and session management for web crawling and testing scenarios.

## Components

### MultiStrategyAuthManager

A flexible authentication manager that supports multiple authentication strategies including basic auth, OAuth, MFA, and API key authentication.

**Supported Strategies:**
- **Basic Authentication**: Username/password login forms
- **OAuth 2.0/OpenID Connect**: Third-party authentication providers
- **Multi-Factor Authentication (MFA)**: TOTP, SMS, email verification
- **API Key Authentication**: Header or query parameter-based auth
- **Custom Strategies**: Extensible framework for custom auth flows

**Usage:**
```typescript
import { MultiStrategyAuthManager } from './auth';

const authManager = new MultiStrategyAuthManager({
  strategies: {
    basic: {
      enabled: true,
      loginUrl: 'https://example.com/login',
      usernameSelector: '#username',
      passwordSelector: '#password',
      submitSelector: '#login-btn',
      successIndicator: '.dashboard',
    },
    oauth: {
      enabled: true,
      provider: 'google',
      clientId: 'your-client-id',
      redirectUri: 'https://your-app.com/callback',
    },
  },
});

const result = await authManager.authenticate(page, 'basic', {
  username: 'user@example.com',
  password: 'secure-password',
});

if (result.success) {
  console.log('Authentication successful!');
  // Continue with authenticated session
}
```

### SessionManager

Handles authentication session persistence and restoration across browser instances.

**Features:**
- Multiple storage backends (file, memory, Redis)
- Session encryption and security
- Automatic session cleanup
- Cross-domain session management
- Session validation and refresh

**Usage:**
```typescript
import { SessionManager } from './auth';

const sessionManager = new SessionManager({
  storage: {
    type: 'redis',
    host: 'localhost',
    port: 6379,
  },
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
  },
  cleanup: {
    maxAge: 3600000, // 1 hour
    interval: 300000, // 5 minutes
  },
});

// Capture session after authentication
await sessionManager.captureSession(page, 'user-session-123', 'example.com');

// Restore session in new browser instance
const restored = await sessionManager.restoreSessionToPage(
  newPage, 
  'user-session-123', 
  'example.com'
);

if (restored) {
  console.log('Session restored successfully');
}
```

## Authentication Strategies

### Basic Authentication

For traditional username/password login forms:

```typescript
const basicConfig = {
  enabled: true,
  loginUrl: 'https://app.example.com/login',
  usernameSelector: 'input[name="email"]',
  passwordSelector: 'input[name="password"]',
  submitSelector: 'button[type="submit"]',
  successIndicator: '.user-dashboard',
  errorSelector: '.error-message',
  timeout: 30000,
};
```

### OAuth 2.0 Authentication

For third-party OAuth providers:

```typescript
const oauthConfig = {
  enabled: true,
  provider: 'github',
  clientId: 'your-github-client-id',
  clientSecret: 'your-github-client-secret',
  redirectUri: 'http://localhost:3000/auth/callback',
  scopes: ['user:email', 'repo'],
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
};
```

### Multi-Factor Authentication

For MFA-enabled accounts:

```typescript
const mfaConfig = {
  enabled: true,
  type: 'totp', // or 'sms', 'email'
  codeSelector: 'input[name="verification_code"]',
  submitSelector: '#verify-btn',
  secretKey: 'TOTP_SECRET_KEY', // for TOTP
  timeout: 60000,
};
```

### API Key Authentication

For API-first applications:

```typescript
const apiKeyConfig = {
  enabled: true,
  method: 'header', // or 'query'
  headerName: 'X-API-Key',
  paramName: 'api_key',
  keyValue: 'your-api-key',
};
```

## Session Storage Backends

### File Storage

```typescript
const fileStorage = {
  type: 'file',
  directory: './sessions',
  format: 'json', // or 'encrypted'
};
```

### Memory Storage

```typescript
const memoryStorage = {
  type: 'memory',
  maxSessions: 1000,
};
```

### Redis Storage

```typescript
const redisStorage = {
  type: 'redis',
  host: 'localhost',
  port: 6379,
  password: 'redis-password',
  db: 0,
  keyPrefix: 'session:',
};
```

## Security Features

### Session Encryption

```typescript
const encryptionConfig = {
  enabled: true,
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
  saltLength: 32,
};
```

### Automatic Cleanup

```typescript
const cleanupConfig = {
  maxAge: 7200000, // 2 hours
  interval: 600000, // 10 minutes
  onStartup: true,
  onShutdown: true,
};
```

## Advanced Usage

### Custom Authentication Strategy

```typescript
class CustomAuthStrategy extends AuthStrategy {
  async authenticate(page: Page, credentials: any): Promise<AuthResult> {
    // Implement custom authentication logic
    await page.goto(this.config.loginUrl);
    await page.fill('#custom-field', credentials.customValue);
    await page.click('#custom-submit');
    
    return {
      success: true,
      strategy: 'custom',
      session: await this.captureSession(page),
    };
  }
}

// Register custom strategy
authManager.registerStrategy('custom', new CustomAuthStrategy(config));
```

### Session Validation

```typescript
// Validate session before use
const isValid = await sessionManager.validateSession('session-id', 'domain.com');

if (!isValid) {
  // Re-authenticate or handle invalid session
  await authManager.authenticate(page, 'basic', credentials);
}
```

### Cross-Domain Sessions

```typescript
// Capture session for multiple domains
await sessionManager.captureSession(page, 'session-id', 'app.example.com');
await sessionManager.captureSession(page, 'session-id', 'api.example.com');

// Restore for specific domain
await sessionManager.restoreSessionToPage(page, 'session-id', 'api.example.com');
```

## Error Handling

### Authentication Errors

```typescript
try {
  const result = await authManager.authenticate(page, 'basic', credentials);
  
  if (!result.success) {
    switch (result.error) {
      case 'INVALID_CREDENTIALS':
        console.log('Username or password incorrect');
        break;
      case 'MFA_REQUIRED':
        console.log('Multi-factor authentication required');
        break;
      case 'ACCOUNT_LOCKED':
        console.log('Account is locked');
        break;
      case 'NETWORK_ERROR':
        console.log('Network connection failed');
        break;
    }
  }
} catch (error) {
  console.error('Authentication failed:', error);
}
```

### Session Errors

```typescript
try {
  await sessionManager.restoreSessionToPage(page, 'session-id', 'domain.com');
} catch (error) {
  if (error.code === 'SESSION_NOT_FOUND') {
    // Re-authenticate
  } else if (error.code === 'SESSION_EXPIRED') {
    // Refresh session
  } else if (error.code === 'ENCRYPTION_ERROR') {
    // Handle decryption failure
  }
}
```

## Best Practices

1. **Credential Security**: Never hardcode credentials; use environment variables or secure vaults
2. **Session Rotation**: Regularly rotate sessions to minimize security risks
3. **Timeout Management**: Set appropriate timeouts for authentication flows
4. **Error Handling**: Implement comprehensive error handling for auth failures
5. **Monitoring**: Monitor authentication success rates and failure patterns
6. **Compliance**: Ensure authentication methods comply with security policies

## Integration Examples

### With Crawling

```typescript
// Authenticate before crawling protected content
const authResult = await authManager.authenticate(page, 'basic', credentials);

if (authResult.success) {
  const crawler = new BreadthFirstCrawler(browser);
  const result = await crawler.crawl({
    startUrl: 'https://app.example.com/dashboard',
    preAuthenticatedPage: page,
  });
}
```

### With Testing

```typescript
// Use authenticated sessions in test generation
const sessionId = 'test-user-session';
await sessionManager.captureSession(page, sessionId, 'app.example.com');

const testGenerator = new TestGenerator({
  sessionId,
  authStrategy: 'basic',
});
```