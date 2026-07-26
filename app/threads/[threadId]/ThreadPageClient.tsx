/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ThreadMessages from '@/components/features/threads/ThreadMessages';
import ThreadInput from '@/components/features/threads/ThreadInput';
import ThreadSidebar from '@/components/features/threads/ThreadSideBar';
import ThreadHeader from '@/components/features/threads/ThreadHeader';
import { useThreadQuery, useCreateThreadMessageMutation, useEditThreadMessageMutation, useLikeThreadMutation, useDeleteThreadMutation, useUpdateThreadMutation, useMessageReactionMutation, useVoteOnPollMutation, useJoinThreadMutation, useLeaveThreadMutation, useRemoveParticipantMutation, checkThreadBan, inviteUserToThread, reportThread } from '@/lib/threads';
import { useUserStore } from '@/store/userStore';
import { Message, Participant, ReactionType, ThreadPrivacy } from '@/types';
import { SearchProvider } from '@/hooks/hooks/ThreadSearchHook';
import { MessageOptionsModal } from '@/components/modals/ThreadModals';
import AppLoadingState from '@/components/ui/AppLoadingState';
import { useRealtimeThread, useTypingIndicator } from '@/lib/core/realtime/useRealtimeThread';
import { useToast } from '@/components/ui/Toast';
import { findDirectConversationWithUser } from '@/lib/messaging';
import { confirmThreadPurchase } from '@/lib/flutterwave/flutterwave-service';
import { DualGatewayPremiumGate } from '@/components/features/premium/DualGatewayPremiumGate';
import { buildThreadPath, extractThreadIdFromRef } from '@/lib/threads/thread-url';
import { Loader2, X } from 'lucide-react';

type ThreadPreviewMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderName: string;
};

type ThreadPreviewData = {
  id: string;
  title: string;
  content: string;
  category: string;
  type: string;
  privacy: string;
  isPremium: boolean;
  price: number | null;
  messageCount: number;
  participantCount: number;
  likes: number;
  expiresAt: string | null;
  messages: ThreadPreviewMessage[];
};


const normalizeReportReason = (reason: string) => {
  switch (reason) {
    case 'spam':
      return 'spam';
    case 'harassment':
      return 'harassment';
    case 'hate_speech':
    case 'hate':
      return 'hate_speech';
    case 'violence':
      return 'violence';
    case 'sexual_content':
      return 'sexual_content';
    case 'inappropriate':
    case 'inappropriate_content':
      return 'other';
    case 'misinformation':
      return 'misinformation';
    case 'copyright':
      return 'copyright';
    case 'other':
    case 'others':
    default:
      return 'other';
  }
};

const ThreadPage = () => {
  const params = useParams();
  const router = useRouter();
  const { session, sessionValidated } = useUserStore();

  const threadRef = useMemo(() => {
    const value = Array.isArray(params.threadId) ? params.threadId[0] : params.threadId;
    return value ? String(value) : undefined;
  }, [params.threadId]);
  const threadId = useMemo(() => extractThreadIdFromRef(threadRef) || undefined, [threadRef]);

  // React Query hooks for data fetching and mutations
  const { thread: currentThread, isLoading, isFetching, isFetchedAfterMount, error, refetch } = useThreadQuery(
    threadId,
    Boolean(threadId && sessionValidated)
  );
  const createMessageMutation = useCreateThreadMessageMutation();
  const editMessageMutation = useEditThreadMessageMutation();
  const likeThreadMutation = useLikeThreadMutation();
  const deleteThreadMutation = useDeleteThreadMutation();
  const updateThreadMutation = useUpdateThreadMutation();
  const messageReactionMutation = useMessageReactionMutation();
  const voteOnPollMutation = useVoteOnPollMutation();
  const joinThreadMutation = useJoinThreadMutation();
  const leaveThreadMutation = useLeaveThreadMutation();
  const removeParticipantMutation = useRemoveParticipantMutation();
  const { showToast } = useToast();

  // Keep Zustand for other thread actions if needed
  // const { } = useThreadStore();

  const messages = useMemo(() => currentThread?.messages || [], [currentThread?.messages]);
  const [replyingTo, setReplyingTo] = useState<Message | undefined>(undefined);
  const [isMuted, setIsMuted] = useState(false);
  const [messageFilter, setMessageFilter] = useState<{ senderId?: string; keyword?: string }>({}); // New state for message filtering
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state
  const [joinActionError, setJoinActionError] = useState<string | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [showRemovedModal, setShowRemovedModal] = useState(false);
  const [banPresentation, setBanPresentation] = useState<'modal' | 'toast' | null>(null);
  const hasEverJoinedRef = useRef(false);
  // Guards the payment-confirm effect so it fires at most once per transaction,
  // even if the effect re-runs (unstable deps / Strict Mode double-invoke).
  const confirmedTxRef = useRef<string | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [messageTarget, setMessageTarget] = useState<Participant | null>(null);
  const [isPollCollapsed, setIsPollCollapsed] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<ThreadPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const lastScrollIntentRef = useRef(0);

  // Realtime hooks
  const realtimeThreadId = isBanned ? null : (threadId || null);
  const { typingUsers, onlineCount } = useRealtimeThread(realtimeThreadId, currentThread?.pollId);
  const { startTyping, stopTyping } = useTypingIndicator(realtimeThreadId);

  const canonicalThreadPath = useMemo(() => {
    if (currentThread?.id) {
      return buildThreadPath({ id: currentThread.id, title: currentThread.title });
    }
    if (threadId) {
      return `/threads/${threadId}`;
    }
    return '/threads';
  }, [currentThread?.id, currentThread?.title, threadId]);

  const loadThreadPreview = async (force = false) => {
    if (!threadId || previewLoading) return;
    if (previewData && !force) return;

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const response = await fetch(`/api/threads/${threadId}/preview`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || 'Failed to load thread preview');
      }

      setPreviewData(payload.data as ThreadPreviewData);
    } catch (previewLoadError) {
      setPreviewError(previewLoadError instanceof Error ? previewLoadError.message : 'Failed to load thread preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenThreadPreview = () => {
    setShowPreviewModal(true);
    void loadThreadPreview();
  };

  const handleCloseThreadPreview = () => {
    setShowPreviewModal(false);
  };

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSidebarOpen]);

  useEffect(() => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, [threadId]);

  useEffect(() => {
    if (!showPreviewModal) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPreviewModal(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPreviewModal]);

  const currentUserId = useMemo(() => session.user?.id || '', [session.user?.id]);
  const isThreadLocked = Boolean(currentThread?.isLocked);
  const isThreadBlocked = isBanned || isThreadLocked;

  const handleBlockedAction = () => {
    if (isBanned) {
      setShowRemovedModal(true);
      return;
    }

    if (isThreadLocked) {
      showToast({
        type: 'error',
        title: 'Thread Blocked',
        message: 'This thread has been blocked due to community reports.',
        duration: 4500,
      });
    }
  };

  useEffect(() => {
    if (!threadId) return;

    if (typeof window === 'undefined') return;
    const txRefStorageKey = `whispr_thread_tx_ref_${threadId}`;
    const params = new URLSearchParams(window.location.search);
    const purchased = params.get('purchased') === 'true';
    const gateway = params.get('gateway');
    const status = String(params.get('status') || '').toLowerCase();
    const txRefFromQuery = params.get('tx_ref');
    const transactionId = params.get('transaction_id');
    const storedTxRef = localStorage.getItem(txRefStorageKey);
    const txRef = txRefFromQuery || storedTxRef;

    if ((!purchased || gateway !== 'flutterwave') && !storedTxRef) return;

    const successStatuses = ['successful', 'success', 'succeeded', 'completed'];
    if (status && !successStatuses.includes(status)) {
      localStorage.removeItem(txRefStorageKey);
      router.replace(canonicalThreadPath);
      return;
    }

    if (!transactionId && !txRef) return;

    // Fire the confirmation only once per transaction. Without this the effect
    // re-runs on unstable deps (refetch/showToast/router) and double-calls
    // /confirm — the second call races the first and used to 500.
    const confirmKey = String(transactionId || txRef);
    if (confirmedTxRef.current === confirmKey) return;
    confirmedTxRef.current = confirmKey;

    let isActive = true;

    const confirmPayment = async () => {
      const result = await confirmThreadPurchase({
        threadId,
        transactionId,
        txRef,
      });

      if (result.success) {
        localStorage.removeItem(txRefStorageKey);
        await refetch();
        showToast({
          type: 'success',
          title: 'Payment Confirmed',
          message: 'Your access is now active.',
          duration: 4000,
        });
      } else {
        localStorage.removeItem(txRefStorageKey);
        showToast({
          type: 'error',
          title: 'Payment Pending',
          message: result.error || 'We are still confirming your payment.',
          duration: 5000,
        });
      }

      if (isActive) {
        router.replace(canonicalThreadPath);
      }
    };

    confirmPayment();

    return () => {
      isActive = false;
    };
  }, [threadId, canonicalThreadPath, refetch, router, showToast]);

  // Subscribe to real-time messages is now handled entirely by useRealtimeThread hook
  // which manages the React Query cache directly for instant updates
  // No explicit effect needed here as useRealtimeThread is called above





  const handleLike = () => {
    if (isThreadBlocked) {
      handleBlockedAction();
      return;
    }
    if (currentThread && threadId) {
      likeThreadMutation.mutate({
        threadId,
        userId: currentUserId,
        isLiked: currentThread.hasLiked,
      });
    }
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (threadId) {
      removeParticipantMutation.mutate({ threadId, participantId });
    }
  };

  const handleInviteParticipant = async (threadId: string, username: string) => {
    if (isThreadLocked) {
      showToast({
        type: 'error',
        title: 'Thread Blocked',
        message: 'This thread is blocked and no further activity is allowed.',
        duration: 4500,
      });
      return;
    }

    if (!currentThread) return;
    const result = await inviteUserToThread(threadId, username, currentThread.title);

    if (result.success) {
      showToast({
        type: 'success',
        title: 'Invite Sent',
        message: `${username} has been invited to join this thread.`,
        duration: 4000,
      });
    } else {
      showToast({
        type: 'error',
        title: 'Invite Failed',
        message: result.error || 'Unable to invite that user.',
        duration: 5000,
      });
    }
  };

  const handleMessageParticipant = async (participantId: string) => {
    if (!participantId) return;
    if (participantId === currentUserId) {
      showToast({
        type: 'error',
        title: 'Unable to message',
        message: 'You cannot message yourself.',
        duration: 3500,
      });
      return;
    }

    // If a direct conversation already exists, go straight to it.
    const existing = await findDirectConversationWithUser(participantId);
    if (existing.data?.id) {
      router.push(`/inbox/${existing.data.id}`);
      return;
    }

    const target = participants.find(p => p.id === participantId) || null;
    setMessageTarget(target);
    setShowMessageOptions(true);
  };

  const handleSendOneOff = () => {
    if (!messageTarget?.id) return;
    router.push(`/dm/${messageTarget.id}?mode=one-time&from=thread&threadId=${threadId}`);
  };

  const handleStartConversation = () => {
    if (!messageTarget?.id) return;
    router.push(`/dm/${messageTarget.id}?mode=conversation&from=thread&threadId=${threadId}`);
  };

  const handleUpdateThreadPrivacy = (privacy: ThreadPrivacy, memberLimit?: number) => {
    if (currentThread && threadId) {
      updateThreadMutation.mutate({
        threadId,
        updates: { privacy, memberLimit },
      });
    }
  };

  const handleLockThread = (threadId: string, isLocked: boolean) => {
    if (currentThread) {
      updateThreadMutation.mutate({
        threadId,
        updates: { isLocked },
      });
    }
  };

  const handleViewReportedMessages = (threadId: string) => {
    // In a real application, this would navigate to a moderation panel or open a specific modal
    void threadId;
  };

  const handleLeaveThread = () => {
    if (threadId && currentUserId) {
      leaveThreadMutation.mutate(
        { threadId, userId: currentUserId },
        {
          onSuccess: () => {
            router.push('/threads');
          },
        }
      );
    }
  };

  const handleJoinThread = async () => {
    if (!threadId) return;
    if (isThreadBlocked) {
      handleBlockedAction();
      return;
    }

    setJoinActionError(null);

    let userId = currentUserId;

    if (!userId) {

      const { loginAnonymously } = useUserStore.getState();
      await loginAnonymously();
      // After login, the currentUserId will be updated in state, 
      // but we need it now for the mutation.
      const { session: freshSession, error: authError } = useUserStore.getState();
      const freshUser = freshSession.user;

      if (authError) {
        setJoinActionError(authError);
        console.error('❌ [ThreadPage] Anonymous login error:', authError);
        return;
      }
      if (!freshUser) {
        const msg = 'Anonymous session not created. Please refresh and try again.';
        setJoinActionError(msg);
        console.error('❌ [ThreadPage] Anonymous login failed, cannot join');
        return;
      }
      userId = freshUser.id;
    }

    joinThreadMutation.mutate({ threadId, userId });
  };

  const handleDeleteThread = () => {
    if (currentThread && threadId) {
      deleteThreadMutation.mutate(
        { threadId, userId: currentUserId },
        {
          onSuccess: () => {
            router.push('/threads');
          },
        }
      );
    }
  };

  const handleReact = (messageId: string, reaction: string) => {
    if (isThreadBlocked) {
      handleBlockedAction();
      return;
    }
    if (!currentUserId) return;

    // Determine current state to toggle
    const message = messages.find(m => m.id === messageId);
    // This depends on how reactions are structured. Data model says it has a list of users.
    // ReactionType in DB might not match UI completely, but let's assume reactions object:
    // reactions: { [reactionType]: { count: number, users: string[] } }

    // Check if user has already reacted with this emoji
    const hasReacted = message?.reactions?.[reaction as ReactionType]?.users.includes(currentUserId);
    const action = hasReacted ? 'remove' : 'add';

    messageReactionMutation.mutate({
      messageId,
      userId: currentUserId,
      reaction,
      action,
      threadId,
    });
  };

  const handleReportThread = async ({
    reason,
    customReason,
  }: {
    reason: string;
    customReason?: string;
  }) => {
    if (!currentThread?.id) return;

    let reporterId = currentUserId;
    if (!reporterId) {
      const { loginAnonymously } = useUserStore.getState();
      await loginAnonymously();
      reporterId = useUserStore.getState().session.user?.id || '';
    }

    if (!reporterId) {
      showToast({
        type: 'error',
        title: 'Report Failed',
        message: 'Unable to authenticate your report right now. Please try again.',
        duration: 4500,
      });
      return;
    }

    const normalizedReason = normalizeReportReason(reason);
    const description = customReason?.trim() || undefined;

    const result = await reportThread(
      currentThread.id,
      normalizedReason,
      description
    );

    if (result.success) {
      const alreadyReported = result.alreadyReported === true;
      const didLockThread = result.isLocked === true;
      showToast({
        type: 'success',
        title: alreadyReported ? 'Already Reported' : 'Report Submitted',
        message: alreadyReported
          ? 'You have already reported this thread.'
          : 'Thanks. Our moderation team will review this thread.',
        duration: 4200,
      });

      if (didLockThread) {
        showToast({
          type: 'error',
          title: 'Thread Blocked',
          message: 'This thread has been blocked due to high report volume.',
          duration: 5000,
        });
      }

      await refetch();
      return;
    }

    showToast({
      type: 'error',
      title: 'Report Failed',
      message: result.error || 'Unable to submit report right now.',
      duration: 4500,
    });
  };

  const handleReply = (message: Message) => {
    if (isThreadBlocked) {
      handleBlockedAction();
      return;
    }
    setReplyingTo(message);
  };

  const handleSetMessageFilter = (filter: { senderId?: string; keyword?: string }) => {
    setMessageFilter(filter);
  };

  const handleSendMessage = (content: string, attachments?: any[]) => {
    if (isThreadBlocked) {
      handleBlockedAction();
      return;
    }


    if (!currentThread) {
      console.error('🔴 Validation failed: No currentThread loaded');
      return;
    }
    if (!threadId) {
      console.error('🔴 Validation failed: No threadId');
      return;
    }
    if (!content.trim() && (!attachments || attachments.length === 0)) {
      console.error('🔴 Validation failed: No content');
      return;
    }

    // Clear reply state immediately for better UX
    setReplyingTo(undefined);


    // Send message using React Query mutation
    createMessageMutation.mutate({
      threadId,
      content,
      userId: currentUserId,
      type: 'text', // Mutation handles type inference from attachments
      attachments: attachments, // Pass raw File[] for mutation to upload
      replyToId: replyingTo?.id,
    });
  };

  const handleEditMessage = (messageId: string, content: string) => {
    if (isThreadBlocked) {
      handleBlockedAction();
      return;
    }
    if (!threadId || !currentUserId) return;

    editMessageMutation.mutate({
      threadId,
      messageId,
      content,
      userId: currentUserId,
    });
  };

  const messagesMap = useMemo(() => {
    const map: { [key: string]: Message } = {};
    messages.forEach(msg => map[msg.id] = msg);
    return map;
  }, [messages]);

  const participants = useMemo(() => {
    const base = currentThread?.participants || [];
    if (base.length === 0) return base;

    const overrides = new Map<
      string,
      { name?: string; anonymousId?: string; avatar?: string; isPremium?: boolean }
    >();

    const creator = currentThread?.createdBy || currentThread?.author;
    if (creator?.id) {
      overrides.set(creator.id, {
        name: creator.name,
        anonymousId: creator.anonymousId,
        avatar: creator.avatar,
        isPremium: creator.isPremium,
      });
    }

    messages.forEach((msg) => {
      const sender = msg.sender;
      if (!sender?.id) return;
      overrides.set(sender.id, {
        name: sender.name,
        anonymousId: sender.anonymousId,
        avatar: sender.avatar,
        isPremium: sender.isPremium,
      });
    });

    const currentUser = session.user;
    if (currentUser?.id) {
      overrides.set(currentUser.id, {
        name: currentUser.username || currentUser.anonymousId,
        anonymousId: currentUser.anonymousId,
        isPremium: currentUser.isPremium,
      });
    }

    const isSystemName = (value: string | undefined) => {
      if (!value) return true;
      return /^ANON_\d{8}$/i.test(value);
    };

    const messageCounts = new Map<string, number>();
    messages.forEach((msg) => {
      const senderId = msg.sender?.id || msg.authorId;
      if (!senderId) return;
      messageCounts.set(senderId, (messageCounts.get(senderId) || 0) + 1);
    });

    return base.map((participant) => {
      const override = overrides.get(participant.id);

      return {
        ...participant,
        ...(override || {}),
        name: isSystemName(participant.name)
          ? (override?.name || participant.name)
          : participant.name,
        anonymousId: override?.anonymousId || participant.anonymousId,
        avatar: override?.avatar || participant.avatar,
        isPremium: override?.isPremium ?? participant.isPremium,
        messageCount: messageCounts.get(participant.id) ?? participant.messageCount ?? 0,
      };
    });
  }, [
    currentThread?.participants,
    currentThread?.createdBy?.id,
    currentThread?.createdBy?.name,
    currentThread?.createdBy?.anonymousId,
    currentThread?.createdBy?.avatar,
    currentThread?.createdBy?.isPremium,
    currentThread?.author?.id,
    currentThread?.author?.name,
    currentThread?.author?.anonymousId,
    currentThread?.author?.avatar,
    currentThread?.author?.isPremium,
    messages,
    session.user?.id,
    session.user?.username,
    session.user?.anonymousId,
    session.user?.isPremium,
  ]);

  const isCreator = useMemo(() => {
    return !!(currentThread && currentThread.createdBy?.id === currentUserId);
  }, [currentThread?.createdBy?.id, currentUserId]);

  const isJoined = useMemo(() => {
    return participants.some(p => p.id === currentUserId);
  }, [participants, currentUserId]);

  const isPrivateThread = useMemo(() => {
    return currentThread?.privacy === 'private' || currentThread?.privacy === 'invite_only';
  }, [currentThread?.privacy]);

  const typingDisplayNames = useMemo(() => {
    if (!typingUsers?.length) return [];

    const participantById = new Map(
      participants.map((participant) => [participant.id, participant])
    );

    return typingUsers.map((typingUserId) => {
      const participant = participantById.get(typingUserId);
      const candidateName = participant?.name || participant?.anonymousId || 'Someone';
      return candidateName.trim() || 'Someone';
    });
  }, [typingUsers, participants]);

  const joinErrorMessage = useMemo(() => {
    if (joinActionError) return joinActionError;
    if (isBanned || banPresentation === 'toast') return '';
    const err = joinThreadMutation.error as any;
    if (!err) return '';
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Failed to join thread';
  }, [joinThreadMutation.error, joinActionError, isBanned, banPresentation]);

  useEffect(() => {
    if (isJoined) {
      hasEverJoinedRef.current = true;
    }
  }, [isJoined]);

  useEffect(() => {
    const err = joinThreadMutation.error as any;
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    if (message.includes('removed from this thread')) {
      setIsBanned(true);
      setBanPresentation('toast');
      setShowRemovedModal(false);
    }
  }, [joinThreadMutation.error]);

  useEffect(() => {
    const err = joinThreadMutation.error as any;
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    if (message.includes('removed from this thread')) {
      setIsBanned(true);
      setShowRemovedModal(true);
    }
  }, [joinThreadMutation.error]);

  useEffect(() => {
    const userId = session.user?.id;
    if (!threadId || !userId) {
      setIsBanned(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await checkThreadBan(threadId, userId);
      if (cancelled) return;
      if (result.isBanned) {
        setIsBanned(true);
        if (banPresentation !== 'toast' && hasEverJoinedRef.current) {
          setBanPresentation('modal');
          setShowRemovedModal(true);
        } else if (banPresentation !== 'toast' && !hasEverJoinedRef.current) {
          setBanPresentation('toast');
          setShowRemovedModal(false);
        }
      } else {
        setIsBanned(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [threadId, session.user?.id, currentThread?.participants?.length, banPresentation]);

  useEffect(() => {
    if (!isBanned) return;

    let delay: number | null = null;
    if (banPresentation === 'modal') delay = 3000;
    if (banPresentation === 'toast') delay = 50;
    if (banPresentation === null) delay = 50;

    if (delay === null) return;

    const timer = setTimeout(() => {
      router.push('/threads');
    }, delay);

    return () => clearTimeout(timer);
  }, [isBanned, banPresentation, router]);

  // Get thread creator ID, ensuring it's always a string
  const threadCreatorId = useMemo(() => {
    return currentThread?.createdBy?.id ?? currentThread?.authorId ?? '';
  }, [currentThread?.createdBy?.id, currentThread?.authorId]);

  const hasAlreadyVoted = useMemo(() =>
    currentThread?.pollOptions?.some(option => option.hasVoted) || false
    , [currentThread?.pollOptions]);
  const totalPollVotes = useMemo(() => {
    return currentThread?.pollOptions?.reduce((sum, option) => sum + (option.votes || 0), 0) || 0;
  }, [currentThread?.pollOptions]);

  useEffect(() => {
    setIsPollCollapsed(false);
    lastScrollIntentRef.current = 0;
  }, [currentThread?.id]);

  const markScrollIntent = () => {
    lastScrollIntentRef.current = Date.now();
  };

  const handleMessagesScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (currentThread?.type !== 'poll') return;
    if (isPollCollapsed) return;

    const isLikelyUserScroll = Date.now() - lastScrollIntentRef.current < 800;
    if (!isLikelyUserScroll) return;

    if (event.currentTarget.scrollTop > 0) {
      setIsPollCollapsed(true);
    }
  };

  const handleVote = (optionId: string) => {
    if (isThreadBlocked) {
      handleBlockedAction();
      return;
    }
    if (!currentThread || currentThread.type !== 'poll' || !currentThread.pollId || !threadId || hasAlreadyVoted) return;

    voteOnPollMutation.mutate({
      pollId: currentThread.pollId,
      optionId,
      userId: currentUserId,
      threadId,
    });
  };

  if (!sessionValidated) {
    return <AppLoadingState title="Syncing your conversations..." />;
  }

  // Prevent rendering cached thread content before the first post-mount fetch completes.
  // This avoids brief unauthorized content peeks on access-restricted threads.
  const waitingForFreshFetch = isFetching && !isFetchedAfterMount;
  if (isLoading || waitingForFreshFetch) {
    return <AppLoadingState title="Syncing your conversations..." />;
  }

  if (error) {
    const queryError = error as Error & { code?: string };
    const isExpiredThread =
      queryError?.code === 'THREAD_EXPIRED' ||
      /thread has expired/i.test(queryError?.message || '');

    return (
      <div className="min-h-[100dvh] bg-[#121212] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#1E1E1E] p-6 text-white shadow-2xl">
          <h2 className="text-lg font-semibold">
            {isExpiredThread ? 'Thread Expired' : 'Unable to Open Thread'}
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            {isExpiredThread
              ? 'This thread has expired and is no longer available.'
              : (queryError?.message || 'Failed to load thread.')}
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/threads')}
              className="flex-1 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              Return to Threads
            </button>
            {!isExpiredThread && (
              <button
                type="button"
                onClick={() => refetch()}
                className="flex-1 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!currentThread) {
    return <div className="text-white p-4">Thread not found.</div>;
  }

  const previewFallbackData: ThreadPreviewData = {
    id: currentThread.id,
    title: currentThread.title,
    content: currentThread.content,
    category: currentThread.category || 'general',
    type: currentThread.type || 'text',
    privacy: currentThread.privacy || 'public',
    isPremium: currentThread.isPremium,
    price: currentThread.price ?? null,
    messageCount: currentThread.messageCount ?? messages.length,
    participantCount: currentThread.participantCount ?? participants.length,
    likes: currentThread.likes ?? 0,
    expiresAt: currentThread.expiresAt || null,
    messages: (messages.slice(-3) || [])
      .reverse()
      .map((message) => ({
        id: message.id,
        content: (message.content || '').trim(),
        createdAt: message.createdAt,
        senderName: message.sender?.name || message.sender?.anonymousId || message.authorName || 'Anonymous',
      })),
  };

  const preview = previewData || previewFallbackData;

  const isPrivateBlocked = isPrivateThread && !isCreator && !isJoined;

  const contentBlock = (
    <>
      {isThreadLocked && (
        <div className="border-b border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          This thread is blocked due to community reports. New activity is disabled.
        </div>
      )}

      {/* Poll Section */}
      {currentThread.type === 'poll' && currentThread.pollOptions && (
        <div className="border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
          <button
            type="button"
            className="w-full px-3 md:px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"
            onClick={() => setIsPollCollapsed(prev => !prev)}
            aria-expanded={!isPollCollapsed}
            aria-label={isPollCollapsed ? 'Expand poll' : 'Collapse poll'}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-white">Poll: {currentThread.title}</h2>
                {isPollCollapsed ? (
                  <p className="text-xs md:text-sm text-gray-400 mt-1">
                    {totalPollVotes} vote{totalPollVotes === 1 ? '' : 's'} - Tap to expand
                  </p>
                ) : (
                  <p className="text-sm md:text-base text-gray-400 mt-2">{currentThread.content}</p>
                )}
              </div>
              <span
                className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-600 text-gray-300 transition-transform ${isPollCollapsed ? '' : 'rotate-180'}`}
                aria-hidden="true"
              >
                v
              </span>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {!isPollCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-2 md:space-y-3">
                  {currentThread.pollOptions.map(option => (
                    <div
                      key={option.id}
                      className={`relative flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg transition-colors overflow-hidden min-h-[48px] ${option.hasVoted
                        ? 'bg-purple-900/50 border border-purple-500'
                        : hasAlreadyVoted
                          ? 'bg-gray-800/50 border border-gray-700 opacity-80 cursor-default'
                          : 'bg-gray-800 hover:bg-gray-700 active:bg-gray-600 cursor-pointer'
                        }`}
                      onClick={() => !hasAlreadyVoted && handleVote(option.id)}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-purple-600/30 to-transparent"
                        initial={{ width: 0 }}
                        animate={{ width: `${option.percentage || 0}%` }}
                        transition={{ duration: 0.5 }}
                      />
                      <div className="relative z-10 flex items-center justify-between w-full gap-2">
                        <span className="text-sm md:text-base font-medium text-white">{option.text}</span>
                        <span className="text-xs md:text-sm text-gray-400 whitespace-nowrap">{option.votes} ({option.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Messages Area - Scrollable */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-20 scrollbar-hide"
        onScroll={handleMessagesScroll}
        onWheel={markScrollIntent}
        onTouchStart={markScrollIntent}
        onTouchMove={markScrollIntent}
        onPointerDown={(event) => {
          if (event.currentTarget === event.target) {
            markScrollIntent();
          }
        }}
      >
        <ThreadMessages
          messages={messages}
          currentUserId={currentUserId}
          threadId={threadId ?? ''}
          threadCreatorId={threadCreatorId}
          onReply={handleReply}
          onEditMessage={handleEditMessage}
          onReact={handleReact}
          getRepliedMessage={(id: string) => messagesMap[id]}
          messageFilter={messageFilter}
          onRetry={(msg) => {
            // Extract raw files from attachments if available
            const retryAttachments = msg.attachments?.map(a => a.file).filter(Boolean) as File[];
            handleSendMessage(msg.content, retryAttachments);
          }}
          typingUsers={typingDisplayNames}
        />
      </div>

      {/* Fixed Input at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 md:left-20 lg:right-80 border-t border-gray-800 bg-[#121212] z-50 pointer-events-auto pb-[env(safe-area-inset-bottom)]">
        <ThreadInput
          onSendMessage={(content, attachments) => handleSendMessage(content, attachments)}
          onTypingStart={startTyping}
          onTypingEnd={stopTyping}
          replyTo={replyingTo || null}
          participants={participants}
          currentUserId={currentUserId}
          onCancelReply={() => setReplyingTo(undefined)}
          replyPreview={
            replyingTo ? `Replying to ${messagesMap[replyingTo.id]?.sender.name || 'User'}: ${messagesMap[replyingTo.id]?.content.substring(0, 30) || 'Attachment'}...` : undefined
          }
          isLoading={createMessageMutation.isPending}
          isDisabled={isThreadBlocked}
          disabledMessage={isThreadLocked
            ? 'This thread has been blocked due to community reports.'
            : 'You have been removed from this thread.'}
        />
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] md:h-screen bg-[#121212] overflow-hidden w-full max-w-full">
      {/* Main content area (messages + input) with its own header */}
      <div className="flex-1 min-w-0 max-w-full border-x-0 md:border-x border-gray-800 flex flex-col h-[100dvh] md:h-screen overflow-hidden">
        {/* Fixed Header - only for main chat area */}
        <div className="sticky top-0 z-[60] shrink-0">
          <ThreadHeader
            thread={currentThread}
            onLike={handleLike}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            currentUserId={currentUserId}
            onOpenPreview={handleOpenThreadPreview}
          />
        </div>
        {isPrivateBlocked ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-md space-y-3">
              <h2 className="text-xl font-semibold text-white">This thread is private</h2>
              <p className="text-sm text-gray-400">
                This thread requires an invite from the creator before you can join.
              </p>
              {joinErrorMessage && (
                <div className="text-xs text-red-400 bg-red-900/30 border border-red-800 rounded px-3 py-2">
                  {joinErrorMessage}
                </div>
              )}
              <button
                onClick={handleJoinThread}
                disabled={joinThreadMutation.isPending}
                className="w-full px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {joinThreadMutation.isPending ? 'Joining...' : 'Join Thread'}
              </button>
              <button
                onClick={() => router.push('/threads')}
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                Back to Threads
              </button>
            </div>
          </div>
        ) : currentThread.isPremium && !isCreator && !currentThread.hasAccess ? (
          <DualGatewayPremiumGate
            key={`premium-gate-${currentThread.id}-${currentThread.hasAccess ? 'open' : 'locked'}`}
            threadId={threadId ?? ''}
            price={currentThread.price ?? 0}
          >
            {contentBlock}
          </DualGatewayPremiumGate>
        ) : (
          contentBlock
        )}
      </div>

      {!isPrivateBlocked && (
        <>
          {/* Mobile Sidebar Drawer */}
          <AnimatePresence>
            {isSidebarOpen && (
              <>
                {/* Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSidebarOpen(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
                />

                {/* Drawer */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => {
                    if (info.offset.x > 100) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-[#121212] shadow-2xl z-[70] lg:hidden overflow-hidden flex flex-col"
                >
                  {/* Drag Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-12 h-1 bg-gray-600 rounded-full" />
                  </div>

                  {/* Close Button */}
                  <div className="flex-shrink-0 bg-[#1E1E1E] border-b border-gray-800 px-4 py-3 flex items-center justify-between">
                    <h2 className="text-white font-semibold text-lg">Thread Details</h2>
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <MobileSidebarContent
                      participants={participants}
                      messages={messages}
                      currentThread={currentThread}
                      isMuted={isMuted}
                      setIsMuted={setIsMuted}
                      messageFilter={messageFilter}
                      isCreator={isCreator}
                      handleRemoveParticipant={handleRemoveParticipant}
                      handleMessageParticipant={handleMessageParticipant}
                      handleLeaveThread={handleLeaveThread}
                      handleDeleteThread={handleDeleteThread}
                      handleUpdateThreadPrivacy={handleUpdateThreadPrivacy}
                      handleInviteParticipant={handleInviteParticipant}
                      handleSetMessageFilter={handleSetMessageFilter}
                      handleLockThread={handleLockThread}
                      handleReportThread={handleReportThread}
                      handleViewReportedMessages={handleViewReportedMessages}
                      isDeleting={deleteThreadMutation.isPending}
                      onlineCount={onlineCount}
                      onJoinThread={handleJoinThread}
                      isJoined={isJoined}
                      joinErrorMessage={joinErrorMessage}
                      isBanned={isBanned}
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Thread Sidebar - Desktop Only */}
          <div className="hidden lg:block lg:w-80 h-screen overflow-y-auto flex-shrink-0 scrollbar-hide">
            <DesktopSidebarContent
              participants={participants}
              messages={messages}
              currentThread={currentThread}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              messageFilter={messageFilter}
              isCreator={isCreator}
              handleRemoveParticipant={handleRemoveParticipant}
              handleMessageParticipant={handleMessageParticipant}
              handleLeaveThread={handleLeaveThread}
              handleDeleteThread={handleDeleteThread}
              handleUpdateThreadPrivacy={handleUpdateThreadPrivacy}
              handleInviteParticipant={handleInviteParticipant}
              handleSetMessageFilter={handleSetMessageFilter}
              handleLockThread={handleLockThread}
              handleReportThread={handleReportThread}
              handleViewReportedMessages={handleViewReportedMessages}
              isDeleting={deleteThreadMutation.isPending}
              onJoinThread={handleJoinThread}
              isJoined={isJoined}
              joinErrorMessage={joinErrorMessage}
              isBanned={isBanned}
            />
          </div>
        </>
      )}

      {showPreviewModal && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-safe-overlay"
          onClick={handleCloseThreadPreview}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-[#151515] text-white shadow-2xl modal-safe-panel overflow-y-auto max-h-[calc(var(--app-viewport-height)-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-gray-400">{preview.category}</p>
                <h3 className="mt-1 text-lg md:text-xl font-semibold text-white break-words">{preview.title}</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseThreadPreview}
                className="rounded-md p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {previewLoading && !previewData ? (
                <div className="py-8 text-center text-sm text-gray-300">Loading preview...</div>
              ) : previewError && !previewData ? (
                <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                  {previewError}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{preview.content}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Messages</p>
                      <p className="text-sm font-semibold">{preview.messageCount}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Participants</p>
                      <p className="text-sm font-semibold">{preview.participantCount}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Likes</p>
                      <p className="text-sm font-semibold">{preview.likes}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Type</p>
                      <p className="text-sm font-semibold">
                        {preview.isPremium ? `Premium${preview.price ? ` $${preview.price.toFixed(2)}` : ''}` : 'Standard'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-100 mb-2">Message Preview</h4>
                    {currentThread.isLocked && (
                      <p className="mb-2 text-xs text-red-300">
                        This thread is blocked due to community reports.
                      </p>
                    )}
                    {preview.messages.length === 0 ? (
                      <p className="text-xs text-gray-400">No messages available yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {preview.messages.map((message) => (
                          <div key={message.id} className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                            <p className="text-[11px] text-gray-400">{message.senderName}</p>
                            <p className="text-sm text-gray-200 break-words">{message.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-5 py-4">
              {previewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              ) : null}
              <button
                type="button"
                onClick={handleCloseThreadPreview}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800/70 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageOptionsModal
        isOpen={showMessageOptions}
        onClose={() => setShowMessageOptions(false)}
        participantName={messageTarget?.name || messageTarget?.anonymousId || 'this user'}
        onSendOneOff={handleSendOneOff}
        onStartConversation={handleStartConversation}
      />

      {isBanned && showRemovedModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm modal-safe-overlay">
          <div className="w-full max-w-md modal-safe-panel bg-[#1E1E1E] border border-red-800 rounded-xl p-6 text-white shadow-2xl overflow-y-auto">
            <h2 className="text-lg font-semibold mb-2">Removed from Thread</h2>
            <p className="text-sm text-gray-300 mb-4">
              You have been removed from this thread by the creator. You can no longer send or receive messages here.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRemovedModal(false)}
                className="flex-1 px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                Okay
              </button>
              <button
                onClick={() => router.push('/threads')}
                className="flex-1 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 transition-colors"
              >
                Leave Thread
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoized Sidebar Content Component to prevent re-renders
const MobileSidebarContent = React.memo((props: any) => {
  const {
    participants, messages, currentThread, isMuted, setIsMuted, messageFilter, isCreator,
    handleRemoveParticipant, handleMessageParticipant, handleLeaveThread, handleDeleteThread,
    handleUpdateThreadPrivacy, handleInviteParticipant, handleSetMessageFilter, handleLockThread,
    handleReportThread, handleViewReportedMessages, isDeleting, onJoinThread, isJoined, joinErrorMessage, isBanned
  } = props;

  const initialData = useMemo(() => ({
    participants: participants.map((p: any) => ({ ...p, messageCount: p.messageCount ?? 0, reportCount: p.reportCount ?? 0 })),
    messages: messages.map((msg: any) => ({
      ...msg,
      sender: {
        id: msg.sender?.id || msg.authorId || '',
        anonymousId: msg.sender?.anonymousId || msg.authorName || '',
        name: msg.sender?.name || msg.authorName || 'Anonymous',
        avatar: '#cccccc',
        status: 'offline',
        messageCount: 0,
        reportCount: 0,
      },
      type: msg.type || 'text',
      threadId: msg.threadId || currentThread.id,
      authorId: msg.authorId || msg.sender?.id || '',
      authorName: msg.authorName || msg.sender?.name || msg.sender?.anonymousId || 'Anonymous',
      likes: msg.likes || 0,
      hasLiked: msg.hasLiked || false,
      replies: msg.replies || [],
      reactions: msg.reactions || {},
    }))
  }), [participants, messages, currentThread.id]);

  const sidebarMessages = useMemo(() => messages.map((msg: any) => {
    const senderForSidebar: Participant = msg.sender || {
      id: msg.authorId || '',
      anonymousId: msg.authorName || '',
      name: msg.authorName || 'Anonymous',
      avatar: '#cccccc',
      status: 'offline',
      messageCount: 0,
      reportCount: 0,
    };
    return {
      ...msg,
      sender: senderForSidebar,
      type: msg.type || 'text',
      threadId: msg.threadId || currentThread.id,
      authorId: msg.authorId || senderForSidebar.id,
      authorName: msg.authorName || senderForSidebar.name,
      likes: msg.likes || 0,
      hasLiked: msg.hasLiked || false,
      replies: msg.replies || [],
      reactions: msg.reactions || {},
    };
  }), [messages, currentThread.id]);

  return (
    <SearchProvider initialData={initialData}>
      <ThreadSidebar
        thread={currentThread}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        participants={participants}
        isCreator={isCreator}
        isMobileDrawer={true}
        messages={sidebarMessages}
        onRemoveParticipant={handleRemoveParticipant}
        onMessageParticipant={handleMessageParticipant}
        onLeaveThread={handleLeaveThread}
        onDeleteThread={handleDeleteThread}
        onUpdateThreadPrivacy={handleUpdateThreadPrivacy}
        onInviteParticipant={handleInviteParticipant}
        onSetMessageFilter={handleSetMessageFilter}
        currentMessageFilter={messageFilter}
        onLockThread={handleLockThread}
        onReportThread={handleReportThread}
        onViewReportedMessages={handleViewReportedMessages}
        isDeleting={isDeleting}
        onJoinThread={onJoinThread}
        isJoined={isJoined}
        joinErrorMessage={joinErrorMessage}
        isBanned={isBanned}
      />
    </SearchProvider>
  );
});

const DesktopSidebarContent = React.memo((props: any) => {
  const {
    participants, messages, currentThread, isMuted, setIsMuted, messageFilter, isCreator,
    handleRemoveParticipant, handleMessageParticipant, handleLeaveThread, handleDeleteThread,
    handleUpdateThreadPrivacy, handleInviteParticipant, handleSetMessageFilter, handleLockThread,
    handleReportThread, handleViewReportedMessages, isDeleting, onJoinThread, isJoined, joinErrorMessage, isBanned
  } = props;

  const initialData = useMemo(() => ({
    participants: participants.map((p: any) => ({ ...p, messageCount: p.messageCount ?? 0, reportCount: p.reportCount ?? 0 })),
    messages: messages.map((msg: any) => ({
      ...msg,
      sender: {
        id: msg.sender?.id || msg.authorId || '',
        anonymousId: msg.sender?.anonymousId || msg.authorName || '',
        name: msg.sender?.name || msg.authorName || 'Anonymous',
        avatar: '#cccccc',
        status: 'offline',
        messageCount: 0,
        reportCount: 0,
      },
      type: msg.type || 'text',
      threadId: msg.threadId || currentThread.id,
      authorId: msg.authorId || msg.sender?.id || '',
      authorName: msg.authorName || msg.sender?.name || msg.sender?.anonymousId || 'Anonymous',
      likes: msg.likes || 0,
      hasLiked: msg.hasLiked || false,
      replies: msg.replies || [],
      reactions: msg.reactions || {},
    }))
  }), [participants, messages, currentThread.id]);

  const sidebarMessages = useMemo(() => messages.map((msg: any) => {
    const senderForSidebar: Participant = msg.sender || {
      id: msg.authorId || '',
      anonymousId: msg.authorName || '',
      name: msg.authorName || 'Anonymous',
      avatar: '#cccccc',
      status: 'offline',
      messageCount: 0,
      reportCount: 0,
    };
    return {
      ...msg,
      sender: senderForSidebar,
      type: msg.type || 'text',
      threadId: msg.threadId || currentThread.id,
      authorId: msg.authorId || senderForSidebar.id,
      authorName: msg.authorName || senderForSidebar.name,
      likes: msg.likes || 0,
      hasLiked: msg.hasLiked || false,
      replies: msg.replies || [],
      reactions: msg.reactions || {},
    };
  }), [messages, currentThread.id]);

  return (
    <SearchProvider initialData={initialData}>
      <ThreadSidebar
        thread={currentThread}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        participants={participants}
        isCreator={isCreator}
        messages={sidebarMessages}
        onRemoveParticipant={handleRemoveParticipant}
        onMessageParticipant={handleMessageParticipant}
        onLeaveThread={handleLeaveThread}
        onDeleteThread={handleDeleteThread}
        onUpdateThreadPrivacy={handleUpdateThreadPrivacy}
        onInviteParticipant={handleInviteParticipant}
        onSetMessageFilter={handleSetMessageFilter}
        currentMessageFilter={messageFilter}
        onLockThread={handleLockThread}
        onReportThread={handleReportThread}
        onViewReportedMessages={handleViewReportedMessages}
        isDeleting={isDeleting}
        onJoinThread={onJoinThread}
        isJoined={isJoined}
        joinErrorMessage={joinErrorMessage}
        isBanned={isBanned}
      />
    </SearchProvider>
  );
});

MobileSidebarContent.displayName = 'MobileSidebarContent';
DesktopSidebarContent.displayName = 'DesktopSidebarContent';

export default ThreadPage;
