/**
 * Unit tests for feature-access.ts
 *
 * These tests verify the subscription-based feature gating logic.
 * Requires a test framework like Jest or Vitest to be installed.
 *
 * To set up testing:
 * npm install --save-dev jest @types/jest ts-jest
 * or
 * npm install --save-dev vitest @vitest/ui
 */

import {
  canCreateGame,
  getMaxTeams,
  canAccessCustomQuestionBanks,
  canAccessVideoImages,
  canAccessCustomTeamNames,
  canAccessAI,
  canAccessCommunityBanks,
  canAccessGoogleClassroom,
  canAccessAnalytics,
  getFeatureList,
} from './feature-access';
import type { Tables } from '@/types/database.types';

type Profile = Tables<'profiles'>;

// Helper function to create test profiles
function createProfile(
  tier: string | null,
  status: string | null,
  gamesCreated = 0
): Profile {
  return {
    id: 'test-id',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user',
    is_active: true,
    subscription_tier: tier,
    subscription_status: status,
    games_created_count: gamesCreated,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    billing_cycle: null,
    current_period_end: null,
    trial_end_date: null,
    admin_notes: null,
    suspension_reason: null,
    email_verified_manually: null,
    custom_plan_type: null,
    custom_plan_name: null,
    custom_plan_expires_at: null,
    custom_plan_notes: null,
    plan_override_limits: null,
  } as Profile;
}

describe('canCreateGame', () => {
  describe('FREE tier', () => {
    it('should allow creation when games_created_count < 3', () => {
      const profile = createProfile('FREE', 'ACTIVE', 0);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should allow creation when games_created_count = 2', () => {
      const profile = createProfile('FREE', 'ACTIVE', 2);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should deny creation when games_created_count >= 3', () => {
      const profile = createProfile('FREE', 'ACTIVE', 3);
      expect(canCreateGame(profile)).toBe(false);
    });

    it('should deny creation when games_created_count > 3', () => {
      const profile = createProfile('FREE', 'ACTIVE', 5);
      expect(canCreateGame(profile)).toBe(false);
    });

    it('should handle null games_created_count as 0', () => {
      const profile = createProfile('FREE', 'ACTIVE');
      profile.games_created_count = null;
      expect(canCreateGame(profile)).toBe(true);
    });
  });

  describe('BASIC tier', () => {
    it('should allow creation when status is ACTIVE', () => {
      const profile = createProfile('BASIC', 'ACTIVE', 100);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should allow creation when status is TRIAL', () => {
      const profile = createProfile('BASIC', 'TRIAL', 100);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should deny creation when status is INACTIVE', () => {
      const profile = createProfile('BASIC', 'INACTIVE', 0);
      expect(canCreateGame(profile)).toBe(false);
    });

    it('should deny creation when status is CANCELLED', () => {
      const profile = createProfile('BASIC', 'CANCELLED', 0);
      expect(canCreateGame(profile)).toBe(false);
    });
  });

  describe('PREMIUM tier', () => {
    it('should allow creation when status is ACTIVE', () => {
      const profile = createProfile('PREMIUM', 'ACTIVE', 100);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should allow creation when status is TRIAL', () => {
      const profile = createProfile('PREMIUM', 'TRIAL', 100);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should deny creation when status is INACTIVE', () => {
      const profile = createProfile('PREMIUM', 'INACTIVE', 0);
      expect(canCreateGame(profile)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should return false for null profile', () => {
      expect(canCreateGame(null)).toBe(false);
    });

    it('should return false for undefined profile', () => {
      expect(canCreateGame(undefined)).toBe(false);
    });

    it('should handle lowercase tier names', () => {
      const profile = createProfile('free', 'active', 0);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should handle mixed case tier names', () => {
      const profile = createProfile('BaSiC', 'AcTiVe', 0);
      expect(canCreateGame(profile)).toBe(true);
    });

    it('should handle invalid tier gracefully (defaults to FREE)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing invalid tier value
      const profile = createProfile('ENTERPRISE' as any, 'ACTIVE', 0);
      expect(canCreateGame(profile)).toBe(true); // Defaults to FREE tier with 0 games
    });

    it('should deny invalid tier with 3+ games', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing invalid tier value
      const profile = createProfile('INVALID_TIER' as any, 'ACTIVE', 3);
      expect(canCreateGame(profile)).toBe(false); // Defaults to FREE tier with 3 games
    });

    it('should handle invalid status gracefully (defaults to INACTIVE)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing invalid status value
      const profile = createProfile('PREMIUM', 'SUSPENDED' as any, 0);
      expect(canCreateGame(profile)).toBe(false); // Defaults to INACTIVE, which fails hasActiveSubscription
    });

    it('should deny BASIC tier with CANCELLED status', () => {
      const profile = createProfile('BASIC', 'CANCELLED', 0);
      expect(canCreateGame(profile)).toBe(false);
    });

    it('should deny PREMIUM tier with CANCELLED status', () => {
      const profile = createProfile('PREMIUM', 'CANCELLED', 100);
      expect(canCreateGame(profile)).toBe(false);
    });
  });
});

describe('getMaxTeams', () => {
  it('should return 5 for FREE tier', () => {
    const profile = createProfile('FREE', 'ACTIVE');
    expect(getMaxTeams(profile)).toBe(5);
  });

  it('should return 10 for BASIC tier', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(getMaxTeams(profile)).toBe(10);
  });

  it('should return 15 for PREMIUM tier', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    expect(getMaxTeams(profile)).toBe(15);
  });

  it('should return 5 for null profile', () => {
    expect(getMaxTeams(null)).toBe(5);
  });

  it('should return 5 for undefined profile', () => {
    expect(getMaxTeams(undefined)).toBe(5);
  });

  it('should return 5 for null tier', () => {
    const profile = createProfile(null, 'ACTIVE');
    expect(getMaxTeams(profile)).toBe(5);
  });

  it('should handle lowercase tier names', () => {
    const profile = createProfile('premium', 'active');
    expect(getMaxTeams(profile)).toBe(15);
  });

  it('should return 5 for BASIC tier with INACTIVE status', () => {
    const profile = createProfile('BASIC', 'INACTIVE');
    expect(getMaxTeams(profile)).toBe(5);
  });

  it('should return 5 for PREMIUM tier with CANCELLED status', () => {
    const profile = createProfile('PREMIUM', 'CANCELLED');
    expect(getMaxTeams(profile)).toBe(5);
  });

  it('should return 10 for BASIC tier with TRIAL status', () => {
    const profile = createProfile('BASIC', 'TRIAL');
    expect(getMaxTeams(profile)).toBe(10);
  });

  it('should handle invalid tier gracefully (defaults to FREE)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing invalid tier value
    const profile = createProfile('ENTERPRISE' as any, 'ACTIVE');
    expect(getMaxTeams(profile)).toBe(5);
  });

  it('should handle invalid status gracefully (defaults to INACTIVE)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing invalid status value
    const profile = createProfile('PREMIUM', 'SUSPENDED' as any);
    expect(getMaxTeams(profile)).toBe(5); // INACTIVE status, so downgrade to FREE limits
  });
});

describe('canAccessCustomQuestionBanks', () => {
  it('should allow BASIC + ACTIVE', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(canAccessCustomQuestionBanks(profile)).toBe(true);
  });

  it('should allow BASIC + TRIAL', () => {
    const profile = createProfile('BASIC', 'TRIAL');
    expect(canAccessCustomQuestionBanks(profile)).toBe(true);
  });

  it('should allow PREMIUM + ACTIVE', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    expect(canAccessCustomQuestionBanks(profile)).toBe(true);
  });

  it('should allow PREMIUM + TRIAL', () => {
    const profile = createProfile('PREMIUM', 'TRIAL');
    expect(canAccessCustomQuestionBanks(profile)).toBe(true);
  });

  it('should deny FREE tier', () => {
    const profile = createProfile('FREE', 'ACTIVE');
    expect(canAccessCustomQuestionBanks(profile)).toBe(false);
  });

  it('should deny BASIC + INACTIVE', () => {
    const profile = createProfile('BASIC', 'INACTIVE');
    expect(canAccessCustomQuestionBanks(profile)).toBe(false);
  });

  it('should deny null profile', () => {
    expect(canAccessCustomQuestionBanks(null)).toBe(false);
  });
});

describe('canAccessVideoImages', () => {
  it('should allow BASIC + ACTIVE', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(canAccessVideoImages(profile)).toBe(true);
  });

  it('should allow PREMIUM + ACTIVE', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    expect(canAccessVideoImages(profile)).toBe(true);
  });

  it('should deny FREE tier', () => {
    const profile = createProfile('FREE', 'ACTIVE');
    expect(canAccessVideoImages(profile)).toBe(false);
  });

  it('should deny BASIC + INACTIVE', () => {
    const profile = createProfile('BASIC', 'INACTIVE');
    expect(canAccessVideoImages(profile)).toBe(false);
  });
});

describe('canAccessCustomTeamNames', () => {
  it('should allow BASIC + ACTIVE', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(canAccessCustomTeamNames(profile)).toBe(true);
  });

  it('should allow PREMIUM + TRIAL', () => {
    const profile = createProfile('PREMIUM', 'TRIAL');
    expect(canAccessCustomTeamNames(profile)).toBe(true);
  });

  it('should deny FREE tier', () => {
    const profile = createProfile('FREE', 'ACTIVE');
    expect(canAccessCustomTeamNames(profile)).toBe(false);
  });

  it('should deny BASIC + CANCELLED', () => {
    const profile = createProfile('BASIC', 'CANCELLED');
    expect(canAccessCustomTeamNames(profile)).toBe(false);
  });
});

describe('canAccessAI', () => {
  it('should allow PREMIUM + ACTIVE', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    expect(canAccessAI(profile)).toBe(true);
  });

  it('should allow PREMIUM + TRIAL', () => {
    const profile = createProfile('PREMIUM', 'TRIAL');
    expect(canAccessAI(profile)).toBe(true);
  });

  it('should deny BASIC tier', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(canAccessAI(profile)).toBe(false);
  });

  it('should deny FREE tier', () => {
    const profile = createProfile('FREE', 'ACTIVE');
    expect(canAccessAI(profile)).toBe(false);
  });

  it('should deny PREMIUM + INACTIVE', () => {
    const profile = createProfile('PREMIUM', 'INACTIVE');
    expect(canAccessAI(profile)).toBe(false);
  });

  it('should deny null profile', () => {
    expect(canAccessAI(null)).toBe(false);
  });
});

describe('canAccessCommunityBanks', () => {
  it('should allow PREMIUM + ACTIVE', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    expect(canAccessCommunityBanks(profile)).toBe(true);
  });

  it('should deny BASIC tier', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(canAccessCommunityBanks(profile)).toBe(false);
  });

  it('should deny PREMIUM + INACTIVE', () => {
    const profile = createProfile('PREMIUM', 'INACTIVE');
    expect(canAccessCommunityBanks(profile)).toBe(false);
  });
});

describe('canAccessGoogleClassroom', () => {
  it('should allow PREMIUM + ACTIVE', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    expect(canAccessGoogleClassroom(profile)).toBe(true);
  });

  it('should allow PREMIUM + TRIAL', () => {
    const profile = createProfile('PREMIUM', 'TRIAL');
    expect(canAccessGoogleClassroom(profile)).toBe(true);
  });

  it('should deny BASIC tier', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(canAccessGoogleClassroom(profile)).toBe(false);
  });

  it('should deny PREMIUM + CANCELLED', () => {
    const profile = createProfile('PREMIUM', 'CANCELLED');
    expect(canAccessGoogleClassroom(profile)).toBe(false);
  });
});

describe('canAccessAnalytics', () => {
  it('should allow PREMIUM + ACTIVE', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    expect(canAccessAnalytics(profile)).toBe(true);
  });

  it('should deny BASIC tier', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    expect(canAccessAnalytics(profile)).toBe(false);
  });

  it('should deny FREE tier', () => {
    const profile = createProfile('FREE', 'ACTIVE');
    expect(canAccessAnalytics(profile)).toBe(false);
  });

  it('should deny PREMIUM + INACTIVE', () => {
    const profile = createProfile('PREMIUM', 'INACTIVE');
    expect(canAccessAnalytics(profile)).toBe(false);
  });
});

describe('getFeatureList', () => {
  it('should return 8 features', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    const features = getFeatureList(profile);
    expect(features).toHaveLength(8);
  });

  it('should enable all features for PREMIUM + ACTIVE with no games created', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE', 0);
    const features = getFeatureList(profile);

    expect(features.every((f) => f.enabled)).toBe(true);
  });

  it('should disable game creation for FREE tier with 3+ games', () => {
    const profile = createProfile('FREE', 'ACTIVE', 3);
    const features = getFeatureList(profile);

    const createGameFeature = features.find((f) => f.id === 'create_game');
    expect(createGameFeature?.enabled).toBe(false);
  });

  it('should disable premium features for BASIC tier', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    const features = getFeatureList(profile);

    const aiFeature = features.find((f) => f.id === 'ai');
    const communityFeature = features.find((f) => f.id === 'community_banks');
    const classroomFeature = features.find((f) => f.id === 'google_classroom');
    const analyticsFeature = features.find((f) => f.id === 'analytics');

    expect(aiFeature?.enabled).toBe(false);
    expect(communityFeature?.enabled).toBe(false);
    expect(classroomFeature?.enabled).toBe(false);
    expect(analyticsFeature?.enabled).toBe(false);
  });

  it('should enable basic features for BASIC tier', () => {
    const profile = createProfile('BASIC', 'ACTIVE');
    const features = getFeatureList(profile);

    const customBanksFeature = features.find((f) => f.id === 'custom_question_banks');
    const videoFeature = features.find((f) => f.id === 'video_images');
    const teamNamesFeature = features.find((f) => f.id === 'custom_team_names');

    expect(customBanksFeature?.enabled).toBe(true);
    expect(videoFeature?.enabled).toBe(true);
    expect(teamNamesFeature?.enabled).toBe(true);
  });

  it('should handle null profile gracefully', () => {
    const features = getFeatureList(null);
    expect(features).toHaveLength(8);
    expect(features.every((f) => !f.enabled || f.id === 'create_game')).toBe(false);
  });

  it('should have correct required tiers', () => {
    const profile = createProfile('FREE', 'ACTIVE');
    const features = getFeatureList(profile);

    expect(features.find((f) => f.id === 'create_game')?.requiredTier).toBe('FREE');
    expect(features.find((f) => f.id === 'custom_question_banks')?.requiredTier).toBe('BASIC');
    expect(features.find((f) => f.id === 'ai')?.requiredTier).toBe('PREMIUM');
  });

  it('should include feature names and descriptions', () => {
    const profile = createProfile('PREMIUM', 'ACTIVE');
    const features = getFeatureList(profile);

    features.forEach((feature) => {
      expect(feature.name).toBeTruthy();
      expect(feature.description).toBeTruthy();
      expect(feature.id).toBeTruthy();
    });
  });
});
