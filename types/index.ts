/* eslint-disable @typescript-eslint/no-explicit-any */
// ===== USER & SESSION TYPES =====
export interface User {
  id: string;
  anonymousId: string; // ANON_XXXXXXXX format - System-generated ID
  username?: string; // Display username (replaces anonymousId for display) - User can change with cooldown
  lastUsernameChange?: string; // Timestamp of last username change (for cooldown enforcement)
  isAnonymous: boolean;
  sessionToken?: string;
  points: number;
  level: number;
  joinedAt: string;
  lastActiveAt: string;
  preferences: UserPreferences;
  isPremium?: boolean; // Premium membership status
  isAdmin?: boolean; // Admin status
  premiumExpiresAt?: string | null;
  premiumProvider?: string | null;
  premiumLastTxRef?: string | null;
  premiumThreadsCreatedThisMonth?: number; // Track monthly premium thread creation
  totalPremiumThreadsCreated?: number; // Total lifetime premium threads
  totalEarnings?: number; // Total creator earnings from premium threads
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
    likes: boolean;
    replies: boolean;
    mentions: boolean;
    groupInvites: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
  };
  education?: {
    onboardingVersion?: string;
    onboardingCompletedAt?: string;
    onboardingSkipped?: boolean;
  };
}

export interface UserSession {
  user: User | null;
  isAuthenticated: boolean;
  sessionExpiry: string | null;
}

// ===== PARTICIPANT & AUTHOR TYPES =====
export interface Participant {
  id: string;
  anonymousId: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  isPremium?: boolean;
  messageCount?: number;
  reportCount?: number;
}

export interface Author {
  id: string;
  anonymousId: string;
  name?: string;
  avatar?: string;
  isPremium?: boolean;
}

// ===== ATTACHMENT TYPES =====
export type FileAttachment = {
  type: 'file';
  url: string;
  fileName?: string;
  fileType?: string; // e.g., 'image', 'document', 'video'
  size?: number;
  file?: File; // For retry logic
};

export type ImageAttachment = {
  type: 'image';
  url: string;
  fileName?: string;
  fileType?: 'image';
  size?: number;
  file?: File; // For retry logic
};

export type VoiceAttachment = {
  type: 'voice';
  url: string;
  duration?: number;
  file?: File; // For retry logic
};

export type LinkAttachment = {
  type: 'link';
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
};

// ===== CONTENT TYPES =====
export type ThreadPrivacy = 'public' | 'private' | 'invite_only';
export type ThreadType = 'text' | 'poll' | 'premium';

export interface Thread {
  id: string;
  creatorId: string;
  creator?: Author;
  title: string;
  content: string;
  type: ThreadType;
  category: string;
  privacy: ThreadPrivacy;
  isPremium: boolean;
  price?: number;
  likesCount: number;
  messageCount: number;
  viewCount: number;
  participantCount: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  isLiked?: boolean;
  isSaved?: boolean;
  isDeleted?: boolean;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  sender?: Author;
  parentMessageId?: string;
  content: string;
  type: 'text' | 'voice' | 'image' | 'file' | 'link';
  attachments?: any[];
  likesCount: number;
  isEdited: boolean;
  isReported: boolean;
  isLiked?: boolean;
  createdAt: string;
  editedAt?: string;
  replyCount?: number;
}

// ===== POLL TYPES =====
export interface Poll {
  id: string;
  threadId: string;
  question: string;
  options: PollOption[];
  allowMultipleVotes: boolean;
  expiresAt: string;
  totalVotes: number;
  userVotedOptionId?: string;
}

export interface PollOption {
  id: string;
  pollId: string;
  text: string;
  voteCount: number;
  orderIndex: number;
}

// ===== GROUP TYPES =====
export type GroupPrivacy = 'public' | 'private' | 'invite_only';

export interface Group {
  id: string;
  name: string;
  description?: string;
  privacy: GroupPrivacy;
  maxMembers: number;
  currentMembers: number;
  avatar?: string;
  banner?: string;
  rules?: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  isMember?: boolean;
  role?: 'creator' | 'admin' | 'member';
}

export interface GroupMember {
  id: string;
  name: string;
  role: 'creator' | 'admin' | 'member';
  joinedAt: string;
  avatar: string;
}

export interface CreateGroupForm {
  name: string;
  description: string;
  privacy: GroupPrivacy;
  maxMembers: number;
  rules?: string;
  avatar?: string;
  banner?: string;
}

export interface AnonymousMessage {
  id: string;
  sender: string;
  recipientId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface AccessCode {
  code: string;
  createdAt: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  expiresAt?: string;
}

// ===== PREMIUM THREAD CREATION TYPES =====
export interface PremiumThreadCreationRules {
  canCreate: boolean;
  priceRange: {
    min: number;
    max: number;
  };
  revenueShare: {
    creator: number;
    platform: number;
  };
  limits: {
    monthly: number;
    concurrent: number;
  };
  features: string[];
}

export interface PremiumThreadPurchase {
  id: string;
  threadId: string;
  buyerId: string;
  buyerAnonymousId: string;
  price: number;
  creatorShare: number;
  platformShare: number;
  creatorId: string;
  purchasedAt: string;
  paymentMethod: 'stripe' | 'apple_pay' | 'google_pay';
  status: 'pending' | 'completed' | 'refunded';
}

export interface CreatorEarnings {
  userId: string;
  totalEarnings: number;
  pendingEarnings: number;
  processingPayouts?: number;
  paidEarnings: number;
  threadsSold: number;
  totalSales: number;
  averagePrice: number;
  lastPayoutAt?: string;
  nextPayoutAt?: string;
}

export interface CreatorPayout {
  id: string;
  creatorId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: 'stripe' | 'paypal' | 'bank';
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
}

export interface ThreadEarnings {
  threadId: string;
  threadTitle: string;
  price: number;
  totalSales: number;
  purchaseCount: number;
  creatorEarnings: number;
  platformFees: number;
  createdAt: string;
  lastSaleAt?: string;
}

export interface CreatorEarningsSeries {
  week: number[];
  month: number[];
  all: number[];
}

export interface CreatorEarningsTransaction {
  id: string;
  type: 'sale' | 'payout';
  status: string;
  threadId?: string | null;
  threadTitle?: string | null;
  grossAmount: number;
  netAmount: number;
  currency: string;
  occurredAt: string;
}

export interface CreatorEarningsResponse {
  earnings: CreatorEarnings;
  threadEarnings: ThreadEarnings[];
  earningsSeries: CreatorEarningsSeries;
  recentTransactions: CreatorEarningsTransaction[];
}

// ===== API RESPONSE TYPES =====
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ===== THREAD CONSTANTS & LIMITS =====
export const CHARACTER_LIMITS = {
  title: 120,
  content: 10000,
  pollOption: 80,
};

export type ThreadCategory =
  | 'general'
  | 'tech'
  | 'lifestyle'
  | 'politics'
  | 'entertainment'
  | 'education'
  | 'business'
  | 'health'
  | 'all';

export const THREAD_CATEGORIES = [
  { value: 'general', label: 'General', icon: '💬' },
  { value: 'tech', label: 'Tech', icon: '💻' },
  { value: 'lifestyle', label: 'Lifestyle', icon: '🌟' },
  { value: 'politics', label: 'Politics', icon: '🏛️' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'health', label: 'Health', icon: '🏥' },
] as const;

export const THREAD_TYPES = [
  {
    value: 'text',
    label: 'Text Thread',
    description: 'Start a text-based discussion',
    icon: '📝',
  },
  {
    value: 'poll',
    label: 'Poll',
    description: 'Ask the community with a poll',
    icon: '📊',
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Exclusive paid content',
    icon: '💎',
  },
] as const;

// ===== THREAD FORM & DRAFT TYPES =====
export interface CreateThreadForm {
  title: string;
  content: string;
  type: ThreadType;
  category: ThreadCategory;
  tags: string[];
  isPremium: boolean;
  price?: number;
  pollOptions?: string[];
  pollDuration?: number;
  privacy: ThreadPrivacy;
  memberLimit?: number;
}

export interface ThreadDraft extends CreateThreadForm {
  id: string;
  lastSaved: string;
  autoSaveEnabled: boolean;
}

export interface ThreadFilters {
  sortBy?: 'newest' | 'popular' | 'trending' | 'oldest';
  category?: string;
  type?: string;
  groupId?: string;
  isPremium?: boolean;
  privacy?: string;
  expiration?: 'active' | 'expired' | 'all';
  page?: number;
}

export interface ThreadData extends Thread {
  messages: Message[];
  participants: Participant[];
  poll?: Poll;
  hasAccess?: boolean;
  hasJoined?: boolean;
  isLocked?: boolean;
  timeRemaining?: string;
  rating?: number;
  ratingCount?: number;
  removedUsers?: string[];
}

export type ReactionType = string;

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'file';
  url: string;
  name?: string;
}
