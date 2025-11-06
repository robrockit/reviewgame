# Test Coverage Requirements

## Overview

This document outlines the testing strategy, requirements, and implementation roadmap for the Review Game application. The goal is to establish comprehensive test coverage to ensure application reliability, maintainability, and quality.

## Testing Goals

- **Overall Coverage Target**: 80% minimum coverage across the codebase
- **Critical Path Coverage**: 90-100% for authentication, game state, scoring, and payment logic
- **Test Types**: Unit, Integration, and End-to-End (E2E) testing
- **Automation**: Tests run on every commit via pre-commit hooks and CI/CD pipeline

## Technology Stack

### Unit & Integration Testing
- **Vitest**: Fast, modern test runner built for Vite/modern tooling
- **React Testing Library**: Component testing with focus on user behavior
- **@testing-library/user-event**: Simulate user interactions
- **@vitest/ui**: Visual test UI for debugging

### E2E Testing
- **Playwright**: Cross-browser end-to-end testing
- **@playwright/test**: Playwright test runner

### Coverage & Reporting
- **@vitest/coverage-v8**: Code coverage using V8
- **Istanbul/NYC reports**: HTML, JSON, and LCOV formats

## Coverage Targets by Area

| Area | Coverage Target | Priority | Rationale |
|------|----------------|----------|-----------|
| Authentication & Authorization | 95% | Critical | Security-critical, affects all user flows |
| Game State Management (Zustand) | 90% | Critical | Core business logic |
| Scoring & Buzzer Logic | 90% | Critical | Core game functionality |
| Payment/Stripe Integration | 85% | High | Financial operations, customer trust |
| Utilities & Helpers | 90% | High | Reused across application |
| React Hooks | 85% | High | Business logic and state management |
| UI Components | 75% | Medium | Visual components, harder to test comprehensively |
| Pages/Routes | 70% | Medium | Covered by integration and E2E tests |
| API Routes | 85% | High | Backend logic and data operations |

## Priority Testing Areas

### 1. Authentication & Authorization (`/lib/supabase`, `/hooks/useAuth.ts`)
- User login/logout flows
- Session management
- Protected route access
- Role-based authorization (teacher vs student)
- Token refresh and expiration

### 2. Game State Management (`/lib/stores/gameStore.ts`)
- Game creation and initialization
- State updates (teams, scores, questions)
- Question selection and answering
- Game lifecycle (start, pause, end)
- State persistence and recovery

### 3. Scoring & Buzzer Functionality (`/hooks/useBuzzer.ts`, `/components/student/BuzzButton.tsx`)
- Buzzer activation and locking
- Score calculation and updates
- Team scoring logic
- Buzzer race conditions
- Score persistence

### 4. Payment/Stripe Integration (`/lib/stripe`)
- Payment flow initialization
- Webhook handling
- Subscription management
- Error handling for failed payments
- Refund processing

## Testing Framework Setup

### Package Installation

```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @playwright/test
npm install -D jsdom happy-dom
```

### Configuration Files

#### `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      // Per-file thresholds for critical areas
      perFile: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

#### `vitest.setup.ts`
```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
```

#### `playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Updated `package.json` Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:all": "npm run test:coverage && npm run test:e2e"
  }
}
```

## Testing Best Practices

### 1. Test Naming Convention

Use descriptive test names that explain what is being tested and the expected outcome:

```typescript
// ❌ Bad
it('works', () => {})

// ✅ Good
it('should display error message when login fails with invalid credentials', () => {})
it('should update team score when correct answer is submitted', () => {})
```

### 2. Arrange-Act-Assert (AAA) Pattern

Structure tests clearly:

```typescript
it('should increment score when correct answer is submitted', () => {
  // Arrange - Set up test data and conditions
  const initialScore = 100
  const pointsEarned = 50

  // Act - Perform the action
  const newScore = calculateScore(initialScore, pointsEarned)

  // Assert - Verify the outcome
  expect(newScore).toBe(150)
})
```

### 3. Test User Behavior, Not Implementation

Focus on what users see and do, not internal implementation:

```typescript
// ❌ Bad - Testing implementation details
it('should call handleBuzzClick when buzzer is pressed', () => {
  const handleBuzzClick = vi.fn()
  render(<BuzzButton onClick={handleBuzzClick} />)
  // Testing the prop/function was called
})

// ✅ Good - Testing user behavior
it('should disable buzzer after student buzzes in', async () => {
  const user = userEvent.setup()
  render(<BuzzButton />)

  const buzzer = screen.getByRole('button', { name: /buzz in/i })
  await user.click(buzzer)

  expect(buzzer).toBeDisabled()
})
```

### 4. Mock External Dependencies

Mock APIs, databases, and third-party services:

```typescript
import { vi } from 'vitest'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    })),
  },
}))
```

### 5. Use Test Fixtures and Factories

Create reusable test data:

```typescript
// __tests__/fixtures/game.ts
export const createMockGame = (overrides = {}) => ({
  id: 'game-123',
  title: 'Test Review Game',
  questions: [],
  teams: [],
  status: 'pending',
  createdAt: new Date().toISOString(),
  ...overrides,
})

// Usage in tests
const game = createMockGame({ status: 'active', teams: ['team-1', 'team-2'] })
```

### 6. Test Edge Cases and Error States

Don't just test the happy path:

```typescript
describe('BuzzButton', () => {
  it('should work when game is active (happy path)', () => {})

  it('should be disabled when game has not started', () => {})

  it('should be disabled when time is up', () => {})

  it('should show error when network request fails', () => {})

  it('should prevent double-buzzing', () => {})
})
```

## Testing Examples

### Unit Test Example: Utility Function

```typescript
// lib/utils/helpers.test.ts
import { describe, it, expect } from 'vitest'
import { calculateTeamScore, formatGameTime } from './helpers'

describe('calculateTeamScore', () => {
  it('should return correct score for all correct answers', () => {
    const questions = [
      { points: 100, correct: true },
      { points: 200, correct: true },
      { points: 150, correct: true },
    ]

    expect(calculateTeamScore(questions)).toBe(450)
  })

  it('should return 0 for all incorrect answers', () => {
    const questions = [
      { points: 100, correct: false },
      { points: 200, correct: false },
    ]

    expect(calculateTeamScore(questions)).toBe(0)
  })

  it('should handle empty questions array', () => {
    expect(calculateTeamScore([])).toBe(0)
  })
})

describe('formatGameTime', () => {
  it('should format seconds into MM:SS format', () => {
    expect(formatGameTime(65)).toBe('01:05')
    expect(formatGameTime(0)).toBe('00:00')
    expect(formatGameTime(3599)).toBe('59:59')
  })
})
```

### Component Test Example: React Component

```typescript
// components/student/BuzzButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuzzButton } from './BuzzButton'

describe('BuzzButton', () => {
  const mockOnBuzz = vi.fn()

  beforeEach(() => {
    mockOnBuzz.mockClear()
  })

  it('should render buzz button with correct text', () => {
    render(<BuzzButton onBuzz={mockOnBuzz} disabled={false} />)

    expect(screen.getByRole('button', { name: /buzz in/i })).toBeInTheDocument()
  })

  it('should call onBuzz when clicked', async () => {
    const user = userEvent.setup()
    render(<BuzzButton onBuzz={mockOnBuzz} disabled={false} />)

    const button = screen.getByRole('button', { name: /buzz in/i })
    await user.click(button)

    expect(mockOnBuzz).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<BuzzButton onBuzz={mockOnBuzz} disabled={true} />)

    const button = screen.getByRole('button', { name: /buzz in/i })
    expect(button).toBeDisabled()
  })

  it('should show visual feedback when active', () => {
    render(<BuzzButton onBuzz={mockOnBuzz} disabled={false} isActive={true} />)

    const button = screen.getByRole('button', { name: /buzz in/i })
    expect(button).toHaveClass('active') // or whatever your active class is
  })
})
```

### Hook Test Example: Custom Hook

```typescript
// hooks/useAuth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from './useAuth'

vi.mock('@/lib/supabase/client')

describe('useAuth', () => {
  it('should return null user when not authenticated', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('should set user when authenticated', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' }

    // Mock Supabase auth
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.loading).toBe(false)
    })
  })

  it('should handle sign out', async () => {
    const { result } = renderHook(() => useAuth())

    await result.current.signOut()

    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })
})
```

### Zustand Store Test Example

```typescript
// lib/stores/gameStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from './gameStore'
import { act } from '@testing-library/react'

describe('gameStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useGameStore.setState({
      currentGame: null,
      teams: [],
      currentQuestion: null,
    })
  })

  it('should initialize with default state', () => {
    const state = useGameStore.getState()

    expect(state.currentGame).toBeNull()
    expect(state.teams).toEqual([])
    expect(state.currentQuestion).toBeNull()
  })

  it('should set current game', () => {
    const mockGame = { id: 'game-1', title: 'Test Game' }

    act(() => {
      useGameStore.getState().setCurrentGame(mockGame)
    })

    expect(useGameStore.getState().currentGame).toEqual(mockGame)
  })

  it('should update team score', () => {
    const mockTeam = { id: 'team-1', name: 'Team A', score: 0 }

    act(() => {
      useGameStore.setState({ teams: [mockTeam] })
      useGameStore.getState().updateTeamScore('team-1', 100)
    })

    const updatedTeam = useGameStore.getState().teams[0]
    expect(updatedTeam.score).toBe(100)
  })
})
```

### Integration Test Example: Game Flow

```typescript
// __tests__/integration/game-flow.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameBoard } from '@/components/game/GameBoard'

describe('Game Flow Integration', () => {
  it('should complete full question-answer-score flow', async () => {
    const user = userEvent.setup()

    render(<GameBoard gameId="test-game-1" />)

    // Wait for game to load
    await waitFor(() => {
      expect(screen.getByText(/select a question/i)).toBeInTheDocument()
    })

    // Select a question
    const question = screen.getByText('Question 1 - 100 points')
    await user.click(question)

    // Question modal should open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/what is/i)).toBeInTheDocument()

    // Student buzzes in
    const buzzButton = screen.getByRole('button', { name: /buzz in/i })
    await user.click(buzzButton)

    // Mark answer as correct
    const correctButton = screen.getByRole('button', { name: /correct/i })
    await user.click(correctButton)

    // Score should update
    await waitFor(() => {
      expect(screen.getByText(/100 points/i)).toBeInTheDocument()
    })
  })
})
```

### E2E Test Example: User Authentication

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should allow user to login with valid credentials', async ({ page }) => {
    await page.goto('/')

    // Click login button
    await page.click('text=Login')

    // Fill in credentials
    await page.fill('input[name="email"]', 'teacher@example.com')
    await page.fill('input[name="password"]', 'password123')

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Welcome')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Login')

    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })

  test('should persist login after page refresh', async ({ page }) => {
    // Login
    await page.goto('/')
    await page.click('text=Login')
    await page.fill('input[name="email"]', 'teacher@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/dashboard')

    // Refresh page
    await page.reload()

    // Should still be logged in
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Welcome')).toBeVisible()
  })
})
```

### E2E Test Example: Complete Game Session

```typescript
// e2e/game-session.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Complete Game Session', () => {
  test('teacher creates game and student joins', async ({ browser }) => {
    // Create two contexts - one for teacher, one for student
    const teacherContext = await browser.newContext()
    const studentContext = await browser.newContext()

    const teacherPage = await teacherContext.newPage()
    const studentPage = await studentContext.newPage()

    // Teacher logs in and creates game
    await teacherPage.goto('/dashboard')
    await teacherPage.click('text=New Game')
    await teacherPage.fill('input[name="title"]', 'E2E Test Game')
    await teacherPage.click('button[type="submit"]')

    // Get join code
    const joinCode = await teacherPage.locator('[data-testid="join-code"]').textContent()

    // Student joins game
    await studentPage.goto('/game/join')
    await studentPage.fill('input[name="code"]', joinCode!)
    await studentPage.fill('input[name="teamName"]', 'Test Team')
    await studentPage.click('button[type="submit"]')

    // Verify student joined
    await expect(teacherPage.locator('text=Test Team')).toBeVisible()

    // Teacher starts game
    await teacherPage.click('button[text="Start Game"]')

    // Student should see active game
    await expect(studentPage.locator('text=Game Active')).toBeVisible()

    await teacherContext.close()
    await studentContext.close()
  })
})
```

## Pre-commit Hooks & CI/CD

### Husky & lint-staged Setup

Install dependencies:
```bash
npm install -D husky lint-staged
```

Initialize Husky:
```bash
npx husky init
```

Create `.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

Add to `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "vitest related --run"
    ]
  }
}
```

### GitHub Actions CI/CD

Create `.github/workflows/test.yml`:
```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unittests

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Coverage Reporting

### Local Coverage Reports

Generate coverage report:
```bash
npm run test:coverage
```

View HTML report:
```bash
open coverage/index.html
```

### Coverage Metrics

Track these metrics:
- **Statements**: % of executable statements tested
- **Branches**: % of if/else branches tested
- **Functions**: % of functions called in tests
- **Lines**: % of code lines executed

### Coverage Tools Integration

#### VS Code Extension
Install "Coverage Gutters" extension to see coverage in editor

#### Codecov (for CI/CD)
1. Sign up at codecov.io
2. Add repository
3. Add `CODECOV_TOKEN` to GitHub secrets
4. Coverage reports auto-upload from CI

## Phased Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Set up testing infrastructure and establish testing culture

**Tasks**:
- [ ] Install and configure Vitest + React Testing Library
- [ ] Set up coverage reporting
- [ ] Create test utilities and mock factories
- [ ] Write documentation and examples
- [ ] Set up pre-commit hooks
- [ ] Configure VS Code for testing workflow

**Deliverables**:
- Working test environment
- 5-10 example tests demonstrating patterns
- Team training session on testing practices

**Success Criteria**:
- All developers can run tests locally
- Test coverage visible in reports

---

### Phase 2: Critical Path Testing (Weeks 3-5)
**Goal**: Achieve 85%+ coverage for critical business logic

**Priority Order**:

#### Week 3: Authentication & Authorization
- [ ] `lib/supabase/client.ts` - Supabase client initialization
- [ ] `lib/supabase/server.ts` - Server-side auth helpers
- [ ] `hooks/useAuth.ts` - Authentication hook
- [ ] `middleware.ts` - Route protection
- [ ] Integration tests for login/logout flows

**Target**: 95% coverage for auth code

#### Week 4: Game State & Scoring
- [ ] `lib/stores/gameStore.ts` - Zustand store (all actions)
- [ ] `hooks/useBuzzer.ts` - Buzzer logic
- [ ] `lib/utils/helpers.ts` - Score calculations
- [ ] Integration tests for game state transitions

**Target**: 90% coverage for game logic

#### Week 5: Payment Integration
- [ ] `lib/stripe/client.ts` - Client-side Stripe
- [ ] `lib/stripe/server.ts` - Server-side Stripe
- [ ] Webhook handlers (if any)
- [ ] Mock Stripe API responses

**Target**: 85% coverage for payment code

**Phase 2 Success Criteria**:
- Critical paths have 85%+ coverage
- All edge cases documented and tested
- No production bugs in tested areas

---

### Phase 3: Component Testing (Weeks 6-8)
**Goal**: Achieve 75% coverage for UI components

**Priority Order**:

#### Week 6: Core Game Components
- [ ] `components/game/GameBoard.tsx`
- [ ] `components/game/QuestionCard.tsx`
- [ ] `components/game/QuestionModal.tsx`
- [ ] `components/game/TeamScoreboard.tsx`
- [ ] `components/game/Timer.tsx`

#### Week 7: Student/Teacher Components
- [ ] `components/student/BuzzButton.tsx`
- [ ] `components/student/TeamScore.tsx`
- [ ] `components/teacher/JoinQRCode.tsx`
- [ ] `components/auth/LoginForm.tsx`

#### Week 8: Integration Tests
- [ ] Game creation flow
- [ ] Team joining flow
- [ ] Question answering flow
- [ ] Scoring updates

**Phase 3 Success Criteria**:
- All major components tested
- Component interactions validated
- 75% UI coverage achieved

---

### Phase 4: E2E Testing (Weeks 9-10)
**Goal**: Establish end-to-end test suite for critical user journeys

**Test Scenarios**:

#### Week 9: Core User Flows
- [ ] Teacher signup → create game → start game
- [ ] Student join game → buzz in → answer question
- [ ] Complete game session (start to finish)
- [ ] Score calculation and display accuracy

#### Week 10: Advanced Flows
- [ ] Multi-team competition
- [ ] Payment and subscription flows
- [ ] Mobile responsive testing
- [ ] Cross-browser compatibility

**Phase 4 Success Criteria**:
- 10+ E2E tests covering main user journeys
- Tests run in CI/CD pipeline
- Cross-browser testing operational

---

### Phase 5: Optimization & Maintenance (Weeks 11-12)
**Goal**: Achieve 80% overall coverage and establish ongoing testing practices

**Tasks**:
- [ ] Fill coverage gaps
- [ ] Optimize slow tests
- [ ] Add visual regression testing (optional)
- [ ] Performance testing (optional)
- [ ] Document test maintenance guidelines
- [ ] Set up coverage trends tracking

**Phase 5 Success Criteria**:
- 80% overall test coverage achieved
- CI/CD pipeline optimized (tests run in < 5 mins)
- Team comfortable writing tests
- Test maintenance process established

---

## Test Maintenance Guidelines

### When to Write Tests
1. **Before fixing a bug**: Write a failing test that reproduces the bug
2. **When adding features**: Write tests as you develop (TDD when possible)
3. **When refactoring**: Ensure existing tests pass, add tests if coverage drops

### Test Review Checklist
- [ ] Tests are deterministic (no flaky tests)
- [ ] Tests are isolated (don't depend on other tests)
- [ ] Tests are fast (unit tests < 100ms, integration < 1s)
- [ ] Tests follow naming conventions
- [ ] Edge cases are covered
- [ ] Mocks are appropriate and not over-used
- [ ] Tests document expected behavior

### Handling Flaky Tests
1. Identify the flaky test
2. Add `.only` to isolate and debug
3. Common causes:
   - Timing issues (add proper waits)
   - Shared state (ensure proper cleanup)
   - Network requests (ensure mocks)
4. Temporarily skip with `.skip` if blocking team
5. File an issue and assign owner

### Coverage Monitoring
- Review coverage reports weekly
- Investigate sudden drops in coverage
- Require tests for all new PRs
- Block PRs that drop coverage below threshold

## Resources & References

### Documentation
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

### Tools
- [Vitest UI](https://vitest.dev/guide/ui.html) - Visual test interface
- [Playwright Inspector](https://playwright.dev/docs/debug) - Debug E2E tests
- [Coverage Gutters](https://marketplace.visualstudio.com/items?itemName=ryanluker.vscode-coverage-gutters) - VS Code extension

### Community
- [Testing Library Discord](https://discord.gg/testing-library)
- [Vitest GitHub Discussions](https://github.com/vitest-dev/vitest/discussions)

## Appendix

### Common Testing Patterns

#### Testing Async Operations
```typescript
it('should fetch game data', async () => {
  const { result } = renderHook(() => useGame('game-1'))

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.game).toBeDefined()
})
```

#### Testing Error Boundaries
```typescript
it('should display error UI when component throws', () => {
  const ThrowError = () => {
    throw new Error('Test error')
  }

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  )

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
})
```

#### Testing Timers
```typescript
it('should countdown timer', () => {
  vi.useFakeTimers()

  render(<Timer duration={60} />)

  expect(screen.getByText('1:00')).toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(screen.getByText('0:59')).toBeInTheDocument()

  vi.useRealTimers()
})
```

### Troubleshooting Common Issues

| Issue | Solution |
|-------|----------|
| Tests timing out | Increase timeout, check for missing awaits, verify mocks |
| Module resolution errors | Check `vitest.config.ts` aliases match `tsconfig.json` |
| React hooks errors | Use `renderHook` from `@testing-library/react` |
| Supabase auth errors | Ensure proper mocking in `vitest.setup.ts` |
| Playwright browser not found | Run `npx playwright install` |

---

## Approval & Sign-off

This document should be reviewed and approved by:
- [ ] Development Team Lead
- [ ] Product Owner
- [ ] QA Lead (if applicable)

**Last Updated**: 2025-11-06
**Version**: 1.0
**Next Review Date**: TBD (after Phase 1 completion)
