# Review Game - Development Guide

This file provides Claude Code with context-specific guidance for developing the Review Game application.

## Project Overview

**Review Game** is a Jeopardy-style review game application for educators. Teachers can create games with question banks, manage teams, and run interactive review sessions. The application includes an admin portal for user management and subscription handling.

## Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Styling:** Tailwind CSS
- **UI Components:** Headless UI
- **Payments:** Stripe
- **Error Tracking:** Sentry
- **Build Tool:** Turbopack (Next.js built-in)

## Directory Structure

```
review-game/
├── app/
│   ├── (auth)/                    # Authentication routes (login, signup)
│   ├── admin/                     # Admin portal
│   │   └── users/                 # User management
│   │       ├── [userId]/          # Individual user details
│   │       │   ├── components/    # User detail components
│   │       │   └── page.tsx       # User detail page
│   │       └── page.tsx           # User list page
│   ├── api/                       # API routes
│   │   ├── admin/                 # Admin-only APIs
│   │   │   └── users/             # User management APIs
│   │   ├── webhooks/              # Stripe webhooks
│   │   └── ...
│   ├── dashboard/                 # Teacher dashboard
│   │   └── games/                 # Game management
│   ├── game/                      # Game play
│   │   ├── teacher/[gameId]/      # Teacher control
│   │   └── team/[gameId]/         # Team play
│   └── error.tsx                  # Error boundary
├── components/                    # Shared components
├── hooks/                         # React hooks
├── lib/                          # Utility libraries
│   ├── admin/                    # Admin utilities
│   │   └── auth.ts               # Admin authentication
│   ├── supabase/                 # Supabase clients
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── middleware.ts         # Middleware client
│   ├── hooks/                    # Custom hooks
│   ├── constants/                # Constants
│   └── logger.ts                 # Centralized logging
├── types/                        # TypeScript types
│   └── database.types.ts         # Supabase generated types
├── middleware.ts                 # Next.js middleware
├── sentry.client.config.ts       # Sentry client config
└── sentry.server.config.ts       # Sentry server config
```

## Development Commands

```bash
# Development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Linting (must pass before commit)
npm run lint

# Type checking (Next.js build includes this)
npx tsc --noEmit
```

## Database Schema

### Key Tables

**profiles** - User profiles with subscription data
- `id` (uuid, FK to auth.users)
- `email` (text)
- `full_name` (text)
- `role` (text: 'user' | 'admin')
- `is_active` (boolean)
- `subscription_status` (text)
- `subscription_tier` (text)
- `email_verified_manually` (boolean)
- `suspended_at` (timestamp)
- `admin_notes` (text)
- `games_created_count` (integer)

**games** - Game instances
- `id` (uuid)
- `teacher_id` (uuid, FK to profiles)
- `bank_id` (uuid, FK to question_banks)
- `status` (text: 'setup' | 'in_progress' | 'completed')
- `num_teams` (integer)
- `team_names` (jsonb)
- `daily_double_positions` (jsonb)

**teams** - Team participation in games
- `id` (uuid)
- `game_id` (uuid, FK to games)
- `team_number` (integer)
- `team_name` (text)
- `score` (integer)
- `connection_status` (text)

**question_banks** - Question collections
- `id` (uuid)
- `owner_id` (uuid, FK to profiles)
- `title` (text)
- `subject` (text)
- `is_public` (boolean)
- `is_custom` (boolean)

**admin_audit_log** - Audit trail for admin actions
- `id` (uuid)
- `admin_user_id` (uuid, FK to profiles)
- `action_type` (text)
- `target_type` (text)
- `target_id` (text)
- `changes` (jsonb)
- `reason` (text)
- `notes` (text)

### Important Indexes

- `idx_profiles_role` - For admin/user filtering
- `idx_profiles_email` - Email lookups
- `idx_profiles_is_active` - Active user filtering
- `idx_profiles_suspended_at` - Session invalidation

## Development Patterns

### Admin Portal Patterns

#### 1. Authentication & Authorization

Always verify admin status on both client and server:

```typescript
// Server-side (API routes)
import { verifyAdminUser, createAdminServerClient } from '@/lib/admin/auth';

const { user, supabase } = await verifyAdminUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

#### 2. Admin API Route Structure

Pattern for admin API routes:

```typescript
// app/api/admin/users/[userId]/action/route.ts
export async function POST(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // 1. Verify admin
    const { user, supabase } = await verifyAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get and validate request body
    const body = await req.json();
    const { userId } = await context.params;

    // 3. Validate input
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // 4. Perform database operation (with RLS)
    const { data, error } = await supabase
      .from('profiles')
      .update({ field: body.value })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // 5. Log admin action
    await logAdminAction({
      actionType: 'action_name',
      targetType: 'profile',
      targetId: userId,
      changes: { field: { from: oldValue, to: body.value } },
      notes: `Description of action`,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    });

    // 6. Return success
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Action failed', error, {
      operation: 'action_name',
      userId: context.params.userId,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 3. Atomic Database Operations with Audit Logging

For operations requiring audit logs, use database functions:

```sql
-- Example: suspend_user_with_audit()
SELECT * FROM suspend_user_with_audit(
  p_user_id := 'user-uuid',
  p_admin_id := 'admin-uuid',
  p_reason := 'Suspension reason',
  p_ip_address := '192.168.1.1',
  p_user_agent := 'Mozilla/5.0...'
);
```

**Benefits:**
- Atomic operations (both succeed or both fail)
- TOCTOU prevention (admin re-verification in transaction)
- Consistent audit logging
- Security definer with locked search_path

#### 4. Modal Component Pattern

Use Headless UI Dialog for modals:

```typescript
import { Dialog, Transition } from '@headlessui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description
}: ModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Modal content */}
      </Dialog>
    </Transition>
  );
}
```

#### 5. Toast Notification Pattern

```typescript
const [showToast, setShowToast] = useState(false);
const [toastMessage, setToastMessage] = useState('');
const [toastType, setToastType] = useState<'success' | 'error'>('success');

const showSuccessToast = (message: string) => {
  setToastMessage(message);
  setToastType('success');
  setShowToast(true);
};

// In JSX
{showToast && (
  <Toast
    message={toastMessage}
    type={toastType}
    onClose={() => setShowToast(false)}
    duration={5000}
  />
)}
```

### Logging Patterns

Always use the centralized logger:

```typescript
import { logger } from '@/lib/logger';

// Info logging
logger.info('Operation completed', {
  operation: 'operationName',
  userId: user.id,
});

// Error logging
logger.error('Operation failed', error, {
  operation: 'operationName',
  userId: user.id,
  additionalContext: 'value',
});
```

**Logger Features:**
- Automatic PII redaction
- Sentry integration in production
- Console logging in development
- Required `operation` field for all logs

### Type Safety

**Always use generated database types:**

```typescript
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types';

type Profile = Tables<'profiles'>;
type ProfileInsert = TablesInsert<'profiles'>;
type ProfileUpdate = TablesUpdate<'profiles'>;
```

**Regenerate types after schema changes:**
```bash
npx supabase gen types typescript --project-id your-project-id > types/database.types.ts
```

### React Hook Dependencies

**Common patterns that require eslint-disable:**

1. **Effect dependencies set inside the effect:**
```typescript
useEffect(() => {
  const value = someCalculation();
  // value is used here but set inside effect
}, [dependency]);
// eslint-disable-next-line react-hooks/exhaustive-deps -- value is set inside effect
```

2. **Intentional ref-based closures:**
```typescript
useEffect(() => {
  valueRef.current = value; // Captured in ref to avoid stale closures
}, [otherDep]);
// eslint-disable-next-line react-hooks/exhaustive-deps -- value captured via ref
```

### Validation Constants

Reuse validation constants across components:

```typescript
export const VALIDATION = {
  FULL_NAME_MAX_LENGTH: 255,
  EMAIL_MAX_LENGTH: 255,
  ADMIN_NOTES_MAX_LENGTH: 5000,
  EMAIL_REGEX: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
};
```

## Testing & Quality

### Pre-commit Checklist

Before committing changes:

1. ✅ Run `npm run lint` - Must pass with exit code 0
2. ✅ Test manually in browser
3. ✅ Check console for errors
4. ✅ Verify database changes with migrations
5. ✅ Test admin actions create audit logs

### Common Linting Issues

- **React Hook Dependencies:** Add eslint-disable with explanation
- **Unused Variables:** Remove or prefix with `_` if required by signature
- **Type Safety:** Always explicitly type function parameters and return values
- **No `any` types:** Use proper types from database.types.ts

## Security Considerations

### Row Level Security (RLS)

All database tables have RLS enabled. Key policies:

- **profiles:** Users can read their own, admins can read all
- **games:** Teachers can manage their own games
- **admin_audit_log:** Admins only
- **question_banks:** Public banks readable by all, custom by owner

### Admin Actions

All admin actions must:
1. Verify admin status
2. Validate input
3. Log to audit trail
4. Handle errors gracefully
5. Return appropriate HTTP status codes

### PII Protection

The logger automatically redacts sensitive fields:
- password
- token
- secret
- authorization
- stripe_secret
- session
- cookie

## Common Workflows

### Adding a New Admin Action

1. **Create API route:** `app/api/admin/users/[userId]/action/route.ts`
2. **Implement handler:** Use admin auth pattern
3. **Add audit logging:** Use `logAdminAction()` or database function
4. **Create UI component:** Modal or button in user detail page
5. **Add to ProfileTab:** Integrate into existing UI
6. **Test:** Verify action works and audit log is created
7. **Lint:** Run `npm run lint` and fix any issues

### Adding a Database Column

1. **Create migration:** Add column in Supabase dashboard or SQL
2. **Update RLS policies:** If needed for new column
3. **Regenerate types:** `npx supabase gen types...`
4. **Update UI:** Add input fields if user-facing
5. **Update API:** Handle new column in PATCH endpoints
6. **Test:** Verify column appears and updates correctly

### Adding a New Modal

1. **Create component:** Follow Headless UI Dialog pattern
2. **Add state management:** `isOpen`, `onClose`, `onConfirm`
3. **Add to parent:** Import and render with condition
4. **Add trigger:** Button to open modal
5. **Handle submission:** Call API, show toast, close modal
6. **Test:** Open, close, submit, error handling

## Environment Variables

Required environment variables (see `.env.local`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Optional: Sentry testing in dev
NEXT_PUBLIC_SENTRY_DEBUG=true
```

## Troubleshooting

### Common Issues

**Issue:** "Unauthorized" error in admin API
- **Solution:** Verify admin role in database, check Supabase RLS policies

**Issue:** Types not matching database
- **Solution:** Regenerate types with `npx supabase gen types`

**Issue:** Lint warnings about React hooks
- **Solution:** Add eslint-disable with explanation (see patterns above)

**Issue:** Toast not showing
- **Solution:** Check state management, verify Toast component is rendered

**Issue:** Modal not closing after submit
- **Solution:** Ensure `onClose()` is called after successful submission

## Performance Considerations

- **Database queries:** Always use indexes for frequently queried columns
- **Realtime subscriptions:** Clean up subscriptions in useEffect cleanup
- **Large lists:** Implement pagination (see UserListTable.tsx)
- **Score animations:** Use refs to prevent stale closures (see useAnimatedScore.ts)

## File Naming Conventions

- **Components:** PascalCase (e.g., `UserProfileHeader.tsx`)
- **Utilities:** camelCase (e.g., `auth.ts`)
- **API routes:** lowercase (e.g., `route.ts`, `verify-email/route.ts`)
- **Types:** PascalCase (e.g., `database.types.ts`)

## Git Workflow

1. Create feature branch from main
2. Make changes and test locally
3. Run linting and fix issues
4. Commit with descriptive message
5. Push and create PR
6. Verify Vercel preview deployment
7. Merge after review

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Headless UI Documentation](https://headlessui.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Last Updated:** 2025-11-14
**Maintained by:** Claude Code AI
