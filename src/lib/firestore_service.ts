import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { AppData, MandalaCell, Lesson, LessonProgress } from "./types";
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
        level: 1,
        xp: 0,
        mood: "Happy",
        lastLogin: new Date().toISOString(),
        evolutionStage: "Egg",
        pokedex: []
    },
    lessonProgress: []
};

export const FirestoreService = {
    // Load data for a specific user
    loadUserData: async (user: User): Promise<AppData> => {
        const userDocRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userDocRef);

        if (snapshot.exists()) {
            return snapshot.data() as AppData;
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

    // Add a subtask (Optimized update)
    addSubTask: async (user: User, data: AppData, sectionId: string, cellId: string, title: string): Promise<AppData> => {
        // Note: Deep cloning to avoid mutating state directly before saving
        const newData = JSON.parse(JSON.stringify(data)) as AppData;
        const section = newData.mandala.surroundingSections.find(s => s.id === sectionId);
        if (!section) return data;
        const cell = section.surroundingCells.find(c => c.id === cellId);
        if (!cell) return data;

        if (!cell.subTasks) cell.subTasks = [];
        cell.subTasks.push({
            id: `sub-${Date.now()}`,
            title,
            completed: false,
            difficulty: 'B',
            createdAt: new Date().toISOString()
        });

        // Award tiny XP for planning? Maybe not yet.

        await FirestoreService.saveUserData(user, newData);
        return newData;
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

            // Gamification: XP for completion (Simple logic: 10xp per task)
            if (task.completed) {
                newData.tiger.xp += 10;
                // Level Up Logic (every 100xp)
                if (Math.floor(newData.tiger.xp / 100) > newData.tiger.level - 1) {
                    newData.tiger.level += 1;
                    // Evolution checkpoints could be handled here or in UI component
                }
            } else {
                newData.tiger.xp = Math.max(0, newData.tiger.xp - 10);
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

    async completeLesson(user: User, currentData: AppData, lessonId: string): Promise<AppData> {
        if (!user.uid) throw new Error("User ID missing");

        const newData = JSON.parse(JSON.stringify(currentData)) as AppData;
        if (!newData.lessonProgress) return currentData;

        const progress = newData.lessonProgress.find(lp => lp.lessonId === lessonId);
        if (!progress || progress.completed) return currentData;

        progress.completed = true;
        progress.completedAt = new Date().toISOString();

        newData.tiger.xp += 50;
        if (Math.floor(newData.tiger.xp / 100) > newData.tiger.level - 1) {
            newData.tiger.level += 1;
        }

        await this.saveUserData(user, newData);
        return newData;
    }
};
