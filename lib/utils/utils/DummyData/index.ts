/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Comprehensive dummy data for development and testing
// This file contains realistic mock data to simulate API responses

import { 
  User, 
  Thread, 
  Message, 
  Group, 
  Notification, 
  Poll,
  ThreadType,
  ThreadCategory,
  GroupPrivacy,
  AnonymousMessage,
  Attachment,
  Participant
} from '../types';

// Mock Users with diverse profiles
const mockUsers: User[] = [
  {
    id: 'user_1',
    anonymousId: 'AnonymousWhisper123',
    isAnonymous: true,
    points: 1250,
    level: 3,
    joinedAt: '2024-01-15T10:30:00Z',
    lastActiveAt: '2024-01-20T14:22:00Z',
    preferences: {
      theme: 'dark',
      notifications: {
        email: false,
        push: true,
        inApp: true,
        likes: true,
        replies: true,
        mentions: true,
        groupInvites: true
      },
      privacy: {
        showOnlineStatus: false,
        allowDirectMessages: true
      }
    }
  },
  {
    id: 'user_2',
    anonymousId: 'MysteriousVoice456',
    isAnonymous: true,
    points: 890,
    level: 2,
    joinedAt: '2024-01-18T09:15:00Z',
    lastActiveAt: '2024-01-20T16:45:00Z',
    preferences: {
      theme: 'light',
      notifications: {
        email: false,
        push: true,
        inApp: true,
        likes: true,
        replies: true,
        mentions: true,
        groupInvites: true
      },
      privacy: {
        showOnlineStatus: false,
        allowDirectMessages: false
      }
    }
  },
  {
    id: 'user_3',
    anonymousId: 'SilentThought789',
    isAnonymous: true,
    points: 2340,
    level: 4,
    joinedAt: '2024-01-10T14:20:00Z',
    lastActiveAt: '2024-01-20T18:30:00Z',
    preferences: {
      theme: 'system',
      notifications: {
        email: false,
        push: false,
        inApp: true,
        likes: true,
        replies: true,
        mentions: true,
        groupInvites: true
      },
      privacy: {
        showOnlineStatus: true,
        allowDirectMessages: true
      }
    }
  },
  {
    id: 'user_4',
    anonymousId: 'HiddenSoul101',
    isAnonymous: true,
    points: 567,
    level: 2,
    joinedAt: '2024-01-12T11:45:00Z',
    lastActiveAt: '2024-01-20T20:15:00Z',
    preferences: {
      theme: 'dark',
      notifications: {
        email: false,
        push: true,
        inApp: true,
        likes: true,
        replies: true,
        mentions: true,
        groupInvites: true
      },
      privacy: {
        showOnlineStatus: false,
        allowDirectMessages: false
      }
    }
  }
];

// Legacy participants for backward compatibility
export const dummyParticipants: Participant[] = [
  {
    id: '1',
    anonymousId: 'AnonymousWhisper123',
    name: 'AnonymousWhisper123',
    avatar: '#9333EA',
    status: 'online',
    isPremium: true
  },
  {
    id: '2',
    anonymousId: 'MysteriousVoice456',
    name: 'MysteriousVoice456',
    avatar: '#EA580C',
    status: 'offline'
  },
  {
    id: '3',
    anonymousId: 'SilentThought789',
    name: 'SilentThought789',
    avatar: '#16A34A',
    status: 'online'
  },
  {
    id: '4',
    anonymousId: 'HiddenSoul101',
    name: 'HiddenSoul101',
    avatar: '#F59E0B',
    status: 'offline'
  }
];

// Mock Attachments
const mockAttachments: Attachment[] = [
  {
    type: 'file',
    url: '/assets/dessert.jpg',
    fileName: 'Mental Health Resources.pdf',
    fileType: 'document',
    size: 2048576 // 2MB
  },
  {
    type: 'voice',
    url: '/mock-audio/voice-note.mp3',
    duration: 45
  },
  {
    type: 'link',
    url: 'https://example.com/article',
    title: 'Understanding Anxiety: A Comprehensive Guide',
    description: 'An in-depth look at anxiety disorders and coping mechanisms.',
    thumbnail: '/assets/burger.jpg'
  }
];

// Mock Threads with diverse content
const mockThreadsData: Thread[] = [
  {
    id: 'thread_1',
    title: 'What\'s your biggest fear that you\'ve never told anyone?',
    content: 'I\'ve been thinking about this lately. We all have those deep, dark fears that we keep to ourselves. Mine is the fear of being truly alone - not just physically, but emotionally. Sometimes I wonder if anyone would really miss me if I just disappeared. What about you? What\'s that one fear you\'ve never shared?',
    type: 'text',
    category: 'general',
    author: {
      id: 'user_1',
      anonymousId: 'AnonymousWhisper123',
      name: 'AnonymousWhisper123',
      avatar: '#9333EA',
    },
    createdAt: '2024-01-20T10:30:00Z',
    updatedAt: '2024-01-20T10:30:00Z',
    likes: 234,
    messageCount: 89,
    isLiked: false,
    tags: ['fear', 'personal', 'deep-thoughts', 'vulnerability'],
    groupId: null,
    isPinned: false,
    isLocked: false,
    latestMessage: 'The increasing importance of end-to-end encryption...',
    timeRemaining: '24h',
    isPremium: false,
    hasLiked: false,
    rating: 4.2,
    ratingCount: 150,
    participantCount: 89,
    participants: [
      dummyParticipants[0], 
      dummyParticipants[1],
      dummyParticipants[2]
    ] // Add participants
  },
  {
    id: 'thread_2',
    title: 'Should we normalize mental health days at work?',
    content: 'I\'ve been struggling with burnout lately and took a mental health day. My manager was understanding, but I could tell some colleagues were skeptical. Do you think we should treat mental health days the same as sick days?',
    type: 'poll',
    category: 'business',
    author: {
      id: 'user_2',
      anonymousId: 'MysteriousVoice456',
      name: 'MysteriousVoice456',
      avatar: '#EA580C',
    },
    createdAt: '2024-01-20T08:15:00Z',
    updatedAt: '2024-01-20T08:15:00Z',
    likes: 456,
    messageCount: 127,
    isLiked: true,
    tags: ['mental-health', 'work', 'burnout', 'workplace-culture'],
    groupId: null,
    isPinned: true,
    isLocked: false,
    poll: {
        id: 'poll_1',
        question: 'Should we normalize mental health days at work?',
        options: [
          { id: 'opt_1', text: 'Absolutely, mental health is as important as physical health', voteCount: 342, percentage: 58.2 },
          { id: 'opt_2', text: 'Yes, but with some limitations and guidelines', voteCount: 156, percentage: 26.5 },
          { id: 'opt_3', text: 'No, it could be abused by employees', voteCount: 23, percentage: 3.9 },
          { id: 'opt_4', text: 'Unsure, need more information', voteCount: 67, percentage: 11.4 }
        ],
        totalVotes: 588,
        userVote: ['opt_1'],
        allowMultipleVotes: false,
        expiresAt: '2024-01-27T08:15:00Z',
        createdBy: 'user_2'
      },
    rating: 3.9,
    ratingCount: 300,
    participantCount: 127,
    participants: [
      dummyParticipants[0],
      dummyParticipants[1],
      dummyParticipants[2],
      dummyParticipants[3]
    ] // Add participants
  },
  {
    id: 'thread_3',
    title: 'Anyone else feel like they\'re just pretending to be an adult?',
    content: 'I\'m 28 and I still feel like I\'m playing dress-up when I go to work meetings or handle "adult" responsibilities. Does this feeling ever go away? Sometimes I look around and wonder if everyone else has it figured out or if we\'re all just winging it.',
    type: 'text',
    category: 'lifestyle',
    author: {
      id: 'user_3',
      anonymousId: 'SilentThought789',
      name: 'SilentThought789',
      avatar: '#16A34A',
    },
    createdAt: '2024-01-19T15:45:00Z',
    updatedAt: '2024-01-19T15:45:00Z',
    likes: 189,
    messageCount: 76,
    isLiked: false,
    tags: ['adulting', 'imposter-syndrome', 'life', 'growing-up'],
    groupId: 'group_1',
    isPinned: false,
    isLocked: false,
    latestMessage: 'A comprehensive guide to choosing and using...',
    timeRemaining: '18h',
    isPremium: false,
    hasLiked: true,
    rating: 4.8,
    ratingCount: 200,
    participantCount: 76,
    participants: [
      dummyParticipants[1],
      dummyParticipants[3]
    ] // Add participants
  },
  {
    id: 'thread_4',
    title: 'What\'s the most beautiful thing that happened to you this week?',
    content: 'In a world full of negativity, let\'s share some light. Mine was seeing an elderly couple holding hands while walking slowly down the street. It reminded me that love can last a lifetime.',
    type: 'text',
    category: 'general',
    author: {
      id: 'user_4',
      anonymousId: 'HiddenSoul101',
      name: 'HiddenSoul101',
      avatar: '#F59E0B',
    },
    createdAt: '2024-01-19T12:20:00Z',
    updatedAt: '2024-01-19T12:20:00Z',
    likes: 312,
    messageCount: 145,
    isLiked: true,
    tags: ['positivity', 'beautiful-moments', 'gratitude', 'love'],
    groupId: null,
    isPinned: false,
    isLocked: false,
    latestMessage: 'A comprehensive guide to choosing and using...',
    timeRemaining: '10h',
    isPremium: false,
    hasLiked: false,
    rating: 4.1,
    ratingCount: 180,
    participantCount: 145,
    participants: [
      dummyParticipants[0],
      dummyParticipants[2],
      dummyParticipants[3]
    ] // Add participants
  },
  {
    id: 'thread_5',
    title: 'How do you deal with toxic family members?',
    content: 'I love my family, but some members are incredibly toxic and draining. Setting boundaries feels impossible because of guilt and family pressure. How do you protect your mental health while maintaining family relationships?',
    type: 'text',
    category: 'lifestyle',
    author: {
      id: 'user_1',
      anonymousId: 'AnonymousWhisper123',
      name: 'AnonymousWhisper123',
      avatar: '#9333EA',
    },
    createdAt: '2024-01-18T20:30:00Z',
    updatedAt: '2024-01-18T20:30:00Z',
    likes: 278,
    messageCount: 98,
    isLiked: false,
    tags: ['family', 'toxic-relationships', 'boundaries', 'mental-health'],
    groupId: 'group_1',
    isPinned: false,
    isLocked: false,
    latestMessage: 'A comprehensive guide to choosing and using...',
    timeRemaining: '6h',
    isPremium: false,
    hasLiked: true,
    rating: 4.4,
    ratingCount: 190,
    participantCount: 98,
    participants: [
      dummyParticipants[0],
      dummyParticipants[1]
    ] // Add participants
  },
  {
    id: 'thread_6',
    title: 'Exclusive Insights on AI Ethics (Invite Only)',
    content: 'A private discussion group for researchers and professionals to explore the ethical implications and responsible development of artificial intelligence. Strict moderation and curated membership.',
    type: 'text',
    category: 'tech',
    author: {
      id: 'user_1',
      anonymousId: 'AnonymousWhisper123',
      name: 'AnonymousWhisper123',
      avatar: '#9333EA',
    },
    createdAt: '2024-01-22T09:00:00Z',
    updatedAt: '2024-01-22T09:00:00Z',
    likes: 55,
    messageCount: 20,
    hasLiked: false,
    tags: ['AI', 'ethics', 'research', 'private'],
    groupId: 'group_private_ai',
    isPinned: true,
    isLocked: false, // Default to unlocked
    privacy: 'invite-only',
    memberLimit: 10,
    latestMessage: 'Discussing the latest frameworks...',
    timeRemaining: undefined,
    isPremium: false,
        rating: 4.9,
    ratingCount: 30,
    participantCount: 5,
    participants: [
      { ...mockUsers[0], name: 'AI_Creator', id: 'creator_ai' }, // Creator
      { ...mockUsers[1], name: 'AI_Researcher', messageCount: 5 },
      { ...mockUsers[2], name: 'Ethicist_Pro', reportCount: 1 },
      { id: 'new_member_1', anonymousId: 'NewAIEnthusiast', name: 'New AI Enthusiast', avatar: '#FFD700', status: 'online', messageCount: 2 },
      { id: 'new_member_2', anonymousId: 'Observer', name: 'Observer', avatar: '#A020F0', status: 'offline' }
    ],
    createdBy: { ...mockUsers[0], name: 'AI_Creator', id: 'creator_ai' },
    reportCount: 0,
  },
  {
    id: 'thread_7',
    title: 'Locked Discussion on Quantum Computing',
    content: 'This thread is currently locked for new messages, but you can still view the existing discussion. For advanced users only. Moderated by QuantumAdmin.',
    type: 'text',
    category: 'tech',
    author: {
      id: 'user_2',
      anonymousId: 'MysteriousVoice456',
      name: 'QuantumAdmin',
      avatar: '#EA580C',
    },
    createdAt: '2024-01-15T14:00:00Z',
    updatedAt: '2024-01-22T10:00:00Z',
    likes: 180,
    messageCount: 75,
    hasLiked: true,
    tags: ['quantum', 'computing', 'advanced', 'locked'],
    groupId: null,
    isPinned: false,
    isLocked: true, // This thread is locked
    privacy: 'public',
    memberLimit: undefined,
    latestMessage: 'Quantum entanglement challenges...',
    timeRemaining: undefined,
    isPremium: false,
    rating: 4.7,
    ratingCount: 100,
    participantCount: 75,
    participants: [
      { ...mockUsers[1], name: 'QuantumAdmin' },
      { ...mockUsers[0], name: 'QResearcher' },
      { ...mockUsers[3], name: 'QStudent' }
    ],
    createdBy: { ...mockUsers[1], name: 'QuantumAdmin' },
    reportCount: 2,
  }
];

// Legacy thread format for backward compatibility
export const DUMMY_THREADS: any[] = [
  {
    id: '1',
    author: {
      id: 'user_1',
      anonymousId: 'AnonymousWhisper123',
      name: 'AnonymousWhisper123',
      avatar: '#9333EA'
    },
    title: 'Thoughts on digital privacy in 2024',
    content: 'The increasing importance of end-to-end encryption in our daily communications...',
    type: 'text',
    category: 'tech',
    createdAt: '2024-01-18T10:00:00Z',
    updatedAt: '2024-01-18T10:00:00Z',
    likes: 156,
    messageCount: 86,
    isLiked: false,
    tags: ['privacy', 'encryption', 'tech'],
    groupId: null,
    isPinned: false,
    isLocked: false,
    rating: 4.5,
    ratingCount: 100,
    participantCount: 86
  },
  {
    id: '2',
    author: {
      id: 'user_2',
      anonymousId: 'PrivacyAdvocate456',
      name: 'Privacy Advocate',
      avatar: '#EA580C'
    },
    title: 'Best practices for secure messaging',
    content: 'A comprehensive guide to choosing and using encrypted messaging apps...',
    type: 'text',
    category: 'tech',
    createdAt: '2024-01-19T15:30:00Z',
    updatedAt: '2024-01-19T15:30:00Z',
    likes: 98,
    messageCount: 45,
    isLiked: true,
    tags: ['security', 'messaging', 'guide'],
    groupId: null,
    isPinned: false,
    isLocked: false,
    rating: 4.0,
    ratingCount: 70,
    participantCount: 45
  },
  {
    id: '3',
    author: {
      id: 'user_3',
      anonymousId: 'TechExplorer789',
      name: 'Tech Explorer',
      avatar: '#16A34A'
    },
    title: 'The future of decentralized communications',
    content: 'Exploring the potential of blockchain-based messaging systems...',
    type: 'text',
    category: 'tech',
    createdAt: '2024-01-20T09:15:00Z',
    updatedAt: '2024-01-20T09:15:00Z',
    likes: 234,
    messageCount: 112,
    isLiked: false,
    tags: ['blockchain', 'decentralization', 'future'],
    groupId: null,
    isPinned: true,
    isLocked: false,
    latestMessage: 'Exploring the potential of blockchain-based...',
    timeRemaining: '12h',
    isPremium: false,
    hasLiked: false,
    rating: 4.7,
    ratingCount: 130,
    participantCount: 112
  }
];

// Mock Messages with realistic conversations
const mockMessagesData: Message[] = [
  {
    id: 'msg_1',
    threadId: 'thread_1',
    sender: {
      id: 'user_2',
      anonymousId: 'MysteriousVoice456',
      name: 'MysteriousVoice456',
      avatar: '#EA580C',
      status: 'online'
    },
    content: 'I can really relate to this. My biggest fear is probably failure - not just failing at something, but being seen as a failure by people I care about. The fear of disappointing others paralyzes me sometimes.',
    timestamp: '2024-01-20T11:15:00Z',
    type: 'text'
  },
  {
    id: 'msg_2',
    threadId: 'thread_1',
    sender: {
      id: 'user_1',
      anonymousId: 'AnonymousWhisper123',
      name: 'AnonymousWhisper123',
      avatar: '#9333EA',
      status: 'online'
    },
    content: 'That\'s really brave of you to share. I think a lot of us struggle with that fear of judgment. You\'re definitely not alone in feeling this way.',
    timestamp: '2024-01-20T11:30:00Z',
    type: 'text',
    replyTo: 'msg_1'
  },
  {
    id: 'msg_3',
    threadId: 'thread_1',
    sender: {
      id: 'user_3',
      anonymousId: 'SilentThought789',
      name: 'SilentThought789',
      avatar: '#16A34A',
      status: 'online'
    },
    content: 'Same here. I\'ve realized that most people are too busy worrying about their own lives to judge us as harshly as we think they do.',
    timestamp: '2024-01-20T12:00:00Z',
    type: 'text',
    replyTo: 'msg_1'
  },
  {
    id: 'msg_4',
    threadId: 'thread_2',
    sender: {
      id: 'user_1',
      anonymousId: 'AnonymousWhisper123',
      name: 'AnonymousWhisper123',
      avatar: '#9333EA',
      status: 'online'
    },
    content: 'I completely agree! Mental health is just as important as physical health. Taking a day to recharge can actually make us more productive.',
    timestamp: '2024-01-20T12:30:00Z',
    type: 'text'
  },
  {
    id: 'msg_5',
    threadId: 'thread_2',
    sender: {
      id: 'user_2',
      anonymousId: 'MysteriousVoice456',
      name: 'MysteriousVoice456',
      avatar: '#EA580C',
      status: 'online'
    },
    content: 'It\'s a cultural shift that needs to happen. The stigma around mental health is still too strong, especially in the workplace.',
    timestamp: '2024-01-20T12:45:00Z',
    type: 'text',
    replyTo: 'msg_4'
  },
  {
    id: 'msg_6',
    threadId: 'thread_2',
    sender: {
      id: 'user_4',
      anonymousId: 'HiddenSoul101',
      name: 'HiddenSoul101',
      avatar: '#F59E0B',
      status: 'online'
    },
    content: 'My company offers unlimited mental health days, and it has made a huge positive impact on employee morale and retention. It really shows they care.',
    timestamp: '2024-01-20T13:00:00Z',
    type: 'text',
    replyTo: 'msg_5'
  },
  {
    id: 'msg_7',
    threadId: 'thread_6',
    sender: { ...mockUsers[0], name: 'AI_Creator', id: 'creator_ai' },
    content: 'Welcome to our invite-only discussion on AI Ethics! Please introduce yourselves and share your current research interests.',
    timestamp: '2024-01-22T09:10:00Z',
    type: 'text',
    isReported: false,
  },
  {
    id: 'msg_8',
    threadId: 'thread_6',
    sender: { ...mockUsers[1], name: 'AI_Researcher' },
    content: 'I\'m focused on explainable AI and mitigating bias in machine learning models. Eager to learn from everyone here!',
    timestamp: '2024-01-22T09:20:00Z',
    type: 'text',
    isReported: false,
  },
  {
    id: 'msg_9',
    threadId: 'thread_6',
    sender: { ...mockUsers[2], name: 'Ethicist_Pro' },
    content: 'There are serious concerns about the weaponization of AI and autonomous systems. We must establish clear international regulations.',
    timestamp: '2024-01-22T09:35:00Z',
    type: 'text',
    isReported: true, // This message is reported
  },
  {
    id: 'msg_10',
    threadId: 'thread_6',
    sender: { id: 'new_member_1', anonymousId: 'NewAIEnthusiast', name: 'New AI Enthusiast', avatar: '#FFD700', status: 'online' },
    content: 'Has anyone read the latest paper on differential privacy and its applications in large language models? Very insightful.',
    timestamp: '2024-01-22T09:50:00Z',
    type: 'text',
    isReported: false,
  },
  {
    id: 'msg_11',
    threadId: 'thread_7',
    sender: { ...mockUsers[1], name: 'QuantumAdmin' },
    content: 'Welcome to the Quantum Computing discussion. This thread is currently locked for new messages.',
    timestamp: '2024-01-15T14:05:00Z',
    type: 'text',
    isReported: false,
  },
  {
    id: 'msg_12',
    threadId: 'thread_7',
    sender: { ...mockUsers[0], name: 'QResearcher' },
    content: 'I agree, the recent breakthroughs in quantum entanglement open new avenues for secure communication.',
    timestamp: '2024-01-15T14:20:00Z',
    type: 'text',
    isReported: false,
  },
  {
    id: 'msg_13',
    threadId: 'thread_7',
    sender: { ...mockUsers[3], name: 'QStudent' },
    content: 'This discussion is great, but I have a question about quantum error correction.',
    timestamp: '2024-01-15T14:35:00Z',
    type: 'text',
    isReported: true, // Another reported message
  }
];

// Legacy message format for backward compatibility
export const dummyMessages: Message[] = [
  {
    id: 'm1',
    sender: {
      id: '1',
      anonymousId: 'AnonymousWhisper123',
      name: 'AnonymousWhisper123',
      avatar: '#9333EA',
      status: 'online'
    },
    content: 'Hey everyone, welcome to our new thread!',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    type: 'text'
  },
  {
    id: 'm2',
    sender: {
      id: '2',
      anonymousId: 'MysteriousVoice456',
      name: 'MysteriousVoice456',
      avatar: '#EA580C',
      status: 'online'
    },
    content: 'Great to be here! What are we discussing?',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    type: 'text',
    replyTo: 'm1'
  }
];

// Mock Groups with diverse communities
const mockGroupsData: Group[] = [
  {
    id: 'group_1',
    name: 'Mental Health Support',
    description: 'A safe space for discussing mental health challenges, sharing coping strategies, and supporting each other through difficult times. Everyone is welcome.',
    privacy: 'invite_only',
    maxMembers: 500,
    currentMembers: 234,
    members: [],
    createdBy: 'user_1',
    createdAt: '2024-01-10T12:00:00Z',
    avatar: '#10B981',
    inviteCode: 'MENTAL2024',
    rules: 'Be respectful and supportive. No medical advice. Use trigger warnings. Maintain confidentiality. Report harmful content immediately.'
  },
  {
    id: 'group_2',
    name: 'Tech Discussions',
    description: 'Discuss the latest in technology, programming, AI, and innovation. Share projects, ask for help, and connect with fellow tech enthusiasts.',
    privacy: 'public',
    maxMembers: 1000,
    currentMembers: 567,
    members: [],
    createdBy: 'user_2',
    createdAt: '2024-01-05T15:30:00Z',
    avatar: '#3B82F6',
    rules: 'Stay on topic. Be constructive in feedback. No spam or self-promotion without permission. Help others learn and grow.'
  },
  {
    id: 'group_3',
    name: 'Creative Minds',
    description: 'A community for artists, writers, musicians, and creators of all kinds. Share your work, get feedback, and find inspiration.',
    privacy: 'public',
    maxMembers: 750,
    currentMembers: 389,
    members: [],
    createdBy: 'user_3',
    createdAt: '2024-01-08T10:15:00Z',
    avatar: '#F59E0B',
    rules: 'Respect intellectual property. Give constructive feedback. Support fellow creators. No hate or discrimination.'
  }
];

// Mock Notifications with various types
const mockNotificationsData: Notification[] = [
  {
    id: '1',
    userId: 'current_user',
    type: 'like',
    title: 'New Like',
    message: 'Someone liked your thread',
    isRead: false,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    userId: 'current_user',
    type: 'reply',
    title: 'New Reply',
    message: 'Someone replied to your thread',
    isRead: true,
    createdAt: '2024-01-15T09:00:00Z'
  }
];



// Mock Anonymous Messages
const mockAnonymousMessagesData: AnonymousMessage[] = [
  {
    id: 'anon_msg_1',
    recipientId: 'user_1',
    content: 'Your thread about fears really resonated with me. Thank you for being so vulnerable and creating a safe space for others to share.',
    createdAt: '2024-01-20T13:45:00Z',
    isRead: false
  }
];

// Legacy thread type for backward compatibility
export const dummyThreads: any[] = [
  {
    id: 't1',
    title: 'Project Collaboration',
    description: 'A thread for discussing our upcoming project',
    createdBy: dummyParticipants[0],
    participants: dummyParticipants,
    messages: dummyMessages,
    reportCount: 0,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 4.5,
    likes: 12,
    hasLiked: false,
    currentUserId: '1',
    tags: ['collaboration', 'project', 'team']
  }
];

// Export all data with consistent naming
export const mockThreads = mockThreadsData;
export const mockMessages = mockMessagesData;
export const mockGroups = mockGroupsData;
export const mockNotifications = mockNotificationsData;

// Export all mock data
export const mockData = {
  users: mockUsers,
  threads: mockThreads,
  messages: mockMessages,
  groups: mockGroups,
  notifications: mockNotifications,
  anonymousMessages: mockAnonymousMessagesData,
  attachments: mockAttachments
};

// Export individual collections for easier access
export {
  mockUsers,
  mockAttachments
};

export const mockAnonymousMessages = mockAnonymousMessagesData;
