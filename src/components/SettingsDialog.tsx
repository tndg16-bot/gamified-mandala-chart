'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    obsidianPath: string;
    autoSync: boolean;
    onSave: (path: string, autoSync: boolean) => Promise<void>;
}

export function SettingsDialog({ open, onOpenChange, obsidianPath, autoSync, onSave }: SettingsDialogProps) {
    const [localPath, setLocalPath] = useState(obsidianPath);
    const [localAutoSync, setLocalAutoSync] = useState(autoSync);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(localPath, localAutoSync);
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
                        Configure your application settings including Obsidian integration.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="text-right text-sm font-medium">
                            Export Path
                        </span>
                        <Input
                            id="obsidian-path"
                            value={localPath}
                            onChange={(e) => setLocalPath(e.target.value)}
                            className="col-span-3"
                            placeholder="../../Gamified-Mandala-Data"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="text-right text-sm font-medium">
                            Auto Sync
                        </span>
                        <div className="col-span-3 flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="auto-sync"
                                checked={localAutoSync}
                                onChange={(e) => setLocalAutoSync(e.target.checked)}
                                className="h-4 w-4"
                            />
                            <span className="text-sm text-muted-foreground">
                                Automatically export to Obsidian on changes
                            </span>
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