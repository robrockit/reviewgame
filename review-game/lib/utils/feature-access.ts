/**
 * Feature Access Control Utilities
 *
 * This module provides utilities to gate features by subscription tier and status.
 * Used throughout the application to enforce subscription-based access control.
 *
 * @module feature-access
 */

import type { Tables } from '@/types/database.types';
import { logger } from '@/lib/logger';

// Type alias for profile rows from the database
type Profile = Tables<'profiles'>;

/**
 * Subscription tier types
 */
export type SubscriptionTier = 'FREE' | 'BASIC' | 'PREMIUM';

/**
 * Subscription status types
 */
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED';

/**
 * Feature access control result
 */
export interface FeatureAccess {
  canAccess: boolean;
  reason?: string;
}

/**
 * Helper function to safely get subscription tier from profile.
 * Validates the tier value and returns FREE as a safe fallback for invalid values.
 */
function getTier(profile: Profile | null | undefined): SubscriptionTier {
  if (!profile?.subscription_tier) return 'FREE';

  const tier = profile.subscription_tier.toUpperCase();

  // Validate tier is one of the expected values
  if (tier === 'FREE' || tier === 'BASIC' || tier === 'PREMIUM') {
    return tier as SubscriptionTier;
  }

  // Log unexpected value for debugging
  logger.error('Invalid subscription tier', new Error('Invalid tier'), {
    operation: 'getTier',
    tier: profile.subscription_tier,
    profileId: profile.id,
  });

  return 'FREE'; // Safe fallback
}

/**
 * Helper function to safely get subscription status from profile.
 * Validates the status value and returns INACTIVE as a safe fallback for invalid values.
 */
function getStatus(profile: Profile | null | undefined): SubscriptionStatus {
  if (!profile?.subscription_status) return 'INACTIVE';

  const status = profile.subscription_status.toUpperCase();

  // Validate status is one of the expected values
  if (status === 'TRIAL' || status === 'ACTIVE' || status === 'INACTIVE' || status === 'CANCELLED') {
    return status as SubscriptionStatus;
  }

  // Log unexpected value for debugging
  logger.error('Invalid subscription status', new Error('Invalid status'), {
    operation: 'getStatus',
    status: profile.subscription_status,
    profileId: profile.id,
  });

  return 'INACTIVE'; // Safe fallback
}

/**
 * Helper function to check if subscription is active (TRIAL or ACTIVE)
 */
function hasActiveSubscription(profile: Profile | null | undefined): boolean {
  const status = getStatus(profile);
  return status === 'TRIAL' || status === 'ACTIVE';
}

/**
 * Checks if a user can create a new game based on their subscription tier.
 * All users require an active subscription (TRIAL or ACTIVE status).
 *
 * @param profile - User profile from the database
 * @returns true if the user can create a game, false otherwise
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (!canCreateGame(profile)) {
 *   throw new Error('Free tier limited to 3 games. Upgrade to create more.');
 * }
 * ```
 */
export function canCreateGame(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  const gamesCreated = profile.games_created_count ?? 0;

  // All users need active subscription to create games
  if (!hasActiveSubscription(profile)) {
    return false;
  }

  // FREE tier: limited to 3 games
  if (tier === 'FREE') {
    return gamesCreated < 3;
  }

  // BASIC/PREMIUM: unlimited games
  return true;
}

/**
 * Gets the maximum number of teams allowed per game based on subscription tier.
 * BASIC and PREMIUM tiers require an active subscription to receive increased limits.
 *
 * @param profile - User profile from the database
 * @returns Maximum number of teams allowed
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * const maxTeams = getMaxTeams(profile);
 * console.log(`You can create up to ${maxTeams} teams`);
 * ```
 */
export function getMaxTeams(profile: Profile | null | undefined): number {
  if (!profile) return 5; // Default to FREE tier limit

  const tier = getTier(profile);

  // BASIC and PREMIUM require active subscription for increased limits
  if ((tier === 'BASIC' || tier === 'PREMIUM') && !hasActiveSubscription(profile)) {
    return 5; // Downgrade to FREE tier limits when subscription is inactive
  }

  switch (tier) {
    case 'FREE':
      return 5;
    case 'BASIC':
      return 10;
    case 'PREMIUM':
      return 15;
    default:
      return 5;
  }
}

/**
 * Checks if a user can access custom question banks.
 * Requires BASIC or PREMIUM tier with TRIAL or ACTIVE status.
 *
 * @param profile - User profile from the database
 * @returns true if the user can access custom question banks
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (canAccessCustomQuestionBanks(profile)) {
 *   // Show custom question bank creation UI
 * }
 * ```
 */
export function canAccessCustomQuestionBanks(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  const isBasicOrPremium = tier === 'BASIC' || tier === 'PREMIUM';

  return isBasicOrPremium && hasActiveSubscription(profile);
}

/**
 * Checks if a user can access video/image features in questions.
 * Requires BASIC or PREMIUM tier with TRIAL or ACTIVE status.
 *
 * @param profile - User profile from the database
 * @returns true if the user can access video/image features
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (canAccessVideoImages(profile)) {
 *   // Show video/image upload UI
 * }
 * ```
 */
export function canAccessVideoImages(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  const isBasicOrPremium = tier === 'BASIC' || tier === 'PREMIUM';

  return isBasicOrPremium && hasActiveSubscription(profile);
}

/**
 * Checks if a user can access custom team names.
 * Requires BASIC or PREMIUM tier with TRIAL or ACTIVE status.
 *
 * @param profile - User profile from the database
 * @returns true if the user can use custom team names
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (canAccessCustomTeamNames(profile)) {
 *   // Show custom team name input
 * } else {
 *   // Use default team names (Team 1, Team 2, etc.)
 * }
 * ```
 */
export function canAccessCustomTeamNames(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  const isBasicOrPremium = tier === 'BASIC' || tier === 'PREMIUM';

  return isBasicOrPremium && hasActiveSubscription(profile);
}

/**
 * Checks if a user can access AI features.
 * Requires PREMIUM tier with TRIAL or ACTIVE status.
 *
 * @param profile - User profile from the database
 * @returns true if the user can access AI features
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (canAccessAI(profile)) {
 *   // Show AI question generation UI
 * }
 * ```
 */
export function canAccessAI(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  return tier === 'PREMIUM' && hasActiveSubscription(profile);
}

/**
 * Checks if a user can access community question banks.
 * Requires PREMIUM tier with TRIAL or ACTIVE status.
 *
 * @param profile - User profile from the database
 * @returns true if the user can access community banks
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (canAccessCommunityBanks(profile)) {
 *   // Show community question banks
 * }
 * ```
 */
export function canAccessCommunityBanks(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  return tier === 'PREMIUM' && hasActiveSubscription(profile);
}

/**
 * Checks if a user can access Google Classroom integration.
 * Requires PREMIUM tier with TRIAL or ACTIVE status.
 *
 * @param profile - User profile from the database
 * @returns true if the user can access Google Classroom integration
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (canAccessGoogleClassroom(profile)) {
 *   // Show Google Classroom sync options
 * }
 * ```
 */
export function canAccessGoogleClassroom(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  return tier === 'PREMIUM' && hasActiveSubscription(profile);
}

/**
 * Checks if a user can access analytics features.
 * Requires PREMIUM tier with TRIAL or ACTIVE status.
 *
 * @param profile - User profile from the database
 * @returns true if the user can access analytics
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * if (canAccessAnalytics(profile)) {
 *   // Show analytics dashboard
 * }
 * ```
 */
export function canAccessAnalytics(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const tier = getTier(profile);
  return tier === 'PREMIUM' && hasActiveSubscription(profile);
}

/**
 * Feature identifier types
 */
export type Feature =
  | 'create_game'
  | 'custom_question_banks'
  | 'video_images'
  | 'custom_team_names'
  | 'ai'
  | 'community_banks'
  | 'google_classroom'
  | 'analytics';

/**
 * Feature display information
 */
export interface FeatureInfo {
  id: Feature;
  name: string;
  description: string;
  enabled: boolean;
  requiredTier: SubscriptionTier;
}

/**
 * Gets a list of all features and their access status for the user.
 * Useful for displaying feature lists in upgrade prompts or settings.
 *
 * @param profile - User profile from the database
 * @returns Array of features with their access status
 *
 * @example
 * ```typescript
 * const profile = await getProfile();
 * const features = getFeatureList(profile);
 * features.forEach(feature => {
 *   console.log(`${feature.name}: ${feature.enabled ? 'Enabled' : 'Disabled'}`);
 * });
 * ```
 */
export function getFeatureList(profile: Profile | null | undefined): FeatureInfo[] {
  return [
    {
      id: 'create_game',
      name: 'Create Games',
      description: 'Create unlimited review games',
      enabled: canCreateGame(profile),
      requiredTier: 'FREE',
    },
    {
      id: 'custom_question_banks',
      name: 'Custom Question Banks',
      description: 'Create and manage your own question banks',
      enabled: canAccessCustomQuestionBanks(profile),
      requiredTier: 'BASIC',
    },
    {
      id: 'video_images',
      name: 'Video & Images',
      description: 'Add videos and images to questions',
      enabled: canAccessVideoImages(profile),
      requiredTier: 'BASIC',
    },
    {
      id: 'custom_team_names',
      name: 'Custom Team Names',
      description: 'Customize team names for your games',
      enabled: canAccessCustomTeamNames(profile),
      requiredTier: 'BASIC',
    },
    {
      id: 'ai',
      name: 'AI Question Generation',
      description: 'Generate questions using AI',
      enabled: canAccessAI(profile),
      requiredTier: 'PREMIUM',
    },
    {
      id: 'community_banks',
      name: 'Community Question Banks',
      description: 'Access community-created question banks',
      enabled: canAccessCommunityBanks(profile),
      requiredTier: 'PREMIUM',
    },
    {
      id: 'google_classroom',
      name: 'Google Classroom',
      description: 'Integrate with Google Classroom',
      enabled: canAccessGoogleClassroom(profile),
      requiredTier: 'PREMIUM',
    },
    {
      id: 'analytics',
      name: 'Advanced Analytics',
      description: 'Access detailed game analytics and insights',
      enabled: canAccessAnalytics(profile),
      requiredTier: 'PREMIUM',
    },
  ];
}
