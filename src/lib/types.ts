export type MandalaCell = {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    color?: string; // Tailwind class or hex
    subTasks?: SubTask[]; // Level 3 Tasks
};

export type TaskDifficulty = 'S' | 'A' | 'B' | 'C';

export interface SubTask {
    id: string;
    title: string;
    completed: boolean;
    difficulty: TaskDifficulty;
    createdAt: string;
}

export type MandalaSection = {
    id: string;
    centerCell: MandalaCell;
    surroundingCells: MandalaCell[]; // Should be 8 cells
};

export type MandalaChart = {
    centerSection: MandalaSection;
    surroundingSections: MandalaSection[]; // Should be 8 sections
};



export type TigerStats = {
    xp: number;
    level: number;
    mood: 'Happy' | 'Cloudy' | 'Runaway';
    lastLogin: string; // ISO Date
    streakDays: number;
    evolutionStage: 'Egg' | 'Cub' | 'Adult' | 'Awakened';
    pokedex: string[]; // List of IDs of past cleared tigers
};

export type ObsidianConfig = {
    exportPath: string;
    autoSync: boolean;
};

export type NotificationFrequency = 'daily' | 'weekdays' | 'weekly';

export type NotificationConfig = {
    enabled: boolean;
    time: string;
    frequency: NotificationFrequency;
    weeklyDay?: number;
    emailEnabled: boolean;
    pushEnabled: boolean;
    lastSentAt?: string;
};

export type CoachingLog = {
    id: string;
    createdAt: string;
    summary: string;
    prompt: string;
    kind?: 'checkin' | 'replan';
};

export type JournalEntry = {
    id: string;
    date: string;
    createdAt: string;
    achievements: string;
    challenges: string;
    goals: string;
};

export type JournalSummary = {
    id: string;
    period: 'weekly' | 'monthly';
    createdAt: string;
    summary: string;
    entryDates: string[];
};

export type UserBehaviorStats = {
    lastActivityAt?: string;
    lastResetAt?: string;
    activityByHour: Record<string, number>;
    categoryCompletions: Record<string, number>;
};

export type UserRole = 'coach' | 'client';

export type CoachFeedback = {
    id: string;
    coachId: string;
    coachName: string;
    message: string;
    createdAt: string;
};

export type Team = {
    id: string;
    name: string;
    inviteCode: string;
    ownerId: string;
    memberIds: string[];
    createdAt: string;
    sharedMandala: MandalaChart;
    comments?: TeamComment[];
};

export type TeamComment = {
    id: string;
    authorId: string;
    authorName: string;
    message: string;
    createdAt: string;
};

export type AppData = {
    mandala: MandalaChart;
    tiger: TigerStats;
    lessonProgress?: LessonProgress[];
    obsidian?: ObsidianConfig;
    aiConfig?: AiConfig; // AI設定を追加
    xpHistory?: { date: string; xp: number }[];
    notifications?: NotificationConfig;
    pushTokens?: string[];
    journalEntries?: JournalEntry[];
    coachingLogs?: CoachingLog[];
    journalSummaries?: JournalSummary[];
    role?: UserRole;
    clientIds?: string[];
    coachFeedback?: CoachFeedback[];
    purchasedLessonIds?: string[];
    behaviorStats?: UserBehaviorStats;
    slackUserId?: string;
    lineUserId?: string;
};

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
};

export type Lesson = {
    id: string;
    title: string;
    description: string;
    content: string;
    order: number;
    requiredLevel: number;
    xp: number;
    authorId?: string;
    authorName?: string;
    isPublic?: boolean;
    category?: string;
    priceCents?: number;
    currency?: string;
    tags?: string[];
};

export type LessonProgress = {
    lessonId: string;
    completed: boolean;
    startedAt?: string;
    completedAt?: string;
};

export type AiProvider = 'ollama' | 'gemini' | 'custom';

export interface AiConfig {
    provider: AiProvider;
    baseUrl: string; // e.g. "http://localhost:11434"
    model: string;   // e.g. "llama3"
    apiKey?: string; // For Gemini/OpenAI
};
