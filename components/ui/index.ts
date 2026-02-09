/**
 * WhisprSpace UI Component Library
 * Centralized exports for all reusable UI components
 */

// Base Components
export { Button } from './Button';
export { Input } from './Input';
export { Badge, CountBadge, StatusBadge } from './Badge';
export { Spinner, PageLoader, LoadingDots } from './Spinner';

// Layout Components
export { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from './Card';

export { 
  Modal, 
  ModalHeader, 
  ModalBody, 
  ModalFooter 
} from './Modal';

// Feedback Components
export { 
  ToastProvider, 
  useToast, 
  useToastHelpers 
} from './Toast';

export { 
  EmptyState, 
  EmptyThreads, 
  EmptyMessages, 
  EmptySearchResults, 
  EmptyNotifications 
} from './EmptyState';

export { 
  ErrorState, 
  InlineError, 
  ErrorBanner 
} from './ErrorState';

// Loading Components
export { 
  Skeleton, 
  ThreadCardSkeleton, 
  MessageCardSkeleton, 
  InboxStatsSkeleton, 
  ProfileHeaderSkeleton 
} from './LoadingSkeleton';

// Type exports
export type { ButtonVariant, ButtonSize } from './Button';
