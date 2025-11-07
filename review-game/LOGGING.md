# Logging and Error Tracking

This project uses a centralized logging service with Sentry integration for production error tracking and monitoring.

## Overview

All logging is handled through the `logger` utility located at `lib/logger.ts`. This provides consistent error tracking across the application and integrates with Sentry for production monitoring.

## Configuration

### Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your_organization_name
SENTRY_PROJECT=your_project_name

# Optional: Auth token for uploading source maps (CI/CD)
SENTRY_AUTH_TOKEN=your_auth_token_here
```

### Getting Your Sentry DSN

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project for your application
3. Copy the DSN from your project settings
4. Add it to your environment variables

## Usage

### Importing the Logger

```typescript
import { logger } from '@/lib/logger';
```

### Log Levels

The logger supports three levels:

#### 1. Info - Informational messages

Use for tracking successful operations and application flow:

```typescript
logger.info('User logged in successfully', {
  userId: user.id,
  operation: 'login',
});
```

#### 2. Warn - Warning messages

Use for non-critical issues that don't break functionality:

```typescript
logger.warn('API rate limit approaching', {
  userId: user.id,
  remainingRequests: 10,
  operation: 'apiCall',
});
```

#### 3. Error - Error messages

Use for errors that affect functionality:

```typescript
logger.error('Failed to update team score', error, {
  teamId: team.id,
  gameId: game.id,
  scoreChange: 100,
  operation: 'updateScore',
});
```

## Best Practices

### 1. Always Include Context

Provide relevant context with every log to make debugging easier:

```typescript
// Good ✓
logger.error('Failed to create game', error, {
  userId: user.id,
  gameName: gameName,
  operation: 'createGame',
});

// Bad ✗
logger.error('Error', error);
```

### 2. Use Descriptive Messages

Write clear, human-readable messages:

```typescript
// Good ✓
logger.error('Failed to update team score', error, { ... });

// Bad ✗
logger.error('Error in handler', error, { ... });
```

### 3. Include Operation Context

Always include an `operation` field to identify where the log originated:

```typescript
logger.error('Database connection failed', error, {
  operation: 'connectDatabase',
  database: 'postgres',
});
```

### 4. Add Relevant IDs

Include all relevant identifiers for debugging:

```typescript
logger.error('Failed to award points', error, {
  gameId: game.id,
  teamId: team.id,
  userId: user.id,
  questionId: question.id,
  operation: 'awardPoints',
});
```

### 5. Handle Errors Properly

When catching errors, always log them before handling:

```typescript
try {
  await updateTeamScore(teamId, points);
} catch (error) {
  logger.error('Failed to update team score', error, {
    teamId,
    scoreChange: points,
    gameId,
    operation: 'updateScore',
  });
  // Handle the error (show user message, etc.)
  throw error; // Re-throw if needed
}
```

## Development vs Production

### Development
- Logs are printed to the console with formatted output
- Errors are not sent to Sentry (filtered by `beforeSend`)
- Full error details are visible in the console

### Production
- Console logs are minimized
- Errors are automatically sent to Sentry
- Session replays are recorded for error debugging
- Source maps are uploaded for accurate stack traces

## Sentry Features

### Error Tracking
All errors logged with `logger.error()` are automatically sent to Sentry with:
- Full stack traces
- User context
- Browser/device information
- Custom context data

### Breadcrumbs
Info logs create breadcrumbs in Sentry that provide context leading up to errors.

### Session Replay
When an error occurs, Sentry captures a replay of the user's session to help reproduce the issue.

### Alerts
Configure alerts in your Sentry dashboard:
1. Go to your project settings
2. Navigate to Alerts
3. Create alert rules for:
   - High error rates
   - Specific error types
   - Performance degradation

## Common Patterns

### API Error Handling

```typescript
try {
  const response = await fetch('/api/games');
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
} catch (error) {
  logger.error('Failed to fetch games', error, {
    userId: user.id,
    operation: 'fetchGames',
    endpoint: '/api/games',
  });
}
```

### Database Operations

```typescript
try {
  const { data, error } = await supabase
    .from('teams')
    .update({ score: newScore })
    .eq('id', teamId);

  if (error) {
    logger.error('Failed to update team score in database', error, {
      teamId,
      newScore,
      gameId,
      operation: 'updateTeamScore',
    });
    throw error;
  }
} catch (error) {
  logger.error('Unexpected error updating team score', error, {
    teamId,
    gameId,
    operation: 'updateTeamScore',
  });
}
```

### Real-time Events

```typescript
channel.subscribe((status: string) => {
  if (status === 'CHANNEL_ERROR') {
    logger.error('Failed to subscribe to channel', undefined, {
      channelName,
      gameId,
      status,
      operation: 'subscribeToChannel',
    });
  }
});
```

## Monitoring and Alerts

### Recommended Alerts

Set up the following alerts in Sentry:

1. **Critical Errors**
   - Score update failures
   - Game creation failures
   - Authentication errors

2. **High Error Rate**
   - Alert when error rate exceeds 5% of requests
   - Monitor for sudden spikes in errors

3. **Performance Issues**
   - Page load times > 3 seconds
   - API response times > 1 second

### Dashboard Monitoring

Monitor these metrics in your Sentry dashboard:
- Error frequency and trends
- Most common errors
- Affected users
- Browser/device breakdown
- Geographic distribution

## Troubleshooting

### Logs Not Appearing in Sentry

1. Check that `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify you're not in development mode (logs are filtered)
3. Check your Sentry project settings
4. Look for network errors in the browser console

### Source Maps Not Working

1. Ensure `SENTRY_AUTH_TOKEN` is set for CI/CD
2. Check that source maps are being uploaded during build
3. Verify the Sentry project and org names are correct

### Too Many Logs

If you're receiving too many logs:
1. Adjust the `tracesSampleRate` in Sentry config files
2. Add filters to `beforeSend` in Sentry config
3. Review and remove unnecessary log statements

## Migration from console.log/error/warn

All `console.error()` and `console.warn()` statements have been replaced with the logger. When adding new code:

```typescript
// Old ✗
console.error('Error:', error);
console.warn('Warning:', message);

// New ✓
logger.error('Description of error', error, { context });
logger.warn('Description of warning', { context });
```

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Next.js Sentry Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Error Monitoring Best Practices](https://docs.sentry.io/product/best-practices/)
