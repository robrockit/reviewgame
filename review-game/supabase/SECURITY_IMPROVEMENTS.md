# Security Improvements - Server-Side Score Updates

**Jira Ticket:** RG-45
**Reference:** PR #23 Code Review
**Date:** 2025-11-06

## Overview

This document describes the security improvements made to move score update logic from client-side direct database updates to server-side RPC functions with proper authorization checks.

## Changes Implemented

### 1. Server-Side RPC Function (`update_team_score`)

**Location:** `/supabase/migrations/add_update_team_score_rpc.sql`

Created a PostgreSQL function that handles all team score updates with the following features:

#### Function Signature
```sql
public.update_team_score(
  p_team_id UUID,
  p_score_change INTEGER,
  p_game_id UUID
) RETURNS TABLE (
  team_id UUID,
  new_score INTEGER,
  success BOOLEAN,
  error_message TEXT
)
```

#### Security Features
1. **Authentication Check**: Verifies user is authenticated via `auth.uid()`
2. **Teacher Authorization**: Confirms authenticated user is the game's teacher
3. **Game Ownership**: Validates the game exists and belongs to the teacher
4. **Team Validation**: Ensures team belongs to the specified game
5. **Atomic Updates**: Score updates are atomic and race-condition safe
6. **Error Handling**: Returns detailed error messages for debugging

#### Authorization Flow
```
1. Check auth.uid() is not NULL → User is authenticated
2. Get game.teacher_id for p_game_id → Game exists
3. Verify game.teacher_id = auth.uid() → Teacher owns game
4. Get team.game_id for p_team_id → Team exists
5. Verify team.game_id = p_game_id → Team belongs to game
6. Update team.score atomically → Success
```

#### Permissions
- **Granted to:** `authenticated` role
- **Revoked from:** `anon` role (anonymous users cannot call this function)

### 2. Client-Side Updates

#### QuestionModal Component
**Location:** `/components/game/QuestionModal.tsx`

**Before:**
```typescript
const { error } = await supabase
  .from('teams')
  .update({ score: newScore })
  .eq('id', teamId);
```

**After:**
```typescript
const { data: scoreResult, error } = await supabase
  .rpc('update_team_score', {
    p_team_id: teamId,
    p_score_change: scoreChange,
    p_game_id: gameId
  });

// Check for authorization errors
if (scoreResult && !scoreResult[0].success) {
  throw new Error(scoreResult[0].error_message);
}
```

#### DailyDoubleModal Component
**Location:** `/components/game/DailyDoubleModal.tsx`

Updated similar to QuestionModal, with the following improvements:
- Removed need for pre-fetching fresh team scores (RPC function handles atomically)
- Consistent error handling across all score update paths
- Proper authorization error messaging

### 3. Row-Level Security (RLS) Policies

**Existing policies remain in place as defense-in-depth:**

#### Teams Table
- `"Teachers can update team scores"` - Allows teachers to update teams in their own games
- `"Anyone can update team connection status"` - Restricts anonymous updates to connection_status only

#### Games Table
- `"Teachers can update their own games"` - Teachers can only modify games they own

**Note:** RLS policies provide additional security layer even with RPC function in place.

## Security Benefits

### 1. Centralized Authorization
- All score updates go through a single, auditable function
- Authorization logic is consistent and cannot be bypassed
- Easier to update authorization rules in one location

### 2. Defense in Depth
- **Layer 1:** Client-side checks (user experience)
- **Layer 2:** RPC function authorization (server-side enforcement)
- **Layer 3:** RLS policies (database-level protection)

### 3. Audit Trail
All score updates now:
- Verify teacher identity server-side
- Log authorization failures
- Can be monitored via database logs

### 4. Prevents Common Attacks
- **Direct API manipulation**: Anonymous users cannot update scores
- **Cross-game manipulation**: Teachers cannot update scores for games they don't own
- **Team spoofing**: Validates team belongs to the specified game
- **Race conditions**: Atomic score updates prevent concurrent modification issues

## Error Handling

The RPC function returns detailed error messages for different failure scenarios:

| Error Message | Cause | HTTP Context |
|--------------|-------|--------------|
| "Unauthorized: Authentication required" | User not logged in | 401 Unauthorized |
| "Unauthorized: Only the game teacher can update scores" | Wrong teacher | 403 Forbidden |
| "Game not found" | Invalid game_id | 404 Not Found |
| "Team not found" | Invalid team_id | 404 Not Found |
| "Team does not belong to the specified game" | team_id not in game_id | 400 Bad Request |
| "Error updating score: {details}" | Database error | 500 Server Error |

## Testing Recommendations

### Functional Testing
1. ✅ Correct answer awards points
2. ✅ Incorrect answer deducts points
3. ✅ Daily Double wagers work correctly
4. ✅ Score updates are atomic (no race conditions)

### Security Testing
1. **Authentication Tests**
   - [ ] Anonymous users cannot call RPC function
   - [ ] Logged-out users receive proper error messages

2. **Authorization Tests**
   - [ ] Teacher A cannot update scores for Teacher B's game
   - [ ] Teacher cannot update team from wrong game
   - [ ] Invalid game_id returns proper error
   - [ ] Invalid team_id returns proper error

3. **Edge Cases**
   - [ ] Concurrent score updates handled correctly
   - [ ] Negative scores allowed (correct behavior)
   - [ ] Very large score changes handled
   - [ ] Team belonging to completed game

### Manual Testing Steps

1. **Valid Update (Should Succeed)**
   ```
   1. Login as Teacher A
   2. Start a game
   3. Have team buzz in
   4. Award/deduct points
   5. Verify score updates correctly
   ```

2. **Unauthorized Update (Should Fail)**
   ```
   1. Login as Teacher A
   2. Get Teacher B's game_id (from database/logs)
   3. Try to update Teacher B's team score
   4. Verify error: "Unauthorized: Only the game teacher can update scores"
   ```

3. **Wrong Team (Should Fail)**
   ```
   1. Login as Teacher A
   2. Start Game 1
   3. Try to update team from Game 2
   4. Verify error: "Team does not belong to the specified game"
   ```

## Migration Instructions

### For New Deployments
Run the migration file:
```bash
supabase db push
```

### For Existing Deployments
1. Run migration: `add_update_team_score_rpc.sql`
2. Verify function exists:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name = 'update_team_score';
   ```
3. Test RPC call:
   ```sql
   SELECT * FROM update_team_score(
     'team-uuid'::UUID,
     100,
     'game-uuid'::UUID
   );
   ```

## Rollback Plan

If issues arise, rollback steps:

1. **Revert client code:**
   ```bash
   git revert <commit-hash>
   ```

2. **Drop RPC function:**
   ```sql
   DROP FUNCTION IF EXISTS public.update_team_score(UUID, INTEGER, UUID);
   ```

3. **Restore direct updates** (RLS policies will still protect)

## Future Enhancements

Potential improvements for future iterations:

1. **Audit Logging**
   - Create `score_audit_log` table
   - Log all score changes with timestamp, teacher_id, old_score, new_score

2. **Rate Limiting**
   - Prevent rapid score updates (potential abuse)
   - Add cooldown between updates

3. **Score History**
   - Track score changes over time
   - Enable undo/replay functionality

4. **Bulk Updates**
   - Create RPC function for updating multiple teams at once
   - Useful for final scoring adjustments

## Related Documentation

- [Supabase RPC Documentation](https://supabase.com/docs/guides/database/functions)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/ddl-priv.html)

## Contact

For questions or issues related to these changes:
- Jira: RG-45
- Original PR: #23
