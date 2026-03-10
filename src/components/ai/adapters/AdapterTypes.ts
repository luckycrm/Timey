export type AdapterType =
    | 'claude-local'
    | 'opencode-local'
    | 'openclaw-gateway'
    | 'http'
    | 'process'
    | 'cursor'
    | 'codex-local';

export interface AdapterConfigField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'boolean' | 'textarea' | 'select';
    required?: boolean;
    placeholder?: string;
    description?: string;
    options?: { value: string; label: string }[];
    defaultValue?: unknown;
}

export interface AdapterDefinition {
    type: AdapterType;
    label: string;
    description: string;
    fields: AdapterConfigField[];
}
