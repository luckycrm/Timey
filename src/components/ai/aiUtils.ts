export const NONE_U64 = 18446744073709551615n;

export function isNoneU64(value: bigint | null | undefined) {
    return value == null || value === 0n || value === NONE_U64;
}

export function formatBigIntDateTime(value: bigint | null | undefined) {
    if (value == null || value === 0n || isNoneU64(value)) return 'Not set';
    return new Date(Number(value)).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function formatRelativeTime(value: bigint | null | undefined, now: number = Date.now()) {
    if (value == null || value === 0n || isNoneU64(value)) return 'Not scheduled';
    const diffMs = Number(value) - now;
    const absMs = Math.abs(diffMs);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

    if (absMs < 60_000) return diffMs >= 0 ? 'in under a minute' : 'less than a minute ago';
    if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
    if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
    return rtf.format(Math.round(diffMs / 86_400_000), 'day');
}

export function parseJsonList(value: string): string[] {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
        return [];
    }
}

export function microusdToUsd(value: bigint) {
    return Number(value) / 1_000_000;
}

export function formatUsd(value: number) {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value);
}

export function safeParseBigInt(value: string): bigint | null {
    try {
        return BigInt(value);
    } catch {
        return null;
    }
}
