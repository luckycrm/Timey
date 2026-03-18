import type { ElementType } from 'react';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';

export type AIPageKey =
    | 'home'
    | 'agents'
    | 'tasks'
    | 'board'
    | 'approvals'
    | 'inbox'
    | 'activity'
    | 'projects'
    | 'goals'
    | 'costs'
    | 'org'
    | 'settings'
    | 'secrets'
    | 'llms';

export interface AIPageDefinition {
    key: AIPageKey;
    label: string;
    eyebrow: string;
    description: string;
    icon: ElementType;
}

export const aiPageDefinitions: AIPageDefinition[] = [
    {
        key: 'home',
        label: 'Home',
        eyebrow: 'Control',
        description: 'A concise operating view across the AI workspace.',
        icon: HomeOutlinedIcon,
    },
    {
        key: 'agents',
        label: 'Agents',
        eyebrow: 'Roster',
        description: 'Capacity, ownership, and readiness for every active agent.',
        icon: SmartToyOutlinedIcon,
    },
    {
        key: 'tasks',
        label: 'Tasks',
        eyebrow: 'Execution',
        description: 'Priority lanes, blockers, and human handoffs.',
        icon: ChecklistRoundedIcon,
    },
    {
        key: 'board',
        label: 'Board',
        eyebrow: 'Dispatch',
        description: 'Claim and dispatch queued tasks to agents.',
        icon: DashboardOutlinedIcon,
    },
    {
        key: 'approvals',
        label: 'Approvals',
        eyebrow: 'Governance',
        description: 'Requests awaiting review, policy checks, and decisions.',
        icon: GppMaybeOutlinedIcon,
    },
    {
        key: 'inbox',
        label: 'Inbox',
        eyebrow: 'Attention',
        description: 'One queue for pending approvals, stale work, and failed runs.',
        icon: InboxOutlinedIcon,
    },
    {
        key: 'activity',
        label: 'Activity',
        eyebrow: 'Feed',
        description: 'A cross-team stream of model, agent, and operator events.',
        icon: BoltOutlinedIcon,
    },
    {
        key: 'projects',
        label: 'Projects',
        eyebrow: 'Portfolio',
        description: 'Program-level tracking for staffed workstreams.',
        icon: FolderOpenOutlinedIcon,
    },
    {
        key: 'goals',
        label: 'Goals',
        eyebrow: 'Outcomes',
        description: 'The objective stack, progress signals, and interventions.',
        icon: FlagOutlinedIcon,
    },
    {
        key: 'costs',
        label: 'Costs',
        eyebrow: 'Spend',
        description: 'Budget, efficiency, and optimization opportunities.',
        icon: PaidOutlinedIcon,
    },
    {
        key: 'org',
        label: 'Org',
        eyebrow: 'Structure',
        description: 'Operating groups, reporting spans, and open coverage.',
        icon: AccountTreeOutlinedIcon,
    },
    {
        key: 'settings',
        label: 'Settings',
        eyebrow: 'Policies',
        description: 'Defaults, limits, integrations, and audit controls.',
        icon: TuneOutlinedIcon,
    },
    {
        key: 'secrets',
        label: 'Secrets',
        eyebrow: 'Security',
        description: 'API keys and credentials stored for agent use at runtime.',
        icon: LockOutlinedIcon,
    },
    {
        key: 'llms',
        label: 'LLM Providers',
        eyebrow: 'Models',
        description: 'Configure language model providers available to agents.',
        icon: PrecisionManufacturingOutlinedIcon,
    },
];

export const aiPageDefinitionMap = aiPageDefinitions.reduce<Record<AIPageKey, AIPageDefinition>>(
    (acc, page) => {
        acc[page.key] = page;
        return acc;
    },
    {} as Record<AIPageKey, AIPageDefinition>
);
