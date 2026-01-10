import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseLessonsFromMarkdown, convertParsedLessonsToLessons, ParsedLesson } from "@/lib/lesson_parser";
import { Lesson } from "@/lib/types";
import { FileText, CheckCircle, AlertCircle, Upload } from "lucide-react";

interface LessonImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (lessons: Lesson[]) => Promise<void>;
}

export function LessonImportDialog({ open, onOpenChange, onImport }: LessonImportDialogProps) {
    const [markdown, setMarkdown] = useState("");
    const [parsedLessons, setParsedLessons] = useState<ParsedLesson[]>([]);
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const handleParse = () => {
        try {
            const lessons = parseLessonsFromMarkdown(markdown);
            if (lessons.length === 0) {
                setErrorMessage("No valid lessons found. Please check the format.");
                setIsValid(false);
                setParsedLessons([]);
                return;
            }
            setParsedLessons(lessons);
            setIsValid(true);
            setErrorMessage("");
        } catch (e: any) {
            setErrorMessage(e.message || "Failed to parse markdown");
            setIsValid(false);
            setParsedLessons([]);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setMarkdown(content);
            handleParse();
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (parsedLessons.length === 0) return;

        setIsImporting(true);
        try {
            const lessons = convertParsedLessonsToLessons(parsedLessons);
            await onImport(lessons);
            setMarkdown("");
            setParsedLessons([]);
            setIsValid(null);
            onOpenChange(false);
        } catch (e: any) {
            setErrorMessage(e.message || "Import failed");
        } finally {
            setIsImporting(false);
        }
    };

    const handleClear = () => {
        setMarkdown("");
        setParsedLessons([]);
        setIsValid(null);
        setErrorMessage("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Import Lessons from Markdown
                    </DialogTitle>
                    <DialogDescription>
                        Paste your lesson content in Markdown format or upload a .md file.
                        Format: <code className="bg-muted px-1 py-0.5 rounded text-xs"># Title | Description | --- | Content | ===</code>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="file"
                                accept=".md,.txt"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <Button variant="outline" size="sm" asChild>
                                <span className="flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    Upload File
                                </span>
                            </Button>
                        </label>
                        {markdown && (
                            <Button variant="ghost" size="sm" onClick={handleClear}>
                                Clear
                            </Button>
                        )}
                    </div>

                    <Textarea
                        placeholder="# Lesson Title&#10;&#10;&lt;!-- level: 1 --&gt;&#10;&lt;!-- xp: 50 --&gt;&#10;&#10;Lesson description here.&#10;&#10;---&#10;&#10;Lesson content here...&#10;&#10;==="
                        value={markdown}
                        onChange={(e) => {
                            setMarkdown(e.target.value);
                            if (isValid !== null) setIsValid(null);
                            if (errorMessage) setErrorMessage("");
                        }}
                        className="min-h-[150px] font-mono text-sm"
                    />

                    <Button
                        onClick={handleParse}
                        variant="secondary"
                        className="w-full"
                        disabled={!markdown.trim()}
                    >
                        Parse Markdown
                    </Button>

                    {errorMessage && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{errorMessage}</span>
                        </div>
                    )}

                    {isValid && parsedLessons.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Found {parsedLessons.length} lesson(s)</span>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {parsedLessons.map((lesson, idx) => (
                                    <div key={idx} className="border rounded-md p-3 bg-muted/30">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="font-medium text-sm">{lesson.title}</h4>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <Badge variant="outline" className="text-xs">Lvl {lesson.requiredLevel}</Badge>
                                                <Badge variant="outline" className="text-xs">{lesson.xp} XP</Badge>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lesson.description}</p>
                                        {lesson.content.length > 0 && (
                                            <div className="mt-2 text-xs text-muted-foreground">
                                                {lesson.content.substring(0, 50)}...
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={parsedLessons.length === 0 || isImporting}
                    >
                        {isImporting ? "Importing..." : "Import Lessons"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
