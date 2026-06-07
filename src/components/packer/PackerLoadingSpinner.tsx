import { useEffect, useState } from 'react';
import { AppWindow, Box, Package, Boxes } from 'lucide-react';
import { cn } from '@/lib/cn';

const ICONS = [AppWindow, Box, Package, Boxes];

interface PackerLoadingSpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
};

export function PackerLoadingSpinner({
    className,
    size = 'md',
}: PackerLoadingSpinnerProps) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % ICONS.length);
        }, 200);

        return () => clearInterval(timer);
    }, []);

    const Icon = ICONS[index];

    return <Icon className={cn(SIZE_MAP[size], 'animate-pulse text-primary', className)} />;
}
