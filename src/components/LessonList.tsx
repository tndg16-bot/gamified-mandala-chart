import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lesson, LessonProgress } from "@/lib/types"
import { BookOpen, Lock, CheckCircle2, Play } from "lucide-react"

interface LessonListProps {
    lessons: Lesson[]
    lessonProgress: LessonProgress[]
    tigerLevel: number
    onStartLesson: (lessonId: string) => void
    onViewLesson: (lesson: Lesson) => void
}

export function LessonList({ lessons, lessonProgress, tigerLevel, onStartLesson, onViewLesson }: LessonListProps) {
    const getLessonStatus = (lesson: Lesson) => {
        const progress = lessonProgress.find(lp => lp.lessonId === lesson.id);
        if (progress?.completed) return { status: 'completed', label: 'Completed', icon: CheckCircle2 };
        if (progress?.startedAt) return { status: 'in-progress', label: 'In Progress', icon: Play };
        if (lesson.requiredLevel > tigerLevel) return { status: 'locked', label: 'Locked', icon: Lock };
        return { status: 'available', label: 'Available', icon: BookOpen };
    };

    return (
        <div className="space-y-4">
            {lessons.map((lesson) => {
                const { status, label, icon: Icon } = getLessonStatus(lesson);
                const isLocked = status === 'locked';

                return (
                    <Card
                        key={lesson.id}
                        className={`transition-all ${isLocked ? 'opacity-60' : 'hover:shadow-lg cursor-pointer'}`}
                        onClick={() => !isLocked && onViewLesson(lesson)}
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant={status === 'completed' ? 'default' : status === 'locked' ? 'secondary' : 'outline'}>
                                            <Icon className="w-3 h-3 mr-1" />
                                            {label}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                            Lvl {lesson.requiredLevel}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-lg">{lesson.title}</CardTitle>
                                    <CardDescription className="mt-2">
                                        {lesson.description}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        {status !== 'locked' && !lessonProgress.find(lp => lp.lessonId === lesson.id)?.startedAt && (
                            <CardContent>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStartLesson(lesson.id);
                                    }}
                                >
                                    Start Lesson
                                </Button>
                            </CardContent>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
