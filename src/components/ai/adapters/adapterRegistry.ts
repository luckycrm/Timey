import type { AdapterDefinition, AdapterType } from './AdapterTypes';

const instructionsFileField = {
    key: 'instructionsFilePath',
    label: 'Agent instructions file',
    type: 'text' as const,
    placeholder: '/absolute/path/to/AGENTS.md',
    description:
        "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into the system prompt at runtime.",
};

export const adapterDefinitions: AdapterDefinition[] = [
    {
        type: 'claude-local',
        label: 'Claude (local)',
        description: 'Runs the Claude CLI locally on the host machine.',
        fields: [
            instructionsFileField,
            {
                key: 'chrome',
                label: 'Enable Chrome',
                type: 'boolean',
                defaultValue: false,
                description: "Enable Claude's Chrome integration by passing --chrome.",
            },
            {
                key: 'dangerouslySkipPermissions',
                label: 'Skip permissions',
                type: 'boolean',
                defaultValue: true,
                description: 'Run Claude without permission prompts. Required for unattended operation.',
            },
            {
                key: 'maxTurnsPerRun',
                label: 'Max turns per run',
                type: 'number',
                placeholder: '80',
                defaultValue: 80,
                description: 'Maximum number of agentic turns (tool calls) per heartbeat run.',
            },
        ],
    },
    {
        type: 'opencode-local',
        label: 'OpenCode (local)',
        description: 'Runs the OpenCode CLI locally on the host machine.',
        fields: [instructionsFileField],
    },
    {
        type: 'cursor',
        label: 'Cursor (local)',
        description: 'Runs Cursor locally on the host machine.',
        fields: [instructionsFileField],
    },
    {
        type: 'codex-local',
        label: 'Codex (local)',
        description: 'Runs the OpenAI Codex CLI locally on the host machine.',
        fields: [
            instructionsFileField,
            {
                key: 'dangerouslyBypassApprovalsAndSandbox',
                label: 'Bypass sandbox',
                type: 'boolean',
                defaultValue: false,
                description: 'Run Codex without sandbox restrictions. Required for filesystem/network access.',
            },
            {
                key: 'search',
                label: 'Enable search',
                type: 'boolean',
                defaultValue: false,
                description: 'Enable Codex web search capability during runs.',
            },
        ],
    },
    {
        type: 'openclaw-gateway',
        label: 'OpenClaw Gateway',
        description: 'Connects to a remote OpenClaw gateway over WebSocket.',
        fields: [
            {
                key: 'url',
                label: 'Gateway URL',
                type: 'text',
                placeholder: 'ws://127.0.0.1:18789',
                description: 'The WebSocket URL of the OpenClaw gateway.',
            },
            {
                key: 'paperclipApiUrl',
                label: 'API URL override',
                type: 'text',
                placeholder: 'https://paperclip.example',
                description: 'Override the Paperclip API URL the gateway calls back to.',
            },
            {
                key: 'sessionKeyStrategy',
                label: 'Session strategy',
                type: 'select',
                defaultValue: 'fixed',
                description: 'Controls how session keys are scoped per run.',
                options: [
                    { value: 'fixed', label: 'Fixed' },
                    { value: 'issue', label: 'Per issue' },
                    { value: 'run', label: 'Per run' },
                ],
            },
            {
                key: 'sessionKey',
                label: 'Session key',
                type: 'text',
                placeholder: 'paperclip',
                description: 'The fixed session key (only used when session strategy is "fixed").',
            },
            {
                key: '__gatewayToken',
                label: 'Gateway auth token (x-openclaw-token)',
                type: 'password',
                placeholder: 'OpenClaw gateway token',
                description: 'Bearer token sent as the x-openclaw-token request header.',
            },
            {
                key: 'role',
                label: 'Role',
                type: 'text',
                placeholder: 'operator',
                defaultValue: 'operator',
                description: 'Role claimed when authenticating with the gateway.',
            },
            {
                key: '__scopes',
                label: 'Scopes (comma-separated)',
                type: 'text',
                placeholder: 'operator.admin',
                description: 'Comma-separated list of OAuth-style scopes to request from the gateway.',
            },
            {
                key: 'waitTimeoutMs',
                label: 'Wait timeout (ms)',
                type: 'number',
                placeholder: '120000',
                defaultValue: 120000,
                description: 'Maximum milliseconds to wait for a response from the gateway.',
            },
        ],
    },
    {
        type: 'http',
        label: 'HTTP',
        description: 'Delivers work to an arbitrary HTTP webhook endpoint.',
        fields: [
            {
                key: 'url',
                label: 'Webhook URL',
                type: 'text',
                placeholder: 'https://...',
                description: 'The URL that receives POST requests when the agent is invoked.',
            },
        ],
    },
    {
        type: 'process',
        label: 'Process',
        description: 'Spawns an arbitrary local process as the agent executor.',
        fields: [
            {
                key: 'command',
                label: 'Command',
                type: 'text',
                placeholder: 'e.g. node, python',
                description: 'The command to execute (e.g. node, python).',
            },
            {
                key: 'args',
                label: 'Args (comma-separated)',
                type: 'text',
                placeholder: 'e.g. script.js, --flag',
                description: 'Command-line arguments, comma-separated.',
            },
        ],
    },
];

const registryMap = new Map<AdapterType, AdapterDefinition>(
    adapterDefinitions.map((def) => [def.type, def]),
);

export function getAdapterDefinition(type: AdapterType): AdapterDefinition {
    return registryMap.get(type) ?? adapterDefinitions.find((d) => d.type === 'process')!;
}

export const adapterTypeOptions: { value: AdapterType; label: string }[] = adapterDefinitions.map(
    (def) => ({ value: def.type, label: def.label }),
);
