'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiConfig, AiProvider, NotificationConfig, NotificationFrequency } from '@/lib/types'; // types.tsからインポート

const DEFAULT_AI_CONFIG: AiConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'gemma3:1b', // Lightweight model for speed
};

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    obsidianPath: string;
    autoSync: boolean;
    aiConfig: AiConfig; // AiConfigを追加
    notificationConfig: NotificationConfig;
    onSave: (path: string, autoSync: boolean, aiConfig: AiConfig, notifications: NotificationConfig) => Promise<void>; // onSaveのシグネチャ変更
}

export function SettingsDialog({ open, onOpenChange, obsidianPath, autoSync, aiConfig, notificationConfig, onSave }: SettingsDialogProps) {
    const [localPath, setLocalPath] = useState(obsidianPath);
    const [localAutoSync, setLocalAutoSync] = useState(autoSync);
    const [localAiConfig, setLocalAiConfig] = useState<AiConfig>(aiConfig); // localAiConfigを追加
    const [localNotificationConfig, setLocalNotificationConfig] = useState<NotificationConfig>(notificationConfig);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(localPath, localAutoSync, localAiConfig, localNotificationConfig); // localAiConfigを渡す
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your application settings including Obsidian and AI integration.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Obsidian Settings */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg border-b pb-2">Obsidian Integration</h4>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="obsidian-path" className="text-right">
                                Export Path
                            </Label>
                            <Input
                                id="obsidian-path"
                                value={localPath}
                                onChange={(e) => setLocalPath(e.target.value)}
                                className="col-span-3"
                                placeholder="../../Gamified-Mandala-Data"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="auto-sync" className="text-right">
                                Auto Sync
                            </Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                                            <input
                                                                type="checkbox"
                                                                id="auto-sync"
                                                                checked={localAutoSync}
                                                                onChange={(e) => setLocalAutoSync(e.target.checked)}
                                                                className="h-4 w-4"
                                                                data-testid="input-auto-sync" // Add data-testid
                                                            />                                <span className="text-sm text-muted-foreground">
                                    Automatically export to Obsidian on changes
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* AI Settings */}
                    <div className="space-y-2 mt-6">
                        <h4 className="font-semibold text-lg border-b pb-2">AI Integration</h4>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ai-provider" className="text-right">
                                AI Provider
                            </Label>
                            <Select
                                value={localAiConfig.provider}
                                onValueChange={(value: AiProvider) =>
                                    setLocalAiConfig(prev => ({ ...prev, provider: value }))
                                }
                                data-testid="select-ai-provider"
                            >
                                <SelectTrigger className="col-span-3" id="ai-provider">
                                    <SelectValue placeholder="Select AI Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ollama">Ollama</SelectItem>
                                    <SelectItem value="gemini">Gemini</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Base URL */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ai-baseUrl" className="text-right">
                                Base URL
                            </Label>
                            <Input
                                id="ai-baseUrl"
                                value={localAiConfig.baseUrl}
                                onChange={(e) =>
                                    setLocalAiConfig(prev => ({ ...prev, baseUrl: e.target.value }))
                                }
                                className="col-span-3"
                                placeholder={localAiConfig.provider === 'ollama' ? "http://localhost:11434" : (localAiConfig.provider === 'gemini' ? "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent" : "Your API URL")}
                            />
                        </div>

                        {/* Model */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ai-model" className="text-right">
                                Model
                            </Label>
                            <Input
                                id="ai-model"
                                value={localAiConfig.model}
                                onChange={(e) =>
                                    setLocalAiConfig(prev => ({ ...prev, model: e.target.value }))
                                }
                                className="col-span-3"
                                placeholder={localAiConfig.provider === 'ollama' ? "gemma3:1b" : (localAiConfig.provider === 'gemini' ? "gemini-pro" : "Your model name")}
                            />
                        </div>

                        {/* API Key (only for Gemini/Custom) */}
                        {(localAiConfig.provider === 'gemini' || localAiConfig.provider === 'custom') && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="ai-apiKey" className="text-right">
                                    API Key
                                </Label>
                                <Input
                                    id="ai-apiKey"
                                    type="password"
                                    value={localAiConfig.apiKey || ''}
                                    onChange={(e) =>
                                        setLocalAiConfig(prev => ({ ...prev, apiKey: e.target.value }))
                                    }
                                    className="col-span-3"
                                    placeholder="Your API Key"
                                />
                            </div>
                        )}
                    </div>
                    {/* Notification Settings */}
                    <div className="space-y-2 mt-6">
                        <h4 className="font-semibold text-lg border-b pb-2">Notifications</h4>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="notif-enabled" className="text-right">
                                Enable
                            </Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="notif-enabled"
                                    checked={localNotificationConfig.enabled}
                                    onChange={(e) =>
                                        setLocalNotificationConfig(prev => ({ ...prev, enabled: e.target.checked }))
                                    }
                                    className="h-4 w-4"
                                />
                                <span className="text-sm text-muted-foreground">
                                    Send daily reminders
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="notif-time" className="text-right">
                                Time
                            </Label>
                            <Input
                                id="notif-time"
                                type="time"
                                value={localNotificationConfig.time}
                                onChange={(e) =>
                                    setLocalNotificationConfig(prev => ({ ...prev, time: e.target.value }))
                                }
                                className="col-span-3"
                                disabled={!localNotificationConfig.enabled}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="notif-frequency" className="text-right">
                                Frequency
                            </Label>
                            <Select
                                value={localNotificationConfig.frequency}
                                onValueChange={(value: NotificationFrequency) =>
                                    setLocalNotificationConfig(prev => ({ ...prev, frequency: value }))
                                }
                                data-testid="select-notif-frequency"
                            >
                                <SelectTrigger className="col-span-3" id="notif-frequency">
                                    <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekdays">Weekdays</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {localNotificationConfig.frequency === 'weekly' && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="notif-weekday" className="text-right">
                                    Day
                                </Label>
                                <Select
                                    value={String(localNotificationConfig.weeklyDay ?? 1)}
                                    onValueChange={(value) =>
                                        setLocalNotificationConfig(prev => ({ ...prev, weeklyDay: Number(value) }))
                                    }
                                    data-testid="select-notif-weekly-day"
                                >
                                    <SelectTrigger className="col-span-3" id="notif-weekday">
                                        <SelectValue placeholder="Select day" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Sunday</SelectItem>
                                        <SelectItem value="1">Monday</SelectItem>
                                        <SelectItem value="2">Tuesday</SelectItem>
                                        <SelectItem value="3">Wednesday</SelectItem>
                                        <SelectItem value="4">Thursday</SelectItem>
                                        <SelectItem value="5">Friday</SelectItem>
                                        <SelectItem value="6">Saturday</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="notif-email" className="text-right">
                                Email
                            </Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="notif-email"
                                    checked={localNotificationConfig.emailEnabled}
                                    onChange={(e) =>
                                        setLocalNotificationConfig(prev => ({ ...prev, emailEnabled: e.target.checked }))
                                    }
                                    className="h-4 w-4"
                                    disabled={!localNotificationConfig.enabled}
                                />
                                <span className="text-sm text-muted-foreground">
                                    Email reminders (requires backend)
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="notif-push" className="text-right">
                                Push
                            </Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="notif-push"
                                    checked={localNotificationConfig.pushEnabled}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        if (checked && typeof Notification !== 'undefined') {
                                            const permission = await Notification.requestPermission();
                                            if (permission !== 'granted') {
                                                alert('Push permission denied.');
                                                return;
                                            }
                                        }
                                        if (checked && typeof Notification === 'undefined') {
                                            alert('Push notifications are not supported in this browser.');
                                            return;
                                        }
                                        setLocalNotificationConfig(prev => ({ ...prev, pushEnabled: checked }));
                                    }}
                                    className="h-4 w-4"
                                    disabled={!localNotificationConfig.enabled}
                                />
                                <span className="text-sm text-muted-foreground">
                                    Browser push notifications
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
