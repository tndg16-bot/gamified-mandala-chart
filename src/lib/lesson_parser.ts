import { Lesson } from "./types";

export interface ParsedLesson {
    title: string;
    description: string;
    content: string;
    requiredLevel: number;
    xp: number;
}

export function parseLessonsFromMarkdown(markdown: string): ParsedLesson[] {
    const lessons: ParsedLesson[] = [];
    
    const lessonBlocks = markdown.split(/^={3,}\s*$/m).filter(block => block.trim());
    
    for (const block of lessonBlocks) {
        const lesson = parseSingleLesson(block);
        if (lesson) {
            lessons.push(lesson);
        }
    }
    
    return lessons;
}

function parseSingleLesson(block: string): ParsedLesson | null {
    const lines = block.split('\n').map(l => l.trimEnd());
    
    let title = '';
    let description = '';
    let content = '';
    let requiredLevel = 1;
    let xp = 50;
    
    let titleLineIndex = -1;
    let separatorIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('# ')) {
            title = line.substring(2).trim();
            titleLineIndex = i;
        } else if (line.startsWith('<!-- level:')) {
            const match = line.match(/level:\s*(\d+)/);
            if (match) requiredLevel = parseInt(match[1], 10);
        } else if (line.startsWith('<!-- xp:')) {
            const match = line.match(/xp:\s*(\d+)/);
            if (match) xp = parseInt(match[1], 10);
        } else if (line === '---') {
            separatorIndex = i;
            break;
        }
    }
    
    if (!title) return null;

    let currentLineIndex = titleLineIndex + 1;

    // Extract metadata and description
    while (currentLineIndex < lines.length && lines[currentLineIndex] !== '---') {
        const line = lines[currentLineIndex];
        if (line.startsWith('<!-- level:')) {
            const match = line.match(/level:\s*(\d+)/);
            if (match) requiredLevel = parseInt(match[1], 10);
        } else if (line.startsWith('<!-- xp:')) {
            const match = line.match(/xp:\s*(\d+)/);
            if (match) xp = parseInt(match[1], 10);
        } else if (line.trim() !== '') {
            descriptionLines.push(line);
        }
        currentLineIndex++;
    }
    description = descriptionLines.join(' ').trim();
    
    separatorIndex = lines.indexOf('---', titleLineIndex + 1); // Ensure it's after title
    if (separatorIndex === -1) {
        // If no separator found, consider everything after metadata/description as content
        separatorIndex = currentLineIndex - 1; // Mark the end of description processing
        content = lines.slice(separatorIndex + 1).join('\n').trim();
    } else {
        content = lines.slice(separatorIndex + 1).join('\n').trim();
    }
    
    return { title, description, content, requiredLevel, xp };
}

export function convertParsedLessonsToLessons(parsedLessons: ParsedLesson[]): Lesson[] {
    return parsedLessons.map((pl, index) => ({
        id: `lesson-${Date.now()}-${index}`,
        title: pl.title,
        description: pl.description,
        content: pl.content,
        order: index,
        requiredLevel: pl.requiredLevel,
        xp: pl.xp
    }));
}
