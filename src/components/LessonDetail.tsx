import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Lesson, LessonProgress } from "@/lib/types"
import { ArrowLeft, CheckCircle2, Trophy, Clock } from "lucide-react"

interface LessonDetailProps {
    lesson: Lesson
    progress: LessonProgress | undefined
    onBack: () => void
    onCompleteLesson: () => void
}

export function LessonDetail({ lesson, progress, onBack, onCompleteLesson }: LessonDetailProps) {
    const isCompleted = progress?.completed;
    const isStarted = progress?.startedAt;

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

                        {isCompleted && (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
                                <CheckCircle2 className="w-6 h-6" />
                                <div>
                                    <div className="font-semibold">Lesson Completed!</div>
                                    <div className="text-sm text-green-600">You earned 50 XP</div>
                                </div>
                            </div>
                        )}

                        {!isCompleted && isStarted && (
                            <div className="flex justify-end">
                                <Button onClick={onCompleteLesson} size="lg" className="gap-2">
                                    <Trophy className="w-5 h-5" />
                                    Complete Lesson (+50 XP)
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
