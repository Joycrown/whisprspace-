"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  BarChart3,
  Crown,
  Bold,
  Italic,
  List,
  Link2,
  Eye,
  EyeOff,
  Save,
  Send,
  X,
  Plus,
  Minus,
  Hash,
  DollarSign,
  Clock,
} from 'lucide-react';
import { useThreadStore } from '@/store/threadStore';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import {
  ThreadType,
  ThreadCategory,
  CreateThreadForm,
  ThreadDraft,
  THREAD_CATEGORIES,
  THREAD_TYPES,
  CHARACTER_LIMITS,
  ThreadPrivacy,
} from '@/types';
import { FaGlobe, FaEnvelope } from 'react-icons/fa';
import PremiumThreadComposer from './PremiumThreadComposer';
import PremiumPaymentForm from '@/components/features/premium/PremiumPaymentForm';
import SignupPromptModal from '@/components/auth/SignupPromptModal';
import { getUserPollStats } from '@/lib/threads/thread-service';
import { buildThreadPath } from '@/lib/threads/thread-url';

interface ThreadComposerProps {
  isOpen: boolean;
  onClose: () => void;
  draft?: ThreadDraft;
  /** Prefill form fields (e.g. when creating a thread from an inbox conversation). */
  initialForm?: Partial<CreateThreadForm>;
  /**
   * Runs after the thread is created, before navigation. Used by the
   * "turn inbox into thread" flow to import the conversation's messages into the
   * new thread. If it throws, thread creation still succeeded but the caller is
   * informed via toast.
   */
  onCreated?: (threadId: string) => Promise<void> | void;
}

const ThreadComposer: React.FC<ThreadComposerProps> = ({ isOpen, onClose, draft, initialForm, onCreated }) => {
  const { createThread, isLoading, error: storeError } = useThreadStore();
  const { session, canCreateThread } = useUserStore();
  const { showToast } = useToast();
  const router = useRouter();

  // Form state with force update key
  const [updateKey, setUpdateKey] = useState(0);
  const [formData, setFormData] = useState<CreateThreadForm>({
    title: '',
    content: '',
    type: 'text' as ThreadType,
    category: 'general',
    tags: [],
    isPremium: false,
    price: undefined,
    pollOptions: ['', ''],
    pollDuration: 24,
    privacy: 'public' as ThreadPrivacy,
    memberLimit: undefined,
  });

  // UI state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPremiumPayment, setShowPremiumPayment] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [pollStats, setPollStats] = useState<{ weeklyCount: number; activeCount: number } | null>(null);

  // Character counts
  const titleCount = formData.title.length;
  const contentCount = formData.content.length;

  // Load draft on mount
  useEffect(() => {
    if (draft) {
      setFormData({
        title: draft.title,
        content: draft.content,
        type: draft.type,
        category: draft.category || 'general',
        tags: draft.tags,
        isPremium: draft.isPremium,
        price: draft.price,
        pollOptions: draft.pollOptions || ['', ''],
        pollDuration: draft.pollDuration || 24,
        privacy: (draft.privacy || 'public') as ThreadPrivacy,
        memberLimit: draft.memberLimit,
      });
    }
  }, [draft]);

  // Prefill from an external source (e.g. inbox → thread). Merges over defaults
  // so any field not provided keeps its default; validation still applies.
  useEffect(() => {
    if (initialForm) {
      setFormData((prev) => ({ ...prev, ...initialForm }));
    }
  }, [initialForm]);

  // Auto-save functionality
  const autoSave = useCallback(() => {
    if (hasUnsavedChanges && formData.title.trim()) {
      // Mock auto-save to localStorage
      const draftData: ThreadDraft = {
        id: draft?.id || `draft_${Date.now()}`,
        ...formData,
        lastSaved: new Date().toISOString(),
        autoSaveEnabled: true,
      };

      localStorage.setItem('thread_draft', JSON.stringify(draftData));
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    }
  }, [formData, hasUnsavedChanges, draft?.id]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [autoSave]);

  // Mark as changed when form data updates
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [formData]);

  useEffect(() => {
    const userId = session.user?.id;
    if (!userId || formData.type !== 'poll') return;

    let isActive = true;
    getUserPollStats(userId).then((stats) => {
      if (isActive) {
        setPollStats(stats);
      }
    });

    return () => {
      isActive = false;
    };
  }, [formData.type, session.user?.id]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > CHARACTER_LIMITS.title) {
      newErrors.title = `Title must be under ${CHARACTER_LIMITS.title} characters`;
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    } else if (formData.content.length > CHARACTER_LIMITS.content) {
      newErrors.content = `Content must be under ${CHARACTER_LIMITS.content} characters`;
    }

    if (formData.type === 'poll') {
      const validOptions = formData.pollOptions?.filter(opt => opt.trim()) || [];
      if (validOptions.length < 2) {
        newErrors.pollOptions = 'Polls must have at least 2 options';
      }
    }

    if (formData.isPremium && (!formData.price || formData.price <= 0)) {
      newErrors.price = 'Premium threads must have a valid price';
    }

    if (formData.type === 'poll' && (!formData.pollDuration || formData.pollDuration <= 0)) {
      newErrors.pollDuration = 'Poll duration is required and must be a positive number';
    }

    // Only validate memberLimit if privacy is 'invite_only'
    if (formData.privacy === 'invite_only') {
      if (!formData.memberLimit || formData.memberLimit <= 0) {
        newErrors.memberLimit = 'Member limit is required and must be a positive number for invite-only threads';
      } else if (formData.memberLimit > 1000) { // Example max limit
        newErrors.memberLimit = 'Member limit cannot exceed 1000';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Check if user can create threads (must be authenticated, not just anonymous)
    if (!canCreateThread()) {
      setShowSignupPrompt(true);
      showToast({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Please sign up or log in to create threads',
      });
      return;
    }

    if (!validateForm()) {
      showToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix the errors before submitting',
      });
      return;
    }

    try {
      const threadId = await createThread(formData);

      if (threadId) {
        // Clear draft
        localStorage.removeItem('thread_draft');

        // Post-create hook (e.g. import inbox messages into the new thread).
        // A failure here doesn't undo the thread — surface it but still proceed.
        if (onCreated) {
          try {
            await onCreated(threadId);
          } catch (hookErr) {
            console.error('ThreadComposer onCreated hook failed:', hookErr);
            showToast({
              type: 'warning',
              title: 'Thread created',
              message: 'The thread was created, but importing the messages failed.',
            });
          }
        }

        // Show success message
        showToast({
          type: 'success',
          title: 'Thread Created!',
          message: 'Your thread has been published successfully',
        });

        // Reset form
        setFormData({
          title: '',
          content: '',
          type: 'text',
          category: 'general',
          tags: [],
          isPremium: false,
          price: undefined,
          pollOptions: ['', ''],
          pollDuration: 24,
          privacy: 'public' as ThreadPrivacy,
          memberLimit: undefined,
        });

        // Signal MainLayout's PostThreadNudge to appear — fires before the router push
        // so both components are still mounted and can receive the event.
        window.dispatchEvent(new CustomEvent('whisprspace:inbox-nudge'))

        // Navigate to the new thread or threads list
        setTimeout(() => {
          router.push(buildThreadPath({ id: threadId, title: formData.title }));
        }, 500);
      } else {
        throw new Error(storeError || 'Failed to create thread');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      const isBlocked = msg === 'CONTENT_BLOCKED'
      showToast({
        type: 'error',
        title: isBlocked ? 'Hold on.' : 'Creation Failed',
        message: isBlocked
          ? 'This space is built on honest expression — not harm. Please rephrase and try again.'
          : msg || 'Failed to create thread. Please try again.',
      });
    }
  };

  // Handle tag addition
  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim()) && formData.tags.length < 5) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  // Handle tag removal
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Handle poll option changes
  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...(formData.pollOptions || [])];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, pollOptions: newOptions }));
  };

  const addPollOption = () => {
    if ((formData.pollOptions?.length || 0) < 6) {
      setFormData(prev => ({
        ...prev,
        pollOptions: [...(prev.pollOptions || []), '']
      }));
    }
  };

  const removePollOption = (index: number) => {
    if ((formData.pollOptions?.length || 0) > 2) {
      setFormData(prev => ({
        ...prev,
        pollOptions: prev.pollOptions?.filter((_, i) => i !== index) || []
      }));
    }
  };

  // Text formatting functions
  const formatText = (format: 'bold' | 'italic' | 'list' | 'link') => {
    // Simple text formatting - in a real app, you'd use a proper rich text editor
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);

    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText || 'italic text'}*`;
        break;
      case 'list':
        formattedText = `\n- ${selectedText || 'list item'}`;
        break;
      case 'link':
        formattedText = `[${selectedText || 'link text'}](url)`;
        break;
    }

    const newContent = formData.content.substring(0, start) + formattedText + formData.content.substring(end);
    setFormData(prev => ({ ...prev, content: newContent }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-none sm:rounded-xl shadow-2xl w-full max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[calc(var(--app-viewport-height)-2rem)] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Type className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Create Thread</h2>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                  {lastSaved ? `Last saved ${lastSaved.toLocaleTimeString()}` : 'Not saved'}
                  {hasUnsavedChanges && <span className="text-orange-500 ml-1">• Unsaved changes</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {isPreviewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {isPreviewMode ? 'Edit' : 'Preview'}
              </button>

              <button
                onClick={autoSave}
                disabled={!hasUnsavedChanges}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span className="hidden md:inline">Save Draft</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!isPreviewMode ? (
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Thread Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2 sm:mb-3">Thread Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {THREAD_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          const newType = type.value as ThreadType;
                          setFormData(prev => {
                            const newFormData: CreateThreadForm = {
                              ...prev,
                              type: newType,
                              pollOptions: newType === 'poll' ? ['', ''] : undefined,
                              isPremium: newType === 'premium',
                              price: newType === 'premium' ? (prev.price || 1.99) : undefined,
                              privacy: 'public' as ThreadPrivacy,
                              memberLimit: undefined,
                            };
                            return newFormData;
                          });
                          setErrors({});
                          setUpdateKey(prev => {
                            const newKey = prev + 1;
                            return newKey;
                          });
                        }}
                        className={`p-3 sm:p-4 rounded-lg border-2 transition-all text-left hover:shadow-md cursor-pointer ${formData.type === type.value
                            ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          {type.value === 'text' && (
                            <Type className={`w-4 h-4 sm:w-5 sm:h-5 ${formData.type === type.value ? 'text-purple-600' : 'text-gray-700'
                              }`} />
                          )}
                          {type.value === 'poll' && (
                            <BarChart3 className={`w-4 h-4 sm:w-5 sm:h-5 ${formData.type === type.value ? 'text-purple-600' : 'text-gray-700'
                              }`} />
                          )}
                          {type.value === 'premium' && (
                            <Crown className={`w-4 h-4 sm:w-5 sm:h-5 ${formData.type === type.value ? 'text-purple-600' : 'text-gray-700'
                              }`} />
                          )}
                          <span className={`text-sm sm:text-base font-medium ${formData.type === type.value ? 'text-purple-900' : 'text-gray-900'
                            }`}>
                            {type.label}
                          </span>
                        </div>
                        <p className={`text-xs sm:text-sm ${formData.type === type.value ? 'text-purple-700' : 'text-gray-600'
                          }`}>
                          {type.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Title
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    maxLength={CHARACTER_LIMITS.title}
                    placeholder="What's on your mind?"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white placeholder-gray-500 ${errors.title ? 'border-red-500' : 'border-gray-300'
                      }`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
                    <p className={`text-sm ml-auto ${titleCount > CHARACTER_LIMITS.title * 0.9 ? 'text-red-500' : 'text-gray-500'
                      }`}>
                      {titleCount}/{CHARACTER_LIMITS.title}
                    </p>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ThreadCategory }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                  >
                    {THREAD_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.icon} {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Privacy Settings - Hidden for premium threads (payment is access control) */}
                {formData.type !== 'premium' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Thread Privacy</label>
                      <div className="mt-1 space-y-2">
                        <label className="flex items-center p-3 rounded-md bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100">
                          <input
                            type="radio"
                            name="privacy"
                            value="public"
                            checked={formData.privacy === 'public'}
                            onChange={() => setFormData(prev => ({ ...prev, privacy: 'public' as ThreadPrivacy, memberLimit: undefined }))}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 flex-shrink-0"
                          />
                          <FaGlobe className="ml-2 sm:ml-3 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 ml-2">
                            <span className="block text-gray-900 font-medium">Public</span>
                            <p className="text-xs sm:text-sm text-gray-500">Anyone can view and join</p>
                          </div>
                        </label>
                        <label className="flex items-center p-3 rounded-md bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100">
                          <input
                            type="radio"
                            name="privacy"
                            value="invite_only"
                            checked={formData.privacy === 'invite_only'}
                            onChange={() => setFormData(prev => ({ ...prev, privacy: 'invite_only' as ThreadPrivacy, memberLimit: (prev.memberLimit || 10) }))}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 flex-shrink-0"
                          />
                          <FaEnvelope className="ml-2 sm:ml-3 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 ml-2">
                            <span className="block text-gray-900 font-medium">Invite Only</span>
                            <p className="text-xs sm:text-sm text-gray-500">Requires invitation to join</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Member Limit for Invite-Only Threads */}
                    {formData.privacy === 'invite_only' && (
                      <div>
                        <label htmlFor="memberLimit" className="block text-sm font-medium text-gray-900 mb-2">Member Limit</label>
                        <input
                          type="number"
                          id="memberLimit"
                          value={formData.memberLimit || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, memberLimit: parseInt(e.target.value) || undefined }))}
                          min={1}
                          placeholder="e.g., 50"
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white placeholder-gray-500 ${errors.memberLimit ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {errors.memberLimit && <p className="text-sm text-red-500 mt-1">{errors.memberLimit}</p>}
                      </div>
                    )}
                  </>
                )}

                {/* Premium Thread Access Info */}
                {formData.type === 'premium' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">Premium Thread Access</h4>
                        <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">
                          Users must pay <strong>${formData.price?.toFixed(2) || '0.00'}</strong> to access this thread. As the creator, you can also generate invite codes to grant free access to collaborators.
                        </p>
                        <p className="text-xs text-gray-600">
                          💡 Invite codes will be available after thread creation to share with your team or special guests.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Type-specific content sections */}
                <div key={`type-content-${formData.type}-${updateKey}`}>
                  {formData.type === 'poll' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-medium text-blue-800">Poll Options</h3>
                      </div>
                      {session.user && !session.user.isPremium && (
                        <div className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                          <div>Free users can create up to 2 polls per week and keep only 2 active at a time.</div>
                          {pollStats && (
                            <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-semibold text-yellow-900">
                              <span>Polls this week: {pollStats.weeklyCount}/2</span>
                              <span>Active polls: {pollStats.activeCount}/2</span>
                            </div>
                          )}
                          <div className="mt-1">Upgrade to Premium for unlimited polls.</div>
                        </div>
                      )}
                      <p className="text-sm text-blue-700 mb-3">
                        Add options for users to vote on. You can have 2-6 options.
                      </p>

                      {/* Poll Duration */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-blue-800 mb-2">Poll Duration</label>
                        <div className="relative">
                          <select
                            value={formData.pollDuration}
                            onChange={(e) => setFormData(prev => ({ ...prev, pollDuration: parseInt(e.target.value) }))}
                            className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white pr-10"
                          >
                            <option value={1}>1 Hour</option>
                            <option value={6}>6 Hours</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>1 Day</option>
                            <option value={72}>3 Days</option>
                            <option value={168}>7 Days</option>
                          </select>
                          <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 pointer-events-none" />
                        </div>
                        {errors.pollDuration && <p className="text-sm text-red-500 mt-1">{errors.pollDuration}</p>}
                      </div>

                      {/* Poll Options */}
                      <div className="space-y-2 mb-4">
                        {formData.pollOptions?.map((option, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updatePollOption(index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                              className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:focus:ring-blue-500 placeholder-gray-500
                              ${errors.pollOptions && !option.trim() ? 'border-red-500' : 'border-blue-300'}`}
                            />
                            {(formData.pollOptions?.length || 0) > 2 && (
                              <button
                                type="button"
                                onClick={() => removePollOption(index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}

                        {(formData.pollOptions?.length || 0) < 6 && (
                          <button
                            type="button"
                            onClick={addPollOption}
                            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add Option
                          </button>
                        )}
                      </div>
                      {errors.pollOptions && <p className="text-sm text-red-500 mt-1">{errors.pollOptions}</p>}
                    </div>
                  )}

                  {formData.type === 'premium' && session.user && (
                    <PremiumThreadComposer
                      user={session.user}
                      onPriceChange={(price) => {
                        setFormData(prev => ({ ...prev, price }));
                        setHasUnsavedChanges(true);
                      }}
                      onUpgrade={() => {
                        // Open premium payment modal
                        setShowPremiumPayment(true);
                      }}
                    />
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        <Hash className="w-3 h-3" />
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-purple-500 hover:text-purple-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {formData.tags.length < 5 && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add a tag..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                      />
                      <button
                        onClick={addTag}
                        disabled={!currentTag.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                {/* Content Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-900">
                      Content
                      <span className="text-red-500 ml-1">*</span>
                    </label>

                    {/* Formatting Toolbar */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => formatText('bold')}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="Bold"
                      >
                        <Bold className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => formatText('italic')}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="Italic"
                      >
                        <Italic className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => formatText('list')}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="List"
                      >
                        <List className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => formatText('link')}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="Link"
                      >
                        <Link2 className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    name="content"
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    maxLength={CHARACTER_LIMITS.content}
                    placeholder="Share your thoughts..."
                    rows={8}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-gray-900 bg-white ${errors.content ? 'border-red-500' : 'border-gray-300'
                      }`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {errors.content && <p className="text-sm text-red-500">{errors.content}</p>}
                    <p className={`text-sm ml-auto ${contentCount > CHARACTER_LIMITS.content * 0.9 ? 'text-red-500' : 'text-gray-500'
                      }`}>
                      {contentCount}/{CHARACTER_LIMITS.content}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Preview Mode */
              <div className="p-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                      {THREAD_CATEGORIES.find(c => c.value === formData.category)?.icon} {formData.category}
                    </span>
                    {formData.isPremium && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        <Crown className="w-3 h-3 inline mr-1" />
                        Premium ${formData.price}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{formData.title || 'Untitled'}</h3>

                  <div className="prose prose-sm max-w-none text-gray-700 mb-4">
                    {formData.content.split('\n').map((line, index) => (
                      <p key={index} className="mb-2">
                        {line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-purple-600 hover:underline">$1</a>')}
                      </p>
                    ))}
                  </div>

                  {formData.type === 'poll' && formData.pollOptions && (
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
                        <Clock className="w-4 h-4" />
                        <span>Poll ends in {formData.pollDuration} {formData.pollDuration === 1 ? 'hour' : 'hours'}</span>
                      </div>
                      <h4 className="text-md font-semibold text-blue-800 mb-2">Poll Options:</h4>
                      {formData.pollOptions.filter(opt => opt.trim()).map((option, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-white rounded border border-blue-200">
                          <div className="w-4 h-4 border-2 border-blue-300 rounded-full flex-shrink-0"></div>
                          <span className="text-blue-800 font-medium">{option}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {formData.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-6 border-t border-gray-200 gap-3 sm:gap-0 flex-shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6 bg-white">
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Auto-saves every 30 seconds</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg sm:border-0"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={isLoading || !formData.title.trim() || !formData.content.trim()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 sm:py-2 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isLoading ? 'Creating...' : 'Create Thread'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Premium Payment Modal */}
      {showPremiumPayment && (
        <PremiumPaymentForm
          plan="monthly"
          onSuccess={() => {
            setShowPremiumPayment(false);
            // You can add logic here to update user premium status
            if (session.user) {
              session.user.isPremium = true;
            }
          }}
          onCancel={() => setShowPremiumPayment(false)}
        />
      )}

      {/* Signup Prompt Modal */}
      <SignupPromptModal
        isOpen={showSignupPrompt}
        onClose={() => setShowSignupPrompt(false)}
      />
    </AnimatePresence>
  );
};

export default ThreadComposer;
