import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, arrayUnion } from "firebase/firestore";
import { AiConfig, AppData, Lesson, LessonProgress, MandalaChart, NotificationConfig, ObsidianConfig } from "./types";
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
    pushTokens: []
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
                pushTokens: userData.pushTokens || DEFAULT_DATA.pushTokens
            };
        } else {
            // Initialize new user data
            await setDoc(userDocRef, DEFAULT_DATA);
            return DEFAULT_DATA;
        }
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

    async getAllLessons(): Promise<Lesson[]> {
        const lessonsRef = collection(db, "lessons");
        const snapshot = await getDocs(lessonsRef);
        return snapshot.docs.map(doc => doc.data() as Lesson);
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

        await this.saveUserData(user, newData);
        return newData;
    },

    async importLessons(lessons: Lesson[]): Promise<void> {
        const lessonsRef = collection(db, "lessons");

        for (const lesson of lessons) {
            await addDoc(lessonsRef, lesson);
        }
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
    }
};
