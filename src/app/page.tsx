'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, Sun } from 'lucide-react';

import { AiConfig, AppData, Lesson, MandalaCell, MandalaChart, NotificationConfig, SubTask } from '@/lib/types';
import { aiClient, DEFAULT_CONFIG as DEFAULT_AI_CLIENT_CONFIG } from '@/lib/ai_client';
import { FirestoreService } from '@/lib/firestore_service';
import { registerPushNotifications } from '@/lib/firebase';
import { exportMandalaToMarkdown, exportTasksToMarkdown } from '@/app/actions';

import { useAuth } from '@/components/AuthContext';
import { LessonImportDialog } from '@/components/LessonImportDialog';
import { LessonDetail } from '@/components/LessonDetail';
import { LessonList } from '@/components/LessonList';
import { ChatUI } from '@/components/ChatUI';
import { SettingsDialog } from '@/components/SettingsDialog';
import { TigerAvatar } from '@/components/TigerAvatar';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: false,
  time: '09:00',
  frequency: 'daily',
  weeklyDay: 1,
  emailEnabled: false,
  pushEnabled: false,
};

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [isAddingSuggestions, setIsAddingSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [lessons, setLessons, ] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [xpRange, setXpRange] = useState<'7' | '30'>('7');

  const [generatedMandala, setGeneratedMandala] = useState<{ centerGoal: string; surroundingGoals: string[] } | null>(null);
  const [isGeneratingMandala, setIsGeneratingMandala] = useState(false);
  const [isMandalaPreviewOpen, setIsMandalaPreviewOpen] = useState(false);
  const [userMandalaGoal, setUserMandalaGoal] = useState('');

  // Initialize AI config from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAiConfig = localStorage.getItem('ai_config');
      if (savedAiConfig) {
        const parsedConfig: AiConfig = JSON.parse(savedAiConfig);
        aiClient.updateConfig(parsedConfig);
        console.log("Restored AI config from localStorage:", parsedConfig);
      } else {
        // If no config in localStorage, use default client config
        aiClient.updateConfig(DEFAULT_AI_CLIENT_CONFIG);
      }
    }
    FirestoreService.getAllLessons().then(setLessons).catch(console.error);
  }, []);

  // Effect to load user data (including AI config from Firestore)
  useEffect(() => {
    if (user) {
      setLoading(true);
      FirestoreService.loadUserData(user)
        .then(d => {
          setData(d);
          // Apply AI config from Firestore if available
          if (d.aiConfig) {
            aiClient.updateConfig(d.aiConfig);
            console.log("Applied AI config from Firestore:", d.aiConfig);
          } else {
            // Firestore data might not have aiConfig yet, use client default
            aiClient.updateConfig(DEFAULT_AI_CLIENT_CONFIG);
          }
        })
        .catch(e => {
          console.error("Failed to load user data:", e);
          alert(`Failed to load data: ${e.message}`);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user]);

  // Sound Placeholder
  const playSuccess = () => {
    const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg');
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play failed", e));
  };

  const [zoomSection, setZoomSection] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ sectionId: string, cell: MandalaCell } | null>(null);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(true);
      FirestoreService.loadUserData(user)
        .then(d => {
          setData(d);
        })
        .catch(e => {
          console.error("Failed to load tiger data:", e);
          alert(`Failed to load data: ${e.message}`);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user]);

  const handleAutoSync = useCallback(async () => {
    if (!data || !user || !data.obsidian?.autoSync) return;
    try {
      await exportMandalaToMarkdown(data);
      await exportTasksToMarkdown(data);
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }, [data, user]);

  useEffect(() => {
    if (data?.obsidian?.autoSync) {
      const timer = setTimeout(() => handleAutoSync(), 1000);
      return () => clearTimeout(timer);
    }
  }, [data, handleAutoSync]);

  useEffect(() => {
    if (!data?.notifications?.enabled || !data.notifications.pushEnabled) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;

    const config = data.notifications;
    const shouldSendToday = () => {
      const day = new Date().getDay();
      if (config.frequency === 'weekdays') return day >= 1 && day <= 5;
      if (config.frequency === 'weekly') return day === (config.weeklyDay ?? 1);
      return true;
    };

    const checkAndNotify = () => {
      if (!shouldSendToday()) return;
      if (!config.time) return;
      const [hour, minute] = config.time.split(':').map(Number);
      const now = new Date();
      if (now.getHours() !== hour || now.getMinutes() !== minute) return;

      const todayKey = now.toISOString().split('T')[0];
      const lastSent = localStorage.getItem('notification_last_sent');
      if (lastSent === todayKey) return;

      if (Notification.permission === 'granted') {
        new Notification('Daily Mandala Check-in', {
          body: 'Review your goals and complete one small action today.',
        });
        localStorage.setItem('notification_last_sent', todayKey);
      }
    };

    const interval = window.setInterval(checkAndNotify, 60 * 1000);
    checkAndNotify();
    return () => window.clearInterval(interval);
  }, [data?.notifications]);

  if (authLoading) return <div className="flex h-screen items-center justify-center">Authenticating...</div>;

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white gap-6">
        <h1 className="text-4xl font-bold">🦁 Gamified Mandala</h1>
        <p className="text-slate-400">Sign in to start your journey.</p>
        <Button onClick={signInWithGoogle} size="lg" className="bg-blue-600 hover:bg-blue-500">
          Sign in with Google
        </Button>
      </div>
    );
  }

  const openValidCellModal = (sectionId: string, cell: MandalaCell) => {
    setSelectedCell({ sectionId, cell });
    setAiSuggestions([]);
    setSelectedSuggestions([]);
  };

  const handleAddSubTask = async () => {
    if (!selectedCell || !newSubTaskTitle.trim() || !user || !data) return;

    const newData = await FirestoreService.addSubTask(user, data, selectedCell.sectionId, selectedCell.cell.id, newSubTaskTitle);
    setData(newData);
    setNewSubTaskTitle('');

    // Update local selected cell state
    const updatedSection = newData.mandala.surroundingSections.find(s => s.id === selectedCell.sectionId);
    const updatedCell = updatedSection?.surroundingCells.find(c => c.id === selectedCell.cell.id);
    if (updatedCell) {
      setSelectedCell({ sectionId: selectedCell.sectionId, cell: updatedCell });
    }
  };

  const toggleSuggestion = (suggestion: string) => {
    setSelectedSuggestions((prev) => (
      prev.includes(suggestion)
        ? prev.filter((item) => item !== suggestion)
        : [...prev, suggestion]
    ));
  };

  const handleGenerateSuggestions = async () => {
    if (!selectedCell || !data || !user) return;
    setIsBrainstorming(true);
    try {
      const suggestions = await aiClient.generateActions(
        data.mandala.centerSection.centerCell.title,
        selectedCell.cell.title
      );
      const trimmed = suggestions.map((suggestion) => suggestion.trim()).filter(Boolean);
      setAiSuggestions(trimmed);
      setSelectedSuggestions(trimmed);
    } catch (e: any) {
      console.error("AI Brainstorming failed:", e);
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleAddSuggestions = async (suggestions: string[]) => {
    if (!selectedCell || !data || !user) return;
    const trimmed = suggestions.map((suggestion) => suggestion.trim()).filter(Boolean);
    if (trimmed.length === 0) return;

    setIsAddingSuggestions(true);
    try {
      const newData = await FirestoreService.addSubTasks(
        user,
        data,
        selectedCell.sectionId,
        selectedCell.cell.id,
        trimmed
      );
      setData(newData);

      const updatedSection = newData.mandala.surroundingSections.find(s => s.id === selectedCell.sectionId);
      const updatedCell = updatedSection?.surroundingCells.find(c => c.id === selectedCell.cell.id);
      if (updatedCell) {
        setSelectedCell({ sectionId: selectedCell.sectionId, cell: updatedCell });
      }
      setAiSuggestions([]);
      setSelectedSuggestions([]);
    } catch (e: any) {
      console.error("Adding AI suggestions failed:", e);
    } finally {
      setIsAddingSuggestions(false);
    }
  };

  const handleToggleSubTask = async (subTaskId: string) => {
    if (!selectedCell || !user || !data) return;

    const newData = await FirestoreService.toggleSubTask(user, data, selectedCell.sectionId, selectedCell.cell.id, subTaskId);
    setData(newData);

    // Play Sound if completed
    // Simplification: Toggle logic logic inside service handles XP, here we just play sound blindly for feedback
    playSuccess();

    // Update local selected cell state
    const updatedSection = newData.mandala.surroundingSections.find(s => s.id === selectedCell.sectionId);
    const updatedCell = updatedSection?.surroundingCells.find(c => c.id === selectedCell.cell.id);
    if (updatedCell) {
      setSelectedCell({ sectionId: selectedCell.sectionId, cell: updatedCell });
    }
  };

  // Helper to get ALL Level 3 SubTasks for Kanban
  const getAllSubTasks = () => {
    if (!data) return [];
    const allTasks: (SubTask & { parentTitle: string })[] = [];
    data.mandala.surroundingSections.forEach(sec => {
      sec.surroundingCells.forEach(cell => {
        if (cell.subTasks && cell.subTasks.length > 0) {
          cell.subTasks.forEach(st => {
            allTasks.push({ ...st, parentTitle: cell.title });
          });
        }
      });
    });
    return allTasks;
  };

  const subTasks = getAllSubTasks();
  const todoTasks = subTasks.filter(t => !t.completed);
  const doneTasks = subTasks.filter(t => t.completed);
  const totalTasks = subTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
  const streakDays = data?.tiger.streakDays ?? 0;

  const xpHistory = data?.xpHistory || [];
  const xpHistoryMap = new Map(xpHistory.map(entry => [entry.date, entry.xp]));
  const buildXpSeries = (days: number) => {
    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      series.push({ date: key, xp: xpHistoryMap.get(key) || 0 });
    }
    return series;
  };
  const xpSeries = buildXpSeries(Number(xpRange));
  const xpValues = xpSeries.map(entry => entry.xp);
  const maxXp = Math.max(10, ...xpValues);
  const xpPoints = xpValues.map((value, index) => {
    const x = (index / Math.max(1, xpValues.length - 1)) * 100;
    const y = 100 - (value / maxXp) * 100;
    return `${x},${y}`;
  }).join(' ');
  const todayKey = new Date().toISOString().split('T')[0];
  const todayTasks = subTasks.filter(task => !task.completed && task.createdAt?.startsWith(todayKey));

  const handleExportMarkdown = () => {
    if (!data) return;

    let md = `# ${data.mandala.centerSection.centerCell.title} (Tiger Level: ${data.tiger.level})\n\n`;

    data.mandala.surroundingSections.forEach(sec => {
      md += `## ${sec.centerCell.title}\n`;
      sec.surroundingCells.forEach(cell => {
        const status = cell.subTasks && cell.subTasks.length > 0 && cell.subTasks.every(t => t.completed) ? '[x]' : '[ ]';
        md += `- ${status} ${cell.title}\n`;
        // Add subtasks
        if (cell.subTasks && cell.subTasks.length > 0) {
          cell.subTasks.forEach(st => {
            const stStatus = st.completed ? '[x]' : '[ ]';
            md += `    - ${stStatus} ${st.title}\n`;
          });
        }
      });
      md += '\n';
    });

    navigator.clipboard.writeText(md).then(() => {
      alert("Copied to Clipboard! You can now paste this into Obsidian.");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert("Failed to copy to clipboard.");
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStartLesson = async (lessonId: string) => {
    if (!user || !data) return;
    const newData = await FirestoreService.startLesson(user, data, lessonId);
    setData(newData);
  };

  const handleCompleteLesson = async (lesson: Lesson) => {
    if (!user || !data) return;
    const newData = await FirestoreService.completeLesson(user, data, lesson);
    setData(newData);
  };

  const handleImportLessons = async (importedLessons: Lesson[]) => {
    if (!user) return;
    await FirestoreService.importLessons(importedLessons);
    const updatedLessons = await FirestoreService.getAllLessons();
    setLessons(updatedLessons);
  };

  const handleExportMandala = async () => {
    if (!data || !user) return;
    setExporting(true);
    try {
      const freshData = await FirestoreService.loadUserData(user);
      const filePath = await exportMandalaToMarkdown(freshData);
      alert(`Mandala exported to: ${filePath}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export Mandala. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTasks = async () => {
    if (!data || !user) return;
    setExporting(true);
    try {
      const freshData = await FirestoreService.loadUserData(user);
      const filePath = await exportTasksToMarkdown(freshData);
      alert(`Tasks exported to: ${filePath}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export tasks. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSettings = async (exportPath: string, autoSync: boolean, aiConfig: AiConfig, notifications: NotificationConfig) => {
    if (!user) return;
    try {
      await FirestoreService.updateObsidianConfig(user, exportPath, autoSync);
      await FirestoreService.updateAiConfig(user, aiConfig);
      await FirestoreService.updateNotificationConfig(user, notifications);

      if (notifications.pushEnabled) {
        try {
          const token = await registerPushNotifications();
          if (token) {
            await FirestoreService.addPushToken(user, token);
          } else {
            alert('Push token was not generated. Check browser permissions.');
          }
        } catch (error) {
          console.error('Failed to register push notifications:', error);
          alert('Failed to enable push notifications. Check your VAPID key and service worker config.');
        }
      }設定をFirestoreに保存

      // localStorageにもAI設定を保存
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_config', JSON.stringify(aiConfig));
      }

      // aiClientを更新
      aiClient.updateConfig(aiConfig);

      const newData = await FirestoreService.loadUserData(user); // 最新データを再ロード
      setData(newData);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  };

  // Function to handle Mandala generation
  const handleGenerateMandala = async () => {
    if (!userMandalaGoal.trim() || isGeneratingMandala) return;

    setIsGeneratingMandala(true);
    setGeneratedMandala(null);
    try {
      const result = await aiClient.generateMandalaChart(userMandalaGoal);
      setGeneratedMandala(result);
      setIsMandalaPreviewOpen(true);
    } catch (e: any) {
      console.error("Failed to generate mandala chart:", e);
      alert(`Failed to generate mandala chart: ${e.message}`);
    } finally {
      setIsGeneratingMandala(false);
    }
  };

  // Function to apply generated Mandala to current data
  const handleApplyGeneratedMandala = async () => {
    if (!user || !data || !generatedMandala) return;

    const newMandala: MandalaChart = {
      centerSection: {
        id: "section-center",
        centerCell: { id: "center-goal", title: generatedMandala.centerGoal, completed: false },
        surroundingCells: Array.from({ length: 8 }).map((_, i) => ({
          id: `center-sub-${i}`,
          title: generatedMandala.surroundingGoals[i] || `Goal ${i + 1}`,
          completed: false
        }))
      },
      surroundingSections: Array.from({ length: 8 }).map((_, i) => ({
        id: `section-${i}`,
        centerCell: {
          id: `sec-center-${i}`,
          title: generatedMandala.surroundingGoals[i] || `Goal ${i + 1}`,
          completed: false
        },
        surroundingCells: Array.from({ length: 8 }).map((_, j) => ({
          id: `sec-${i}-cell-${j}`,
          title: `Task ${j + 1}`, // Default tasks for new sections
          completed: false,
          subTasks: []
        }))
      }))
    };

    try {
      const updatedData = await FirestoreService.updateMandalaChart(user, newMandala);
      setData(updatedData);
      setGeneratedMandala(null);
      setIsMandalaPreviewOpen(false);
      setUserMandalaGoal('');
      alert("Mandala chart updated successfully!");
    } catch (e: any) {
      console.error("Failed to apply generated mandala:", e);
      alert(`Failed to apply generated mandala: ${e.message}`);
    }
  };


  if (loading || !data) return <div className="flex h-screen items-center justify-center">Loading Tiger...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 transition-colors duration-1000 print:bg-white print:p-0 bali-bg">

      {/* Header / Tiger HUD - Hide on Print */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:hidden glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <TigerAvatar level={data.tiger.level} mood={data.tiger.mood} />
          <div>
            <h1 className="text-2xl font-bold text-white text-shadow">My Tiger (Lvl {data.tiger.level})</h1>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Sun className="w-4 h-4" /> Mood: {data.tiger.mood}
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center w-full justify-between md:justify-end gap-2">
            <span className="text-xs text-white/70 mr-2 hidden sm:inline">Logged in as {user.displayName}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-red-300 hover:bg-red-500/20">Logout</Button>
          </div>
          <Separator orientation="vertical" className="hidden md:block h-6" />
          <div className="flex gap-2 w-full md:w-auto print:hidden">
            <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setIsImportDialogOpen(true)}>📂 Import</Button>
            <Button variant={copied ? "default" : "secondary"} className="flex-1 md:flex-none" onClick={handleExportMarkdown}>
              {copied ? "✅ Copied!" : "📤 MD"}
            </Button>
            <Button variant="outline" className="flex-1 md:flex-none" onClick={handlePrint}>🖨️ PDF</Button>
            <Button
              variant="outline"
              className="flex-1 md:flex-none"
              onClick={() => setIsSettingsDialogOpen(true)}
              aria-label="Open settings"
            >
              ⚙️
            </Button>
          </div>
          <div className="w-full md:w-64">
            <div className="flex justify-between text-xs mb-1">
              <span>XP: {data.tiger.xp}</span>
              <span>Next: {(Math.floor(data.tiger.xp / 100) + 1) * 100}</span>
            </div>
            <Progress value={data.tiger.xp % 100} className="h-2" />
            {data.obsidian?.autoSync && (
              <div className="text-[10px] text-orange-300 mt-1">Auto-sync: ON</div>
            )}
          </div>
        </div>
      </div>

      {/* Obsidian Export Bar */}
      <div className="glass-panel rounded-xl p-3 mb-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Obsidian Integration</span>
            {data.obsidian?.autoSync && (
              <Badge variant="secondary" className="text-[10px]">Auto-sync: ON</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMandala}
              disabled={exporting}
              className="text-xs"
            >
              📊 Export Mandala
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTasks}
              disabled={exporting}
              className="text-xs"
            >
              ✅ Export Tasks
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="mandala" className="w-full">
        <TabsList className="grid w-full grid-cols-5 print:hidden glass-panel rounded-xl">
          <TabsTrigger value="dashboard" className="text-white data-[state=active]:bg-white/20">Dashboard</TabsTrigger>
          <TabsTrigger value="mandala" className="text-white data-[state=active]:bg-white/20">Mandala View</TabsTrigger>
          <TabsTrigger value="kanban" className="text-white data-[state=active]:bg-white/20">Kanban View</TabsTrigger>
          <TabsTrigger value="lessons" className="text-white data-[state=active]:bg-white/20">Lessons</TabsTrigger>
          <TabsTrigger value="chat" className="text-white data-[state=active]:bg-white/20">AI Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overall progress</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div
                  className="h-32 w-32 rounded-full flex items-center justify-center"
                  style={{
                    background: `conic-gradient(#fb923c ${completionRate}%, rgba(255,255,255,0.12) 0)`
                  }}
                >
                  <div className="h-20 w-20 rounded-full bg-slate-900/80 flex items-center justify-center text-lg font-bold text-white">
                    {completionRate}%
                  </div>
                </div>
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Completed</span>
                    <span>{doneTasks.length}/{totalTasks}</span>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">XP trend</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={xpRange === '7' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="text-xs"
                      onClick={() => setXpRange('7')}
                    >
                      7d
                    </Button>
                    <Button
                      variant={xpRange === '30' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="text-xs"
                      onClick={() => setXpRange('30')}
                    >
                      30d
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-32 w-full rounded-md border border-white/10 bg-white/5 p-3">
                  <svg viewBox="0 0 100 100" className="h-full w-full">
                    <polyline
                      fill="none"
                      stroke="#fb923c"
                      strokeWidth="3"
                      points={xpPoints}
                    />
                  </svg>
                </div>
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Total XP</span>
                  <span>{data.tiger.xp}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Streak</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold text-white">{streakDays} days</div>
                <div className="text-xs text-white/70">Keep the chain alive by completing a task today.</div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Today tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayTasks.length > 0 ? (
                    todayTasks.slice(0, 6).map(task => (
                      <div key={task.id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-xs text-white/80">
                        <span className="truncate">{task.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{task.parentTitle}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-white/60">No tasks scheduled for today.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mandala" className="mt-4">
          <AnimatePresence mode="wait">
            {!zoomSection ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="grid grid-cols-3 gap-2 max-w-2xl mx-auto aspect-square p-2"
              >
                {/* Level 1 View: Center Core + 8 Areas */}
                {Array.from({ length: 9 }).map((_, i) => {
                  if (i === 4) {
                    const center = data.mandala.centerSection.centerCell;
                    return (
                      <Card key={center.id} className="glass-panel flex flex-col items-center justify-center p-2 md:p-4 text-center border-orange-400/50 shadow-lg">
                        <div className="font-bold text-sm md:text-lg break-words w-full text-white text-shadow">{center.title}</div>
                        <div className="text-[10px] md:text-xs text-white/70 mt-1 hidden sm:block">(Core Vision)</div>
                      </Card>
                    );
                  }

                  const dataIndex = i < 4 ? i : i - 1;
                  const sec = data.mandala.surroundingSections[dataIndex];
                  if (!sec) return <div key={i} className="bg-muted/20 rounded-md" />; // Placeholder for missing data

                  return (
                    <Card key={sec.id} onClick={() => setZoomSection(sec.id)} className="glass-card cursor-pointer transition-all flex items-center justify-center p-2 md:p-4 text-center rounded-xl">
                      <h3 className="font-semibold text-xs md:text-base break-words w-full text-white">{sec.centerCell?.title || 'Empty'}</h3>
                    </Card>
                  )
                })}
              </motion.div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <Button variant="ghost" onClick={() => setZoomSection(null)} className="mb-4">← Back to Overview</Button>
                <div className="grid grid-cols-3 gap-2 aspect-square p-2">
                  {/* Level 2 View: Area Sub-Goal (Center) + 8 Means (Surrounding) */}
                  {Array.from({ length: 9 }).map((_, i) => {
                    const section = data.mandala.surroundingSections.find(s => s.id === zoomSection);
                    if (!section) return null;

                    // Index 4 is the Section Center (The Sub-Goal)
                    if (i === 4) {
                      return (
                        <Card key={section.centerCell.id} className="glass-panel flex flex-col items-center justify-center p-2 md:p-4 text-center border-orange-400/50 font-bold shadow-lg">
                          <span className="text-xs md:text-base break-words w-full text-white text-shadow">{section.centerCell.title}</span>
                        </Card>
                      );
                    }

                    // Surrounding Cells (The Means/Tasks)
                    const cellIndex = i < 4 ? i : i - 1;
                    const cell = section.surroundingCells[cellIndex];

                    return (
                      <Card
                        key={cell.id}
                        onClick={() => openValidCellModal(section.id, cell)}
                        className="glass-card cursor-pointer flex flex-col items-center justify-center p-1 md:p-2 text-center text-sm relative group transition-all rounded-xl"
                      >
                        <span className="break-words w-full px-1 text-[10px] md:text-sm text-white">{cell.title}</span>
                        <div className="absolute bottom-1 right-1">
                          {cell.subTasks && cell.subTasks.length > 0 ? (
                            <Badge variant="secondary" className="text-[8px] md:text-[10px] bg-white/20 text-white">{cell.subTasks.filter(t => t.completed).length}/{cell.subTasks.length}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] md:text-[10px] opacity-0 group-hover:opacity-100 transition-opacity border-white/50 text-white">+</Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="kanban">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-auto md:h-[600px] overflow-y-auto md:overflow-hidden pb-8 md:pb-0">
            <KanbanColumn title="To Do" tasks={todoTasks} />
            <KanbanColumn title="Doing" tasks={[]} />
            <KanbanColumn title="Done" tasks={doneTasks} />
          </div>
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <ChatUI className="max-w-2xl mx-auto" />
        </TabsContent>

        <TabsContent value="lessons" className="mt-4">
          {selectedLesson ? (
            <LessonDetail
              lesson={selectedLesson}
              progress={data?.lessonProgress?.find(lp => lp.lessonId === selectedLesson.id)}
              onBack={() => setSelectedLesson(null)}
              onCompleteLesson={handleCompleteLesson}
            />
          ) : (
            <LessonList
              lessons={lessons}
              lessonProgress={data?.lessonProgress || []}
              tigerLevel={data?.tiger.level || 1}
              onStartLesson={handleStartLesson}
              onViewLesson={setSelectedLesson}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Level 3: SubTask Modal */}
      <Dialog
        open={!!selectedCell}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCell(null);
            setAiSuggestions([]);
            setSelectedSuggestions([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted-foreground uppercase">Means (方法)</span>
              <div className="flex items-center gap-2">
                <input
                  className="text-xl font-bold bg-transparent border-b border-transparent hover:border-muted-foreground focus:border-primary focus:outline-none w-full"
                  value={selectedCell?.cell.title || ''}
                  onChange={(e) => {
                    if (!selectedCell || !data) return;
                    // Optimistic UI update for typing feel, actual save on blur
                    const newTitle = e.target.value;
                    const savedSectionId = selectedCell.sectionId;
                    const savedCellId = selectedCell.cell.id;

                    // Deep update locally to reflect typing
                    const newData = JSON.parse(JSON.stringify(data)) as AppData;
                    const sec = newData.mandala.surroundingSections.find(s => s.id === savedSectionId);
                    const c = sec?.surroundingCells.find(cl => cl.id === savedCellId);
                    if (c) c.title = newTitle;
                    setData(newData);

                    // Keep selection valid
                    if (c) setSelectedCell({ sectionId: savedSectionId, cell: c });
                  }}
                  onBlur={async (e) => {
                    if (!selectedCell || !user || !data) return;
                    await FirestoreService.updateCellTitle(user, data, selectedCell.sectionId, selectedCell.cell.id, e.target.value);
                  }}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">✎ Edit</span>
              </div>
            </div>
            <DialogDescription>
              この手段を達成するための「具体的な行動（Actions）」を登録してください。<br />
              Add specific actions to achieve this means.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Add Task Input */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubTaskTitle}
                  onChange={(e) => setNewSubTaskTitle(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Ex: Read 5 pages, Do 10 squats..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()}
                />
                <Button onClick={handleAddSubTask}>Add</Button>
              </div>

              {/* AI Brainstorming Button */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  title="Configure AI Endpoint"
                  onClick={() => {
                    const current = aiClient.getConfig().baseUrl;
                    const newUrl = prompt("Enter Local AI URL (e.g. http://localhost:11434 or Ngrok URL):", current);
                    if (newUrl) {
                      aiClient.setBaseUrl(newUrl);
                      localStorage.setItem('ai_base_url', newUrl); // Save to localStorage
                      alert(`AI Endpoint set to: ${newUrl}`);
                    }
                  }}
                >
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 gap-1"
                  onClick={handleGenerateSuggestions}
                  disabled={isBrainstorming || isAddingSuggestions}
                >
                  {isBrainstorming ? (
                    <span className="animate-pulse">Thinking...</span>
                  ) : (
                    <>AI suggestions (3-5)</>
                  )}
                </Button>
              </div>

              {aiSuggestions.length > 0 && (
                <div className="rounded-md border border-dashed p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">AI suggestions</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleAddSuggestions(aiSuggestions)}
                        disabled={isAddingSuggestions}
                      >
                        {isAddingSuggestions ? "Adding..." : "Add all"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleAddSuggestions(selectedSuggestions)}
                        disabled={isAddingSuggestions || selectedSuggestions.length === 0}
                      >
                        Add selected
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {aiSuggestions.map((suggestion) => {
                      const checked = selectedSuggestions.includes(suggestion);
                      return (
                        <div key={suggestion} className="flex items-center gap-2 rounded-md border px-2 py-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-orange-500"
                            checked={checked}
                            onChange={() => toggleSuggestion(suggestion)}
                          />
                          <span className="flex-1 text-xs">{suggestion}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleAddSuggestions([suggestion])}
                            disabled={isAddingSuggestions}
                          >
                            Add
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Task List */}
            <div className="h-[200px] w-full rounded-md border p-4 overflow-y-auto">
              <div className="space-y-2">
                {selectedCell?.cell.subTasks?.map((subTask) => (
                  <div key={subTask.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer" onClick={() => handleToggleSubTask(subTask.id)}>
                    {subTask.completed ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                    <span className={`text-sm ${subTask.completed ? 'line-through text-muted-foreground' : ''}`}>{subTask.title}</span>
                  </div>
                ))}
                {(!selectedCell?.cell.subTasks || selectedCell?.cell.subTasks.length === 0) && (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    No actions yet. Add one above!
                  </div>
                )}
              </div>
            </div>
          </div>
          </DialogContent>
        </Dialog>

      {/* Lesson Import Dialog */}
      <LessonImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleImportLessons}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
        obsidianPath={data?.obsidian?.exportPath || '../../Gamified-Mandala-Data'}
        autoSync={data?.obsidian?.autoSync || false}
        aiConfig={data?.aiConfig || DEFAULT_AI_CLIENT_CONFIG}
        notificationConfig={data?.notifications || DEFAULT_NOTIFICATION_CONFIG} // aiConfigを追加
        onSave={handleSaveSettings}
      />

    </div>
  );
}

function KanbanColumn({ title, tasks }: { title: string, tasks: any[] }) {
  return (
    <Card className="h-full bg-muted/50 flex flex-col">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">{title} {tasks ? `(${tasks.length})` : ''}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {tasks && tasks.map((task: any, i: number) => (
            <Card key={i} className="p-3 shadow-sm cursor-grab active:cursor-grabbing hover:bg-accent transition-colors">
              <div className="text-sm font-medium">{task.title}</div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] truncate max-w-[150px]">{task.parentTitle}</Badge>
              </div>
            </Card>
          ))}
          {(!tasks || tasks.length === 0) && (
            <div className="text-xs text-muted-foreground text-center py-4">No tasks</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
