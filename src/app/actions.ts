'use server';

import fs from 'fs/promises';
import path from 'path';
import { AppData, MandalaChart, TigerStats, SubTask } from '@/lib/types';


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

export async function deleteSubTask(sectionId: string, cellId: string, subTaskId: string): Promise<AppData> {
    const data = await loadData();
    const section = data.mandala.surroundingSections.find(s => s.id === sectionId);
    if (!section) throw new Error("Section not found");

    const cell = section.surroundingCells.find(c => c.id === cellId);
    if (!cell || !cell.subTasks) throw new Error("Cell or SubTasks not found");

    const subTaskIndex = cell.subTasks.findIndex(t => t.id === subTaskId);
    if (subTaskIndex === -1) throw new Error("SubTask not found");

    const deletedSubTask = cell.subTasks[subTaskIndex];
    cell.subTasks.splice(subTaskIndex, 1);

    // If deleted task was completed, subtract XP
    if (deletedSubTask.completed) {
        data.tiger.xp = Math.max(0, data.tiger.xp - 10);
    }

    await saveData(data);
    return data;
}

export async function editSubTask(sectionId: string, cellId: string, subTaskId: string, newTitle: string): Promise<AppData> {
    const data = await loadData();
    const section = data.mandala.surroundingSections.find(s => s.id === sectionId);
    if (!section) throw new Error("Section not found");

    const cell = section.surroundingCells.find(c => c.id === cellId);
    if (!cell || !cell.subTasks) throw new Error("Cell or SubTasks not found");

    const subTask = cell.subTasks.find(t => t.id === subTaskId);
    if (!subTask) throw new Error("SubTask not found");

    subTask.title = newTitle;

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

async function getLatestMarkdownFile(exportDir: string, prefix: string): Promise<string | null> {
    try {
        const files = await fs.readdir(exportDir);
        const matches = files.filter((name) => name.startsWith(prefix) && name.endsWith('.md'));
        if (matches.length === 0) return null;
        matches.sort();
        return path.join(exportDir, matches[matches.length - 1]);
    } catch {
        return null;
    }
}

function parseMandalaMarkdown(content: string, baseMandala: MandalaChart): MandalaChart {
    const updated = JSON.parse(JSON.stringify(baseMandala)) as MandalaChart;
    const lines = content.split(/\r?\n/);
    const centerLine = lines.find((line) => line.startsWith('# ') && !line.startsWith('## '));
    if (centerLine) {
        updated.centerSection.centerCell.title = centerLine.replace(/^#\s+/, '').trim();
    }

    const sectionTitles: string[] = [];
    const sectionCells: string[][] = [];
    let currentSectionIndex: number | null = null;

    lines.forEach((line) => {
        if (line.startsWith('## ')) {
            const title = line.replace(/^##\s+/, '').trim();
            if (title.toLowerCase().includes('core vision')) {
                currentSectionIndex = null;
                return;
            }
            currentSectionIndex = sectionTitles.length;
            sectionTitles.push(title);
            sectionCells.push([]);
            return;
        }

        if (currentSectionIndex === null) return;
        const match = line.match(/^- \[[ xX]\]\s+(.+)$/);
        if (match) {
            sectionCells[currentSectionIndex].push(match[1].trim());
        }
    });

    sectionTitles.slice(0, 8).forEach((title, index) => {
        updated.centerSection.surroundingCells[index].title = title;
        updated.surroundingSections[index].centerCell.title = title;
    });

    sectionCells.slice(0, 8).forEach((cells, sectionIndex) => {
        cells.slice(0, 8).forEach((cellTitle, cellIndex) => {
            updated.surroundingSections[sectionIndex].surroundingCells[cellIndex].title = cellTitle;
        });
    });

    return updated;
}

export async function importMandalaFromObsidian(
    baseMandala: MandalaChart,
    obsidianPath?: string
): Promise<MandalaChart | null> {
    const obsidianDir = obsidianPath || '../../Gamified-Mandala-Data';
    const exportDir = path.resolve(process.cwd(), obsidianDir);
    const filePath = await getLatestMarkdownFile(exportDir, 'mandala-');
    if (!filePath) return null;

    const content = await fs.readFile(filePath, 'utf-8');
    return parseMandalaMarkdown(content, baseMandala);
}

function buildCellIndex(data: AppData) {
    const map = new Map<string, { sectionIndex: number; cellIndex: number }>();
    data.mandala.surroundingSections.forEach((section, sectionIndex) => {
        section.surroundingCells.forEach((cell, cellIndex) => {
            if (!map.has(cell.title)) {
                map.set(cell.title, { sectionIndex, cellIndex });
            }
        });
    });
    return map;
}

function parseTasksMarkdown(content: string) {
    const tasks: { cellTitle: string; title: string; completed: boolean; difficulty?: string }[] = [];
    let completed = false;

    content.split(/\r?\n/).forEach((line) => {
        if (line.startsWith('## ')) {
            if (line.toLowerCase().includes('done')) {
                completed = true;
            } else if (line.toLowerCase().includes('to do')) {
                completed = false;
            }
            return;
        }
        const match = line.match(/^- \[\[(.+?)\]\]:\s+(.+)$/);
        if (!match) return;
        let title = match[2].trim();
        let difficulty: string | undefined;
        const diffMatch = title.match(/\s+\[([SABC])\]$/);
        if (diffMatch) {
            difficulty = diffMatch[1];
            title = title.replace(/\s+\[[SABC]\]$/, '').trim();
        }
        tasks.push({ cellTitle: match[1].trim(), title, completed, difficulty });
    });

    return tasks;
}

export async function importTasksFromObsidian(
    data: AppData,
    obsidianPath?: string
): Promise<{ data: AppData; imported: number; skipped: number } | null> {
    const obsidianDir = obsidianPath || '../../Gamified-Mandala-Data';
    const exportDir = path.resolve(process.cwd(), obsidianDir);
    const filePath = await getLatestMarkdownFile(exportDir, 'tasks-');
    if (!filePath) return null;

    const content = await fs.readFile(filePath, 'utf-8');
    const parsedTasks = parseTasksMarkdown(content);
    if (parsedTasks.length === 0) {
        return { data, imported: 0, skipped: 0 };
    }

    const updatedData = JSON.parse(JSON.stringify(data)) as AppData;
    const cellIndex = buildCellIndex(updatedData);
    let imported = 0;
    let skipped = 0;

    parsedTasks.forEach((task) => {
        const location = cellIndex.get(task.cellTitle);
        if (!location) {
            skipped += 1;
            return;
        }
        const cell = updatedData.mandala.surroundingSections[location.sectionIndex].surroundingCells[location.cellIndex];
        if (!cell.subTasks) cell.subTasks = [];
        const existing = cell.subTasks.find((subTask) => subTask.title === task.title);
        if (existing) {
            existing.completed = task.completed;
            if (task.difficulty) {
                existing.difficulty = task.difficulty as any;
            }
        } else {
            cell.subTasks.push({
                id: `sub-${Date.now()}-${imported}`,
                title: task.title,
                completed: task.completed,
                difficulty: (task.difficulty as any) || 'B',
                createdAt: new Date().toISOString()
            });
        }
        imported += 1;
    });

    return { data: updatedData, imported, skipped };
}

export async function updateObsidianConfig(exportPath: string, autoSync: boolean): Promise<void> {
    const data = await loadData();
    data.obsidian = {
        exportPath,
        autoSync
    };
    await saveData(data);
}
