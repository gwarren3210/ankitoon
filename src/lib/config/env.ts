import { logger } from '@/lib/logger'

/**
 * Environment variable configuration interface.
 * Provides typed access to validated environment variables.
 */
export interface EnvironmentConfig {
  supabase: {
    url: string
    publishableKey: string
    serviceRoleKey?: string
  }
  app: {
    nodeEnv: 'development' | 'production' | 'test'
  }
}

/**
 * Required environment variables with descriptions.
 * These must be set for the app to start.
 */
const REQUIRED_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase project URL (https://your-project.supabase.co)',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'Supabase publishable API key',
} as const

/**
 * Validates all required environment variables exist and have valid formats.
 * Throws an error with clear message if validation fails.
 * Input: none (reads from process.env)
 * Output: validated EnvironmentConfig object
 */
export function validateEnvironment(): EnvironmentConfig {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required variables exist
  for (const [key, description] of Object.entries(REQUIRED_VARS)) {
    const value = process.env[key]
    if (!value || value.trim() === '') {
      errors.push(`${key} - ${description}`)
    }
  }

  // Validate Supabase URL format (if provided)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    errors.push(
      `NEXT_PUBLIC_SUPABASE_URL must start with 'https://', ` +
      `got '${supabaseUrl.substring(0, 30)}...'`
    )
  }

  // Validate NODE_ENV if set
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(
      `NODE_ENV must be 'development', 'production', or 'test', ` +
      `got '${nodeEnv}'`
    )
  }

  // Check optional variables and warn if missing
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY not set (admin features disabled)')
  }

  // Fail fast if required variables are missing
  if (errors.length > 0) {
    const errorMessage = [
      '',
      'Missing or invalid required environment variables:',
      '',
      ...errors.map(err => `  - ${err}`),
      '',
      'Please set these variables in .env.local',
      'See .env.example for reference',
      '',
    ].join('\n')

    logger.error({ errors }, 'Environment validation failed')
    throw new Error(errorMessage)
  }

  // Log warnings for optional variables
  if (warnings.length > 0) {
    logger.warn({ warnings }, 'Optional environment variables not set')
  }

  // Return validated config with type safety
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    app: {
      nodeEnv: (nodeEnv as EnvironmentConfig['app']['nodeEnv']) || 'development',
    },
  }
}

/** Singleton config instance - validated once and cached */
let config: EnvironmentConfig | null = null

/**
 * Gets validated environment configuration.
 * Validates on first call, returns cached result on subsequent calls.
 * Input: none
 * Output: validated EnvironmentConfig object
 */
export function getConfig(): EnvironmentConfig {
  if (!config) {
    config = validateEnvironment()
    logger.info('Environment configuration validated successfully')
  }
  return config
}

/**
 * Resets cached config. Used for testing.
 * Input: none
 * Output: void
 */
export function resetConfig(): void {
  config = null
}
