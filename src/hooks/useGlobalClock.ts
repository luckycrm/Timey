import { useEffect, useState } from 'react';

export function useGlobalClock(refreshMs = 30000) {
    const [now, setNow] = useState<Date | null>(null);
    const [viewerTimeZone, setViewerTimeZone] = useState('UTC');

    useEffect(() => {
        setNow(new Date());

        try {
            setViewerTimeZone(
                Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            );
        } catch {
            setViewerTimeZone('UTC');
        }

        const timer = window.setInterval(() => {
            setNow(new Date());
        }, refreshMs);

        return () => window.clearInterval(timer);
    }, [refreshMs]);

    return { now, viewerTimeZone };
}
