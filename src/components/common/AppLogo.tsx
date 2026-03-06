import { useState, useEffect } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function AppLogo({
    size = 'medium',
    color
}: {
    size?: 'small' | 'medium';
    color?: string;
}) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const iconSize = size === 'small' ? 34 : 42;
    const variant = size === 'small' ? 'subtitle1' : 'h5';

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();

    const hourDeg = (hours % 12) * 30 + minutes * 0.5;
    const minuteDeg = minutes * 6;
    const secondDeg = seconds * 6;

    const strokeColor = color === '#ffffff' ? '#ffffff' : (color || '#CA6F33');

    return (
        <Stack direction="row" alignItems="center" spacing={1.5}>
            <svg width={iconSize} height={iconSize} viewBox="0 0 32 32" fill="none">
                {/* Clock Face (Squircle) */}
                <rect
                    x="2"
                    y="2"
                    width="28"
                    height="28"
                    rx="9"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    fill="#111111"
                />

                {/* Hour Hand */}
                <line
                    x1="16"
                    y1="16"
                    x2="16"
                    y2="10"
                    stroke={color === '#ffffff' ? '#ffffff' : '#ffffff'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{
                        transform: `rotate(${hourDeg}deg)`,
                        transformOrigin: '16px 16px',
                        transition: 'transform 0.5s ease-in-out',
                    }}
                />

                {/* Minute Hand */}
                <line
                    x1="16"
                    y1="16"
                    x2="16"
                    y2="7"
                    stroke={color === '#ffffff' ? '#ffffff' : '#ffffff'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    style={{
                        transform: `rotate(${minuteDeg}deg)`,
                        transformOrigin: '16px 16px',
                        transition: 'transform 0.5s ease-in-out',
                    }}
                />

                {/* Second Hand */}
                <line
                    x1="16"
                    y1="16"
                    x2="16"
                    y2="6"
                    stroke="#FF3B30"
                    strokeWidth="1"
                    strokeLinecap="round"
                    style={{
                        transform: `rotate(${secondDeg}deg)`,
                        transformOrigin: '16px 16px',
                        transition: 'transform 0.1s linear',
                    }}
                />

                {/* Center Dot */}
                <circle cx="16" cy="16" r="1.5" fill={strokeColor} />
            </svg>
            <Typography
                variant={variant}
                sx={{
                    color: color || 'primary.main',
                    fontWeight: 800,
                    fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
                    letterSpacing: '-0.04em',
                }}
            >
                Timey
            </Typography>
        </Stack>
    );
}
