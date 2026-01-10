'use server';

import fs from 'fs/promises';
import path from 'path';
import { AppData, TigerStats, SubTask } from '@/lib/types';


// Define the path relative to the app execution.
// Since the app is in apps/gamified-mandala, and we want data in the Vault root:
// ../../GamifiedMandalaData
const DATA_DIR = path.resolve(process.cwd(), '../../GamifiedMandalaData');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

const INITIAL_DATA: AppData = {
    mandala: {
        centerSection: {
            id: 'center',
            centerCell: { id: 'core', title: 'Life Vision', completed: false },
            surroundingCells: Array(8).fill(null).map((_, i) => ({ id: `core-${i}`, title: `Area ${i + 1}`, completed: false }))
        },
        surroundingSections: Array(8).fill(null).map((_, i) => ({
            id: `section-${i}`,
            centerCell: { id: `sec-center-${i}`, title: `Area ${i + 1}`, completed: false },
            surroundingCells: Array(8).fill(null).map((_, j) => ({ id: `cell-${i}-${j}`, title: 'Task', completed: false }))
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
        exportPath: '../../Gamified-Mandala-Data',
        autoSync: false
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

export async function loadData(): Promise<AppData> {
    await ensureDataDir();
    try {
        const content = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        // If file doesn't exist, create it with initial data
        await saveData(INITIAL_DATA);
        return INITIAL_DATA;
    }
}

export async function saveData(data: AppData): Promise<void> {
    await ensureDataDir();
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function updateTigerXP(xpToAdd: number, difficulty: string): Promise<TigerStats> {
    const data = await loadData();
    data.tiger.xp += xpToAdd;

    // Simple Level Up Logic: Level = sqrt(XP) or similar linear threshold
    // MVP: 100 XP per level
    const newLevel = Math.floor(data.tiger.xp / 100) + 1;
    if (newLevel > data.tiger.level) {
        // Level Up Event could be handled here or on frontend
        data.tiger.level = newLevel;
    }

    data.tiger.lastLogin = new Date().toISOString();
    await saveData(data);
    return data.tiger;
}

const TEMPLATE_FILE = path.resolve(process.cwd(), '../../specs/TIGER_GOAL_SETTING_TEMPLATE.md');

export async function importMandalaFromMarkdown(): Promise<AppData> {
    await ensureDataDir();

    try {
        const content = await fs.readFile(TEMPLATE_FILE, 'utf-8');
        const sections = content.split('### ').slice(1); // Skip preamble

        // Parse Center Goal (Simple extraction for MVP)
        const centerMatch = content.match(/## 1. 🌈 ビジョン \(Center Goal\)\n\*\*(.+)\*\*/);
        const centerTitle = centerMatch ? centerMatch[1] : 'My Vision';

        const currentData = await loadData();
        const newMandala = { ...currentData.mandala };

        // Update Center
        newMandala.centerSection.centerCell.title = centerTitle;

        // Parse 8 Sections
        sections.forEach((sectionText, index) => {
            if (index >= 8) return; // Limit to 8

            const lines = sectionText.split('\n');
            const titleLine = lines[0].trim(); // e.g., "1. 【財】資産・お金 (Asset)"

            const tasks = lines.slice(1)
                .filter(line => line.trim().startsWith('*'))
                .map((line, i) => ({
                    id: `cell-${index}-${i}`,
                    title: line.replace('*', '').trim(),
                    completed: false,
                    difficulty: 'B' // Default difficulty
                })).slice(0, 8); // Tak 8 tasks max

            // Update Section
            newMandala.surroundingSections[index].centerCell.title = titleLine;

            // Update Tasks (Surrounding Cells)
            newMandala.surroundingSections[index].surroundingCells = newMandala.surroundingSections[index].surroundingCells.map((cell, i) => {
                if (tasks[i]) {
                    return { ...cell, title: tasks[i].title };
                }
                return { ...cell, title: '(Empty)' };
            });
        });

        // Save and Return
        const newData = { ...currentData, mandala: newMandala };
        await saveData(newData);
        return newData;

    } catch (error) {
        console.error("Import failed:", error);
        throw new Error("Failed to import Markdown template");
    }
}

// --- Phase 3: SubTask Actions ---

export async function addSubTask(sectionId: string, cellId: string, title: string): Promise<AppData> {
    const data = await loadData();
    const section = data.mandala.surroundingSections.find(s => s.id === sectionId);
    if (!section) throw new Error("Section not found");

    const cell = section.surroundingCells.find(c => c.id === cellId);
    if (!cell) throw new Error("Cell not found");

    if (!cell.subTasks) cell.subTasks = [];

    const newSubTask: any = {
        id: `sub-${Date.now()}`,
        title: title,
        completed: false,
        difficulty: 'B',
        createdAt: new Date().toISOString()
    };

    cell.subTasks.push(newSubTask);
    await saveData(data);
    return data;
}

export async function toggleSubTask(sectionId: string, cellId: string, subTaskId: string): Promise<AppData> {
    const data = await loadData();
    const section = data.mandala.surroundingSections.find(s => s.id === sectionId);
    if (!section) throw new Error("Section not found");

    const cell = section.surroundingCells.find(c => c.id === cellId);
    if (!cell || !cell.subTasks) throw new Error("Cell or SubTasks not found");

    const subTask = cell.subTasks.find(t => t.id === subTaskId);
    if (!subTask) throw new Error("SubTask not found");

    subTask.completed = !subTask.completed;

    // XP Logic for SubTask
    if (subTask.completed) {
        data.tiger.xp += 10; // 10 XP per subtask
    } else {
        data.tiger.xp = Math.max(0, data.tiger.xp - 10);
    }

    await saveData(data);
    return data;
}

export async function exportMandalaToMarkdown(data: AppData): Promise<string> {
    const obsidianDir = data.obsidian?.exportPath || '../../Gamified-Mandala-Data';
    const exportDir = path.resolve(process.cwd(), obsidianDir);

    try {
        await fs.mkdir(exportDir, { recursive: true });
    } catch {
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `mandala-${timestamp}.md`;
    const filePath = path.join(exportDir, filename);

    let md = `---
title: Mandala Chart
date: ${new Date().toISOString()}
tiger_level: ${data.tiger.level}
tags: [mandala, goals]
---

# ${data.mandala.centerSection.centerCell.title}

**Tiger Level:** ${data.tiger.level} | **XP:** ${data.tiger.xp}

## 🎯 Core Vision

${data.mandala.centerSection.centerCell.title}

`;

    data.mandala.surroundingSections.forEach(sec => {
        md += `## ${sec.centerCell.title}\n\n`;
        sec.surroundingCells.forEach(cell => {
            const status = cell.subTasks && cell.subTasks.length > 0 && cell.subTasks.every(t => t.completed) ? '[x]' : '[ ]';
            md += `- ${status} ${cell.title}\n`;
            if (cell.subTasks && cell.subTasks.length > 0) {
                cell.subTasks.forEach(st => {
                    const stStatus = st.completed ? '[x]' : '[ ]';
                    const diffBadge = st.difficulty ? ` [${st.difficulty}]` : '';
                    md += `  - ${stStatus} ${st.title}${diffBadge}\n`;
                });
            }
        });
        md += '\n';
    });

    await fs.writeFile(filePath, md, 'utf-8');
    return filePath;
}

export async function exportTasksToMarkdown(data: AppData): Promise<string> {
    const obsidianDir = data.obsidian?.exportPath || '../../Gamified-Mandala-Data';
    const exportDir = path.resolve(process.cwd(), obsidianDir);

    try {
        await fs.mkdir(exportDir, { recursive: true });
    } catch {
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `tasks-${timestamp}.md`;
    const filePath = path.join(exportDir, filename);

    const allTasks: { subTask: SubTask; sectionTitle: string; cellTitle: string }[] = [];

    data.mandala.surroundingSections.forEach(sec => {
        sec.surroundingCells.forEach(cell => {
            if (cell.subTasks && cell.subTasks.length > 0) {
                cell.subTasks.forEach(st => {
                    allTasks.push({ subTask: st, sectionTitle: sec.centerCell.title, cellTitle: cell.title });
                });
            }
        });
    });

    const todoTasks = allTasks.filter(t => !t.subTask.completed);
    const doneTasks = allTasks.filter(t => t.subTask.completed);

    let md = `---
title: Task List
date: ${new Date().toISOString()}
tags: [tasks, todo]
---

# Task List

**Tiger Level:** ${data.tiger.level} | **Total Tasks:** ${allTasks.length}

## 📋 To Do (${todoTasks.length})

`;

    todoTasks.forEach(t => {
        const diffBadge = t.subTask.difficulty ? ` [${t.subTask.difficulty}]` : '';
        md += `- [[${t.cellTitle}]]: ${t.subTask.title}${diffBadge}\n`;
    });

    md += `\n## ✅ Done (${doneTasks.length})\n\n`;

    doneTasks.forEach(t => {
        const diffBadge = t.subTask.difficulty ? ` [${t.subTask.difficulty}]` : '';
        md += `- [[${t.cellTitle}]]: ${t.subTask.title}${diffBadge}\n`;
    });

    await fs.writeFile(filePath, md, 'utf-8');
    return filePath;
}

export async function updateObsidianConfig(exportPath: string, autoSync: boolean): Promise<void> {
    const data = await loadData();
    data.obsidian = {
        exportPath,
        autoSync
    };
    await saveData(data);
}
