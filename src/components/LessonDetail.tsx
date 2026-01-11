import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Lesson, LessonProgress } from "@/lib/types"
import { ArrowLeft, CheckCircle2, Trophy, Clock } from "lucide-react"

interface LessonDetailProps {
    lesson: Lesson
    progress: LessonProgress | undefined
    onBack: () => void
    onCompleteLesson: (lesson: Lesson) => void
    isOwner?: boolean
    onTogglePublish?: (lesson: Lesson, publish: boolean) => void
    onUpdateCategory?: (lesson: Lesson, category: string) => void
    onUpdatePrice?: (lesson: Lesson, priceCents: number) => void
}

export function LessonDetail({
    lesson,
    progress,
    onBack,
    onCompleteLesson,
    isOwner,
    onTogglePublish,
    onUpdateCategory
}: LessonDetailProps) {
    const isCompleted = progress?.completed;
    const isStarted = progress?.startedAt;
    const [category, setCategory] = useState(lesson.category || "");
    const [price, setPrice] = useState(
        lesson.priceCents !== undefined ? String(lesson.priceCents / 100) : ""
    );

    useEffect(() => {
        setCategory(lesson.category || "");
        setPrice(lesson.priceCents !== undefined ? String(lesson.priceCents / 100) : "");
    }, [lesson.category, lesson.id]);

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <Button variant="ghost" onClick={onBack} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Lessons
            </Button>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant={isCompleted ? 'default' : 'outline'}>
                                    {isCompleted ? 'Completed' : isStarted ? 'In Progress' : 'Not Started'}
                                </Badge>
                                <Badge variant="outline">
                                    Lvl {lesson.requiredLevel}
                                </Badge>
                                {lesson.isPublic && (
                                    <Badge variant="secondary">Public</Badge>
                                )}
                            </div>
                            <CardTitle className="text-2xl">{lesson.title}</CardTitle>
                            <CardDescription className="mt-2">
                                {lesson.description}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                    <div className="space-y-6">
                        {progress && (
                            <div className="flex gap-4 text-sm text-muted-foreground">
                                {progress.startedAt && (
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Started: {new Date(progress.startedAt).toLocaleDateString()}
                                    </div>
                                )}
                                {progress.completedAt && (
                                    <div className="flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-yellow-500" />
                                        Completed: {new Date(progress.completedAt).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="prose prose-slate max-w-none">
                            <h3 className="text-lg font-semibold mb-3">Lesson Content</h3>
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                {lesson.content}
                            </div>
                        </div>

                        {isOwner && (
                            <div className="rounded-md border border-white/10 bg-white/5 p-4 space-y-2">
                                <div className="text-sm font-semibold">Publishing</div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        onBlur={() => onUpdateCategory?.(lesson, category.trim())}
                                        placeholder="Category (e.g. Productivity)"
                                        className="flex-1"
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        onBlur={() => {
                                            const value = Number(price);
                                            if (!Number.isNaN(value)) {
                                                onUpdatePrice?.(lesson, Math.round(value * 100));
                                            }
                                        }}
                                        placeholder="Price (USD)"
                                        className="w-32"
                                    />
                                    <Button
                                        variant={lesson.isPublic ? "outline" : "default"}
                                        onClick={() => onTogglePublish?.(lesson, !lesson.isPublic)}
                                    >
                                        {lesson.isPublic ? "Unpublish" : "Publish"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {isCompleted && (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
                                <CheckCircle2 className="w-6 h-6" />
                                <div>
                                    <div className="font-semibold">Lesson Completed!</div>
                                    <div className="text-sm text-green-600">You earned {lesson.xp} XP</div>
                                </div>
                            </div>
                        )}

                        {!isCompleted && isStarted && (
                            <div className="flex justify-end">
                                <Button onClick={() => onCompleteLesson(lesson)} size="lg" className="gap-2">
                                    <Trophy className="w-5 h-5" />
                                    Complete Lesson (+{lesson.xp} XP)
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
