'use client';

import { motion } from 'framer-motion';
// In a real deployed app, these would be in /public/images
// For now, we will assume they are available or use placeholders if local images aren't moved yet.
// Since Picasso generated them in the artifact folder, we need to instruct the User (or System) to move them.
// For this code, I will reference them as local public assets.

interface TigerAvatarProps {
    level: number;
    mood: string;
}

export function TigerAvatar({ level, mood }: TigerAvatarProps) {
    // Evolution Logic
    let imageSrc = '/tiger_baby.png'; // Default
    let stageName = 'Baby Tiger';

    if (level >= 50) {
        imageSrc = '/tiger_god.png';
        stageName = 'God Beast';
    } else if (level >= 30) {
        imageSrc = '/tiger_adult.png';
        stageName = 'Adult Tiger';
    } else if (level >= 10) {
        imageSrc = '/tiger_child.png';
        stageName = 'Young Tiger';
    }

    // Animation variants
    const bounce = {
        y: [0, -10, 0],
        transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } as any
    };

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <motion.div
                animate={mood === 'Happy' ? bounce : {}}
                className="relative w-48 h-48 rounded-full border-4 border-yellow-500/30 overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.3)] bg-white/10 backdrop-blur-sm"
            >
                {/* Placeholder for the actual image file - assuming user will place them in public/ */}
                {/* We use an img tag pointing to public root */}
                <img
                    src={imageSrc}
                    alt={stageName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // Fallback if image not found
                        (e.target as HTMLImageElement).src = 'https://placehold.co/200x200/orange/white?text=Tiger';
                    }}
                />
            </motion.div>
            <div className="mt-2 text-center">
                <div className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-orange-600">
                    {stageName}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest">Level {level}</div>
            </div>
        </div>
    );
}
