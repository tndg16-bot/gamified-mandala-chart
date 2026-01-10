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
    evolutionStage: 'Egg' | 'Cub' | 'Adult' | 'Awakened';
    pokedex: string[]; // List of IDs of past cleared tigers
};

export type AppData = {
    mandala: MandalaChart;
    tiger: TigerStats;
};
