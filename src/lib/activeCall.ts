export interface ActiveCallSnapshot {
    open: boolean;
    authToken: string | null;
    title: string;
    channelId: string | null;
    meetingId: string | null;
    callSessionId: string | null;
}

const STORAGE_KEY = 'timey.active_call.v1';
export const ACTIVE_CALL_EVENT = 'timey-active-call-updated';

const EMPTY_SNAPSHOT: ActiveCallSnapshot = {
    open: false,
    authToken: null,
    title: '',
    channelId: null,
    meetingId: null,
    callSessionId: null,
};

export function getActiveCallSnapshot(): ActiveCallSnapshot {
    if (typeof window === 'undefined') return EMPTY_SNAPSHOT;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY_SNAPSHOT;
        const parsed = JSON.parse(raw) as Partial<ActiveCallSnapshot>;
        return {
            open: parsed.open === true,
            authToken: typeof parsed.authToken === 'string' ? parsed.authToken : null,
            title: typeof parsed.title === 'string' ? parsed.title : '',
            channelId: typeof parsed.channelId === 'string' ? parsed.channelId : null,
            meetingId: typeof parsed.meetingId === 'string' ? parsed.meetingId : null,
            callSessionId: typeof parsed.callSessionId === 'string' ? parsed.callSessionId : null,
        };
    } catch {
        return EMPTY_SNAPSHOT;
    }
}

export function setActiveCallSnapshot(snapshot: ActiveCallSnapshot) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new Event(ACTIVE_CALL_EVENT));
}

export function patchActiveCallSnapshot(patch: Partial<ActiveCallSnapshot>) {
    const current = getActiveCallSnapshot();
    setActiveCallSnapshot({
        ...current,
        ...patch,
    });
}

export function clearActiveCallSnapshot() {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(ACTIVE_CALL_EVENT));
}
