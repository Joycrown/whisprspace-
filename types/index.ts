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
  file?: File; // For retry logic
};

export type Attachment = FileAttachment | ImageAttachment | VoiceAttachment | LinkAttachment;

// ===== REACTION TYPES =====
export interface Reaction {
  count: number;
  users: string[];
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'angry' | 'sad' | 'wow';

// ===== MESSAGE TYPES =====
export interface Message {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  sender: Participant;
  content: string;
  timestamp: string;
  type: 'text' | 'voice' | 'image' | 'file' | 'link';
  attachments?: Attachment[];
  replyToId?: string;
  reactions?: { [key in ReactionType]?: { count: number; users: string[] } };
  isEdited?: boolean;
  editedAt?: string;
  likes: number;
  hasLiked: boolean;
  replies?: Message[];
  repliedMessage?: Partial<Message>;
  isReported?: boolean; // Add isReported flag to Message
  status?: 'sending' | 'sent' | 'error'; // Optimistic UI status
}

// ===== POLL TYPES =====
export interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
  hasVoted: boolean;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt: string;
  allowMultipleVotes: boolean;
  userVote?: string[]; // option IDs user voted for
  createdBy: string;
}

// ===== THREAD TYPES =====
export type ThreadType = 'text' | 'poll' | 'premium';
export type ThreadCategory = 'general' | 'tech' | 'lifestyle' | 'politics' | 'entertainment' | 'education' | 'business' | 'health';

export interface ThreadFilters {
  sortBy?: 'newest' | 'popular' | 'trending' | 'expiring' | 'oldest';
  category?: ThreadCategory | 'all';
  groupId?: string; // Filter threads by group
  type?: ThreadType | 'all';
  privacy?: 'public' | 'private' | 'invite_only' | 'group' | 'all';
  isPremium?: boolean;
  expiration?: 'active' | 'expired' | 'all';
  page?: number; // Pagination page number
}

export interface Thread {
  id: string;
  title: string;
  content: string;
  type: ThreadType;
  category: ThreadCategory;
  author: Author;
  authorId: string; // Explicit author ID for ownership checks
  createdAt: string;
  updatedAt: string;
  likes: number;
  messageCount: number;
  hasLiked: boolean;
  hasJoined?: boolean;
  hasAccess?: boolean;
  isPremium: boolean;
  price?: number;
  purchasedBy?: string[]; // User IDs who purchased access
  purchaseCount?: number; // Number of purchases
  earnings?: {
    totalSales: number;
    creatorEarnings: number;
    platformEarnings: number;
  };
  timeRemaining?: string;
  latestMessage?: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  participantCount: number;
  groupId?: string; // This might become redundant if groups are just private threads
  isPinned?: boolean;
  isLocked?: boolean;
  privacy: ThreadPrivacy; // Add privacy setting to Thread
  memberLimit?: number; // Add member limit to Thread
  accessCodes?: AccessCode[]; // Invite codes for free access
  secretToken?: string; // Token for secret link access
  freeAccessUsers?: string[]; // User IDs who got free access via codes/links
  expiresAt?: string; // ISO timestamp when thread expires (null if saved from expiration)
  isSaved: boolean; // Premium feature: saved threads never expire
  removedUsers?: string[]; // User IDs removed by thread owner (premium feature)
  creatorIsPremium?: boolean; // Whether the creator is a premium user
}

export interface ThreadData extends Thread {
  messages: Message[];
  pollId?: string;
  pollOptions?: PollOption[];
  isExpired?: boolean;
  viewCount: number;
  participants: Participant[];
  createdBy: Participant;
  reportCount: number;
  messageExpiresAt?: string; // Premium feature: extended message expiration (2 weeks for premium)
}

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
  privacy: ThreadPrivacy; // Add privacy setting to CreateThreadForm
  memberLimit?: number; // Add member limit to CreateThreadForm
  isSaved?: boolean; // Premium: Save thread from expiration
}

export interface ThreadDraft {
  id: string;
  title: string;
  content: string;
  type: ThreadType;
  category?: ThreadCategory;
  tags: string[];
  isPremium: boolean;
  price?: number;
  pollOptions?: string[];
  pollDuration?: number;
  lastSaved: string;
  autoSaveEnabled: boolean;
  privacy: ThreadPrivacy; // Add privacy setting to ThreadDraft
  memberLimit?: number; // Add member limit to ThreadDraft
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidation {
  isValid: boolean;
  errors: ValidationError[];
}

export interface EditorState {
  content: string;
  characterCount: number;
  isPreviewMode: boolean;
  hasUnsavedChanges: boolean;
}

export const THREAD_CATEGORIES: { value: ThreadCategory; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: '💬' },
  { value: 'tech', label: 'Technology', icon: '💻' },
  { value: 'lifestyle', label: 'Lifestyle', icon: '🌟' },
  { value: 'politics', label: 'Politics', icon: '🏛️' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'health', label: 'Health', icon: '🏥' },
];

export const CHARACTER_LIMITS = {
  title: 200,
  content: 5000,
  pollOption: 100,
  tag: 30,
} as const;

export const THREAD_TYPES: { value: ThreadType; label: string; description: string }[] = [
  {
    value: 'text',
    label: 'Text Thread',
    description: 'Share thoughts, stories, or start discussions'
  },
  {
    value: 'poll',
    label: 'Poll',
    description: 'Ask questions and gather community opinions'
  },
  {
    value: 'premium',
    label: 'Premium Thread',
    description: 'Create exclusive content for paying users'
  },
];

export type NotificationCategory = 'all' | 'message' | 'group_invite' | 'reaction' | 'system' | 'mention' | 'reply' | 'like' | 'thread_invite';
export type NotificationType = 'message' | 'group_invite' | 'reaction' | 'system' | 'mention' | 'reply' | 'like' | 'thread_invite';

export type ThreadPrivacy = 'public' | 'private' | 'invite_only';
export type GroupPrivacy = 'public' | 'private' | 'invite_only';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  maxMembers: number;
  currentMembers: number;
  members: GroupMember[];
  createdBy: string;
  createdAt: string;
  avatar: string;
  banner?: string;
  rules?: string;
  inviteCode?: string;
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
