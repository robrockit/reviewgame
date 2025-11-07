This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required environment variables:
   - Sentry DSN for error tracking
   - Supabase credentials
   - Application URL

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Error Tracking and Logging

This project uses **Sentry** for production error tracking and monitoring. All errors and warnings are logged through a centralized logging service.

### Setup Sentry

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new Next.js project
3. Copy your DSN and add it to `.env.local`:
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=your_dsn_here
   ```

### Using the Logger

```typescript
import { logger } from '@/lib/logger';

// Log info
logger.info('Operation completed', { userId, operation: 'login' });

// Log warnings
logger.warn('Rate limit approaching', { userId, remainingRequests: 10 });

// Log errors
logger.error('Failed to update score', error, {
  teamId,
  gameId,
  operation: 'updateScore'
});
```

For complete documentation, see [LOGGING.md](./LOGGING.md).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
