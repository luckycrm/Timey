export interface GlobalHub {
    city: string;
    country: string;
    region: string;
    timeZone: string;
    accent: string;
    focus: string;
    code: string;
}

export const globalHubs: GlobalHub[] = [
    {
        city: 'Toronto',
        country: 'Canada',
        region: 'North America',
        timeZone: 'America/Toronto',
        accent: '#0f766e',
        focus: 'Client delivery',
        code: 'YYZ',
    },
    {
        city: 'London',
        country: 'United Kingdom',
        region: 'Europe',
        timeZone: 'Europe/London',
        accent: '#c96f2d',
        focus: 'Cross-region planning',
        code: 'LON',
    },
    {
        city: 'Dubai',
        country: 'United Arab Emirates',
        region: 'Middle East',
        timeZone: 'Asia/Dubai',
        accent: '#6a57d5',
        focus: 'Partner handoffs',
        code: 'DXB',
    },
    {
        city: 'Singapore',
        country: 'Singapore',
        region: 'Asia Pacific',
        timeZone: 'Asia/Singapore',
        accent: '#b6487a',
        focus: 'Operations coverage',
        code: 'SIN',
    },
];

export function formatHubTime(date: Date | null, timeZone: string) {
    if (!date) return '--:--';

    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone,
    }).format(date);
}

export function formatHubDay(date: Date | null, timeZone: string) {
    if (!date) return 'Syncing';

    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone,
    }).format(date);
}

export function getHubOffset(date: Date | null, timeZone: string) {
    if (!date) return 'UTC';

    const part = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
    })
        .formatToParts(date)
        .find((item) => item.type === 'timeZoneName');

    return part?.value ?? 'UTC';
}

export function getHubStatus(date: Date | null, timeZone: string) {
    if (!date) return 'Syncing';

    const hour = Number(
        new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            hourCycle: 'h23',
            timeZone,
        }).format(date)
    );

    if (hour >= 8 && hour < 12) return 'Morning focus';
    if (hour >= 12 && hour < 18) return 'Shared core hours';
    if (hour >= 18 && hour < 22) return 'Evening handoff';
    return 'Offline window';
}

export function getGreeting(date: Date | null) {
    if (!date) return 'Hello';

    const hour = date.getHours();

    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

export function formatViewerZone(viewerTimeZone: string) {
    return viewerTimeZone.replace(/_/g, ' ');
}
