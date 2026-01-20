import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, arrayUnion, query, where, limit } from "firebase/firestore";
import { AiConfig, AppData, CoachFeedback, Lesson, LessonProgress, MandalaChart, NotificationConfig, ObsidianConfig, Team, TeamComment } from "./types";
import { User } from "firebase/auth";

const DEFAULT_DATA: AppData = {
    mandala: {
        centerSection: {
            id: "section-center",
            centerCell: { id: "center-goal", title: "2026 Goal", completed: false },
            surroundingCells: Array.from({ length: 8 }).map((_, i) => ({
                id: `center-sub-${i}`,
                title: `Idea ${i + 1}`,
                completed: false
            }))
        },
        surroundingSections: Array.from({ length: 8 }).map((_, i) => ({
            id: `section-${i}`,
            centerCell: {
                id: `sec-center-${i}`,
                title: `Sub Goal ${i + 1}`,
                completed: false
            },
            surroundingCells: Array.from({ length: 8 }).map((_, j) => ({
                id: `sec-${i}-cell-${j}`,
                title: `Task ${j + 1}`,
                completed: false,
                subTasks: []
            }))
        }))
    },
    tiger: {
        xp: 0,
        level: 1,
        mood: 'Happy',
        lastLogin: new Date().toISOString(),
        streakDays: 0,
        evolutionStage: 'Egg',
        pokedex: []
    },
    xpHistory: [],
    obsidian: {
        exportPath: "../../Gamified-Mandala-Data",
        autoSync: false
    },
    aiConfig: { // DEFAULT_DATAにaiConfigを追加
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'gemma3:1b',
    },
    notifications: {
        enabled: false,
        time: '09:00',
        frequency: 'daily',
        weeklyDay: 1,
        emailEnabled: false,
        pushEnabled: false
    },
    pushTokens: [],
    journalEntries: [],
    coachingLogs: [],
    journalSummaries: [],
    role: 'client',
    clientIds: [],
    coachFeedback: [],
    purchasedLessonIds: [],
    behaviorStats: {
        activityByHour: {},
        categoryCompletions: {}
    },
    slackUserId: "",
    lineUserId: ""
};

export const FirestoreService = {
    // Load data for a specific user
    loadUserData: async (user: User): Promise<AppData> => {
        const userDocRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userDocRef);

        if (snapshot.exists()) {
            const userData = snapshot.data() as AppData;
            // 既存のデータにaiConfigがない場合を考慮してDEFAULT_DATAとマージ
            const mergedTiger = { ...DEFAULT_DATA.tiger, ...userData.tiger };
            return {
                ...DEFAULT_DATA,
                ...userData,
                tiger: mergedTiger,
                aiConfig: userData.aiConfig || DEFAULT_DATA.aiConfig,
                xpHistory: userData.xpHistory || DEFAULT_DATA.xpHistory,
                notifications: userData.notifications || DEFAULT_DATA.notifications,
                pushTokens: userData.pushTokens || DEFAULT_DATA.pushTokens,
                journalEntries: userData.journalEntries || DEFAULT_DATA.journalEntries,
                coachingLogs: userData.coachingLogs || DEFAULT_DATA.coachingLogs,
                journalSummaries: userData.journalSummaries || DEFAULT_DATA.journalSummaries,
                role: userData.role || DEFAULT_DATA.role,
                clientIds: userData.clientIds || DEFAULT_DATA.clientIds,
                coachFeedback: userData.coachFeedback || DEFAULT_DATA.coachFeedback,
                purchasedLessonIds: userData.purchasedLessonIds || DEFAULT_DATA.purchasedLessonIds,
                behaviorStats: userData.behaviorStats || DEFAULT_DATA.behaviorStats,
                slackUserId: userData.slackUserId || DEFAULT_DATA.slackUserId,
                lineUserId: userData.lineUserId || DEFAULT_DATA.lineUserId
            };
        } else {
            // Initialize new user data
            await setDoc(userDocRef, DEFAULT_DATA);
            return DEFAULT_DATA;
        }
    },

    loadUserDataById: async (userId: string): Promise<AppData | null> => {
        const userDocRef = doc(db, "users", userId);
        const snapshot = await getDoc(userDocRef);

        if (!snapshot.exists()) {
            return null;
        }
        const userData = snapshot.data() as AppData;
        const mergedTiger = { ...DEFAULT_DATA.tiger, ...userData.tiger };
        return {
            ...DEFAULT_DATA,
            ...userData,
            tiger: mergedTiger,
            aiConfig: userData.aiConfig || DEFAULT_DATA.aiConfig,
            xpHistory: userData.xpHistory || DEFAULT_DATA.xpHistory,
            notifications: userData.notifications || DEFAULT_DATA.notifications,
            pushTokens: userData.pushTokens || DEFAULT_DATA.pushTokens,
            journalEntries: userData.journalEntries || DEFAULT_DATA.journalEntries,
            coachingLogs: userData.coachingLogs || DEFAULT_DATA.coachingLogs,
            journalSummaries: userData.journalSummaries || DEFAULT_DATA.journalSummaries,
            role: userData.role || DEFAULT_DATA.role,
            clientIds: userData.clientIds || DEFAULT_DATA.clientIds,
            coachFeedback: userData.coachFeedback || DEFAULT_DATA.coachFeedback,
            purchasedLessonIds: userData.purchasedLessonIds || DEFAULT_DATA.purchasedLessonIds,
            behaviorStats: userData.behaviorStats || DEFAULT_DATA.behaviorStats,
            slackUserId: userData.slackUserId || DEFAULT_DATA.slackUserId,
            lineUserId: userData.lineUserId || DEFAULT_DATA.lineUserId
        };
    },

    // Save full state (heavy, use sparingly)
    saveUserData: async (user: User, data: AppData): Promise<void> => {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, data, { merge: true });
    },

    // Add multiple subtasks in one save to avoid overwriting
    addSubTasks: async (user: User, data: AppData, sectionId: string, cellId: string, titles: string[]): Promise<AppData> => {
        const trimmedTitles = titles.map(title => title.trim()).filter(Boolean);
        if (trimmedTitles.length === 0) return data;

        // Note: Deep cloning to avoid mutating state directly before saving
        const newData = JSON.parse(JSON.stringify(data)) as AppData;
        const section = newData.mandala.surroundingSections.find(s => s.id === sectionId);
        if (!section) return data;
        const cell = section.surroundingCells.find(c => c.id === cellId);
        if (!cell) return data;

        if (!cell.subTasks) cell.subTasks = [];
        const now = Date.now();
        trimmedTitles.forEach((title, index) => {
            cell.subTasks?.push({
                id: `sub-${now + index}`,
                title,
                completed: false,
                difficulty: 'B',
                createdAt: new Date().toISOString()
            });
        });

        await FirestoreService.saveUserData(user, newData);
        return newData;
    },

    // Add a subtask (Optimized update)
    addSubTask: async (user: User, data: AppData, sectionId: string, cellId: string, title: string): Promise<AppData> => {
        return FirestoreService.addSubTasks(user, data, sectionId, cellId, [title]);
    },

    // Toggle subtask & Update XP
    async toggleSubTask(user: User, currentData: AppData, sectionId: string, cellId: string, subTaskId: string): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const newData = JSON.parse(JSON.stringify(currentData)) as AppData;
        const section = newData.mandala.surroundingSections.find(s => s.id === sectionId);
        if (!section) return currentData;

        const cell = section.surroundingCells.find(c => c.id === cellId);
        if (!cell || !cell.subTasks) return currentData;

        const task = cell.subTasks.find(t => t.id === subTaskId);
        if (task) {
            task.completed = !task.completed;

            const today = new Date();
            const todayKey = today.toISOString().split('T')[0];
            if (!newData.xpHistory) newData.xpHistory = [];
            let historyEntry = newData.xpHistory.find(entry => entry.date === todayKey);
            if (!historyEntry) {
                historyEntry = { date: todayKey, xp: 0 };
                newData.xpHistory.push(historyEntry);
            }

            // Gamification: XP for completion (Simple logic: 10xp per task)
            if (task.completed) {
                newData.tiger.xp += 10;
                historyEntry.xp += 10;
                // Level Up Logic (every 100xp)
                if (Math.floor(newData.tiger.xp / 100) > newData.tiger.level - 1) {
                    newData.tiger.level += 1;
                    // Evolution checkpoints could be handled here or in UI component
                }

                const lastLogin = newData.tiger.lastLogin ? new Date(newData.tiger.lastLogin) : null;
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                if (lastLogin) {
                    const lastStart = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
                    const diffDays = Math.round((todayStart.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        newData.tiger.streakDays = (newData.tiger.streakDays || 0) + 1;
                    } else if (diffDays > 1) {
                        newData.tiger.streakDays = 1;
                    }
                } else {
                    newData.tiger.streakDays = 1;
                }
                newData.tiger.lastLogin = today.toISOString();

                if (!newData.behaviorStats) {
                    newData.behaviorStats = {
                        activityByHour: {},
                        categoryCompletions: {}
                    };
                }
                const decay = 0.9;
                Object.keys(newData.behaviorStats.activityByHour).forEach((key) => {
                    newData.behaviorStats.activityByHour[key] = newData.behaviorStats.activityByHour[key] * decay;
                });
                Object.keys(newData.behaviorStats.categoryCompletions).forEach((key) => {
                    newData.behaviorStats.categoryCompletions[key] = newData.behaviorStats.categoryCompletions[key] * decay;
                });
                const hourKey = String(today.getHours());
                newData.behaviorStats.activityByHour[hourKey] = (newData.behaviorStats.activityByHour[hourKey] || 0) + 1;
                const category = section.centerCell.title || "General";
                newData.behaviorStats.categoryCompletions[category] = (newData.behaviorStats.categoryCompletions[category] || 0) + 1;
                newData.behaviorStats.lastActivityAt = today.toISOString();
            } else {
                newData.tiger.xp = Math.max(0, newData.tiger.xp - 10);
                historyEntry.xp = Math.max(0, historyEntry.xp - 10);
            }
        }

        await this.saveUserData(user, newData);
        return newData;
    },

    async updateCellTitle(user: User, currentData: AppData, sectionId: string, cellId: string, newTitle: string): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const newData = JSON.parse(JSON.stringify(currentData)) as AppData;
        const section = newData.mandala.surroundingSections.find(s => s.id === sectionId);
        if (!section) return currentData;

        const cell = section.surroundingCells.find(c => c.id === cellId);
        if (cell) {
            cell.title = newTitle;
            await this.saveUserData(user, newData);
        }
        return newData;
    },

    // Delete subtask
    async deleteSubTask(user: User, currentData: AppData, sectionId: string, cellId: string, subTaskId: string): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const newData = JSON.parse(JSON.stringify(currentData)) as AppData;
        const section = newData.mandala.surroundingSections.find(s => s.id === sectionId);
        if (!section) return currentData;

        const cell = section.surroundingCells.find(c => c.id === cellId);
        if (!cell || !cell.subTasks) return currentData;

        // Find and remove the subtask
        const subTaskIndex = cell.subTasks.findIndex(t => t.id === subTaskId);
        if (subTaskIndex === -1) return currentData;

        const deletedSubTask = cell.subTasks[subTaskIndex];
        cell.subTasks.splice(subTaskIndex, 1);

        // If the deleted task was completed, subtract XP
        if (deletedSubTask.completed) {
            newData.tiger.xp = Math.max(0, newData.tiger.xp - 10);
            const todayKey = new Date().toISOString().split('T')[0];
            if (!newData.xpHistory) newData.xpHistory = [];
            let historyEntry = newData.xpHistory.find(entry => entry.date === todayKey);
            if (!historyEntry) {
                historyEntry = { date: todayKey, xp: 0 };
                newData.xpHistory.push(historyEntry);
            }
            historyEntry.xp = Math.max(0, historyEntry.xp - 10);
        }

        await this.saveUserData(user, newData);
        return newData;
    },

    // Edit subtask title
    async editSubTask(user: User, currentData: AppData, sectionId: string, cellId: string, subTaskId: string, newTitle: string): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const newData = JSON.parse(JSON.stringify(currentData)) as AppData;
        const section = newData.mandala.surroundingSections.find(s => s.id === sectionId);
        if (!section) return currentData;

        const cell = section.surroundingCells.find(c => c.id === cellId);
        if (!cell || !cell.subTasks) return currentData;

        const subTask = cell.subTasks.find(t => t.id === subTaskId);
        if (!subTask) return currentData;

        subTask.title = newTitle;

        await this.saveUserData(user, newData);
        return newData;
    },

    async getAllLessons(): Promise<Lesson[]> {
        const lessonsRef = collection(db, "lessons");
        const snapshot = await getDocs(lessonsRef);
        return snapshot.docs.map(doc => doc.data() as Lesson);
    },

    async getPublicLessons(): Promise<Lesson[]> {
        const lessonsRef = collection(db, "lessons");
        const q = query(lessonsRef, where("isPublic", "==", true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Lesson);
    },

    async getLessonsForUser(userId: string): Promise<Lesson[]> {
        const lessonsRef = collection(db, "lessons");
        const snapshot = await getDocs(lessonsRef);
        return snapshot.docs
            .map(doc => doc.data() as Lesson)
            .filter(lesson => !lesson.authorId || lesson.authorId === userId);
    },

    async startLesson(user: User, currentData: AppData, lessonId: string): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const newData = JSON.parse(JSON.stringify(currentData)) as AppData;
        if (!newData.lessonProgress) newData.lessonProgress = [];

        const existing = newData.lessonProgress.find(lp => lp.lessonId === lessonId);
        if (existing) return currentData;

        newData.lessonProgress.push({
            lessonId,
            completed: false,
            startedAt: new Date().toISOString()
        });

        await this.saveUserData(user, newData);
        return newData;
    },

    async completeLesson(user: User, currentData: AppData, lesson: Lesson): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const newData = JSON.parse(JSON.stringify(currentData)) as AppData;
        if (!newData.lessonProgress) return currentData;

        const progress = newData.lessonProgress.find(lp => lp.lessonId === lesson.id);
        if (!progress || progress.completed) return currentData;

        progress.completed = true;
        progress.completedAt = new Date().toISOString();

        const lessonXp = lesson.xp || 50;
        newData.tiger.xp += lessonXp;
        const todayKey = new Date().toISOString().split('T')[0];
        if (!newData.xpHistory) newData.xpHistory = [];
        let historyEntry = newData.xpHistory.find(entry => entry.date === todayKey);
        if (!historyEntry) {
            historyEntry = { date: todayKey, xp: 0 };
            newData.xpHistory.push(historyEntry);
        }
        historyEntry.xp += lessonXp;
        if (Math.floor(newData.tiger.xp / 100) > newData.tiger.level - 1) {
            newData.tiger.level += 1;
        }

        if (!newData.behaviorStats) {
            newData.behaviorStats = {
                activityByHour: {},
                categoryCompletions: {}
            };
        }
        const decay = 0.9;
        Object.keys(newData.behaviorStats.activityByHour).forEach((key) => {
            newData.behaviorStats.activityByHour[key] = newData.behaviorStats.activityByHour[key] * decay;
        });
        Object.keys(newData.behaviorStats.categoryCompletions).forEach((key) => {
            newData.behaviorStats.categoryCompletions[key] = newData.behaviorStats.categoryCompletions[key] * decay;
        });
        const now = new Date();
        const hourKey = String(now.getHours());
        newData.behaviorStats.activityByHour[hourKey] = (newData.behaviorStats.activityByHour[hourKey] || 0) + 1;
        newData.behaviorStats.categoryCompletions["Lessons"] = (newData.behaviorStats.categoryCompletions["Lessons"] || 0) + 1;
        newData.behaviorStats.lastActivityAt = now.toISOString();

        await this.saveUserData(user, newData);
        return newData;
    },

    async importLessons(lessons: Lesson[], author?: { id: string; name: string }): Promise<void> {
        const lessonsRef = collection(db, "lessons");

        for (const lesson of lessons) {
            await addDoc(lessonsRef, {
                ...lesson,
                authorId: author?.id || lesson.authorId,
                authorName: author?.name || lesson.authorName,
                isPublic: lesson.isPublic ?? false,
                category: lesson.category,
                priceCents: lesson.priceCents,
                currency: lesson.currency,
                tags: lesson.tags
            });
        }
    },

    async updateLessonMeta(
        lessonId: string,
        updates: { isPublic?: boolean; category?: string; priceCents?: number; currency?: string; tags?: string[] }
    ): Promise<void> {
        const lessonsRef = collection(db, "lessons");
        const q = query(lessonsRef, where("id", "==", lessonId), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, updates);
    },

    async updateObsidianConfig(user: User, exportPath: string, autoSync: boolean): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");

        const userDocRef = doc(db, "users", user.uid);
        const obsidianConfig: ObsidianConfig = { exportPath, autoSync };

        await updateDoc(userDocRef, {
            obsidian: obsidianConfig
        });
    },

    async updateAiConfig(user: User, aiConfig: AiConfig): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");

        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            aiConfig: aiConfig
        });
    },

    async updateNotificationConfig(user: User, notifications: NotificationConfig): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");

        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            notifications
        });
    },

    async updateUserRole(user: User, role: AppData["role"]): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { role });
    },

    async updateSlackUserId(user: User, slackUserId: string): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { slackUserId });
    },

    async updateLineUserId(user: User, lineUserId: string): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { lineUserId });
    },

    async addPushToken(user: User, token: string): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");
        if (!token) return;

        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            pushTokens: arrayUnion(token)
        });
    },

    async updateMandalaChart(user: User, newMandala: MandalaChart): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const userDocRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userDocRef);

        if (!snapshot.exists()) {
            throw new Error("User data not found for updating mandala chart.");
        }

        const currentData = snapshot.data() as AppData;
        const updatedData = {
            ...currentData,
            mandala: newMandala,
        };

        await setDoc(userDocRef, updatedData, { merge: true });
        return updatedData;
    },

    async createTeam(user: User, name: string, mandala: MandalaChart): Promise<Team> {
        if (!user.uid) throw new Error("User ID missing");
        const teamsRef = collection(db, "teams");
        const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        const payload = {
            name,
            inviteCode,
            ownerId: user.uid,
            memberIds: [user.uid],
            createdAt: new Date().toISOString(),
            sharedMandala: mandala
        };
        const docRef = await addDoc(teamsRef, payload);
        return { id: docRef.id, ...payload };
    },

    async joinTeamByCode(user: User, inviteCode: string): Promise<Team> {
        if (!user.uid) throw new Error("User ID missing");
        const teamsRef = collection(db, "teams");
        const q = query(teamsRef, where("inviteCode", "==", inviteCode), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            throw new Error("Team not found");
        }
        const docSnap = snapshot.docs[0];
        await updateDoc(docSnap.ref, {
            memberIds: arrayUnion(user.uid)
        });
        return { id: docSnap.id, ...(docSnap.data() as Omit<Team, "id">) };
    },

    async loadTeamsForUser(user: User): Promise<Team[]> {
        if (!user.uid) throw new Error("User ID missing");
        const teamsRef = collection(db, "teams");
        const q = query(teamsRef, where("memberIds", "array-contains", user.uid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Omit<Team, "id">) }));
    },

    async updateTeamMandala(teamId: string, mandala: MandalaChart): Promise<void> {
        const teamRef = doc(db, "teams", teamId);
        await updateDoc(teamRef, { sharedMandala: mandala });
    },

    async addTeamComment(teamId: string, comment: TeamComment): Promise<void> {
        const teamRef = doc(db, "teams", teamId);
        await updateDoc(teamRef, {
            comments: arrayUnion(comment)
        });
    },

    async addCoachClient(user: User, clientId: string): Promise<void> {
        if (!user.uid) throw new Error("User ID missing");
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            clientIds: arrayUnion(clientId)
        });
    },

    async addCoachFeedback(clientId: string, feedback: CoachFeedback): Promise<void> {
        const userDocRef = doc(db, "users", clientId);
        await updateDoc(userDocRef, {
            coachFeedback: arrayUnion(feedback)
        });
    }
};
