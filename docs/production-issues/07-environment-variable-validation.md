# Production Issue #7: Missing Environment Variable Validation

**Severity:** MEDIUM 🟡
**Impact:** Medium - Runtime crashes, unclear error messages
**Affected Files:** Multiple files using `process.env.*!`
**Problem:** No startup validation of required environment variables

---

## Problem Description

The application uses **non-null assertions** (`!`) on environment
variables without validating they exist at startup. This causes:

1. **Runtime crashes** with cryptic error messages
2. **Delayed error discovery** (crash when feature is used, not at startup)
3. **Poor developer experience** (unclear which variable is missing)
4. **Production incidents** (misconfigured deploys crash silently)

### Current Implementation

Environment variables accessed throughout codebase:

```typescript
// src/lib/redis/client.ts
const redisClient = createClient({
  url: process.env.REDIS_URL!  // ❌ Non-null assertion
})

// src/lib/pipeline/ocr.ts
const ocrApiKey = process.env.OCR_API_KEY!  // ❌ Non-null assertion

// src/lib/pipeline/translator.ts
const geminiApiKey = process.env.GEMINI_API_KEY!  // ❌ Non-null assertion

// src/lib/supabase/server.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!  // ❌ Non-null assertion
```

**What happens if variable is missing?**

```typescript
// If REDIS_URL is undefined
const url = process.env.REDIS_URL!  // url = undefined (not caught!)

createClient({ url: undefined })
// Later crashes with: "Invalid Redis URL: undefined"
// ❌ Error occurs deep in application, hard to debug
```

---

## Why This Matters

### Production Incident Example

**Scenario: Forgot to set GEMINI_API_KEY in production**

```
1. Deploy to production ✅
2. App starts successfully ✅ (no validation!)
3. User uploads image for processing
4. Image processing calls Gemini API
5. Error: "API key is undefined"
6. User sees "Internal Server Error"
7. Developer checks logs, sees cryptic error
8. Takes 30 minutes to realize GEMINI_API_KEY missing
9. Add variable, redeploy
10. Total downtime: 45 minutes
```

**With validation:**
```
1. Deploy to production ✅
2. App startup checks env vars ❌
3. Error: "Missing required environment variable: GEMINI_API_KEY"
4. Deploy fails, never goes live
5. Fix immediately, redeploy
6. Total downtime: 0 minutes
```

### Developer Experience Impact

**Without validation:**
```bash
$ bun dev
Server started on port 3000 ✅

# 5 minutes later, tries to use feature
$ curl /api/study/session
{"error": "Cannot read property 'undefined' of undefined"}

# Developer confused, no idea what's wrong
# Spends 20 minutes debugging
# Finally realizes REDIS_URL not set
```

**With validation:**
```bash
$ bun dev
❌ Error: Missing required environment variables:
  - REDIS_URL
  - OCR_API_KEY

Please set these variables in .env.local
See .env.example for reference

Process exited with code 1
```

### Security Implications

**Undefined variables can cause security issues:**

```typescript
// If NODE_ENV is undefined
if (process.env.NODE_ENV === 'production') {
  // Never executes! undefined !== 'production'
  enableSecurityHeaders()
}

// Security headers not enabled in production! ❌
```

---

## Required Environment Variables

### Critical (App Won't Function)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=         # Database and auth
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # Public API key
SUPABASE_SERVICE_ROLE_KEY=        # Admin operations (optional)

# Pipeline
OCR_API_KEY=                      # Image text extraction
GEMINI_API_KEY=                   # Vocabulary extraction

# Redis (optional but recommended)
REDIS_URL=                        # Session caching
```

### Optional (Degrades Gracefully)

```bash
# Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=  # User tracking

# Monitoring
SENTRY_DSN=                       # Error tracking

# Email
SENDGRID_API_KEY=                 # Transactional emails
```

---

## Recommended Solution

### Strategy: Fail-Fast Validation at Startup

Validate all required environment variables when the app starts, before
any requests are handled.

---

## Implementation

### Step 1: Create Environment Config Module (30 minutes)

Create `src/lib/config/env.ts`:

```typescript
import pino from 'pino'

const logger = pino()

/**
 * Environment variable configuration
 */
export interface EnvironmentConfig {
  // Supabase
  supabase: {
    url: string
    publishableKey: string
    serviceRoleKey?: string
  }

  // External APIs
  apis: {
    ocr: string
    gemini: string
  }

  // Redis
  redis: {
    url: string
  }

  // Optional services
  optional: {
    googleAnalyticsId?: string
    sentryDsn?: string
    sendgridApiKey?: string
  }

  // App config
  app: {
    nodeEnv: 'development' | 'production' | 'test'
    vercelEnv?: 'production' | 'preview' | 'development'
  }
}

/**
 * Required environment variables
 */
const REQUIRED_VARS = {
  // Supabase (always required)
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase project URL',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'Supabase publishable API key',

  // Pipeline (required for admin features)
  OCR_API_KEY: 'OCR.space API key for image processing',
  GEMINI_API_KEY: 'Google Gemini API key for vocabulary extraction',

  // Redis (required for study sessions)
  REDIS_URL: 'Redis connection URL for session caching',
} as const

/**
 * Optional environment variables (with defaults)
 */
const OPTIONAL_VARS = {
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: undefined,
  SENTRY_DSN: undefined,
  SENDGRID_API_KEY: undefined,
} as const

/**
 * Validates and returns environment configuration
 *
 * @throws {Error} If required variables are missing or invalid
 * @returns Validated environment configuration
 */
export function validateEnvironment(): EnvironmentConfig {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const [key, description] of Object.entries(REQUIRED_VARS)) {
    const value = process.env[key]

    if (!value || value.trim() === '') {
      errors.push(`${key} - ${description}`)
    }
  }

  // Check optional variables
  for (const key of Object.keys(OPTIONAL_VARS)) {
    const value = process.env[key]

    if (!value || value.trim() === '') {
      warnings.push(`${key} is not set (optional)`)
    }
  }

  // Validate environment values
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(
      `NODE_ENV must be 'development', 'production', or 'test', got '${nodeEnv}'`
    )
  }

  // Validate Redis URL format
  const redisUrl = process.env.REDIS_URL
  if (redisUrl && !redisUrl.startsWith('redis://')) {
    errors.push(
      `REDIS_URL must start with 'redis://', got '${redisUrl.substring(0, 20)}...'`
    )
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    errors.push(
      `NEXT_PUBLIC_SUPABASE_URL must start with 'https://', got '${supabaseUrl.substring(0, 20)}...'`
    )
  }

  // If there are errors, fail fast
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Missing or invalid required environment variables:',
      '',
      ...errors.map(err => `  - ${err}`),
      '',
      'Please set these variables in .env.local',
      'See .env.example for reference',
    ].join('\n')

    logger.error(errorMessage)

    // In production, also log to error tracking
    if (process.env.NODE_ENV === 'production') {
      // Send to Sentry/monitoring service
    }

    throw new Error(errorMessage)
  }

  // Log warnings for optional variables
  if (warnings.length > 0) {
    logger.warn(
      {
        warnings,
      },
      'Optional environment variables not set'
    )
  }

  // Return validated config
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    apis: {
      ocr: process.env.OCR_API_KEY!,
      gemini: process.env.GEMINI_API_KEY!,
    },
    redis: {
      url: process.env.REDIS_URL!,
    },
    optional: {
      googleAnalyticsId: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
      sentryDsn: process.env.SENTRY_DSN,
      sendgridApiKey: process.env.SENDGRID_API_KEY,
    },
    app: {
      nodeEnv: (nodeEnv as any) || 'development',
      vercelEnv: process.env.VERCEL_ENV as any,
    },
  }
}

/**
 * Singleton config instance
 */
let config: EnvironmentConfig | null = null

/**
 * Gets validated environment configuration
 * Validates on first call, caches result
 */
export function getConfig(): EnvironmentConfig {
  if (!config) {
    config = validateEnvironment()
    logger.info('Environment configuration validated successfully')
  }
  return config
}

/**
 * Resets config (useful for testing)
 */
export function resetConfig(): void {
  config = null
}
```

### Step 2: Validate on App Startup (15 minutes)

Update `src/app/layout.tsx`:

```typescript
import { getConfig } from '@/lib/config/env'

// Validate environment variables at module load time
// This runs once when the server starts
try {
  getConfig()
} catch (error) {
  // Error already logged in getConfig()
  // Exit process in production
  if (process.env.NODE_ENV === 'production') {
    process.exit(1)
  }
  throw error
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Rest of layout...
}
```

### Step 3: Use Config Instead of process.env (30 minutes)

Update all files to use config module:

**Before:**
```typescript
// src/lib/redis/client.ts
const redisClient = createClient({
  url: process.env.REDIS_URL!  // ❌
})
```

**After:**
```typescript
// src/lib/redis/client.ts
import { getConfig } from '@/lib/config/env'

const config = getConfig()
const redisClient = createClient({
  url: config.redis.url  // ✅ Validated at startup
})
```

**Files to update:**
- `src/lib/redis/client.ts`
- `src/lib/pipeline/ocr.ts`
- `src/lib/pipeline/translator.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`

### Step 4: Update .env.example (10 minutes)

Make `.env.example` comprehensive:

```bash
# .env.example - Example environment variables
# Copy this file to .env.local and fill in the values

# ============================================
# REQUIRED - App will not start without these
# ============================================

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here

# Pipeline - Required for image processing
OCR_API_KEY=your-ocr-space-api-key
GEMINI_API_KEY=your-google-gemini-api-key

# Redis - Required for study sessions
REDIS_URL=redis://localhost:6379

# ============================================
# OPTIONAL - App will work without these
# ============================================

# Supabase Admin (for admin operations)
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Analytics
# NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Error Tracking
# SENTRY_DSN=https://your-sentry-dsn

# Email (for notifications)
# SENDGRID_API_KEY=SG.xxxxxxxxxx

# ============================================
# DEVELOPMENT - Usually auto-set by framework
# ============================================

# NODE_ENV=development
# NEXT_PUBLIC_VERCEL_ENV=development
```

### Step 5: Add VSCode Integration (5 minutes)

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate Environment",
      "type": "shell",
      "command": "bun run validate-env",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    }
  ]
}
```

Add script to `package.json`:

```json
{
  "scripts": {
    "validate-env": "bun run src/lib/config/env.ts"
  }
}
```

---

## Testing

### Unit Tests

Create `src/lib/config/__tests__/env.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { validateEnvironment, resetConfig } from '../env'

describe('Environment Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset process.env for each test
    process.env = { ...originalEnv }
    resetConfig()
  })

  afterEach(() => {
    process.env = originalEnv
    resetConfig()
  })

  it('should pass with all required variables', () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
      OCR_API_KEY: 'test-ocr-key',
      GEMINI_API_KEY: 'test-gemini-key',
      REDIS_URL: 'redis://localhost:6379',
    }

    expect(() => validateEnvironment()).not.toThrow()
  })

  it('should fail if required variable missing', () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      // Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    }

    expect(() => validateEnvironment()).toThrow('Missing or invalid')
  })

  it('should fail if REDIS_URL has wrong format', () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
      OCR_API_KEY: 'test-ocr-key',
      GEMINI_API_KEY: 'test-gemini-key',
      REDIS_URL: 'http://localhost:6379', // Wrong protocol
    }

    expect(() => validateEnvironment()).toThrow('must start with redis://')
  })

  it('should allow optional variables to be missing', () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
      OCR_API_KEY: 'test-ocr-key',
      GEMINI_API_KEY: 'test-gemini-key',
      REDIS_URL: 'redis://localhost:6379',
      // Optional variables not set
    }

    const config = validateEnvironment()
    expect(config.optional.googleAnalyticsId).toBeUndefined()
  })

  it('should cache config after first validation', () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
      OCR_API_KEY: 'test-ocr-key',
      GEMINI_API_KEY: 'test-gemini-key',
      REDIS_URL: 'redis://localhost:6379',
    }

    const config1 = validateEnvironment()
    const config2 = validateEnvironment()

    expect(config1).toBe(config2) // Same instance
  })
})
```

### Integration Test

```typescript
describe('App Startup', () => {
  it('should not start with missing env vars', async () => {
    // Remove required variable
    delete process.env.REDIS_URL

    // Try to import app (triggers validation)
    await expect(import('../../../app/layout')).rejects.toThrow(
      'Missing or invalid'
    )
  })
})
```

---

## CI/CD Integration

### GitHub Actions

Update `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  validate-env:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: oven-sh/setup-bun@v1

      - name: Validate environment config
        run: |
          # Create minimal .env for testing
          cat > .env.local <<EOF
          NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-key
          OCR_API_KEY=test-ocr-key
          GEMINI_API_KEY=test-gemini-key
          REDIS_URL=redis://localhost:6379
          EOF

          # Run validation
          bun run validate-env

  test:
    needs: validate-env
    runs-on: ubuntu-latest
    # ... rest of test job
```

### Vercel Deployment

Create `vercel.json`:

```json
{
  "buildCommand": "bun run validate-env && bun run build",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "@supabase-key",
    "OCR_API_KEY": "@ocr-api-key",
    "GEMINI_API_KEY": "@gemini-api-key",
    "REDIS_URL": "@redis-url"
  }
}
```

---

## Developer Documentation

### README.md

Add environment setup section:

```markdown
## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in required variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Get from Supabase dashboard
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Get from Supabase dashboard
   - `OCR_API_KEY` - Sign up at https://ocr.space/ocrapi
   - `GEMINI_API_KEY` - Get from Google AI Studio
   - `REDIS_URL` - Use `redis://localhost:6379` for local development

3. Start the development server:
   ```bash
   bun dev
   ```

If you see an error about missing environment variables, check that all
required variables are set in `.env.local`.
```

### Onboarding Checklist

Create `docs/onboarding.md`:

```markdown
# Developer Onboarding

## Environment Setup ✅

- [ ] Clone repository
- [ ] Copy `.env.example` to `.env.local`
- [ ] Set up Supabase account and get credentials
- [ ] Set up OCR.space API key
- [ ] Set up Google Gemini API key
- [ ] Install Redis locally or use Upstash
- [ ] Run `bun dev` and verify no errors

If you get stuck, check the [Environment Variables Guide](./environment-variables.md).
```

---

## Advanced: Runtime Type Safety

For even stronger type safety, use Zod:

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  OCR_API_KEY: z.string().min(10),
  GEMINI_API_KEY: z.string().min(10),
  REDIS_URL: z.string().startsWith('redis://'),

  // Optional with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: z.string().optional(),
})

export function validateEnvironment() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:')
    console.error(error)
    throw error
  }
}
```

---

## Success Criteria

✅ App validates env vars at startup
✅ Clear error messages if variables missing
✅ All `process.env.*!` assertions removed
✅ Centralized config module used throughout app
✅ `.env.example` comprehensive and up-to-date
✅ CI/CD validates env config before deploy
✅ Developer documentation includes env setup
✅ Tests cover validation logic

---

## Monitoring

### Track Missing Variables in Production

```typescript
// Send alert if env validation fails in production
if (process.env.NODE_ENV === 'production') {
  try {
    validateEnvironment()
  } catch (error) {
    // Send to error tracking
    Sentry.captureException(error, {
      tags: {
        type: 'env_validation_failure',
      },
    })

    // Send to logging service
    logger.fatal({ error }, 'Environment validation failed in production')

    // Exit process
    process.exit(1)
  }
}
```

---

## References

- [12-Factor App: Config](https://12factor.net/config)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Zod Schema Validation](https://zod.dev/)
- [Node.js Process.env Best Practices](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)
