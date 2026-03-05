/**
 * Prebuilt bank data shape used across onboarding UI and API responses.
 */
export interface PrebuiltBank {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  difficulty: string | null;
  question_count: number;
}
