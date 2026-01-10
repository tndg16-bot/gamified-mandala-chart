import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { AppData, MandalaCell } from "./types";
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
    }
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
    }
};
