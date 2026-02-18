# Development Scripts

This directory contains utility scripts for development workflows.

## Environment Switcher

Easily toggle between development and staging environments.

### Quick Start

```bash
# Check current environment
npm run env:status

# Switch to development
npm run env:dev

# Switch to staging
npm run env:staging
```

### How It Works

The script copies the appropriate environment file to `.env.local`, which Next.js automatically loads.

**Environment Files:**
- `.env.local.backup` → Development environment (local Supabase, test Stripe keys)
- `.env.staging` → Staging environment (staging Supabase, staging Stripe keys)
- `.env.local` → **Active environment** (generated, not committed to git)

**Environment Markers:**
For reliable environment detection, add this comment as the **first line** of each env file:

```bash
# ENVIRONMENT=development
# or
# ENVIRONMENT=staging
```

If no marker is found, the script falls back to inspecting the Supabase URL.

### Workflow Example

```bash
# Working on new feature locally
npm run env:dev
npm run dev

# Test against staging database
npm run env:staging
npm run dev  # Restart required!

# Back to development
npm run env:dev
npm run dev
```

### Important Notes

⚠️ **Always restart your dev server** after switching environments:
1. Stop dev server (Ctrl+C)
2. Run `npm run env:dev` or `npm run env:staging`
3. Start dev server: `npm run dev`

✅ **Safe to use** - Environment-specific backups are automatically created:
  - Switching from dev → `.env.local.dev.backup`
  - Switching from staging → `.env.local.staging.backup`
  - Backups are only created if they don't already exist

🔒 **Security** - Never commit `.env.local`, `.env.staging`, `.env.local.*.backup`, or any environment files to git

### Git Ignore Recommendations

Ensure these patterns are in your `.gitignore`:

```gitignore
# Environment files
.env*
!.env*.example

# Environment backup files created by environment switcher
.env.local.*.backup
```

### Troubleshooting

**"Source file not found"**
- Make sure you have both `.env.local.backup` and `.env.staging` files
- Copy from `.env.local.example` and update with your keys

**Changes not taking effect**
- Did you restart the dev server?
- Check `npm run env:status` to verify current environment

**Lost my environment configuration**
- Dev environment backed up in `.env.local.dev.backup`
- Staging environment backed up in `.env.local.staging.backup`
- Restore by copying the backup file back to `.env.local` or switching environments
