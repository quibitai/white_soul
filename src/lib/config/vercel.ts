/**
 * Vercel-specific configuration and environment detection
 * Handles serverless function limitations and optimizations
 */

/**
 * Detect if running in Vercel serverless environment
 * @returns True if running in Vercel
 */
export function isVercelEnvironment(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

/**
 * Get optimal retry settings for Vercel Blob operations
 * @returns Retry configuration optimized for serverless
 */
export function getBlobRetryConfig() {
  if (isVercelEnvironment()) {
    return {
      maxRetries: 3, // Fewer retries in serverless to avoid timeouts
      initialDelay: 2000, // Start with longer delay for eventual consistency
      maxDelay: 8000, // Cap delays to avoid function timeout
      backoffMultiplier: 1.5, // Gentler backoff
    };
  }
  
  return {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  };
}

/**
 * Get FFmpeg binary paths prioritized for current environment
 * @returns Array of paths to try in order
 */
export function getFFmpegPaths(): string[] {
  const paths: string[] = [];
  
  if (isVercelEnvironment()) {
    // Vercel/Lambda-specific paths first
    paths.push(
      '/var/task/node_modules/ffmpeg-static/ffmpeg',
      '/opt/nodejs/node_modules/ffmpeg-static/ffmpeg'
    );
    
    if (process.env.LAMBDA_TASK_ROOT) {
      paths.push(`${process.env.LAMBDA_TASK_ROOT}/node_modules/ffmpeg-static/ffmpeg`);
    }
  }
  
  // Standard paths for all environments
  paths.push(
    process.cwd() + '/node_modules/ffmpeg-static/ffmpeg',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg'
  );
  
  return paths;
}

/**
 * Get optimal timeout settings for current environment
 * @returns Timeout configuration
 */
export function getTimeoutConfig() {
  if (isVercelEnvironment()) {
    return {
      synthesis: 25000, // 25s for synthesis (Vercel has 30s limit for Hobby)
      ffmpeg: 20000, // 20s for FFmpeg operations
      blobUpload: 10000, // 10s for blob uploads
      statusUpdate: 5000, // 5s for status updates
    };
  }
  
  return {
    synthesis: 60000, // 60s for synthesis in development
    ffmpeg: 45000, // 45s for FFmpeg operations
    blobUpload: 30000, // 30s for blob uploads
    statusUpdate: 10000, // 10s for status updates
  };
}

/**
 * Get memory usage limits for current environment
 * @returns Memory configuration
 */
export function getMemoryConfig() {
  if (isVercelEnvironment()) {
    return {
      maxChunkSize: 5 * 1024 * 1024, // 5MB max chunk size
      maxConcurrentChunks: 2, // Process fewer chunks concurrently
      tempFileCleanup: true, // Always cleanup temp files
    };
  }
  
  return {
    maxChunkSize: 20 * 1024 * 1024, // 20MB max chunk size in development
    maxConcurrentChunks: 4, // More concurrent processing
    tempFileCleanup: false, // Keep temp files for debugging
  };
}

/**
 * Construct absolute URL for API calls in Vercel environment
 * @param path - API path (e.g., '/api/process')
 * @returns Absolute URL for the API endpoint
 */
export function getAbsoluteApiUrl(path: string): string {
  // Remove leading slash if present to normalize
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  
  // In Vercel deployment, use VERCEL_URL environment variable
  if (isVercelEnvironment()) {
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      // VERCEL_URL doesn't include protocol in some cases
      const baseUrl = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
      return `${baseUrl}/${normalizedPath}`;
    }
    
    // Fallback: try to construct from other Vercel env vars
    const vercelBranch = process.env.VERCEL_BRANCH_URL;
    if (vercelBranch) {
      const baseUrl = vercelBranch.startsWith('http') ? vercelBranch : `https://${vercelBranch}`;
      return `${baseUrl}/${normalizedPath}`;
    }
    
    // Last resort: use the project name if available
    const projectName = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (projectName) {
      const baseUrl = projectName.startsWith('http') ? projectName : `https://${projectName}`;
      return `${baseUrl}/${normalizedPath}`;
    }
    
    // If all else fails in Vercel, log warning and use relative path
    console.warn('⚠️ Could not determine Vercel URL, using relative path. This may cause issues.');
    return `/${normalizedPath}`;
  }
  
  // In development, use localhost
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}/${normalizedPath}`;
}

/**
 * Log environment information for debugging
 */
export function logEnvironmentInfo(): void {
  console.log('🌍 Environment Detection:');
  console.log(`  - Vercel: ${isVercelEnvironment()}`);
  console.log(`  - Node Version: ${process.version}`);
  console.log(`  - Platform: ${process.platform}`);
  console.log(`  - Architecture: ${process.arch}`);
  
  if (isVercelEnvironment()) {
    console.log('  - Lambda Task Root:', process.env.LAMBDA_TASK_ROOT || 'not set');
    console.log('  - Vercel Region:', process.env.VERCEL_REGION || 'not set');
    console.log('  - Function Name:', process.env.AWS_LAMBDA_FUNCTION_NAME || 'not set');
    console.log('  - Vercel URL:', process.env.VERCEL_URL || 'not set');
    console.log('  - Vercel Branch URL:', process.env.VERCEL_BRANCH_URL || 'not set');
    console.log('  - Project Production URL:', process.env.VERCEL_PROJECT_PRODUCTION_URL || 'not set');
  }
}
