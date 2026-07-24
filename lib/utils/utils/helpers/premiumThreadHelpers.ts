import { User, PremiumThreadCreationRules, Thread, PremiumThreadPurchase } from '../types';

/**
 * Get premium thread creation rules based on user status
 */
export function getPremiumThreadRules(user: User): PremiumThreadCreationRules {
  if (user.isPremium) {
    return {
      canCreate: true,
      priceRange: {
        min: 1.00,
        max: Infinity, // Premium users set their own price — no upper cap
      },
      revenueShare: {
        creator: 0.70,  // 70% to creator
        platform: 0.30  // 30% to platform
      },
      limits: {
        monthly: Infinity,
        concurrent: 50
      },
      features: [
        'advanced_analytics',
        'extended_expiration',
        'save_threads',
        'closed_premium_threads',
        'priority_placement',
        'creator_badge'
      ]
    };
  } else {
    return {
      canCreate: true,
      priceRange: {
        min: 1.00,
        max: 2.99
      },
      revenueShare: {
        creator: 0.50,  // 50% to creator
        platform: 0.50  // 50% to platform
      },
      limits: {
        monthly: 5,
        concurrent: 10
      },
      features: [
        'basic_analytics',
        'standard_expiration'
      ]
    };
  }
}

/**
 * Validate premium thread price
 */
export function validatePremiumThreadPrice(
  price: number,
  user: User
): { valid: boolean; reason?: string } {
  const rules = getPremiumThreadRules(user);

  if (!price || isNaN(price) || price <= 0) {
    return { valid: false, reason: 'Please enter a valid price' };
  }

  if (price < rules.priceRange.min) {
    return {
      valid: false,
      reason: `Price must be at least $${rules.priceRange.min.toFixed(2)}`,
    };
  }

  // Free users have a $2.99 ceiling; premium users have no upper limit
  if (!user.isPremium && price > rules.priceRange.max) {
    return {
      valid: false,
      reason: `Free users can charge up to $${rules.priceRange.max.toFixed(2)}. Upgrade to Premium for higher prices!`,
    };
  }

  return { valid: true };
}

/**
 * Calculate revenue split for a premium thread sale
 */
export function calculateRevenueSplit(
  price: number,
  creatorIsPremium: boolean
): { creatorShare: number; platformShare: number } {
  const share = creatorIsPremium ? 0.70 : 0.50;
  
  return {
    creatorShare: parseFloat((price * share).toFixed(2)),
    platformShare: parseFloat((price * (1 - share)).toFixed(2))
  };
}

/**
 * Check if user can create more premium threads this month
 */
export function canCreatePremiumThread(
  user: User,
  currentMonthCount: number
): { canCreate: boolean; reason?: string; remaining?: number } {
  const rules = getPremiumThreadRules(user);
  
  if (currentMonthCount >= rules.limits.monthly) {
    return {
      canCreate: false,
      reason: user.isPremium
        ? `Maximum concurrent premium threads reached (${rules.limits.concurrent})`
        : `Free users can create ${rules.limits.monthly} premium threads per month. Upgrade to Premium for unlimited!`,
      remaining: 0
    };
  }
  
  const remaining = user.isPremium ? Infinity : rules.limits.monthly - currentMonthCount;
  
  return {
    canCreate: true,
    remaining
  };
}

/**
 * Calculate total earnings for a creator
 */
export function calculateCreatorEarnings(purchases: PremiumThreadPurchase[]) {
  const total = purchases.reduce((sum, purchase) => {
    if (purchase.status === 'completed') {
      return sum + purchase.creatorShare;
    }
    return sum;
  }, 0);

  const pending = purchases.reduce((sum, purchase) => {
    if (purchase.status === 'pending') {
      return sum + purchase.creatorShare;
    }
    return sum;
  }, 0);

  return {
    total: parseFloat(total.toFixed(2)),
    pending: parseFloat(pending.toFixed(2)),
    paid: parseFloat((total - pending).toFixed(2))
  };
}

/**
 * Calculate earnings for a specific thread
 */
export function calculateThreadEarnings(
  thread: Thread,
  purchases: PremiumThreadPurchase[]
): {
  totalSales: number;
  purchaseCount: number;
  creatorEarnings: number;
  platformFees: number;
} {
  const threadPurchases = purchases.filter(p => 
    p.threadId === thread.id && p.status === 'completed'
  );

  const totalSales = threadPurchases.reduce((sum, p) => sum + p.price, 0);
  const creatorEarnings = threadPurchases.reduce((sum, p) => sum + p.creatorShare, 0);
  const platformFees = threadPurchases.reduce((sum, p) => sum + p.platformShare, 0);

  return {
    totalSales: parseFloat(totalSales.toFixed(2)),
    purchaseCount: threadPurchases.length,
    creatorEarnings: parseFloat(creatorEarnings.toFixed(2)),
    platformFees: parseFloat(platformFees.toFixed(2))
  };
}

/**
 * Check if user has purchased a premium thread
 */
export function hasUserPurchasedThread(
  thread: Thread,
  userId: string
): boolean {
  return thread.purchasedBy?.includes(userId) || thread.authorId === userId;
}

/**
 * Get upgrade benefits for premium thread creators
 */
export function getUpgradeBenefits(currentPrice: number): {
  freeEarnings: number;
  premiumEarnings: number;
  revenueBoost: number;
} {
  const freeShare = currentPrice * 0.50;
  const premiumShare = currentPrice * 0.70;

  return {
    freeEarnings: parseFloat(freeShare.toFixed(2)),
    premiumEarnings: parseFloat(premiumShare.toFixed(2)),
    revenueBoost: parseFloat(((premiumShare - freeShare) / freeShare * 100).toFixed(0)),
  };
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Format earnings for display
 */
export function formatEarnings(earnings: number): string {
  if (earnings >= 1000) {
    return `$${(earnings / 1000).toFixed(1)}k`;
  }
  return `$${earnings.toFixed(2)}`;
}

/**
 * Calculate potential monthly earnings
 */
export function calculatePotentialEarnings(
  threadPrice: number,
  estimatedSales: number,
  isPremium: boolean
): {
  gross: number;
  creatorShare: number;
  platformShare: number;
  revenuePercentage: number;
} {
  const gross = threadPrice * estimatedSales;
  const revenuePercentage = isPremium ? 0.70 : 0.50;
  const creatorShare = gross * revenuePercentage;
  const platformShare = gross * (1 - revenuePercentage);

  return {
    gross: parseFloat(gross.toFixed(2)),
    creatorShare: parseFloat(creatorShare.toFixed(2)),
    platformShare: parseFloat(platformShare.toFixed(2)),
    revenuePercentage
  };
}
