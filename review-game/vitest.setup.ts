import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend vitest's expect with jest-dom custom matchers
// (e.g. toBeInTheDocument, toHaveClass, toBeDisabled …)
expect.extend(matchers);
