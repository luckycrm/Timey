import { schema, table, t } from 'spacetimedb/server';

const NONE_U64 = 18446744073709551615n;
const SCHEDULED_JOIN_LEAD_MS = 10n * 60n * 1000n;

const spacetimedb = schema({
  user: table(
    { name: 'user', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      identity: t.identity().unique(),
      email: t.string().unique(),
      name: t.string(),
      created_at: t.u64(),
      last_login_at: t.u64(),
    }
  ),
  organization: table(
    { name: 'organization', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      name: t.string(),
      created_at: t.u64(),
    }
  ),
  organization_member: table(
    {
      name: 'organization_member',
      public: true,
    },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      user_id: t.u64().index('btree'),
      role: t.string(), // 'owner' or 'member'
      joined_at: t.u64(),
    }
  ),
  join_id: table(
    { name: 'join_id', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      token: t.string().unique(),
      is_revoked: t.bool(),
      created_at: t.u64(),
    }
  ),
  invite: table(
    { name: 'invite', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      inviter_user_id: t.u64(),
      email: t.string().index('btree'),
      status: t.string(), // 'pending', 'accepted', 'revoked'
      created_at: t.u64(),
    }
  ),
  chat_channel: table(
    { name: 'chat_channel', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      name: t.string(),
      type: t.string(), // 'dm' or 'group'
      created_by: t.u64(),
      created_at: t.u64(),
    }
  ),
  chat_channel_member: table(
    { name: 'chat_channel_member', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      channel_id: t.u64().index('btree'),
      user_id: t.u64().index('btree'),
      joined_at: t.u64(),
    }
  ),
  chat_message: table(
    { name: 'chat_message', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      channel_id: t.u64().index('btree'),
      sender_id: t.u64().index('btree'),
      content: t.string(),
      created_at: t.u64(),
      parent_message_id: t.u64().index('btree').default(NONE_U64),
      edited_at: t.u64().default(NONE_U64),
    }
  ),
  chat_reaction: table(
    { name: 'chat_reaction', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      message_id: t.u64().index('btree'),
      user_id: t.u64().index('btree'),
      emoji: t.string(),
      is_active: t.bool(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  chat_read_state: table(
    { name: 'chat_read_state', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      channel_id: t.u64().index('btree'),
      user_id: t.u64().index('btree'),
      last_read_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  chat_typing: table(
    { name: 'chat_typing', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      channel_id: t.u64().index('btree'),
      user_id: t.u64().index('btree'),
      is_typing: t.bool(),
      updated_at: t.u64(),
    }
  ),
  chat_call_session: table(
    { name: 'chat_call_session', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      channel_id: t.u64().index('btree'),
      org_id: t.u64().index('btree'),
      dyte_meeting_id: t.string(),
      title: t.string(),
      started_by_user_id: t.u64().index('btree'),
      status: t.string().index('btree'), // 'active' | 'ended'
      started_at: t.u64(),
      ended_at: t.u64().default(NONE_U64),
      updated_at: t.u64(),
    }
  ),
  chat_call_participant: table(
    { name: 'chat_call_participant', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      call_session_id: t.u64().index('btree'),
      channel_id: t.u64().index('btree'),
      user_id: t.u64().index('btree'),
      joined_at: t.u64(),
      left_at: t.u64().default(NONE_U64),
      updated_at: t.u64(),
    }
  ),
  chat_scheduled_meeting: table(
    { name: 'chat_scheduled_meeting', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      channel_id: t.u64().index('btree').default(NONE_U64),
      visibility: t.string().index('btree'), // 'channel' | 'public'
      title: t.string(),
      description: t.string(),
      scheduled_at: t.u64().index('btree'),
      dyte_meeting_id: t.string().index('btree'),
      created_by_user_id: t.u64().index('btree'),
      status: t.string().index('btree'), // 'scheduled' | 'started' | 'ended' | 'cancelled'
      started_call_session_id: t.u64().index('btree').default(NONE_U64),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_public_profile: table(
    { name: 'meeting_public_profile', public: true },
    {
      user_id: t.u64().primaryKey(),
      org_id: t.u64().index('btree'),
      handle: t.string().unique(),
      headline: t.string(),
      timezone: t.string(),
      booking_enabled: t.bool(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_event_type: table(
    { name: 'meeting_event_type', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      owner_user_id: t.u64().index('btree'),
      slug: t.string().index('btree'),
      title: t.string(),
      description: t.string(),
      duration_min: t.u64(),
      visibility: t.string().index('btree'), // 'public' | 'channel'
      default_channel_id: t.u64().index('btree').default(NONE_U64),
      require_approval: t.bool(),
      is_active: t.bool(),
      max_days_in_advance: t.u64(),
      min_notice_min: t.u64(),
      buffer_before_min: t.u64(),
      buffer_after_min: t.u64(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_availability_rule: table(
    { name: 'meeting_availability_rule', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      event_type_id: t.u64().index('btree'),
      user_id: t.u64().index('btree'),
      weekday: t.u64().index('btree'),
      start_minute: t.u64(),
      end_minute: t.u64(),
      timezone: t.string(),
      is_enabled: t.bool(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_booking: table(
    { name: 'meeting_booking', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      event_type_id: t.u64().index('btree'),
      scheduled_meeting_id: t.u64().index('btree').default(NONE_U64),
      host_user_id: t.u64().index('btree'),
      booked_by_user_id: t.u64().index('btree').default(NONE_U64),
      invitee_name: t.string(),
      invitee_email: t.string().index('btree'),
      invitee_timezone: t.string(),
      starts_at: t.u64().index('btree'),
      ends_at: t.u64().index('btree'),
      status: t.string().index('btree'), // 'pending' | 'confirmed' | 'cancelled'
      booking_token: t.string().unique(),
      notes: t.string(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_recording_policy: table(
    { name: 'meeting_recording_policy', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      mode: t.string(), // 'off' | 'optional' | 'required'
      auto_record: t.bool(),
      retention_days: t.u64(),
      description: t.string(),
      created_by_user_id: t.u64().index('btree'),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_followup_template: table(
    { name: 'meeting_followup_template', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      created_by_user_id: t.u64().index('btree'),
      title: t.string(),
      items_json: t.string(),
      is_default: t.bool(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_reminder_template: table(
    { name: 'meeting_reminder_template', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      created_by_user_id: t.u64().index('btree'),
      name: t.string(),
      offsets_json: t.string(),
      channel_scope: t.string(), // 'all' | 'public' | 'channel'
      is_default: t.bool(),
      is_active: t.bool(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_reminder_delivery: table(
    { name: 'meeting_reminder_delivery', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      booking_id: t.u64().index('btree'),
      template_id: t.u64().index('btree'),
      offset_min: t.u64(),
      trigger_at: t.u64().index('btree'),
      status: t.string().index('btree'), // 'pending' | 'sent' | 'failed'
      attempts: t.u64(),
      last_error: t.string(),
      sent_at: t.u64().default(NONE_U64),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  meeting_activity: table(
    { name: 'meeting_activity', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      actor_user_id: t.u64().index('btree').default(NONE_U64),
      booking_id: t.u64().index('btree').default(NONE_U64),
      meeting_id: t.u64().index('btree').default(NONE_U64),
      event_type: t.string().index('btree'),
      description: t.string(),
      metadata_json: t.string(),
      created_at: t.u64().index('btree'),
    }
  ),
  ai_agent: table(
    { name: 'ai_agent', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      owner_user_id: t.u64().index('btree'),
      manager_user_id: t.u64().index('btree').default(NONE_U64),
      project_id: t.u64().index('btree').default(NONE_U64),
      name: t.string(),
      role: t.string(),
      department: t.string().index('btree'),
      description: t.string(),
      status: t.string().index('btree'), // 'draft' | 'active' | 'paused' | 'attention'
      autonomy_mode: t.string(), // 'manual' | 'guarded' | 'autonomous'
      approval_mode: t.string(), // 'manual' | 'threshold' | 'auto'
      tools_json: t.string(),
      schedule_json: t.string(),
      daily_budget_microusd: t.u64(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  ai_project: table(
    { name: 'ai_project', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      owner_user_id: t.u64().index('btree'),
      name: t.string(),
      summary: t.string(),
      status: t.string().index('btree'), // 'planning' | 'active' | 'watching' | 'completed' | 'paused'
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  ai_goal: table(
    { name: 'ai_goal', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      owner_user_id: t.u64().index('btree'),
      project_id: t.u64().index('btree').default(NONE_U64),
      title: t.string(),
      description: t.string(),
      status: t.string().index('btree'), // 'on_track' | 'watching' | 'blocked' | 'completed'
      progress_pct: t.u64(),
      due_at: t.u64().index('btree').default(NONE_U64),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  ai_task: table(
    { name: 'ai_task', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      project_id: t.u64().index('btree').default(NONE_U64),
      goal_id: t.u64().index('btree').default(NONE_U64),
      agent_id: t.u64().index('btree').default(NONE_U64),
      created_by_user_id: t.u64().index('btree'),
      title: t.string(),
      description: t.string(),
      status: t.string().index('btree'), // 'queued' | 'running' | 'waiting_approval' | 'blocked' | 'completed' | 'failed' | 'cancelled'
      priority: t.string().index('btree'), // 'low' | 'normal' | 'high' | 'urgent'
      source_type: t.string(), // 'manual' | 'automation' | 'goal' | 'project'
      linked_entity_type: t.string(),
      linked_entity_id: t.u64().index('btree').default(NONE_U64),
      due_at: t.u64().index('btree').default(NONE_U64),
      completed_at: t.u64().default(NONE_U64),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  ai_approval: table(
    { name: 'ai_approval', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      task_id: t.u64().index('btree').default(NONE_U64),
      agent_id: t.u64().index('btree').default(NONE_U64),
      requester_user_id: t.u64().index('btree'),
      reviewer_user_id: t.u64().index('btree').default(NONE_U64),
      title: t.string(),
      summary: t.string(),
      status: t.string().index('btree'), // 'pending' | 'approved' | 'rejected'
      risk_level: t.string().index('btree'), // 'low' | 'medium' | 'high' | 'critical'
      action_type: t.string(),
      metadata_json: t.string(),
      created_at: t.u64(),
      updated_at: t.u64(),
      decided_at: t.u64().default(NONE_U64),
    }
  ),
  ai_run: table(
    { name: 'ai_run', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      task_id: t.u64().index('btree').default(NONE_U64),
      agent_id: t.u64().index('btree').default(NONE_U64),
      status: t.string().index('btree'), // 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'
      trigger_type: t.string(), // 'manual' | 'timer' | 'assignment' | 'automation'
      summary: t.string(),
      error_message: t.string(),
      token_input: t.u64(),
      token_output: t.u64(),
      tool_calls: t.u64(),
      cost_microusd: t.u64(),
      started_at: t.u64(),
      finished_at: t.u64().default(NONE_U64),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  ai_agent_runtime: table(
    { name: 'ai_agent_runtime', public: true },
    {
      agent_id: t.u64().primaryKey(),
      org_id: t.u64().index('btree'),
      adapter_type: t.string().index('btree'),
      runtime_status: t.string().index('btree'),
      base_url: t.string(),
      command: t.string(),
      cwd: t.string(),
      env_json: t.string(),
      config_json: t.string(),
      heartbeat_policy_json: t.string(),
      wake_policy_json: t.string(),
      last_heartbeat_at: t.u64().index('btree').default(NONE_U64),
      last_success_at: t.u64().index('btree').default(NONE_U64),
      last_failure_at: t.u64().index('btree').default(NONE_U64),
      last_error: t.string(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  ai_wakeup_request: table(
    { name: 'ai_wakeup_request', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      agent_id: t.u64().index('btree'),
      task_id: t.u64().index('btree').default(NONE_U64),
      requested_by_user_id: t.u64().index('btree').default(NONE_U64),
      status: t.string().index('btree'),
      source: t.string().index('btree'),
      reason: t.string(),
      payload_json: t.string(),
      run_id: t.u64().index('btree').default(NONE_U64),
      error_message: t.string(),
      created_at: t.u64().index('btree'),
      updated_at: t.u64(),
      started_at: t.u64().default(NONE_U64),
      finished_at: t.u64().default(NONE_U64),
    }
  ),
  ai_run_event: table(
    { name: 'ai_run_event', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      run_id: t.u64().index('btree'),
      agent_id: t.u64().index('btree').default(NONE_U64),
      task_id: t.u64().index('btree').default(NONE_U64),
      actor_user_id: t.u64().index('btree').default(NONE_U64),
      event_type: t.string().index('btree'),
      level: t.string().index('btree'),
      message: t.string(),
      payload_json: t.string(),
      created_at: t.u64().index('btree'),
    }
  ),
  ai_adapter_session: table(
    { name: 'ai_adapter_session', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      agent_id: t.u64().index('btree'),
      run_id: t.u64().index('btree').default(NONE_U64),
      adapter_type: t.string().index('btree'),
      external_session_id: t.string().index('btree'),
      status: t.string().index('btree'),
      summary: t.string(),
      metadata_json: t.string(),
      last_seen_at: t.u64().index('btree').default(NONE_U64),
      created_at: t.u64().index('btree'),
      updated_at: t.u64(),
    }
  ),
  ai_config_revision: table(
    { name: 'ai_config_revision', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      actor_user_id: t.u64().index('btree').default(NONE_U64),
      scope_type: t.string().index('btree'),
      scope_id: t.u64().index('btree').default(NONE_U64),
      revision_label: t.string(),
      payload_json: t.string(),
      metadata_json: t.string(),
      created_at: t.u64().index('btree'),
    }
  ),
  ai_activity: table(
    { name: 'ai_activity', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      org_id: t.u64().index('btree'),
      actor_user_id: t.u64().index('btree').default(NONE_U64),
      agent_id: t.u64().index('btree').default(NONE_U64),
      task_id: t.u64().index('btree').default(NONE_U64),
      approval_id: t.u64().index('btree').default(NONE_U64),
      project_id: t.u64().index('btree').default(NONE_U64),
      goal_id: t.u64().index('btree').default(NONE_U64),
      run_id: t.u64().index('btree').default(NONE_U64),
      event_type: t.string().index('btree'),
      description: t.string(),
      metadata_json: t.string(),
      created_at: t.u64().index('btree'),
    }
  ),
  ai_workspace_settings: table(
    { name: 'ai_workspace_settings', public: true },
    {
      org_id: t.u64().primaryKey(),
      created_by_user_id: t.u64().index('btree'),
      default_model: t.string(),
      autonomy_posture: t.string(),
      fallback_mode: t.string(),
      external_send_policy: t.string(),
      budget_change_policy: t.string(),
      internal_notes_policy: t.string(),
      integrations_json: t.string(),
      audit_retention_days: t.u64(),
      max_run_cost_microusd: t.u64(),
      created_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
  user_presence: table(
    { name: 'user_presence', public: true },
    {
      user_id: t.u64().primaryKey(),
      org_id: t.u64().index('btree'),
      channel_id: t.u64().index('btree'),
      status: t.string(), // 'online' | 'away' | 'dnd' | 'offline'
      last_seen_at: t.u64(),
      updated_at: t.u64(),
    }
  ),
});
export default spacetimedb;

// Helper to generate a somewhat random string in a deterministic-friendly way
// In a real app, you might want to pass this from the client if true randomness is needed
function generateToken(orgId: bigint, timestamp: bigint): string {
  const combined = orgId.toString() + timestamp.toString();
  // Simple hex-like hash for a 6-character token
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
}

function generateBookingToken(orgId: bigint, timestamp: bigint, nonce: bigint): string {
  const base = `${orgId.toString(36)}${timestamp.toString(36)}${nonce.toString(36)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  const suffix = Math.abs(hash).toString(36).slice(0, 6);
  return `bk_${base.slice(-8)}${suffix}`.toLowerCase();
}

function isValidHandle(handle: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(handle);
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getUserFromSender(ctx: any) {
  const user = ctx.db.user.identity.find(ctx.sender);
  if (!user) throw new Error('User not found');
  return user;
}

function getUserFromSenderOptional(ctx: any) {
  return ctx.db.user.identity.find(ctx.sender) || null;
}

function isOrganizationMember(ctx: any, orgId: bigint, userId: bigint): boolean {
  for (const m of ctx.db.organization_member.iter()) {
    if (m.org_id === orgId && m.user_id === userId) return true;
  }
  return false;
}

function isChannelMember(ctx: any, channelId: bigint, userId: bigint): boolean {
  for (const cm of ctx.db.chat_channel_member.iter()) {
    if (cm.channel_id === channelId && cm.user_id === userId) return true;
  }
  return false;
}

function findActiveCallSessionByChannel(ctx: any, channelId: bigint) {
  for (const session of ctx.db.chat_call_session.iter()) {
    if (
      session.channel_id === channelId &&
      session.status === 'active' &&
      session.ended_at === NONE_U64
    ) {
      return session;
    }
  }
  return null;
}

function countActiveCallParticipants(ctx: any, callSessionId: bigint): number {
  let count = 0;
  for (const participant of ctx.db.chat_call_participant.iter()) {
    if (participant.call_session_id === callSessionId && participant.left_at === NONE_U64) {
      count += 1;
    }
  }
  return count;
}

function isOrganizationOwner(ctx: any, orgId: bigint, userId: bigint): boolean {
  for (const m of ctx.db.organization_member.iter()) {
    if (m.org_id === orgId && m.user_id === userId && m.role === 'owner') return true;
  }
  return false;
}

const AI_AGENT_STATUSES = new Set(['draft', 'active', 'paused', 'attention']);
const AI_AUTONOMY_MODES = new Set(['manual', 'guarded', 'autonomous']);
const AI_APPROVAL_MODES = new Set(['manual', 'threshold', 'auto']);
const AI_PROJECT_STATUSES = new Set(['planning', 'active', 'watching', 'completed', 'paused']);
const AI_GOAL_STATUSES = new Set(['on_track', 'watching', 'blocked', 'completed']);
const AI_TASK_STATUSES = new Set(['queued', 'running', 'waiting_approval', 'blocked', 'completed', 'failed', 'cancelled']);
const AI_TASK_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const AI_TASK_SOURCE_TYPES = new Set(['manual', 'automation', 'goal', 'project']);
const AI_APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected']);
const AI_APPROVAL_RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);
const AI_RUN_STATUSES = new Set(['queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled']);
const AI_RUN_TRIGGER_TYPES = new Set(['manual', 'timer', 'assignment', 'automation']);
const AI_RUNTIME_ADAPTER_TYPES = new Set(['manual', 'process', 'http', 'claude_local', 'codex_local']);
const AI_RUNTIME_STATUSES = new Set(['idle', 'ready', 'disabled', 'error']);
const AI_WAKEUP_STATUSES = new Set(['queued', 'claimed', 'running', 'completed', 'failed', 'cancelled', 'merged']);
const AI_WAKEUP_SOURCES = new Set(['manual', 'timer', 'assignment', 'automation']);
const AI_RUN_EVENT_LEVELS = new Set(['info', 'warning', 'error', 'debug']);
const AI_ADAPTER_SESSION_STATUSES = new Set(['active', 'closed', 'expired', 'failed']);
const AI_CONFIG_REVISION_SCOPES = new Set(['agent_runtime', 'workspace_settings']);
const AI_WORKSPACE_AUTONOMY_POSTURES = new Set(['manual', 'guarded', 'autonomous']);
const AI_WORKSPACE_FALLBACK_MODES = new Set(['human-first', 'retry-safe', 'fail-closed']);
const AI_EXTERNAL_SEND_POLICIES = new Set(['manual_approval', 'trusted_only', 'auto_allowed']);
const AI_BUDGET_CHANGE_POLICIES = new Set(['owner_review', 'admin_review', 'auto_allowed']);
const AI_INTERNAL_NOTES_POLICIES = new Set(['auto_allowed', 'manual_review']);

function normalizeAiEnum(name: string, value: string, fallback: string, allowed: Set<string>): string {
  const normalized = value.trim() || fallback;
  if (!allowed.has(normalized)) {
    throw new Error(`Invalid ${name}`);
  }
  return normalized;
}

function findOrganizationOwnerId(ctx: any, orgId: bigint): bigint {
  for (const member of ctx.db.organization_member.iter()) {
    if (member.org_id === orgId && member.role === 'owner') {
      return member.user_id;
    }
  }
  return NONE_U64;
}

function isAiRunLiveStatus(status: string): boolean {
  return status === 'queued' || status === 'running' || status === 'waiting_approval';
}

function hasPendingAiApprovalForTask(ctx: any, taskId: bigint, ignoreApprovalId: bigint = NONE_U64): boolean {
  for (const approval of ctx.db.ai_approval.iter()) {
    if (approval.id === ignoreApprovalId) continue;
    if (approval.task_id !== taskId) continue;
    if (approval.status === 'pending') return true;
  }
  return false;
}

function getLiveAiRunsForTask(ctx: any, taskId: bigint, ignoreRunId: bigint = NONE_U64): any[] {
  const rows: any[] = [];
  for (const run of ctx.db.ai_run.iter()) {
    if (run.id === ignoreRunId) continue;
    if (run.task_id !== taskId) continue;
    if (!isAiRunLiveStatus(run.status)) continue;
    rows.push(run);
  }
  return rows;
}

function isAiWakeupOpenStatus(status: string): boolean {
  return status === 'queued' || status === 'claimed' || status === 'running';
}

function getOpenAiWakeupsForAgent(ctx: any, agentId: bigint, ignoreWakeupId: bigint = NONE_U64): any[] {
  const rows: any[] = [];
  for (const wakeup of ctx.db.ai_wakeup_request.iter()) {
    if (wakeup.id === ignoreWakeupId) continue;
    if (wakeup.agent_id !== agentId) continue;
    if (!isAiWakeupOpenStatus(wakeup.status)) continue;
    rows.push(wakeup);
  }
  return rows;
}

function syncTaskFromRunStatus(ctx: any, task: any, nextRunStatus: string, now: bigint) {
  if (nextRunStatus === 'running') {
    ctx.db.ai_task.id.update({
      ...task,
      status: 'running',
      updated_at: now,
    });
    return;
  }

  if (nextRunStatus === 'waiting_approval') {
    ctx.db.ai_task.id.update({
      ...task,
      status: 'waiting_approval',
      updated_at: now,
    });
    return;
  }

  if (nextRunStatus === 'completed') {
    ctx.db.ai_task.id.update({
      ...task,
      status: 'completed',
      completed_at: now,
      updated_at: now,
    });
    return;
  }

  if (nextRunStatus === 'failed') {
    ctx.db.ai_task.id.update({
      ...task,
      status: 'failed',
      updated_at: now,
    });
    return;
  }

  if (nextRunStatus === 'cancelled') {
    ctx.db.ai_task.id.update({
      ...task,
      status: task.status === 'blocked' ? 'blocked' : 'cancelled',
      updated_at: now,
    });
  }
}

function hasConfirmedBookingOverlap(
  ctx: any,
  hostUserId: bigint,
  startsAt: bigint,
  endsAt: bigint,
  ignoreBookingId: bigint = NONE_U64
): boolean {
  for (const booking of ctx.db.meeting_booking.iter()) {
    if (booking.id === ignoreBookingId) continue;
    if (booking.status !== 'confirmed') continue;
    if (booking.host_user_id !== hostUserId) continue;

    const overlaps = startsAt < booking.ends_at && endsAt > booking.starts_at;
    if (overlaps) return true;
  }
  return false;
}

function cancelBookingAndMeeting(ctx: any, booking: any, now: bigint) {
  if (booking.status === 'cancelled') return;

  ctx.db.meeting_booking.id.update({
    ...booking,
    status: 'cancelled',
    updated_at: now,
  });

  if (booking.scheduled_meeting_id !== NONE_U64) {
    const meeting = ctx.db.chat_scheduled_meeting.id.find(booking.scheduled_meeting_id);
    if (meeting && meeting.status === 'scheduled') {
      ctx.db.chat_scheduled_meeting.id.update({
        ...meeting,
        status: 'cancelled',
        updated_at: now,
      });
    }
  }
}

function rescheduleBookingAndMeeting(ctx: any, booking: any, eventType: any, startsAt: bigint, now: bigint) {
  if (booking.status === 'cancelled') throw new Error('Cancelled booking cannot be rescheduled');
  if (startsAt <= now) throw new Error('Booking start time must be in the future');

  const minNoticeMs = eventType.min_notice_min * 60n * 1000n;
  if (startsAt < now + minNoticeMs) {
    throw new Error('Selected time is too soon for this event type');
  }

  const maxAdvanceMs = eventType.max_days_in_advance * 24n * 60n * 60n * 1000n;
  if (startsAt > now + maxAdvanceMs) {
    throw new Error('Selected time is beyond max booking window');
  }

  const durationMs = eventType.duration_min * 60n * 1000n;
  const endsAt = startsAt + durationMs;

  if (booking.status === 'confirmed' && hasConfirmedBookingOverlap(ctx, booking.host_user_id, startsAt, endsAt, booking.id)) {
    throw new Error('This time overlaps an existing booking');
  }

  ctx.db.meeting_booking.id.update({
    ...booking,
    starts_at: startsAt,
    ends_at: endsAt,
    updated_at: now,
  });

  if (booking.scheduled_meeting_id !== NONE_U64) {
    const meeting = ctx.db.chat_scheduled_meeting.id.find(booking.scheduled_meeting_id);
    if (!meeting) return;
    if (meeting.status !== 'scheduled') {
      throw new Error('Only scheduled meetings can be rescheduled');
    }
    ctx.db.chat_scheduled_meeting.id.update({
      ...meeting,
      scheduled_at: startsAt,
      updated_at: now,
    });
  }
}

function insertMeetingActivity(
  ctx: any,
  {
    orgId,
    actorUserId = NONE_U64,
    bookingId = NONE_U64,
    meetingId = NONE_U64,
    eventType,
    description,
    metadataJson = '{}',
    createdAt,
  }: {
    orgId: bigint;
    actorUserId?: bigint;
    bookingId?: bigint;
    meetingId?: bigint;
    eventType: string;
    description: string;
    metadataJson?: string;
    createdAt: bigint;
  }
) {
  ctx.db.meeting_activity.insert({
    id: 0n,
    org_id: orgId,
    actor_user_id: actorUserId,
    booking_id: bookingId,
    meeting_id: meetingId,
    event_type: eventType,
    description: description.trim(),
    metadata_json: metadataJson.trim().length > 0 ? metadataJson.trim() : '{}',
    created_at: createdAt,
  });
}

function getBookingVisibility(ctx: any, booking: any, eventType: any): 'public' | 'channel' {
  if (booking.scheduled_meeting_id !== NONE_U64) {
    const meeting = ctx.db.chat_scheduled_meeting.id.find(booking.scheduled_meeting_id);
    if (meeting) {
      return meeting.visibility === 'channel' ? 'channel' : 'public';
    }
  }
  return eventType.visibility === 'channel' ? 'channel' : 'public';
}

function parseReminderOffsets(offsetsJson: string): bigint[] {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(offsetsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const offsets = parsed
    .map((value) => BigInt(Math.floor(Number(value))))
    .filter((value) => value > 0n && value <= 30n * 24n * 60n);

  const dedup = new Set<string>();
  const result: bigint[] = [];
  for (const offset of offsets) {
    const key = offset.toString();
    if (dedup.has(key)) continue;
    dedup.add(key);
    result.push(offset);
  }
  return result;
}

function hasExistingReminderDelivery(
  ctx: any,
  bookingId: bigint,
  templateId: bigint,
  offsetMin: bigint,
  triggerAt: bigint
): boolean {
  for (const row of ctx.db.meeting_reminder_delivery.iter()) {
    if (
      row.booking_id === bookingId &&
      row.template_id === templateId &&
      row.offset_min === offsetMin &&
      row.trigger_at === triggerAt
    ) {
      return true;
    }
  }
  return false;
}

function markScheduledMeetingStarted(
  ctx: any,
  meetingId: bigint,
  callSessionId: bigint,
  now: bigint
) {
  const meeting = ctx.db.chat_scheduled_meeting.id.find(meetingId);
  if (!meeting) return;
  if (meeting.status === 'cancelled' || meeting.status === 'ended') return;

  ctx.db.chat_scheduled_meeting.id.update({
    ...meeting,
    status: 'started',
    started_call_session_id: callSessionId,
    updated_at: now,
  });
}

function markScheduledMeetingsEndedByCall(
  ctx: any,
  callSession: any,
  now: bigint
) {
  for (const meeting of ctx.db.chat_scheduled_meeting.iter()) {
    if (
      meeting.org_id === callSession.org_id &&
      meeting.dyte_meeting_id === callSession.dyte_meeting_id &&
      (meeting.status === 'scheduled' || meeting.status === 'started')
    ) {
      ctx.db.chat_scheduled_meeting.id.update({
        ...meeting,
        status: 'ended',
        started_call_session_id:
          meeting.started_call_session_id === NONE_U64 ? callSession.id : meeting.started_call_session_id,
        updated_at: now,
      });
    }
  }
}

function upsertPresence(
  ctx: any,
  userId: bigint,
  orgId: bigint,
  channelId: bigint,
  status: string,
  now: bigint
) {
  const existing = ctx.db.user_presence.user_id.find(userId);
  if (existing) {
    ctx.db.user_presence.user_id.update({
      ...existing,
      org_id: orgId,
      channel_id: channelId,
      status,
      last_seen_at: now,
      updated_at: now,
    });
    return;
  }

  ctx.db.user_presence.insert({
    user_id: userId,
    org_id: orgId,
    channel_id: channelId,
    status,
    last_seen_at: now,
    updated_at: now,
  });
}

function insertAiActivity(
  ctx: any,
  {
    orgId,
    actorUserId = NONE_U64,
    agentId = NONE_U64,
    taskId = NONE_U64,
    approvalId = NONE_U64,
    projectId = NONE_U64,
    goalId = NONE_U64,
    runId = NONE_U64,
    eventType,
    description,
    metadataJson = '{}',
    createdAt,
  }: {
    orgId: bigint;
    actorUserId?: bigint;
    agentId?: bigint;
    taskId?: bigint;
    approvalId?: bigint;
    projectId?: bigint;
    goalId?: bigint;
    runId?: bigint;
    eventType: string;
    description: string;
    metadataJson?: string;
    createdAt: bigint;
  }
) {
  ctx.db.ai_activity.insert({
    id: 0n,
    org_id: orgId,
    actor_user_id: actorUserId,
    agent_id: agentId,
    task_id: taskId,
    approval_id: approvalId,
    project_id: projectId,
    goal_id: goalId,
    run_id: runId,
    event_type: eventType,
    description: description.trim(),
    metadata_json: metadataJson.trim().length > 0 ? metadataJson.trim() : '{}',
    created_at: createdAt,
  });
}

function insertAiRunEvent(
  ctx: any,
  {
    orgId,
    runId,
    agentId = NONE_U64,
    taskId = NONE_U64,
    actorUserId = NONE_U64,
    eventType,
    level = 'info',
    message,
    payloadJson = '{}',
    createdAt,
  }: {
    orgId: bigint;
    runId: bigint;
    agentId?: bigint;
    taskId?: bigint;
    actorUserId?: bigint;
    eventType: string;
    level?: string;
    message: string;
    payloadJson?: string;
    createdAt: bigint;
  }
) {
  ctx.db.ai_run_event.insert({
    id: 0n,
    org_id: orgId,
    run_id: runId,
    agent_id: agentId,
    task_id: taskId,
    actor_user_id: actorUserId,
    event_type: eventType.trim(),
    level: level.trim() || 'info',
    message: message.trim(),
    payload_json: payloadJson.trim().length > 0 ? payloadJson.trim() : '{}',
    created_at: createdAt,
  });
}

function parseRevisionPayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to the empty object return below.
  }
  return {};
}

function serializeAiAgentRuntimeRevision(runtime: any) {
  return JSON.stringify({
    agent_id: runtime.agent_id.toString(),
    org_id: runtime.org_id.toString(),
    adapter_type: runtime.adapter_type,
    runtime_status: runtime.runtime_status,
    base_url: runtime.base_url,
    command: runtime.command,
    cwd: runtime.cwd,
    env_json: runtime.env_json,
    config_json: runtime.config_json,
    heartbeat_policy_json: runtime.heartbeat_policy_json,
    wake_policy_json: runtime.wake_policy_json,
    last_heartbeat_at: runtime.last_heartbeat_at.toString(),
    last_success_at: runtime.last_success_at.toString(),
    last_failure_at: runtime.last_failure_at.toString(),
    last_error: runtime.last_error,
    created_at: runtime.created_at.toString(),
    updated_at: runtime.updated_at.toString(),
  });
}

function serializeAiWorkspaceSettingsRevision(settings: any) {
  return JSON.stringify({
    org_id: settings.org_id.toString(),
    created_by_user_id: settings.created_by_user_id.toString(),
    default_model: settings.default_model,
    autonomy_posture: settings.autonomy_posture,
    fallback_mode: settings.fallback_mode,
    external_send_policy: settings.external_send_policy,
    budget_change_policy: settings.budget_change_policy,
    internal_notes_policy: settings.internal_notes_policy,
    integrations_json: settings.integrations_json,
    audit_retention_days: settings.audit_retention_days.toString(),
    max_run_cost_microusd: settings.max_run_cost_microusd.toString(),
    created_at: settings.created_at.toString(),
    updated_at: settings.updated_at.toString(),
  });
}

function insertAiConfigRevision(
  ctx: any,
  {
    orgId,
    actorUserId = NONE_U64,
    scopeType,
    scopeId = NONE_U64,
    revisionLabel,
    payloadJson,
    metadataJson = '{}',
    createdAt,
  }: {
    orgId: bigint;
    actorUserId?: bigint;
    scopeType: string;
    scopeId?: bigint;
    revisionLabel: string;
    payloadJson: string;
    metadataJson?: string;
    createdAt: bigint;
  }
) {
  const normalizedScopeType = normalizeAiEnum('config revision scope', scopeType, 'workspace_settings', AI_CONFIG_REVISION_SCOPES);
  ctx.db.ai_config_revision.insert({
    id: 0n,
    org_id: orgId,
    actor_user_id: actorUserId,
    scope_type: normalizedScopeType,
    scope_id: scopeId,
    revision_label: revisionLabel.trim(),
    payload_json: payloadJson.trim().length > 0 ? payloadJson.trim() : '{}',
    metadata_json: metadataJson.trim().length > 0 ? metadataJson.trim() : '{}',
    created_at: createdAt,
  });
}

function parseAiConfigRevisionPayload(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as Record<string, string>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyAiAgentRuntimeSnapshot(runtime: any) {
  return JSON.stringify({
    agent_id: runtime.agent_id.toString(),
    org_id: runtime.org_id.toString(),
    adapter_type: runtime.adapter_type,
    runtime_status: runtime.runtime_status,
    base_url: runtime.base_url,
    command: runtime.command,
    cwd: runtime.cwd,
    env_json: runtime.env_json,
    config_json: runtime.config_json,
    heartbeat_policy_json: runtime.heartbeat_policy_json,
    wake_policy_json: runtime.wake_policy_json,
    created_at: runtime.created_at.toString(),
    updated_at: runtime.updated_at.toString(),
  });
}

function stringifyAiWorkspaceSettingsSnapshot(settings: any) {
  return JSON.stringify({
    org_id: settings.org_id.toString(),
    created_by_user_id: settings.created_by_user_id.toString(),
    default_model: settings.default_model,
    autonomy_posture: settings.autonomy_posture,
    fallback_mode: settings.fallback_mode,
    external_send_policy: settings.external_send_policy,
    budget_change_policy: settings.budget_change_policy,
    internal_notes_policy: settings.internal_notes_policy,
    integrations_json: settings.integrations_json,
    audit_retention_days: settings.audit_retention_days.toString(),
    max_run_cost_microusd: settings.max_run_cost_microusd.toString(),
    created_at: settings.created_at.toString(),
    updated_at: settings.updated_at.toString(),
  });
}

export const init = spacetimedb.init((_ctx) => {
  // Called when the module is initially published
});
// ... (onConnect/onDisconnect omitted for brevity)

/**
 * Register or update a user after OTP verification.
 */
export const registerUser = spacetimedb.reducer(
  { email: t.string(), name: t.string() },
  (ctx, { email, name }) => {
    const now = BigInt(Date.now());
    const identity = ctx.sender;

    const existingByIdentity = ctx.db.user.identity.find(identity);
    if (existingByIdentity) {
      ctx.db.user.id.update({ ...existingByIdentity, last_login_at: now });
      upsertPresence(ctx, existingByIdentity.id, 0n, 0n, 'online', now);
      return;
    }

    const existingByEmail = ctx.db.user.email.find(email);
    if (existingByEmail) {
      ctx.db.user.id.update({ ...existingByEmail, identity, last_login_at: now });
      upsertPresence(ctx, existingByEmail.id, 0n, 0n, 'online', now);
      return;
    }

    const created = ctx.db.user.insert({
      id: 0n,
      identity,
      email,
      name,
      created_at: now,
      last_login_at: now,
    });

    upsertPresence(ctx, created.id, 0n, 0n, 'online', now);
  }
);

/**
 * Update user profile (name).
 */
export const updateProfile = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new Error('User not found');
    ctx.db.user.id.update({ ...user, name });
  }
);

/**
 * Create a new organization.
 * The creator automatically becomes the 'owner'.
 */
export const createOrganization = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    const now = BigInt(Date.now());
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new Error('User not found');

    const orgRecord = ctx.db.organization.insert({
      id: 0n,
      name,
      created_at: now,
    });

    ctx.db.organization_member.insert({
      id: 0n,
      org_id: orgRecord.id,
      user_id: user.id,
      role: 'owner',
      joined_at: now,
    });

    // Generate initial Join ID
    ctx.db.join_id.insert({
      id: 0n,
      org_id: orgRecord.id,
      token: generateToken(orgRecord.id, now),
      is_revoked: false,
      created_at: now,
    });

    console.info(`Organization created: ${name} (ID: ${orgRecord.id})`);
  }
);

/**
 * Create a new invitation for a user by email.
 * Only the owner can send invitations.
 */
export const createInvite = spacetimedb.reducer(
  { org_id: t.u64(), email: t.string() },
  (ctx, { org_id, email }) => {
    const now = BigInt(Date.now());
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new Error('User not found');

    // Check ownership
    let isOwner = false;
    for (const m of ctx.db.organization_member.iter()) {
      if (m.org_id === org_id && m.user_id === user.id && m.role === 'owner') {
        isOwner = true;
        break;
      }
    }
    if (!isOwner) throw new Error('Only the owner can send invitations');

    // Check if an invitation already exists for this email/org
    for (const i of ctx.db.invite.iter()) {
      if (i.org_id === org_id && i.email === email && i.status === 'pending') {
        throw new Error('An invitation is already pending for this email');
      }
    }

    ctx.db.invite.insert({
      id: 0n,
      org_id,
      inviter_user_id: user.id,
      email,
      status: 'pending',
      created_at: now,
    });

    console.info(`Invite created for ${email} in Org ${org_id} by ${user.email}`);
  }
);

/**
 * Generate a new Join ID for an organization.
 * Only the owner can rotate the token.
 */
export const generateJoinId = spacetimedb.reducer(
  { org_id: t.u64() },
  (ctx, { org_id }) => {
    const now = BigInt(Date.now());
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new Error('User not found');

    // Check ownership
    let isOwner = false;
    for (const m of ctx.db.organization_member.iter()) {
      if (m.org_id === org_id && m.user_id === user.id && m.role === 'owner') {
        isOwner = true;
        break;
      }
    }
    if (!isOwner) throw new Error('Only the owner can regenerate the Join ID');

    // Revoke all existing tokens for this org
    for (const j of ctx.db.join_id.iter()) {
      if (j.org_id === org_id && !j.is_revoked) {
        ctx.db.join_id.id.update({ ...j, is_revoked: true });
      }
    }

    // Generate a new unique token (append timestamp to ensure uniqueness if needed)
    const token = generateToken(org_id, now + BigInt(ctx.db.join_id.count()));

    ctx.db.join_id.insert({
      id: 0n,
      org_id,
      token,
      is_revoked: false,
      created_at: now,
    });

    console.info(`New Join ID generated for Org ${org_id}: ${token}`);
  }
);

/**
 * Join an existing organization using a token.
 */
export const joinOrganization = spacetimedb.reducer(
  { token: t.string() },
  (ctx, { token }) => {
    const now = BigInt(Date.now());
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new Error('User not found');

    // Find the active token
    let activeJoinId = null;
    for (const j of ctx.db.join_id.iter()) {
      if (j.token === token) {
        if (j.is_revoked) {
          throw new Error('This Join ID has been revoked. Please ask your administrator for a new one.');
        }
        activeJoinId = j;
        break;
      }
    }

    if (!activeJoinId) {
      throw new Error('Invalid Join ID. Please check the code and try again.');
    }

    const org_id = activeJoinId.org_id;

    // Check if the user is already a member
    for (const m of ctx.db.organization_member.iter()) {
      if (m.user_id === user.id && m.org_id === org_id) {
        throw new Error('You are already a member of this workspace');
      }
    }

    // Add the user as a member
    ctx.db.organization_member.insert({
      id: 0n,
      org_id,
      user_id: user.id,
      role: 'member',
      joined_at: now,
    });

    console.info(`User ${user.email} joined workspace ID ${org_id} using token ${token}`);
  }
);

/**
 * Create a new chat channel (DM or group) within an organization.
 */
export const createChannel = spacetimedb.reducer(
  { org_id: t.u64(), name: t.string(), type: t.string(), member_ids: t.array(t.u64()) },
  (ctx, { org_id, name, type, member_ids }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    // Verify the creator is a member of the org
    let isMember = false;
    for (const m of ctx.db.organization_member.iter()) {
      if (m.org_id === org_id && m.user_id === user.id) {
        isMember = true;
        break;
      }
    }
    if (!isMember) throw new Error('You are not a member of this workspace');

    const channel = ctx.db.chat_channel.insert({
      id: 0n,
      org_id,
      name,
      type, // 'dm' or 'group'
      created_by: user.id,
      created_at: now,
    });

    // Add the creator as a member
    ctx.db.chat_channel_member.insert({
      id: 0n,
      channel_id: channel.id,
      user_id: user.id,
      joined_at: now,
    });

    // Add other specified members
    for (const memberId of member_ids) {
      if (memberId !== user.id) {
        ctx.db.chat_channel_member.insert({
          id: 0n,
          channel_id: channel.id,
          user_id: memberId,
          joined_at: now,
        });
      }
    }

    console.info(`Channel "${name}" created in Org ${org_id} by ${user.email}`);
  }
);

/**
 * Send a message to a chat channel.
 */
export const sendMessage = spacetimedb.reducer(
  { channel_id: t.u64(), content: t.string(), parent_message_id: t.u64() },
  (ctx, { channel_id, content, parent_message_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isChannelMember(ctx, channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    if (content.trim().length === 0) throw new Error('Message cannot be empty');

    if (parent_message_id !== 0n) {
      const parent = ctx.db.chat_message.id.find(parent_message_id);
      if (!parent) throw new Error('Thread parent message not found');
      if (parent.channel_id !== channel_id) {
        throw new Error('Thread parent must belong to the same channel');
      }
    }

    ctx.db.chat_message.insert({
      id: 0n,
      channel_id,
      sender_id: user.id,
      parent_message_id: parent_message_id === 0n ? NONE_U64 : parent_message_id,
      content,
      created_at: now,
      edited_at: NONE_U64,
    });

    upsertPresence(ctx, user.id, 0n, channel_id, 'online', now);
  }
);

/**
 * Add a member to an existing chat channel.
 */
export const addChannelMember = spacetimedb.reducer(
  { channel_id: t.u64(), user_id: t.u64() },
  (ctx, { channel_id, user_id }) => {
    const now = BigInt(Date.now());
    const sender = getUserFromSender(ctx);

    // Find the channel
    const channel = ctx.db.chat_channel.id.find(channel_id);
    if (!channel) throw new Error('Channel not found');

    // Verify the sender is a member of the channel
    let senderIsMember = false;
    for (const cm of ctx.db.chat_channel_member.iter()) {
      if (cm.channel_id === channel_id && cm.user_id === sender.id) {
        senderIsMember = true;
        break;
      }
    }
    if (!senderIsMember) throw new Error('You are not a member of this channel');

    // Check if the target user is already a member
    for (const cm of ctx.db.chat_channel_member.iter()) {
      if (cm.channel_id === channel_id && cm.user_id === user_id) {
        throw new Error('User is already a member of this channel');
      }
    }

    ctx.db.chat_channel_member.insert({
      id: 0n,
      channel_id,
      user_id,
      joined_at: now,
    });

    console.info(`User ${user_id} added to channel ${channel_id}`);
  }
);

/**
 * Start a channel-level video call session.
 */
export const startChannelCall = spacetimedb.reducer(
  { channel_id: t.u64(), dyte_meeting_id: t.string(), title: t.string() },
  (ctx, { channel_id, dyte_meeting_id, title }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    const channel = ctx.db.chat_channel.id.find(channel_id);
    if (!channel) throw new Error('Channel not found');

    if (!isChannelMember(ctx, channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    if (!dyte_meeting_id.trim()) {
      throw new Error('Meeting id is required');
    }

    const active = findActiveCallSessionByChannel(ctx, channel_id);
    if (active) {
      throw new Error('A call is already active in this channel');
    }

    const session = ctx.db.chat_call_session.insert({
      id: 0n,
      channel_id,
      org_id: channel.org_id,
      dyte_meeting_id: dyte_meeting_id.trim(),
      title: title.trim() || `${channel.name} call`,
      started_by_user_id: user.id,
      status: 'active',
      started_at: now,
      ended_at: NONE_U64,
      updated_at: now,
    });

    ctx.db.chat_call_participant.insert({
      id: 0n,
      call_session_id: session.id,
      channel_id,
      user_id: user.id,
      joined_at: now,
      left_at: NONE_U64,
      updated_at: now,
    });

    ctx.db.chat_message.insert({
      id: 0n,
      channel_id,
      sender_id: user.id,
      content: `started a video call: ${session.title}`,
      created_at: now,
      parent_message_id: NONE_U64,
      edited_at: NONE_U64,
    });
  }
);

/**
 * Mark the current user as joined in an active call.
 */
export const joinChannelCall = spacetimedb.reducer(
  { call_session_id: t.u64() },
  (ctx, { call_session_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const session = ctx.db.chat_call_session.id.find(call_session_id);
    if (!session) throw new Error('Call session not found');
    if (session.status !== 'active' || session.ended_at !== NONE_U64) {
      throw new Error('This call has already ended');
    }

    if (!isChannelMember(ctx, session.channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    for (const participant of ctx.db.chat_call_participant.iter()) {
      if (
        participant.call_session_id === call_session_id &&
        participant.user_id === user.id &&
        participant.left_at === NONE_U64
      ) {
        return;
      }
    }

    ctx.db.chat_call_participant.insert({
      id: 0n,
      call_session_id,
      channel_id: session.channel_id,
      user_id: user.id,
      joined_at: now,
      left_at: NONE_U64,
      updated_at: now,
    });

    ctx.db.chat_call_session.id.update({
      ...session,
      updated_at: now,
    });
  }
);

/**
 * Mark the current user as left from a call.
 * If no participants remain, the call auto-ends.
 */
export const leaveChannelCall = spacetimedb.reducer(
  { call_session_id: t.u64() },
  (ctx, { call_session_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const session = ctx.db.chat_call_session.id.find(call_session_id);
    if (!session) throw new Error('Call session not found');

    let activeParticipant = null;
    for (const participant of ctx.db.chat_call_participant.iter()) {
      if (
        participant.call_session_id === call_session_id &&
        participant.user_id === user.id &&
        participant.left_at === NONE_U64
      ) {
        activeParticipant = participant;
        break;
      }
    }

    if (activeParticipant) {
      ctx.db.chat_call_participant.id.update({
        ...activeParticipant,
        left_at: now,
        updated_at: now,
      });
    }

    const refreshedSession = ctx.db.chat_call_session.id.find(call_session_id);
    if (!refreshedSession || refreshedSession.status !== 'active' || refreshedSession.ended_at !== NONE_U64) {
      return;
    }

    const remaining = countActiveCallParticipants(ctx, call_session_id);
    if (remaining > 0) {
      ctx.db.chat_call_session.id.update({
        ...refreshedSession,
        updated_at: now,
      });
      return;
    }

    ctx.db.chat_call_session.id.update({
      ...refreshedSession,
      status: 'ended',
      ended_at: now,
      updated_at: now,
    });

    if (refreshedSession.channel_id !== NONE_U64) {
      ctx.db.chat_message.insert({
        id: 0n,
        channel_id: refreshedSession.channel_id,
        sender_id: user.id,
        content: `ended the video call: ${refreshedSession.title}`,
        created_at: now,
        parent_message_id: NONE_U64,
        edited_at: NONE_U64,
      });
    }

    markScheduledMeetingsEndedByCall(ctx, refreshedSession, now);
  }
);

/**
 * End an active call for everyone in the channel.
 */
export const endChannelCall = spacetimedb.reducer(
  { call_session_id: t.u64() },
  (ctx, { call_session_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const session = ctx.db.chat_call_session.id.find(call_session_id);
    if (!session) throw new Error('Call session not found');
    if (session.status !== 'active' || session.ended_at !== NONE_U64) return;

    if (session.channel_id === NONE_U64) {
      if (!isOrganizationMember(ctx, session.org_id, user.id)) {
        throw new Error('You are not a member of this workspace');
      }
    } else if (!isChannelMember(ctx, session.channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    for (const participant of ctx.db.chat_call_participant.iter()) {
      if (participant.call_session_id === call_session_id && participant.left_at === NONE_U64) {
        ctx.db.chat_call_participant.id.update({
          ...participant,
          left_at: now,
          updated_at: now,
        });
      }
    }

    ctx.db.chat_call_session.id.update({
      ...session,
      status: 'ended',
      ended_at: now,
      updated_at: now,
    });

    if (session.channel_id !== NONE_U64) {
      ctx.db.chat_message.insert({
        id: 0n,
        channel_id: session.channel_id,
        sender_id: user.id,
        content: `ended the video call: ${session.title}`,
        created_at: now,
        parent_message_id: NONE_U64,
        edited_at: NONE_U64,
      });
    }

    markScheduledMeetingsEndedByCall(ctx, session, now);
  }
);

/**
 * Create a scheduled meeting tied to a chat channel.
 */
export const createScheduledMeeting = spacetimedb.reducer(
  {
    org_id: t.u64(),
    channel_id: t.u64(),
    visibility: t.string(),
    title: t.string(),
    description: t.string(),
    scheduled_at: t.u64(),
    dyte_meeting_id: t.string(),
  },
  (ctx, { org_id, channel_id, visibility, title, description, scheduled_at, dyte_meeting_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isOrganizationMember(ctx, org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    if (title.trim().length === 0) throw new Error('Meeting name is required');
    if (dyte_meeting_id.trim().length === 0) throw new Error('Meeting id is required');

    const scheduledAt = BigInt(scheduled_at);
    if (scheduledAt <= now + 60_000n) {
      throw new Error('Meeting must be scheduled at least 1 minute in the future');
    }

    let resolvedChannelId = channel_id;
    if (visibility === 'channel') {
      const channel = ctx.db.chat_channel.id.find(channel_id);
      if (!channel) throw new Error('Channel not found');
      if (channel.org_id !== org_id) {
        throw new Error('Channel does not belong to this workspace');
      }
      if (!isChannelMember(ctx, channel_id, user.id)) {
        throw new Error('You are not a member of this channel');
      }
    } else if (visibility === 'public') {
      resolvedChannelId = NONE_U64;
    } else {
      throw new Error('Invalid meeting visibility');
    }

    const meeting = ctx.db.chat_scheduled_meeting.insert({
      id: 0n,
      org_id,
      channel_id: resolvedChannelId,
      visibility,
      title: title.trim(),
      description: description.trim(),
      scheduled_at: scheduledAt,
      dyte_meeting_id: dyte_meeting_id.trim(),
      created_by_user_id: user.id,
      status: 'scheduled',
      started_call_session_id: NONE_U64,
      created_at: now,
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: org_id,
      actorUserId: user.id,
      meetingId: meeting.id,
      eventType: 'meeting_scheduled',
      description: `Scheduled meeting "${meeting.title}"`,
      metadataJson: JSON.stringify({
        visibility: meeting.visibility,
        scheduled_at: meeting.scheduled_at.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Update an existing scheduled meeting.
 */
export const updateScheduledMeeting = spacetimedb.reducer(
  {
    meeting_id: t.u64(),
    channel_id: t.u64(),
    visibility: t.string(),
    title: t.string(),
    description: t.string(),
    scheduled_at: t.u64(),
  },
  (ctx, { meeting_id, channel_id, visibility, title, description, scheduled_at }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const meeting = ctx.db.chat_scheduled_meeting.id.find(meeting_id);
    if (!meeting) throw new Error('Meeting not found');

    if (meeting.visibility === 'public') {
      if (!isOrganizationMember(ctx, meeting.org_id, user.id)) {
        throw new Error('You are not a member of this workspace');
      }
    } else if (!isChannelMember(ctx, meeting.channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    const canManage =
      meeting.created_by_user_id === user.id ||
      isOrganizationOwner(ctx, meeting.org_id, user.id);
    if (!canManage) {
      throw new Error('Only the organizer or organization owner can update this meeting');
    }
    if (meeting.status !== 'scheduled') {
      throw new Error('Only scheduled meetings can be updated');
    }
    if (title.trim().length === 0) {
      throw new Error('Meeting name is required');
    }

    const scheduledAt = BigInt(scheduled_at);
    if (scheduledAt <= now + 60_000n) {
      throw new Error('Meeting must be scheduled at least 1 minute in the future');
    }

    let resolvedChannelId = channel_id;
    if (visibility === 'channel') {
      const channel = ctx.db.chat_channel.id.find(channel_id);
      if (!channel) throw new Error('Channel not found');
      if (channel.org_id !== meeting.org_id) {
        throw new Error('Channel does not belong to this workspace');
      }
      if (!isChannelMember(ctx, channel_id, user.id)) {
        throw new Error('You are not a member of this channel');
      }
    } else if (visibility === 'public') {
      resolvedChannelId = NONE_U64;
    } else {
      throw new Error('Invalid meeting visibility');
    }

    let linkedBooking = null;
    for (const row of ctx.db.meeting_booking.iter()) {
      if (row.scheduled_meeting_id === meeting.id && row.status === 'confirmed') {
        linkedBooking = row;
        break;
      }
    }

    if (linkedBooking) {
      const duration = linkedBooking.ends_at - linkedBooking.starts_at;
      const nextEndsAt = scheduledAt + duration;
      if (hasConfirmedBookingOverlap(ctx, linkedBooking.host_user_id, scheduledAt, nextEndsAt, linkedBooking.id)) {
        throw new Error('This time overlaps an existing booking');
      }

      ctx.db.meeting_booking.id.update({
        ...linkedBooking,
        starts_at: scheduledAt,
        ends_at: nextEndsAt,
        updated_at: now,
      });
    }

    const previousVisibility = meeting.visibility;
    const previousChannelId = meeting.channel_id;
    const previousScheduledAt = meeting.scheduled_at;
    const previousTitle = meeting.title;
    const previousDescription = meeting.description;

    ctx.db.chat_scheduled_meeting.id.update({
      ...meeting,
      channel_id: resolvedChannelId,
      visibility,
      title: title.trim(),
      description: description.trim(),
      scheduled_at: scheduledAt,
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: meeting.org_id,
      actorUserId: user.id,
      bookingId: linkedBooking ? linkedBooking.id : NONE_U64,
      meetingId: meeting.id,
      eventType: 'meeting_updated',
      description: `Updated meeting "${title.trim()}"`,
      metadataJson: JSON.stringify({
        old_title: previousTitle,
        new_title: title.trim(),
        old_description: previousDescription,
        new_description: description.trim(),
        old_visibility: previousVisibility,
        new_visibility: visibility,
        old_channel_id: previousChannelId.toString(),
        new_channel_id: resolvedChannelId.toString(),
        old_scheduled_at: previousScheduledAt.toString(),
        new_scheduled_at: scheduledAt.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Cancel a scheduled meeting before it starts.
 */
export const cancelScheduledMeeting = spacetimedb.reducer(
  { meeting_id: t.u64() },
  (ctx, { meeting_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const meeting = ctx.db.chat_scheduled_meeting.id.find(meeting_id);
    if (!meeting) throw new Error('Meeting not found');

    if (meeting.visibility === 'public') {
      if (!isOrganizationMember(ctx, meeting.org_id, user.id)) {
        throw new Error('You are not a member of this workspace');
      }
    } else if (!isChannelMember(ctx, meeting.channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    const canManage =
      meeting.created_by_user_id === user.id ||
      isOrganizationOwner(ctx, meeting.org_id, user.id);

    if (!canManage) {
      throw new Error('Only the organizer or organization owner can cancel this meeting');
    }

    if (meeting.status !== 'scheduled') {
      throw new Error('Only scheduled meetings can be cancelled');
    }

    ctx.db.chat_scheduled_meeting.id.update({
      ...meeting,
      status: 'cancelled',
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: meeting.org_id,
      actorUserId: user.id,
      meetingId: meeting.id,
      eventType: 'meeting_cancelled',
      description: `Cancelled meeting "${meeting.title}"`,
      metadataJson: JSON.stringify({
        visibility: meeting.visibility,
        scheduled_at: meeting.scheduled_at.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Reschedule a scheduled meeting.
 */
export const rescheduleScheduledMeeting = spacetimedb.reducer(
  { meeting_id: t.u64(), scheduled_at: t.u64() },
  (ctx, { meeting_id, scheduled_at }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const meeting = ctx.db.chat_scheduled_meeting.id.find(meeting_id);
    if (!meeting) throw new Error('Meeting not found');

    if (meeting.visibility === 'public') {
      if (!isOrganizationMember(ctx, meeting.org_id, user.id)) {
        throw new Error('You are not a member of this workspace');
      }
    } else if (!isChannelMember(ctx, meeting.channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    const canManage =
      meeting.created_by_user_id === user.id ||
      isOrganizationOwner(ctx, meeting.org_id, user.id);
    if (!canManage) {
      throw new Error('Only the organizer or organization owner can reschedule this meeting');
    }
    if (meeting.status !== 'scheduled') {
      throw new Error('Only scheduled meetings can be rescheduled');
    }

    const scheduledAt = BigInt(scheduled_at);
    if (scheduledAt <= now + 60_000n) {
      throw new Error('Meeting must be rescheduled at least 1 minute in the future');
    }

    // Keep linked booking in sync when this meeting was materialized from booking flow.
    let linkedBooking = null;
    for (const row of ctx.db.meeting_booking.iter()) {
      if (row.scheduled_meeting_id === meeting.id && row.status === 'confirmed') {
        linkedBooking = row;
        break;
      }
    }

    if (linkedBooking) {
      const duration = linkedBooking.ends_at - linkedBooking.starts_at;
      const nextEndsAt = scheduledAt + duration;
      if (hasConfirmedBookingOverlap(ctx, linkedBooking.host_user_id, scheduledAt, nextEndsAt, linkedBooking.id)) {
        throw new Error('This time overlaps an existing booking');
      }

      ctx.db.meeting_booking.id.update({
        ...linkedBooking,
        starts_at: scheduledAt,
        ends_at: nextEndsAt,
        updated_at: now,
      });
    }

    ctx.db.chat_scheduled_meeting.id.update({
      ...meeting,
      scheduled_at: scheduledAt,
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: meeting.org_id,
      actorUserId: user.id,
      bookingId: linkedBooking ? linkedBooking.id : NONE_U64,
      meetingId: meeting.id,
      eventType: 'meeting_rescheduled',
      description: `Rescheduled meeting "${meeting.title}"`,
      metadataJson: JSON.stringify({
        old_scheduled_at: meeting.scheduled_at.toString(),
        new_scheduled_at: scheduledAt.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Join a scheduled meeting. Join is allowed up to 10 minutes before start.
 * If the meeting call has not started yet, this reducer starts it.
 */
export const joinScheduledMeeting = spacetimedb.reducer(
  { meeting_id: t.u64() },
  (ctx, { meeting_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const meeting = ctx.db.chat_scheduled_meeting.id.find(meeting_id);
    if (!meeting) throw new Error('Meeting not found');

    if (meeting.visibility === 'public') {
      if (!isOrganizationMember(ctx, meeting.org_id, user.id)) {
        throw new Error('You are not a member of this workspace');
      }
    } else if (!isChannelMember(ctx, meeting.channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    if (meeting.status === 'cancelled') {
      throw new Error('This meeting has been cancelled');
    }
    if (meeting.status === 'ended') {
      throw new Error('This meeting has already ended');
    }

    const joinOpenAt =
      meeting.scheduled_at > SCHEDULED_JOIN_LEAD_MS
        ? meeting.scheduled_at - SCHEDULED_JOIN_LEAD_MS
        : 0n;

    if (now < joinOpenAt) {
      throw new Error('You can join this meeting only 10 minutes before the scheduled start');
    }

    let session = null;
    for (const existing of ctx.db.chat_call_session.iter()) {
      if (
        existing.dyte_meeting_id === meeting.dyte_meeting_id &&
        existing.status === 'active' &&
        existing.ended_at === NONE_U64
      ) {
        session = existing;
        break;
      }
    }

    if (!session && meeting.visibility === 'channel') {
      const activeInChannel = findActiveCallSessionByChannel(ctx, meeting.channel_id);
      if (activeInChannel && activeInChannel.dyte_meeting_id !== meeting.dyte_meeting_id) {
        throw new Error('Another call is already active in this channel');
      }
      session = activeInChannel;
    }

    if (!session) {
      session = ctx.db.chat_call_session.insert({
        id: 0n,
        channel_id: meeting.channel_id,
        org_id: meeting.org_id,
        dyte_meeting_id: meeting.dyte_meeting_id,
        title: meeting.title,
        started_by_user_id: user.id,
        status: 'active',
        started_at: now,
        ended_at: NONE_U64,
        updated_at: now,
      });

      if (meeting.channel_id !== NONE_U64) {
        ctx.db.chat_message.insert({
          id: 0n,
          channel_id: meeting.channel_id,
          sender_id: user.id,
          content: `started a video call: ${meeting.title}`,
          created_at: now,
          parent_message_id: NONE_U64,
          edited_at: NONE_U64,
        });
      }
    }

    let alreadyParticipant = false;
    for (const participant of ctx.db.chat_call_participant.iter()) {
      if (
        participant.call_session_id === session.id &&
        participant.user_id === user.id &&
        participant.left_at === NONE_U64
      ) {
        alreadyParticipant = true;
        break;
      }
    }

    if (!alreadyParticipant) {
      ctx.db.chat_call_participant.insert({
        id: 0n,
        call_session_id: session.id,
        channel_id: session.channel_id,
        user_id: user.id,
        joined_at: now,
        left_at: NONE_U64,
        updated_at: now,
      });
    }

    ctx.db.chat_call_session.id.update({
      ...session,
      updated_at: now,
    });

    markScheduledMeetingStarted(ctx, meeting.id, session.id, now);
  }
);

/**
 * Set or update the public scheduling profile for a user.
 */
export const upsertMeetingPublicProfile = spacetimedb.reducer(
  {
    org_id: t.u64(),
    handle: t.string(),
    timezone: t.string(),
    headline: t.string(),
    booking_enabled: t.bool(),
  },
  (ctx, { org_id, handle, timezone, headline, booking_enabled }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isOrganizationMember(ctx, org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const normalizedHandle = handle.trim().toLowerCase();
    if (!isValidHandle(normalizedHandle)) {
      throw new Error('Handle must be 3-32 chars and use lowercase letters, numbers, or hyphens');
    }

    for (const row of ctx.db.meeting_public_profile.iter()) {
      if (row.handle === normalizedHandle && row.user_id !== user.id) {
        throw new Error('This public handle is already taken');
      }
    }

    const existing = ctx.db.meeting_public_profile.user_id.find(user.id);
    if (existing) {
      ctx.db.meeting_public_profile.user_id.update({
        ...existing,
        org_id,
        handle: normalizedHandle,
        timezone: timezone.trim(),
        headline: headline.trim(),
        booking_enabled,
        updated_at: now,
      });
      return;
    }

    ctx.db.meeting_public_profile.insert({
      user_id: user.id,
      org_id,
      handle: normalizedHandle,
      timezone: timezone.trim(),
      headline: headline.trim(),
      booking_enabled,
      created_at: now,
      updated_at: now,
    });
  }
);

/**
 * Create a scheduling event type for an organization user.
 */
export const createMeetingEventType = spacetimedb.reducer(
  {
    org_id: t.u64(),
    slug: t.string(),
    title: t.string(),
    description: t.string(),
    duration_min: t.u64(),
    visibility: t.string(),
    default_channel_id: t.u64(),
    require_approval: t.bool(),
    is_active: t.bool(),
    max_days_in_advance: t.u64(),
    min_notice_min: t.u64(),
    buffer_before_min: t.u64(),
    buffer_after_min: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const slug = args.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
      throw new Error('Event slug must use lowercase letters, numbers, and hyphens');
    }

    for (const row of ctx.db.meeting_event_type.iter()) {
      if (row.org_id === args.org_id && row.slug === slug && row.is_active) {
        throw new Error('An active event type with this slug already exists');
      }
    }

    if (args.title.trim().length < 2) {
      throw new Error('Event type title is required');
    }
    if (args.duration_min < 5n || args.duration_min > 8n * 60n) {
      throw new Error('Duration must be between 5 and 480 minutes');
    }
    if (args.visibility !== 'public' && args.visibility !== 'channel') {
      throw new Error('Visibility must be public or channel');
    }

    let defaultChannelId = args.default_channel_id;
    if (args.visibility === 'channel') {
      if (defaultChannelId === NONE_U64) {
        throw new Error('Channel visibility requires a default channel');
      }
      const channel = ctx.db.chat_channel.id.find(defaultChannelId);
      if (!channel || channel.org_id !== args.org_id) {
        throw new Error('Default channel not found in this workspace');
      }
      if (!isChannelMember(ctx, defaultChannelId, user.id)) {
        throw new Error('You are not a member of the default channel');
      }
    } else {
      defaultChannelId = NONE_U64;
    }

    ctx.db.meeting_event_type.insert({
      id: 0n,
      org_id: args.org_id,
      owner_user_id: user.id,
      slug,
      title: args.title.trim(),
      description: args.description.trim(),
      duration_min: args.duration_min,
      visibility: args.visibility,
      default_channel_id: defaultChannelId,
      require_approval: args.require_approval,
      is_active: args.is_active,
      max_days_in_advance: args.max_days_in_advance,
      min_notice_min: args.min_notice_min,
      buffer_before_min: args.buffer_before_min,
      buffer_after_min: args.buffer_after_min,
      created_at: now,
      updated_at: now,
    });
  }
);

/**
 * Update an existing event type.
 */
export const updateMeetingEventType = spacetimedb.reducer(
  {
    event_type_id: t.u64(),
    title: t.string(),
    description: t.string(),
    duration_min: t.u64(),
    visibility: t.string(),
    default_channel_id: t.u64(),
    require_approval: t.bool(),
    is_active: t.bool(),
    max_days_in_advance: t.u64(),
    min_notice_min: t.u64(),
    buffer_before_min: t.u64(),
    buffer_after_min: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const eventType = ctx.db.meeting_event_type.id.find(args.event_type_id);
    if (!eventType) throw new Error('Event type not found');

    const canManage =
      eventType.owner_user_id === user.id ||
      isOrganizationOwner(ctx, eventType.org_id, user.id);
    if (!canManage) throw new Error('Only the owner or organization owner can update this event type');

    if (args.title.trim().length < 2) throw new Error('Event type title is required');
    if (args.duration_min < 5n || args.duration_min > 8n * 60n) {
      throw new Error('Duration must be between 5 and 480 minutes');
    }
    if (args.visibility !== 'public' && args.visibility !== 'channel') {
      throw new Error('Visibility must be public or channel');
    }

    let defaultChannelId = args.default_channel_id;
    if (args.visibility === 'channel') {
      if (defaultChannelId === NONE_U64) {
        throw new Error('Channel visibility requires a default channel');
      }
      const channel = ctx.db.chat_channel.id.find(defaultChannelId);
      if (!channel || channel.org_id !== eventType.org_id) {
        throw new Error('Default channel not found in this workspace');
      }
    } else {
      defaultChannelId = NONE_U64;
    }

    ctx.db.meeting_event_type.id.update({
      ...eventType,
      title: args.title.trim(),
      description: args.description.trim(),
      duration_min: args.duration_min,
      visibility: args.visibility,
      default_channel_id: defaultChannelId,
      require_approval: args.require_approval,
      is_active: args.is_active,
      max_days_in_advance: args.max_days_in_advance,
      min_notice_min: args.min_notice_min,
      buffer_before_min: args.buffer_before_min,
      buffer_after_min: args.buffer_after_min,
      updated_at: now,
    });
  }
);

/**
 * Replace availability rules for an event type and owner.
 */
export const setMeetingAvailabilityRules = spacetimedb.reducer(
  {
    event_type_id: t.u64(),
    timezone: t.string(),
    rules_json: t.string(),
  },
  (ctx, { event_type_id, timezone, rules_json }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const eventType = ctx.db.meeting_event_type.id.find(event_type_id);
    if (!eventType) throw new Error('Event type not found');

    const canManage =
      eventType.owner_user_id === user.id ||
      isOrganizationOwner(ctx, eventType.org_id, user.id);
    if (!canManage) throw new Error('Only the owner or organization owner can manage availability');

    type AvailabilityRuleInput = {
      weekday: number;
      start_minute: number;
      end_minute: number;
      is_enabled: boolean;
    };

    let parsedRules: AvailabilityRuleInput[] = [];
    try {
      const raw = JSON.parse(rules_json) as unknown;
      if (!Array.isArray(raw)) throw new Error('rules_json must be an array');
      parsedRules = raw as AvailabilityRuleInput[];
    } catch (error) {
      throw new Error(`Invalid rules_json payload: ${error instanceof Error ? error.message : 'parse failed'}`);
    }

    const rules = parsedRules.map((rule) => ({
      weekday: BigInt(rule.weekday),
      start_minute: BigInt(rule.start_minute),
      end_minute: BigInt(rule.end_minute),
      is_enabled: Boolean(rule.is_enabled),
    }));

    for (const rule of rules) {
      if (rule.weekday > 6n) throw new Error('Weekday must be 0-6');
      if (rule.start_minute >= rule.end_minute) {
        throw new Error('Availability window start must be before end');
      }
      if (rule.end_minute > 24n * 60n) {
        throw new Error('Availability end must be within the day');
      }
    }

    for (const existing of ctx.db.meeting_availability_rule.iter()) {
      if (existing.event_type_id === event_type_id && existing.user_id === eventType.owner_user_id) {
        ctx.db.meeting_availability_rule.id.update({
          ...existing,
          is_enabled: false,
          updated_at: now,
        });
      }
    }

    for (const rule of rules) {
      ctx.db.meeting_availability_rule.insert({
        id: 0n,
        event_type_id,
        user_id: eventType.owner_user_id,
        weekday: rule.weekday,
        start_minute: rule.start_minute,
        end_minute: rule.end_minute,
        timezone: timezone.trim(),
        is_enabled: rule.is_enabled,
        created_at: now,
        updated_at: now,
      });
    }
  }
);

/**
 * Create a booking from an event type and materialize it into a scheduled meeting.
 */
export const createMeetingBooking = spacetimedb.reducer(
  {
    event_type_id: t.u64(),
    invitee_name: t.string(),
    invitee_email: t.string(),
    invitee_timezone: t.string(),
    starts_at: t.u64(),
    notes: t.string(),
    dyte_meeting_id: t.string(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const senderUser = getUserFromSenderOptional(ctx);
    const eventType = ctx.db.meeting_event_type.id.find(args.event_type_id);
    if (!eventType) throw new Error('Event type not found');
    if (!eventType.is_active) throw new Error('This event type is not active');

    const isSenderMember = senderUser != null &&
      isOrganizationMember(ctx, eventType.org_id, senderUser.id);

    if (eventType.visibility === 'channel' && !isSenderMember) {
      throw new Error('Channel meetings can only be booked by workspace members');
    }

    const inviteeName = args.invitee_name.trim();
    const inviteeEmail = args.invitee_email.trim().toLowerCase();
    if (inviteeName.length < 2) throw new Error('Invitee name is required');
    if (!isEmailLike(inviteeEmail)) throw new Error('Invitee email is invalid');

    const startsAt = BigInt(args.starts_at);
    if (startsAt <= now) throw new Error('Booking start time must be in the future');

    const minNoticeMs = eventType.min_notice_min * 60n * 1000n;
    if (startsAt < now + minNoticeMs) {
      throw new Error('Selected time is too soon for this event type');
    }

    const maxAdvanceMs = eventType.max_days_in_advance * 24n * 60n * 60n * 1000n;
    if (startsAt > now + maxAdvanceMs) {
      throw new Error('Selected time is beyond max booking window');
    }

    const durationMs = eventType.duration_min * 60n * 1000n;
    const endsAt = startsAt + durationMs;
    const actorUserId = isSenderMember && senderUser
      ? senderUser.id
      : eventType.owner_user_id;
    const bookedByUserId = isSenderMember && senderUser
      ? senderUser.id
      : NONE_U64;
    const isApprovalRequired = eventType.require_approval;
    const meetingId = args.dyte_meeting_id.trim();

    if (!isApprovalRequired && meetingId.length === 0) {
      throw new Error('Meeting id is required');
    }

    if (hasConfirmedBookingOverlap(ctx, eventType.owner_user_id, startsAt, endsAt)) {
      throw new Error('This time overlaps an existing booking');
    }

    const token = generateBookingToken(eventType.org_id, now, BigInt(ctx.db.meeting_booking.count()));
    const booking = ctx.db.meeting_booking.insert({
      id: 0n,
      org_id: eventType.org_id,
      event_type_id: eventType.id,
      scheduled_meeting_id: NONE_U64,
      host_user_id: eventType.owner_user_id,
      booked_by_user_id: bookedByUserId,
      invitee_name: inviteeName,
      invitee_email: inviteeEmail,
      invitee_timezone: args.invitee_timezone.trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      status: isApprovalRequired ? 'pending' : 'confirmed',
      booking_token: token,
      notes: args.notes.trim(),
      created_at: now,
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: eventType.org_id,
      actorUserId: senderUser ? senderUser.id : NONE_U64,
      bookingId: booking.id,
      eventType: isApprovalRequired ? 'booking_requested' : 'booking_confirmed',
      description: isApprovalRequired
        ? `Booking request created for "${eventType.title}"`
        : `Booking confirmed for "${eventType.title}"`,
      metadataJson: JSON.stringify({
        event_type_id: eventType.id.toString(),
        starts_at: booking.starts_at.toString(),
        invitee_email: booking.invitee_email,
      }),
      createdAt: now,
    });

    if (!isApprovalRequired) {
      const meeting = ctx.db.chat_scheduled_meeting.insert({
        id: 0n,
        org_id: eventType.org_id,
        channel_id: eventType.visibility === 'channel' ? eventType.default_channel_id : NONE_U64,
        visibility: eventType.visibility,
        title: eventType.title,
        description: args.notes.trim(),
        scheduled_at: startsAt,
        dyte_meeting_id: meetingId,
        created_by_user_id: actorUserId,
        status: 'scheduled',
        started_call_session_id: NONE_U64,
        created_at: now,
        updated_at: now,
      });

      ctx.db.meeting_booking.id.update({
        ...booking,
        scheduled_meeting_id: meeting.id,
        updated_at: now,
      });

      insertMeetingActivity(ctx, {
        orgId: eventType.org_id,
        actorUserId: senderUser ? senderUser.id : NONE_U64,
        bookingId: booking.id,
        meetingId: meeting.id,
        eventType: 'booking_materialized',
        description: `Booking created scheduled meeting "${meeting.title}"`,
        metadataJson: JSON.stringify({
          meeting_id: meeting.id.toString(),
          dyte_meeting_id: meeting.dyte_meeting_id,
        }),
        createdAt: now,
      });

      if (meeting.channel_id !== NONE_U64 && senderUser && isSenderMember) {
        ctx.db.chat_message.insert({
          id: 0n,
          channel_id: meeting.channel_id,
          sender_id: senderUser.id,
          content: `scheduled a meeting: ${meeting.title}`,
          created_at: now,
          parent_message_id: NONE_U64,
          edited_at: NONE_U64,
        });
      }
    }
  }
);

/**
 * Approve a pending booking request and create the scheduled meeting.
 */
export const approveMeetingBooking = spacetimedb.reducer(
  {
    booking_id: t.u64(),
    dyte_meeting_id: t.string(),
  },
  (ctx, { booking_id, dyte_meeting_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const booking = ctx.db.meeting_booking.id.find(booking_id);
    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'pending') throw new Error('Only pending bookings can be approved');

    const canManage =
      booking.host_user_id === user.id ||
      isOrganizationOwner(ctx, booking.org_id, user.id);
    if (!canManage) throw new Error('You are not allowed to approve this booking');

    const eventType = ctx.db.meeting_event_type.id.find(booking.event_type_id);
    if (!eventType) throw new Error('Event type not found');
    const meetingId = dyte_meeting_id.trim();
    if (meetingId.length === 0) throw new Error('Meeting id is required');

    const meeting = ctx.db.chat_scheduled_meeting.insert({
      id: 0n,
      org_id: eventType.org_id,
      channel_id: eventType.visibility === 'channel' ? eventType.default_channel_id : NONE_U64,
      visibility: eventType.visibility,
      title: eventType.title,
      description: booking.notes,
      scheduled_at: booking.starts_at,
      dyte_meeting_id: meetingId,
      created_by_user_id: user.id,
      status: 'scheduled',
      started_call_session_id: NONE_U64,
      created_at: now,
      updated_at: now,
    });

    ctx.db.meeting_booking.id.update({
      ...booking,
      status: 'confirmed',
      scheduled_meeting_id: meeting.id,
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: booking.org_id,
      actorUserId: user.id,
      bookingId: booking.id,
      meetingId: meeting.id,
      eventType: 'booking_approved',
      description: `Approved booking for "${eventType.title}"`,
      metadataJson: JSON.stringify({
        invitee_email: booking.invitee_email,
        starts_at: booking.starts_at.toString(),
      }),
      createdAt: now,
    });

    if (meeting.channel_id !== NONE_U64) {
      ctx.db.chat_message.insert({
        id: 0n,
        channel_id: meeting.channel_id,
        sender_id: user.id,
        content: `approved a booking: ${meeting.title}`,
        created_at: now,
        parent_message_id: NONE_U64,
        edited_at: NONE_U64,
      });
    }
  }
);

/**
 * Reject a pending booking request.
 */
export const rejectMeetingBooking = spacetimedb.reducer(
  { booking_id: t.u64() },
  (ctx, { booking_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const booking = ctx.db.meeting_booking.id.find(booking_id);
    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'pending') throw new Error('Only pending bookings can be rejected');

    const canManage =
      booking.host_user_id === user.id ||
      isOrganizationOwner(ctx, booking.org_id, user.id);
    if (!canManage) throw new Error('You are not allowed to reject this booking');

    ctx.db.meeting_booking.id.update({
      ...booking,
      status: 'cancelled',
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: booking.org_id,
      actorUserId: user.id,
      bookingId: booking.id,
      eventType: 'booking_rejected',
      description: `Declined booking request from ${booking.invitee_name}`,
      metadataJson: JSON.stringify({
        invitee_email: booking.invitee_email,
        starts_at: booking.starts_at.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Cancel a booking and its scheduled meeting.
 */
export const cancelMeetingBooking = spacetimedb.reducer(
  { booking_id: t.u64() },
  (ctx, { booking_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const booking = ctx.db.meeting_booking.id.find(booking_id);
    if (!booking) throw new Error('Booking not found');

    const canManage =
      booking.booked_by_user_id === user.id ||
      booking.host_user_id === user.id ||
      isOrganizationOwner(ctx, booking.org_id, user.id);
    if (!canManage) throw new Error('You are not allowed to cancel this booking');

    cancelBookingAndMeeting(ctx, booking, now);

    insertMeetingActivity(ctx, {
      orgId: booking.org_id,
      actorUserId: user.id,
      bookingId: booking.id,
      meetingId: booking.scheduled_meeting_id,
      eventType: 'booking_cancelled',
      description: `Cancelled booking for ${booking.invitee_name}`,
      metadataJson: JSON.stringify({
        starts_at: booking.starts_at.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Cancel a booking using its booking token.
 */
export const cancelMeetingBookingByToken = spacetimedb.reducer(
  { booking_token: t.string() },
  (ctx, { booking_token }) => {
    const now = BigInt(Date.now());
    const token = booking_token.trim().toLowerCase();
    if (token.length === 0) throw new Error('Booking token is required');

    const booking = ctx.db.meeting_booking.booking_token.find(token);
    if (!booking) throw new Error('Booking not found');

    cancelBookingAndMeeting(ctx, booking, now);

    insertMeetingActivity(ctx, {
      orgId: booking.org_id,
      actorUserId: NONE_U64,
      bookingId: booking.id,
      meetingId: booking.scheduled_meeting_id,
      eventType: 'booking_cancelled_by_token',
      description: `Booking cancelled via public manage link`,
      metadataJson: JSON.stringify({
        invitee_email: booking.invitee_email,
        starts_at: booking.starts_at.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Reschedule a booking by an authorized user (invitee, host, or organization owner).
 */
export const rescheduleMeetingBooking = spacetimedb.reducer(
  {
    booking_id: t.u64(),
    starts_at: t.u64(),
  },
  (ctx, { booking_id, starts_at }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const booking = ctx.db.meeting_booking.id.find(booking_id);
    if (!booking) throw new Error('Booking not found');

    const canManage =
      booking.booked_by_user_id === user.id ||
      booking.host_user_id === user.id ||
      isOrganizationOwner(ctx, booking.org_id, user.id);
    if (!canManage) throw new Error('You are not allowed to reschedule this booking');

    const eventType = ctx.db.meeting_event_type.id.find(booking.event_type_id);
    if (!eventType) throw new Error('Event type not found');

    const oldStartsAt = booking.starts_at;
    rescheduleBookingAndMeeting(ctx, booking, eventType, BigInt(starts_at), now);

    insertMeetingActivity(ctx, {
      orgId: booking.org_id,
      actorUserId: user.id,
      bookingId: booking.id,
      meetingId: booking.scheduled_meeting_id,
      eventType: 'booking_rescheduled',
      description: `Rescheduled booking for ${booking.invitee_name}`,
      metadataJson: JSON.stringify({
        old_starts_at: oldStartsAt.toString(),
        new_starts_at: starts_at.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Reschedule a booking with booking token.
 */
export const rescheduleMeetingBookingByToken = spacetimedb.reducer(
  {
    booking_token: t.string(),
    starts_at: t.u64(),
  },
  (ctx, { booking_token, starts_at }) => {
    const now = BigInt(Date.now());
    const token = booking_token.trim().toLowerCase();
    if (token.length === 0) throw new Error('Booking token is required');

    const booking = ctx.db.meeting_booking.booking_token.find(token);
    if (!booking) throw new Error('Booking not found');

    const eventType = ctx.db.meeting_event_type.id.find(booking.event_type_id);
    if (!eventType) throw new Error('Event type not found');

    const oldStartsAt = booking.starts_at;
    rescheduleBookingAndMeeting(ctx, booking, eventType, BigInt(starts_at), now);

    insertMeetingActivity(ctx, {
      orgId: booking.org_id,
      actorUserId: NONE_U64,
      bookingId: booking.id,
      meetingId: booking.scheduled_meeting_id,
      eventType: 'booking_rescheduled_by_token',
      description: `Booking rescheduled via public manage link`,
      metadataJson: JSON.stringify({
        old_starts_at: oldStartsAt.toString(),
        new_starts_at: starts_at.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Set recording policy for an organization.
 */
export const setMeetingRecordingPolicy = spacetimedb.reducer(
  {
    org_id: t.u64(),
    mode: t.string(),
    auto_record: t.bool(),
    retention_days: t.u64(),
    description: t.string(),
  },
  (ctx, { org_id, mode, auto_record, retention_days, description }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isOrganizationOwner(ctx, org_id, user.id)) {
      throw new Error('Only organization owners can configure recording policy');
    }
    if (mode !== 'off' && mode !== 'optional' && mode !== 'required') {
      throw new Error('Recording mode must be off, optional, or required');
    }

    let existing = null;
    for (const row of ctx.db.meeting_recording_policy.iter()) {
      if (row.org_id === org_id) {
        existing = row;
        break;
      }
    }

    if (existing) {
      ctx.db.meeting_recording_policy.id.update({
        ...existing,
        mode,
        auto_record,
        retention_days,
        description: description.trim(),
        created_by_user_id: user.id,
        updated_at: now,
      });
      return;
    }

    ctx.db.meeting_recording_policy.insert({
      id: 0n,
      org_id,
      mode,
      auto_record,
      retention_days,
      description: description.trim(),
      created_by_user_id: user.id,
      created_at: now,
      updated_at: now,
    });
  }
);

/**
 * Create a follow-up checklist template.
 */
export const createMeetingFollowupTemplate = spacetimedb.reducer(
  {
    org_id: t.u64(),
    title: t.string(),
    items_json: t.string(),
    is_default: t.bool(),
  },
  (ctx, { org_id, title, items_json, is_default }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isOrganizationMember(ctx, org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }
    if (title.trim().length < 2) throw new Error('Template title is required');

    if (is_default) {
      for (const existing of ctx.db.meeting_followup_template.iter()) {
        if (existing.org_id === org_id && existing.is_default) {
          ctx.db.meeting_followup_template.id.update({
            ...existing,
            is_default: false,
            updated_at: now,
          });
        }
      }
    }

    ctx.db.meeting_followup_template.insert({
      id: 0n,
      org_id,
      created_by_user_id: user.id,
      title: title.trim(),
      items_json: items_json.trim(),
      is_default,
      created_at: now,
      updated_at: now,
    });
  }
);

/**
 * Create or update a reminder schedule template for an organization.
 */
export const setMeetingReminderTemplate = spacetimedb.reducer(
  {
    org_id: t.u64(),
    name: t.string(),
    offsets_json: t.string(),
    channel_scope: t.string(),
    is_default: t.bool(),
    is_active: t.bool(),
  },
  (ctx, { org_id, name, offsets_json, channel_scope, is_default, is_active }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isOrganizationMember(ctx, org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) throw new Error('Reminder template name is required');
    if (channel_scope !== 'all' && channel_scope !== 'public' && channel_scope !== 'channel') {
      throw new Error('Reminder scope must be all, public, or channel');
    }

    let parsedOffsets: number[] = [];
    try {
      const raw = JSON.parse(offsets_json);
      if (!Array.isArray(raw)) throw new Error('offsets_json must be an array');
      parsedOffsets = raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    } catch (error) {
      throw new Error(`Invalid offsets_json payload: ${error instanceof Error ? error.message : 'parse failed'}`);
    }

    if (parsedOffsets.length === 0) {
      throw new Error('At least one reminder offset is required');
    }
    for (const offset of parsedOffsets) {
      if (offset < 1 || offset > 30 * 24 * 60) {
        throw new Error('Reminder offsets must be between 1 minute and 30 days');
      }
    }

    if (is_default) {
      for (const existing of ctx.db.meeting_reminder_template.iter()) {
        if (existing.org_id === org_id && existing.is_default) {
          ctx.db.meeting_reminder_template.id.update({
            ...existing,
            is_default: false,
            updated_at: now,
          });
        }
      }
    }

    let existingByName = null;
    for (const existing of ctx.db.meeting_reminder_template.iter()) {
      if (existing.org_id === org_id && existing.name.toLowerCase() === trimmedName.toLowerCase()) {
        existingByName = existing;
        break;
      }
    }

    if (existingByName) {
      ctx.db.meeting_reminder_template.id.update({
        ...existingByName,
        name: trimmedName,
        offsets_json: JSON.stringify(parsedOffsets),
        channel_scope,
        is_default,
        is_active,
        created_by_user_id: user.id,
        updated_at: now,
      });
      return;
    }

    ctx.db.meeting_reminder_template.insert({
      id: 0n,
      org_id,
      created_by_user_id: user.id,
      name: trimmedName,
      offsets_json: JSON.stringify(parsedOffsets),
      channel_scope,
      is_default,
      is_active,
      created_at: now,
      updated_at: now,
    });
  }
);

/**
 * Queue reminder deliveries due within the provided horizon window.
 */
export const queueMeetingReminderDeliveries = spacetimedb.reducer(
  { org_id: t.u64(), horizon_min: t.u64() },
  (ctx, { org_id, horizon_min }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const horizon = horizon_min === 0n ? 15n : horizon_min;
    if (horizon < 1n || horizon > 24n * 60n) {
      throw new Error('horizon_min must be between 1 and 1440');
    }
    const horizonEnd = now + horizon * 60n * 1000n;
    const graceWindow = 5n * 60n * 1000n;

    const activeTemplates = [];
    for (const template of ctx.db.meeting_reminder_template.iter()) {
      if (template.org_id === org_id && template.is_active) {
        activeTemplates.push(template);
      }
    }
    if (activeTemplates.length === 0) return;

    let queuedCount = 0n;

    for (const booking of ctx.db.meeting_booking.iter()) {
      if (booking.org_id !== org_id) continue;
      if (booking.status !== 'confirmed') continue;
      if (booking.starts_at <= now - graceWindow) continue;

      const eventType = ctx.db.meeting_event_type.id.find(booking.event_type_id);
      if (!eventType) continue;

      const visibility = getBookingVisibility(ctx, booking, eventType);
      const scopedTemplates = activeTemplates.filter((template) =>
        template.channel_scope === 'all' || template.channel_scope === visibility
      );
      if (scopedTemplates.length === 0) continue;

      const defaultTemplate = scopedTemplates.find((template) => template.is_default);
      const template = defaultTemplate || scopedTemplates[0];
      const offsets = parseReminderOffsets(template.offsets_json);
      if (offsets.length === 0) continue;

      for (const offset of offsets) {
        const triggerAt = booking.starts_at - offset * 60n * 1000n;
        if (triggerAt > horizonEnd) continue;
        if (triggerAt + graceWindow < now) continue;

        if (hasExistingReminderDelivery(ctx, booking.id, template.id, offset, triggerAt)) {
          continue;
        }

        const delivery = ctx.db.meeting_reminder_delivery.insert({
          id: 0n,
          org_id,
          booking_id: booking.id,
          template_id: template.id,
          offset_min: offset,
          trigger_at: triggerAt,
          status: 'pending',
          attempts: 0n,
          last_error: '',
          sent_at: NONE_U64,
          created_at: now,
          updated_at: now,
        });

        queuedCount += 1n;

        insertMeetingActivity(ctx, {
          orgId: org_id,
          actorUserId: user.id,
          bookingId: booking.id,
          eventType: 'reminder_queued',
          description: `Queued reminder (${offset.toString()}m) for ${booking.invitee_name}`,
          metadataJson: JSON.stringify({
            delivery_id: delivery.id.toString(),
            template_id: template.id.toString(),
            trigger_at: triggerAt.toString(),
          }),
          createdAt: now,
        });
      }
    }

    if (queuedCount > 0n) {
      insertMeetingActivity(ctx, {
        orgId: org_id,
        actorUserId: user.id,
        eventType: 'reminder_queue_run',
        description: `Queued ${queuedCount.toString()} reminder delivery(s)`,
        metadataJson: JSON.stringify({
          horizon_min: horizon.toString(),
          queued_count: queuedCount.toString(),
        }),
        createdAt: now,
      });
    }
  }
);

/**
 * Mark a reminder delivery as sent or failed.
 */
export const markMeetingReminderDeliveryStatus = spacetimedb.reducer(
  { delivery_id: t.u64(), status: t.string(), error: t.string() },
  (ctx, { delivery_id, status, error }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const delivery = ctx.db.meeting_reminder_delivery.id.find(delivery_id);
    if (!delivery) throw new Error('Reminder delivery not found');
    if (!isOrganizationMember(ctx, delivery.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }
    if (status !== 'sent' && status !== 'failed') {
      throw new Error('Status must be sent or failed');
    }

    ctx.db.meeting_reminder_delivery.id.update({
      ...delivery,
      status,
      attempts: delivery.attempts + 1n,
      last_error: status === 'failed' ? error.trim().slice(0, 512) : '',
      sent_at: status === 'sent' ? now : delivery.sent_at,
      updated_at: now,
    });

    insertMeetingActivity(ctx, {
      orgId: delivery.org_id,
      actorUserId: user.id,
      bookingId: delivery.booking_id,
      eventType: status === 'sent' ? 'reminder_sent' : 'reminder_failed',
      description: status === 'sent'
        ? `Reminder delivery sent (${delivery.offset_min.toString()}m before)`
        : `Reminder delivery failed (${delivery.offset_min.toString()}m before)`,
      metadataJson: JSON.stringify({
        delivery_id: delivery.id.toString(),
        offset_min: delivery.offset_min.toString(),
        error: status === 'failed' ? error.trim().slice(0, 512) : '',
      }),
      createdAt: now,
    });
  }
);

/**
 * Create a new AI agent for a workspace.
 */
export const createAiAgent = spacetimedb.reducer(
  {
    org_id: t.u64(),
    project_id: t.u64(),
    manager_user_id: t.u64(),
    name: t.string(),
    role: t.string(),
    department: t.string(),
    description: t.string(),
    status: t.string(),
    autonomy_mode: t.string(),
    approval_mode: t.string(),
    tools_json: t.string(),
    schedule_json: t.string(),
    daily_budget_microusd: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }
    if (args.name.trim().length < 2) throw new Error('Agent name is required');
    if (args.role.trim().length < 2) throw new Error('Agent role is required');

    const projectId = args.project_id === 0n ? NONE_U64 : args.project_id;
    if (projectId !== NONE_U64) {
      const project = ctx.db.ai_project.id.find(projectId);
      if (!project || project.org_id !== args.org_id) {
        throw new Error('Selected project does not belong to this workspace');
      }
    }

    const managerUserId = args.manager_user_id === 0n ? NONE_U64 : args.manager_user_id;
    if (managerUserId !== NONE_U64 && !isOrganizationMember(ctx, args.org_id, managerUserId)) {
      throw new Error('Selected manager is not a member of this workspace');
    }

    const agentStatus = normalizeAiEnum('agent status', args.status, 'draft', AI_AGENT_STATUSES);
    const autonomyMode = normalizeAiEnum('autonomy mode', args.autonomy_mode, 'guarded', AI_AUTONOMY_MODES);
    const approvalMode = normalizeAiEnum('approval mode', args.approval_mode, 'manual', AI_APPROVAL_MODES);

    const agent = ctx.db.ai_agent.insert({
      id: 0n,
      org_id: args.org_id,
      owner_user_id: user.id,
      manager_user_id: managerUserId,
      project_id: projectId,
      name: args.name.trim(),
      role: args.role.trim(),
      department: args.department.trim() || 'General',
      description: args.description.trim(),
      status: agentStatus,
      autonomy_mode: autonomyMode,
      approval_mode: approvalMode,
      tools_json: args.tools_json.trim() || '[]',
      schedule_json: args.schedule_json.trim() || '{}',
      daily_budget_microusd: args.daily_budget_microusd,
      created_at: now,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId: agent.id,
      projectId,
      eventType: 'agent_created',
      description: `Created agent "${agent.name}"`,
      metadataJson: JSON.stringify({
        status: agent.status,
        department: agent.department,
        role: agent.role,
      }),
      createdAt: now,
    });
  }
);

/**
 * Update the status of an AI agent.
 */
export const updateAiAgentStatus = spacetimedb.reducer(
  { agent_id: t.u64(), status: t.string() },
  (ctx, { agent_id, status }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const agent = ctx.db.ai_agent.id.find(agent_id);
    if (!agent) throw new Error('Agent not found');
    if (!isOrganizationMember(ctx, agent.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const nextStatus = normalizeAiEnum('agent status', status, agent.status, AI_AGENT_STATUSES);

    ctx.db.ai_agent.id.update({
      ...agent,
      status: nextStatus,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: agent.org_id,
      actorUserId: user.id,
      agentId: agent.id,
      projectId: agent.project_id,
      eventType: 'agent_status_changed',
      description: `Changed agent "${agent.name}" to ${nextStatus}`,
      createdAt: now,
    });
  }
);

/**
 * Create a new AI project.
 */
export const createAiProject = spacetimedb.reducer(
  { org_id: t.u64(), name: t.string(), summary: t.string(), status: t.string() },
  (ctx, { org_id, name, summary, status }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }
    if (name.trim().length < 2) throw new Error('Project name is required');

    const projectStatus = normalizeAiEnum('project status', status, 'planning', AI_PROJECT_STATUSES);

    const project = ctx.db.ai_project.insert({
      id: 0n,
      org_id,
      owner_user_id: user.id,
      name: name.trim(),
      summary: summary.trim(),
      status: projectStatus,
      created_at: now,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: org_id,
      actorUserId: user.id,
      projectId: project.id,
      eventType: 'project_created',
      description: `Created AI project "${project.name}"`,
      metadataJson: JSON.stringify({ status: project.status }),
      createdAt: now,
    });
  }
);

/**
 * Update the status of an AI project.
 */
export const updateAiProjectStatus = spacetimedb.reducer(
  { project_id: t.u64(), status: t.string() },
  (ctx, { project_id, status }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const project = ctx.db.ai_project.id.find(project_id);
    if (!project) throw new Error('Project not found');
    if (!isOrganizationMember(ctx, project.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const nextStatus = normalizeAiEnum('project status', status, project.status, AI_PROJECT_STATUSES);

    ctx.db.ai_project.id.update({
      ...project,
      status: nextStatus,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: project.org_id,
      actorUserId: user.id,
      projectId: project.id,
      eventType: 'project_status_changed',
      description: `Changed project "${project.name}" to ${nextStatus}`,
      createdAt: now,
    });
  }
);

/**
 * Create a new AI goal.
 */
export const createAiGoal = spacetimedb.reducer(
  {
    org_id: t.u64(),
    project_id: t.u64(),
    title: t.string(),
    description: t.string(),
    status: t.string(),
    progress_pct: t.u64(),
    due_at: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }
    if (args.title.trim().length < 2) throw new Error('Goal title is required');
    if (args.progress_pct > 100n) throw new Error('Progress must be between 0 and 100');

    const projectId = args.project_id === 0n ? NONE_U64 : args.project_id;
    if (projectId !== NONE_U64) {
      const project = ctx.db.ai_project.id.find(projectId);
      if (!project || project.org_id !== args.org_id) {
        throw new Error('Selected project does not belong to this workspace');
      }
    }

    const goalStatus = normalizeAiEnum('goal status', args.status, 'watching', AI_GOAL_STATUSES);

    const goal = ctx.db.ai_goal.insert({
      id: 0n,
      org_id: args.org_id,
      owner_user_id: user.id,
      project_id: projectId,
      title: args.title.trim(),
      description: args.description.trim(),
      status: goalStatus,
      progress_pct: args.progress_pct,
      due_at: args.due_at === 0n ? NONE_U64 : args.due_at,
      created_at: now,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      goalId: goal.id,
      projectId,
      eventType: 'goal_created',
      description: `Created goal "${goal.title}"`,
      metadataJson: JSON.stringify({
        status: goal.status,
        progress_pct: goal.progress_pct.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Update goal progress and status.
 */
export const updateAiGoalProgress = spacetimedb.reducer(
  { goal_id: t.u64(), progress_pct: t.u64(), status: t.string() },
  (ctx, { goal_id, progress_pct, status }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const goal = ctx.db.ai_goal.id.find(goal_id);
    if (!goal) throw new Error('Goal not found');
    if (!isOrganizationMember(ctx, goal.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }
    if (progress_pct > 100n) throw new Error('Progress must be between 0 and 100');

    const nextStatus = normalizeAiEnum('goal status', status, goal.status, AI_GOAL_STATUSES);

    ctx.db.ai_goal.id.update({
      ...goal,
      progress_pct,
      status: nextStatus,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: goal.org_id,
      actorUserId: user.id,
      goalId: goal.id,
      projectId: goal.project_id,
      eventType: 'goal_progress_updated',
      description: `Updated goal "${goal.title}" to ${progress_pct.toString()}%`,
      metadataJson: JSON.stringify({
        status: nextStatus,
        progress_pct: progress_pct.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Create a new AI task.
 */
export const createAiTask = spacetimedb.reducer(
  {
    org_id: t.u64(),
    project_id: t.u64(),
    goal_id: t.u64(),
    agent_id: t.u64(),
    title: t.string(),
    description: t.string(),
    priority: t.string(),
    source_type: t.string(),
    linked_entity_type: t.string(),
    linked_entity_id: t.u64(),
    due_at: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }
    if (args.title.trim().length < 2) throw new Error('Task title is required');

    const projectId = args.project_id === 0n ? NONE_U64 : args.project_id;
    if (projectId !== NONE_U64) {
      const project = ctx.db.ai_project.id.find(projectId);
      if (!project || project.org_id !== args.org_id) {
        throw new Error('Selected project does not belong to this workspace');
      }
    }

    let resolvedProjectId = args.project_id === 0n ? NONE_U64 : args.project_id;
    const goalId = args.goal_id === 0n ? NONE_U64 : args.goal_id;
    let goal = null;
    if (goalId !== NONE_U64) {
      goal = ctx.db.ai_goal.id.find(goalId);
      if (!goal || goal.org_id !== args.org_id) {
        throw new Error('Selected goal does not belong to this workspace');
      }
      if (goal.project_id !== NONE_U64) {
        if (resolvedProjectId === NONE_U64) {
          resolvedProjectId = goal.project_id;
        } else if (goal.project_id !== resolvedProjectId) {
          throw new Error('Selected goal does not belong to the selected project');
        }
      }
    }

    const agentId = args.agent_id === 0n ? NONE_U64 : args.agent_id;
    let agent = null;
    if (agentId !== NONE_U64) {
      agent = ctx.db.ai_agent.id.find(agentId);
      if (!agent || agent.org_id !== args.org_id) {
        throw new Error('Selected agent does not belong to this workspace');
      }
      if (agent.project_id !== NONE_U64) {
        if (resolvedProjectId === NONE_U64) {
          resolvedProjectId = agent.project_id;
        } else if (agent.project_id !== resolvedProjectId) {
          throw new Error('Selected agent does not belong to the selected project');
        }
      }
    }

    if (resolvedProjectId !== NONE_U64) {
      const project = ctx.db.ai_project.id.find(resolvedProjectId);
      if (!project || project.org_id !== args.org_id) {
        throw new Error('Selected project does not belong to this workspace');
      }
    }

    const priority = normalizeAiEnum('task priority', args.priority, 'normal', AI_TASK_PRIORITIES);
    const sourceType = normalizeAiEnum('task source type', args.source_type, 'manual', AI_TASK_SOURCE_TYPES);

    const task = ctx.db.ai_task.insert({
      id: 0n,
      org_id: args.org_id,
      project_id: resolvedProjectId,
      goal_id: goalId,
      agent_id: agentId,
      created_by_user_id: user.id,
      title: args.title.trim(),
      description: args.description.trim(),
      status: 'queued',
      priority,
      source_type: sourceType,
      linked_entity_type: args.linked_entity_type.trim(),
      linked_entity_id: args.linked_entity_id === 0n ? NONE_U64 : args.linked_entity_id,
      due_at: args.due_at === 0n ? NONE_U64 : args.due_at,
      completed_at: NONE_U64,
      created_at: now,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId,
      taskId: task.id,
      projectId: resolvedProjectId,
      goalId,
      eventType: 'task_created',
      description: `Created task "${task.title}"`,
      metadataJson: JSON.stringify({
        priority: task.priority,
        source_type: task.source_type,
      }),
      createdAt: now,
    });
  }
);

/**
 * Update AI task status.
 */
export const updateAiTaskStatus = spacetimedb.reducer(
  { task_id: t.u64(), status: t.string() },
  (ctx, { task_id, status }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const task = ctx.db.ai_task.id.find(task_id);
    if (!task) throw new Error('Task not found');
    if (!isOrganizationMember(ctx, task.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const nextStatus = normalizeAiEnum('task status', status, task.status, AI_TASK_STATUSES);
    ctx.db.ai_task.id.update({
      ...task,
      status: nextStatus,
      completed_at: nextStatus === 'completed' ? now : task.completed_at,
      updated_at: now,
    });

    if (nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'blocked') {
      const runStatus = nextStatus === 'blocked' ? 'cancelled' : nextStatus;
      for (const run of getLiveAiRunsForTask(ctx, task.id)) {
        ctx.db.ai_run.id.update({
          ...run,
          status: runStatus,
          finished_at: now,
          updated_at: now,
        });
      }
    }

    insertAiActivity(ctx, {
      orgId: task.org_id,
      actorUserId: user.id,
      agentId: task.agent_id,
      taskId: task.id,
      projectId: task.project_id,
      goalId: task.goal_id,
      eventType: 'task_status_changed',
      description: `Changed task "${task.title}" to ${nextStatus}`,
      createdAt: now,
    });
  }
);

/**
 * Create an approval request for AI work.
 */
export const createAiApproval = spacetimedb.reducer(
  {
    org_id: t.u64(),
    task_id: t.u64(),
    agent_id: t.u64(),
    title: t.string(),
    summary: t.string(),
    risk_level: t.string(),
    action_type: t.string(),
    metadata_json: t.string(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const taskId = args.task_id === 0n ? NONE_U64 : args.task_id;
    let task = null;
    if (taskId !== NONE_U64) {
      task = ctx.db.ai_task.id.find(taskId);
      if (!task || task.org_id !== args.org_id) {
        throw new Error('Selected task does not belong to this workspace');
      }
      if (hasPendingAiApprovalForTask(ctx, taskId)) {
        throw new Error('A pending approval already exists for this task');
      }
      ctx.db.ai_task.id.update({
        ...task,
        status: 'waiting_approval',
        updated_at: now,
      });
      for (const run of getLiveAiRunsForTask(ctx, task.id)) {
        ctx.db.ai_run.id.update({
          ...run,
          status: 'waiting_approval',
          updated_at: now,
        });
      }
    }

    let agentId = args.agent_id === 0n ? NONE_U64 : args.agent_id;
    if (task && agentId === NONE_U64 && task.agent_id !== NONE_U64) {
      agentId = task.agent_id;
    }
    if (agentId !== NONE_U64) {
      const agent = ctx.db.ai_agent.id.find(agentId);
      if (!agent || agent.org_id !== args.org_id) {
        throw new Error('Selected agent does not belong to this workspace');
      }
      if (task && task.agent_id !== NONE_U64 && task.agent_id !== agentId) {
        throw new Error('Selected approval agent does not match the linked task');
      }
    }

    const approvalRiskLevel = normalizeAiEnum('approval risk level', args.risk_level, 'medium', AI_APPROVAL_RISK_LEVELS);
    if (args.title.trim().length < 2) throw new Error('Approval title is required');
    const reviewerUserId = findOrganizationOwnerId(ctx, args.org_id);

    const approval = ctx.db.ai_approval.insert({
      id: 0n,
      org_id: args.org_id,
      task_id: taskId,
      agent_id: agentId,
      requester_user_id: user.id,
      reviewer_user_id: reviewerUserId,
      title: args.title.trim(),
      summary: args.summary.trim(),
      status: 'pending',
      risk_level: approvalRiskLevel,
      action_type: args.action_type.trim(),
      metadata_json: args.metadata_json.trim() || '{}',
      created_at: now,
      updated_at: now,
      decided_at: NONE_U64,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId,
      taskId,
      approvalId: approval.id,
      eventType: 'approval_requested',
      description: `Requested approval "${approval.title}"`,
      metadataJson: JSON.stringify({ risk_level: approval.risk_level }),
      createdAt: now,
    });
  }
);

/**
 * Approve or reject AI work.
 */
export const decideAiApproval = spacetimedb.reducer(
  { approval_id: t.u64(), status: t.string() },
  (ctx, { approval_id, status }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const approval = ctx.db.ai_approval.id.find(approval_id);
    if (!approval) throw new Error('Approval not found');
    if (!isOrganizationOwner(ctx, approval.org_id, user.id) && approval.reviewer_user_id !== user.id) {
      throw new Error('Only the assigned reviewer or organization owner can decide this approval');
    }
    if (approval.status !== 'pending') throw new Error('This approval has already been decided');
    if (status !== 'approved' && status !== 'rejected') {
      throw new Error('Approval status must be approved or rejected');
    }

    ctx.db.ai_approval.id.update({
      ...approval,
      status,
      reviewer_user_id: user.id,
      decided_at: now,
      updated_at: now,
    });

    if (approval.task_id !== NONE_U64) {
      const task = ctx.db.ai_task.id.find(approval.task_id);
      if (task) {
        ctx.db.ai_task.id.update({
          ...task,
          status: status === 'approved' ? 'queued' : 'blocked',
          updated_at: now,
        });
        for (const run of getLiveAiRunsForTask(ctx, task.id)) {
          ctx.db.ai_run.id.update({
            ...run,
            status: status === 'approved' ? 'queued' : 'cancelled',
            finished_at: status === 'rejected' ? now : run.finished_at,
            updated_at: now,
          });
        }
      }
    }

    insertAiActivity(ctx, {
      orgId: approval.org_id,
      actorUserId: user.id,
      agentId: approval.agent_id,
      taskId: approval.task_id,
      approvalId: approval.id,
      eventType: status === 'approved' ? 'approval_granted' : 'approval_rejected',
      description: `${status === 'approved' ? 'Approved' : 'Rejected'} "${approval.title}"`,
      createdAt: now,
    });
  }
);

/**
 * Create an AI run record.
 */
export const createAiRun = spacetimedb.reducer(
  {
    org_id: t.u64(),
    task_id: t.u64(),
    agent_id: t.u64(),
    status: t.string(),
    trigger_type: t.string(),
    summary: t.string(),
    error_message: t.string(),
    token_input: t.u64(),
    token_output: t.u64(),
    tool_calls: t.u64(),
    cost_microusd: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const runStatus = normalizeAiEnum('run status', args.status, 'queued', AI_RUN_STATUSES);
    const triggerType = normalizeAiEnum('run trigger type', args.trigger_type, 'manual', AI_RUN_TRIGGER_TYPES);

    const taskId = args.task_id === 0n ? NONE_U64 : args.task_id;
    let task = null;
    if (taskId !== NONE_U64) {
      task = ctx.db.ai_task.id.find(taskId);
      if (!task || task.org_id !== args.org_id) {
        throw new Error('Selected task does not belong to this workspace');
      }
      if (isAiRunLiveStatus(runStatus) && getLiveAiRunsForTask(ctx, taskId).length > 0) {
        throw new Error('A live run already exists for this task');
      }
      if (task.status === 'completed' || task.status === 'cancelled') {
        throw new Error('Cannot create a new run for a closed task');
      }
    }

    const agentId = args.agent_id === 0n ? NONE_U64 : args.agent_id;
    if (agentId !== NONE_U64) {
      const agent = ctx.db.ai_agent.id.find(agentId);
      if (!agent || agent.org_id !== args.org_id) {
        throw new Error('Selected agent does not belong to this workspace');
      }
      if (task && task.agent_id !== NONE_U64 && task.agent_id !== agentId) {
        throw new Error('Selected run agent does not match the linked task');
      }
    }

    const run = ctx.db.ai_run.insert({
      id: 0n,
      org_id: args.org_id,
      task_id: taskId,
      agent_id: agentId,
      status: runStatus,
      trigger_type: triggerType,
      summary: args.summary.trim(),
      error_message: args.error_message.trim(),
      token_input: args.token_input,
      token_output: args.token_output,
      tool_calls: args.tool_calls,
      cost_microusd: args.cost_microusd,
      started_at: now,
      finished_at:
        runStatus === 'completed' || runStatus === 'failed' || runStatus === 'cancelled'
          ? now
          : NONE_U64,
      created_at: now,
      updated_at: now,
    });

    if (task) {
      syncTaskFromRunStatus(ctx, task, runStatus, now);
    }

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId,
      taskId,
      runId: run.id,
      eventType: 'run_created',
      description: `Created run for ${taskId === NONE_U64 ? 'manual task' : 'task'} with status ${run.status}`,
      metadataJson: JSON.stringify({
        trigger_type: run.trigger_type,
        cost_microusd: run.cost_microusd.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Update AI run status and usage details.
 */
export const updateAiRunStatus = spacetimedb.reducer(
  {
    run_id: t.u64(),
    status: t.string(),
    summary: t.string(),
    error_message: t.string(),
    token_input: t.u64(),
    token_output: t.u64(),
    tool_calls: t.u64(),
    cost_microusd: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const run = ctx.db.ai_run.id.find(args.run_id);
    if (!run) throw new Error('Run not found');
    if (!isOrganizationMember(ctx, run.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const nextStatus = normalizeAiEnum('run status', args.status, run.status, AI_RUN_STATUSES);
    ctx.db.ai_run.id.update({
      ...run,
      status: nextStatus,
      summary: args.summary.trim(),
      error_message: args.error_message.trim(),
      token_input: args.token_input,
      token_output: args.token_output,
      tool_calls: args.tool_calls,
      cost_microusd: args.cost_microusd,
      finished_at:
        nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'cancelled'
          ? now
          : run.finished_at,
      updated_at: now,
    });

    if (run.task_id !== NONE_U64) {
      const task = ctx.db.ai_task.id.find(run.task_id);
      if (task) {
        syncTaskFromRunStatus(ctx, task, nextStatus, now);
      }
    }

    insertAiActivity(ctx, {
      orgId: run.org_id,
      actorUserId: user.id,
      agentId: run.agent_id,
      taskId: run.task_id,
      runId: run.id,
      eventType: 'run_updated',
      description: `Updated run ${run.id.toString()} to ${nextStatus}`,
      metadataJson: JSON.stringify({
        cost_microusd: args.cost_microusd.toString(),
        tool_calls: args.tool_calls.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Create or update runtime configuration for an AI agent.
 */
export const upsertAiAgentRuntime = spacetimedb.reducer(
  {
    org_id: t.u64(),
    agent_id: t.u64(),
    adapter_type: t.string(),
    runtime_status: t.string(),
    base_url: t.string(),
    command: t.string(),
    cwd: t.string(),
    env_json: t.string(),
    config_json: t.string(),
    heartbeat_policy_json: t.string(),
    wake_policy_json: t.string(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationOwner(ctx, args.org_id, user.id)) {
      throw new Error('Only organization owners can update AI runtime configuration');
    }

    const agent = ctx.db.ai_agent.id.find(args.agent_id);
    if (!agent || agent.org_id !== args.org_id) {
      throw new Error('Selected agent does not belong to this workspace');
    }

    const adapterType = normalizeAiEnum('runtime adapter type', args.adapter_type, 'manual', AI_RUNTIME_ADAPTER_TYPES);
    const runtimeStatus = normalizeAiEnum('runtime status', args.runtime_status, 'idle', AI_RUNTIME_STATUSES);
    const existing = ctx.db.ai_agent_runtime.agent_id.find(args.agent_id);
    let persistedRuntime = null;

    if (existing) {
      const nextRuntime = {
        ...existing,
        adapter_type: adapterType,
        runtime_status: runtimeStatus,
        base_url: args.base_url.trim(),
        command: args.command.trim(),
        cwd: args.cwd.trim(),
        env_json: args.env_json.trim() || existing.env_json,
        config_json: args.config_json.trim() || existing.config_json,
        heartbeat_policy_json: args.heartbeat_policy_json.trim() || existing.heartbeat_policy_json,
        wake_policy_json: args.wake_policy_json.trim() || existing.wake_policy_json,
        updated_at: now,
      };
      ctx.db.ai_agent_runtime.agent_id.update(nextRuntime);
      persistedRuntime = nextRuntime;
    } else {
      const nextRuntime = {
        agent_id: args.agent_id,
        org_id: args.org_id,
        adapter_type: adapterType,
        runtime_status: runtimeStatus,
        base_url: args.base_url.trim(),
        command: args.command.trim(),
        cwd: args.cwd.trim(),
        env_json: args.env_json.trim() || '{}',
        config_json: args.config_json.trim() || '{}',
        heartbeat_policy_json: args.heartbeat_policy_json.trim() || '{}',
        wake_policy_json: args.wake_policy_json.trim() || '{}',
        last_heartbeat_at: NONE_U64,
        last_success_at: NONE_U64,
        last_failure_at: NONE_U64,
        last_error: '',
        created_at: now,
        updated_at: now,
      };
      ctx.db.ai_agent_runtime.insert(nextRuntime);
      persistedRuntime = nextRuntime;
    }

    insertAiConfigRevision(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      scopeType: 'agent_runtime',
      scopeId: args.agent_id,
      revisionLabel: existing ? 'Runtime configuration updated' : 'Runtime configuration created',
      payloadJson: serializeAiAgentRuntimeRevision(persistedRuntime),
      metadataJson: JSON.stringify({
        adapter_type: adapterType,
        runtime_status: runtimeStatus,
      }),
      createdAt: now,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId: args.agent_id,
      projectId: agent.project_id,
      eventType: 'agent_runtime_updated',
      description: `Updated runtime config for "${agent.name}"`,
      metadataJson: JSON.stringify({
        adapter_type: adapterType,
        runtime_status: runtimeStatus,
      }),
      createdAt: now,
    });
  }
);

/**
 * Restore a prior runtime configuration revision for an AI agent.
 */
export const restoreAiAgentRuntimeRevision = spacetimedb.reducer(
  { revision_id: t.u64() },
  (ctx, { revision_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const revision = ctx.db.ai_config_revision.id.find(revision_id);
    if (!revision) throw new Error('Config revision not found');
    if (revision.scope_type !== 'agent_runtime') {
      throw new Error('Selected revision is not an agent runtime revision');
    }
    if (!isOrganizationOwner(ctx, revision.org_id, user.id)) {
      throw new Error('Only organization owners can restore AI runtime revisions');
    }

    const payload = parseRevisionPayload(revision.payload_json);
    const agentId = revision.scope_id;
    const agent = ctx.db.ai_agent.id.find(agentId);
    if (!agent || agent.org_id !== revision.org_id) {
      throw new Error('Selected agent does not belong to this workspace');
    }

    const existing = ctx.db.ai_agent_runtime.agent_id.find(agentId);
    const restoredRuntime = {
      agent_id: agentId,
      org_id: revision.org_id,
      adapter_type: normalizeAiEnum('runtime adapter type', String(payload.adapter_type ?? existing?.adapter_type ?? 'manual'), 'manual', AI_RUNTIME_ADAPTER_TYPES),
      runtime_status: normalizeAiEnum('runtime status', String(payload.runtime_status ?? existing?.runtime_status ?? 'idle'), 'idle', AI_RUNTIME_STATUSES),
      base_url: String(payload.base_url ?? existing?.base_url ?? '').trim(),
      command: String(payload.command ?? existing?.command ?? '').trim(),
      cwd: String(payload.cwd ?? existing?.cwd ?? '').trim(),
      env_json: String(payload.env_json ?? existing?.env_json ?? '{}').trim() || '{}',
      config_json: String(payload.config_json ?? existing?.config_json ?? '{}').trim() || '{}',
      heartbeat_policy_json: String(payload.heartbeat_policy_json ?? existing?.heartbeat_policy_json ?? '{}').trim() || '{}',
      wake_policy_json: String(payload.wake_policy_json ?? existing?.wake_policy_json ?? '{}').trim() || '{}',
      last_heartbeat_at: existing?.last_heartbeat_at ?? NONE_U64,
      last_success_at: existing?.last_success_at ?? NONE_U64,
      last_failure_at: existing?.last_failure_at ?? NONE_U64,
      last_error: existing?.last_error ?? '',
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    if (existing) {
      ctx.db.ai_agent_runtime.agent_id.update(restoredRuntime);
    } else {
      ctx.db.ai_agent_runtime.insert(restoredRuntime);
    }

    insertAiConfigRevision(ctx, {
      orgId: revision.org_id,
      actorUserId: user.id,
      scopeType: 'agent_runtime',
      scopeId: agentId,
      revisionLabel: `Restored runtime from revision ${revision.id.toString()}`,
      payloadJson: serializeAiAgentRuntimeRevision(restoredRuntime),
      metadataJson: JSON.stringify({
        restored_from_revision_id: revision.id.toString(),
      }),
      createdAt: now,
    });

    insertAiActivity(ctx, {
      orgId: revision.org_id,
      actorUserId: user.id,
      agentId,
      projectId: agent.project_id,
      eventType: 'agent_runtime_restored',
      description: `Restored runtime config for "${agent.name}"`,
      metadataJson: JSON.stringify({
        revision_id: revision.id.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Record a runtime heartbeat for an AI agent.
 */
export const recordAiAgentRuntimeHeartbeat = spacetimedb.reducer(
  { agent_id: t.u64(), runtime_status: t.string(), last_error: t.string() },
  (ctx, { agent_id, runtime_status, last_error }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const runtime = ctx.db.ai_agent_runtime.agent_id.find(agent_id);
    if (!runtime) throw new Error('Runtime configuration not found for this agent');
    if (!isOrganizationMember(ctx, runtime.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const nextStatus = normalizeAiEnum('runtime status', runtime_status, runtime.runtime_status, AI_RUNTIME_STATUSES);
    const trimmedError = last_error.trim();

    ctx.db.ai_agent_runtime.agent_id.update({
      ...runtime,
      runtime_status: nextStatus,
      last_heartbeat_at: now,
      last_success_at: nextStatus === 'ready' || nextStatus === 'idle' ? now : runtime.last_success_at,
      last_failure_at: nextStatus === 'error' ? now : runtime.last_failure_at,
      last_error: trimmedError,
      updated_at: now,
    });

    insertAiActivity(ctx, {
      orgId: runtime.org_id,
      actorUserId: user.id,
      agentId: runtime.agent_id,
      eventType: 'runtime_heartbeat',
      description: `Runtime heartbeat recorded for agent ${runtime.agent_id.toString()}`,
      metadataJson: JSON.stringify({
        runtime_status: nextStatus,
        last_error: trimmedError,
      }),
      createdAt: now,
    });
  }
);

/**
 * Queue a wakeup request for an AI agent.
 */
export const enqueueAiWakeupRequest = spacetimedb.reducer(
  {
    org_id: t.u64(),
    agent_id: t.u64(),
    task_id: t.u64(),
    source: t.string(),
    reason: t.string(),
    payload_json: t.string(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const agent = ctx.db.ai_agent.id.find(args.agent_id);
    if (!agent || agent.org_id !== args.org_id) {
      throw new Error('Selected agent does not belong to this workspace');
    }

    const taskId = args.task_id === 0n ? NONE_U64 : args.task_id;
    if (taskId !== NONE_U64) {
      const task = ctx.db.ai_task.id.find(taskId);
      if (!task || task.org_id !== args.org_id) {
        throw new Error('Selected task does not belong to this workspace');
      }
      if (task.agent_id !== NONE_U64 && task.agent_id !== args.agent_id) {
        throw new Error('Selected task is assigned to a different agent');
      }
    }

    const source = normalizeAiEnum('wakeup source', args.source, 'manual', AI_WAKEUP_SOURCES);
    const existing = getOpenAiWakeupsForAgent(ctx, args.agent_id).find((wakeup) => (
      wakeup.task_id === taskId &&
      wakeup.source === source
    ));

    if (existing) {
      ctx.db.ai_wakeup_request.id.update({
        ...existing,
        status: 'merged',
        updated_at: now,
        finished_at: now,
      });

      insertAiActivity(ctx, {
        orgId: args.org_id,
        actorUserId: user.id,
        agentId: args.agent_id,
        taskId,
        eventType: 'wakeup_merged',
        description: `Merged wakeup request for "${agent.name}"`,
        metadataJson: JSON.stringify({
          source,
          existing_wakeup_id: existing.id.toString(),
        }),
        createdAt: now,
      });
    }

    const wakeup = ctx.db.ai_wakeup_request.insert({
      id: 0n,
      org_id: args.org_id,
      agent_id: args.agent_id,
      task_id: taskId,
      requested_by_user_id: user.id,
      status: 'queued',
      source,
      reason: args.reason.trim() || 'Manual wakeup',
      payload_json: args.payload_json.trim() || '{}',
      run_id: NONE_U64,
      error_message: '',
      created_at: now,
      updated_at: now,
      started_at: NONE_U64,
      finished_at: NONE_U64,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId: args.agent_id,
      taskId,
      eventType: 'wakeup_queued',
      description: `Queued wakeup for "${agent.name}"`,
      metadataJson: JSON.stringify({
        wakeup_id: wakeup.id.toString(),
        source,
      }),
      createdAt: now,
    });
  }
);

/**
 * Update the status of an AI wakeup request.
 */
export const updateAiWakeupRequestStatus = spacetimedb.reducer(
  {
    wakeup_id: t.u64(),
    status: t.string(),
    run_id: t.u64(),
    error_message: t.string(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const wakeup = ctx.db.ai_wakeup_request.id.find(args.wakeup_id);
    if (!wakeup) throw new Error('Wakeup request not found');
    if (!isOrganizationMember(ctx, wakeup.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const nextStatus = normalizeAiEnum('wakeup status', args.status, wakeup.status, AI_WAKEUP_STATUSES);
    const runId = args.run_id === 0n ? NONE_U64 : args.run_id;
    if (runId !== NONE_U64) {
      const run = ctx.db.ai_run.id.find(runId);
      if (!run || run.org_id !== wakeup.org_id) {
        throw new Error('Selected run does not belong to this workspace');
      }
      if (run.agent_id !== wakeup.agent_id) {
        throw new Error('Selected run does not match the wakeup agent');
      }
    }

    ctx.db.ai_wakeup_request.id.update({
      ...wakeup,
      status: nextStatus,
      run_id: runId,
      error_message: args.error_message.trim(),
      updated_at: now,
      started_at: nextStatus === 'claimed' || nextStatus === 'running'
        ? (wakeup.started_at === NONE_U64 ? now : wakeup.started_at)
        : wakeup.started_at,
      finished_at: nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'merged'
        ? now
        : wakeup.finished_at,
    });

    insertAiActivity(ctx, {
      orgId: wakeup.org_id,
      actorUserId: user.id,
      agentId: wakeup.agent_id,
      taskId: wakeup.task_id,
      runId,
      eventType: 'wakeup_updated',
      description: `Updated wakeup ${wakeup.id.toString()} to ${nextStatus}`,
      metadataJson: JSON.stringify({
        error_message: args.error_message.trim(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Append a run event row for detailed runtime logs.
 */
export const appendAiRunEvent = spacetimedb.reducer(
  {
    org_id: t.u64(),
    run_id: t.u64(),
    agent_id: t.u64(),
    task_id: t.u64(),
    event_type: t.string(),
    level: t.string(),
    message: t.string(),
    payload_json: t.string(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const run = ctx.db.ai_run.id.find(args.run_id);
    if (!run || run.org_id !== args.org_id) {
      throw new Error('Selected run does not belong to this workspace');
    }

    const level = normalizeAiEnum('run event level', args.level, 'info', AI_RUN_EVENT_LEVELS);
    const agentId = args.agent_id === 0n ? run.agent_id : args.agent_id;
    const taskId = args.task_id === 0n ? run.task_id : args.task_id;

    insertAiRunEvent(ctx, {
      orgId: args.org_id,
      runId: run.id,
      agentId,
      taskId,
      actorUserId: user.id,
      eventType: args.event_type.trim() || 'operator_note',
      level,
      message: args.message.trim(),
      payloadJson: args.payload_json.trim() || '{}',
      createdAt: now,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId,
      taskId,
      runId: run.id,
      eventType: 'run_event_appended',
      description: `Appended ${level} run event to ${run.id.toString()}`,
      metadataJson: JSON.stringify({
        event_type: args.event_type.trim() || 'operator_note',
      }),
      createdAt: now,
    });
  }
);

/**
 * Create or update an adapter session for an AI agent/runtime.
 */
export const upsertAiAdapterSession = spacetimedb.reducer(
  {
    org_id: t.u64(),
    agent_id: t.u64(),
    run_id: t.u64(),
    adapter_type: t.string(),
    external_session_id: t.string(),
    status: t.string(),
    summary: t.string(),
    metadata_json: t.string(),
    last_seen_at: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    const agent = ctx.db.ai_agent.id.find(args.agent_id);
    if (!agent || agent.org_id !== args.org_id) {
      throw new Error('Selected agent does not belong to this workspace');
    }

    const runId = args.run_id === 0n ? NONE_U64 : args.run_id;
    if (runId !== NONE_U64) {
      const run = ctx.db.ai_run.id.find(runId);
      if (!run || run.org_id !== args.org_id) {
        throw new Error('Selected run does not belong to this workspace');
      }
    }

    const adapterType = normalizeAiEnum('runtime adapter type', args.adapter_type, 'manual', AI_RUNTIME_ADAPTER_TYPES);
    const sessionStatus = normalizeAiEnum('adapter session status', args.status, 'active', AI_ADAPTER_SESSION_STATUSES);
    const externalSessionId = args.external_session_id.trim();
    if (externalSessionId.length < 2) {
      throw new Error('External session id is required');
    }

    let existing = null;
    for (const session of ctx.db.ai_adapter_session.iter()) {
      if (
        session.org_id === args.org_id &&
        session.agent_id === args.agent_id &&
        session.external_session_id === externalSessionId
      ) {
        existing = session;
        break;
      }
    }

    if (existing) {
      ctx.db.ai_adapter_session.id.update({
        ...existing,
        run_id: runId,
        adapter_type: adapterType,
        status: sessionStatus,
        summary: args.summary.trim(),
        metadata_json: args.metadata_json.trim() || existing.metadata_json,
        last_seen_at: args.last_seen_at === 0n ? existing.last_seen_at : args.last_seen_at,
        updated_at: now,
      });
    } else {
      ctx.db.ai_adapter_session.insert({
        id: 0n,
        org_id: args.org_id,
        agent_id: args.agent_id,
        run_id: runId,
        adapter_type: adapterType,
        external_session_id: externalSessionId,
        status: sessionStatus,
        summary: args.summary.trim(),
        metadata_json: args.metadata_json.trim() || '{}',
        last_seen_at: args.last_seen_at === 0n ? NONE_U64 : args.last_seen_at,
        created_at: now,
        updated_at: now,
      });
    }

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId: args.agent_id,
      runId,
      eventType: 'adapter_session_upserted',
      description: `Upserted adapter session for "${agent.name}"`,
      metadataJson: JSON.stringify({
        adapter_type: adapterType,
        session_status: sessionStatus,
      }),
      createdAt: now,
    });
  }
);

/**
 * Record an AI activity event explicitly.
 */
export const logAiActivity = spacetimedb.reducer(
  {
    org_id: t.u64(),
    agent_id: t.u64(),
    task_id: t.u64(),
    approval_id: t.u64(),
    project_id: t.u64(),
    goal_id: t.u64(),
    run_id: t.u64(),
    event_type: t.string(),
    description: t.string(),
    metadata_json: t.string(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationMember(ctx, args.org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      agentId: args.agent_id === 0n ? NONE_U64 : args.agent_id,
      taskId: args.task_id === 0n ? NONE_U64 : args.task_id,
      approvalId: args.approval_id === 0n ? NONE_U64 : args.approval_id,
      projectId: args.project_id === 0n ? NONE_U64 : args.project_id,
      goalId: args.goal_id === 0n ? NONE_U64 : args.goal_id,
      runId: args.run_id === 0n ? NONE_U64 : args.run_id,
      eventType: args.event_type.trim(),
      description: args.description.trim(),
      metadataJson: args.metadata_json.trim() || '{}',
      createdAt: now,
    });
  }
);

/**
 * Create or update workspace-wide AI defaults.
 */
export const upsertAiWorkspaceSettings = spacetimedb.reducer(
  {
    org_id: t.u64(),
    default_model: t.string(),
    autonomy_posture: t.string(),
    fallback_mode: t.string(),
    external_send_policy: t.string(),
    budget_change_policy: t.string(),
    internal_notes_policy: t.string(),
    integrations_json: t.string(),
    audit_retention_days: t.u64(),
    max_run_cost_microusd: t.u64(),
  },
  (ctx, args) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    if (!isOrganizationOwner(ctx, args.org_id, user.id)) {
      throw new Error('Only organization owners can update AI workspace settings');
    }
    const autonomyPosture = normalizeAiEnum('autonomy posture', args.autonomy_posture, 'guarded', AI_WORKSPACE_AUTONOMY_POSTURES);
    const fallbackMode = normalizeAiEnum('fallback mode', args.fallback_mode, 'human-first', AI_WORKSPACE_FALLBACK_MODES);
    const externalSendPolicy = normalizeAiEnum('external send policy', args.external_send_policy, 'manual_approval', AI_EXTERNAL_SEND_POLICIES);
    const budgetChangePolicy = normalizeAiEnum('budget change policy', args.budget_change_policy, 'owner_review', AI_BUDGET_CHANGE_POLICIES);
    const internalNotesPolicy = normalizeAiEnum('internal notes policy', args.internal_notes_policy, 'auto_allowed', AI_INTERNAL_NOTES_POLICIES);

    const existing = ctx.db.ai_workspace_settings.org_id.find(args.org_id);
    let persistedSettings = null;
    if (existing) {
      const nextSettings = {
        ...existing,
        created_by_user_id: user.id,
        default_model: args.default_model.trim() || existing.default_model,
        autonomy_posture: autonomyPosture,
        fallback_mode: fallbackMode,
        external_send_policy: externalSendPolicy,
        budget_change_policy: budgetChangePolicy,
        internal_notes_policy: internalNotesPolicy,
        integrations_json: args.integrations_json.trim() || existing.integrations_json,
        audit_retention_days: args.audit_retention_days,
        max_run_cost_microusd: args.max_run_cost_microusd,
        updated_at: now,
      };
      ctx.db.ai_workspace_settings.org_id.update(nextSettings);
      persistedSettings = nextSettings;
    } else {
      const nextSettings = {
        org_id: args.org_id,
        created_by_user_id: user.id,
        default_model: args.default_model.trim() || 'gpt-5-class',
        autonomy_posture: autonomyPosture,
        fallback_mode: fallbackMode,
        external_send_policy: externalSendPolicy,
        budget_change_policy: budgetChangePolicy,
        internal_notes_policy: internalNotesPolicy,
        integrations_json: args.integrations_json.trim() || '[]',
        audit_retention_days: args.audit_retention_days === 0n ? 90n : args.audit_retention_days,
        max_run_cost_microusd: args.max_run_cost_microusd,
        created_at: now,
        updated_at: now,
      };
      ctx.db.ai_workspace_settings.insert(nextSettings);
      persistedSettings = nextSettings;
    }

    insertAiConfigRevision(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      scopeType: 'workspace_settings',
      scopeId: args.org_id,
      revisionLabel: existing ? 'Workspace settings updated' : 'Workspace settings created',
      payloadJson: serializeAiWorkspaceSettingsRevision(persistedSettings),
      metadataJson: JSON.stringify({
        default_model: persistedSettings.default_model,
        autonomy_posture: persistedSettings.autonomy_posture,
      }),
      createdAt: now,
    });

    insertAiActivity(ctx, {
      orgId: args.org_id,
      actorUserId: user.id,
      eventType: 'workspace_settings_updated',
      description: 'Updated AI workspace settings',
      metadataJson: JSON.stringify({
        default_model: args.default_model.trim(),
        autonomy_posture: autonomyPosture,
      }),
      createdAt: now,
    });
  }
);

/**
 * Restore a prior AI workspace settings revision.
 */
export const restoreAiWorkspaceSettingsRevision = spacetimedb.reducer(
  { revision_id: t.u64() },
  (ctx, { revision_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const revision = ctx.db.ai_config_revision.id.find(revision_id);
    if (!revision) throw new Error('Config revision not found');
    if (revision.scope_type !== 'workspace_settings') {
      throw new Error('Selected revision is not a workspace settings revision');
    }
    if (!isOrganizationOwner(ctx, revision.org_id, user.id)) {
      throw new Error('Only organization owners can restore AI workspace settings revisions');
    }

    const payload = parseRevisionPayload(revision.payload_json);
    const existing = ctx.db.ai_workspace_settings.org_id.find(revision.org_id);
    const restoredSettings = {
      org_id: revision.org_id,
      created_by_user_id: user.id,
      default_model: String(payload.default_model ?? existing?.default_model ?? 'gpt-5-class').trim() || 'gpt-5-class',
      autonomy_posture: normalizeAiEnum('autonomy posture', String(payload.autonomy_posture ?? existing?.autonomy_posture ?? 'guarded'), 'guarded', AI_WORKSPACE_AUTONOMY_POSTURES),
      fallback_mode: normalizeAiEnum('fallback mode', String(payload.fallback_mode ?? existing?.fallback_mode ?? 'human-first'), 'human-first', AI_WORKSPACE_FALLBACK_MODES),
      external_send_policy: normalizeAiEnum('external send policy', String(payload.external_send_policy ?? existing?.external_send_policy ?? 'manual_approval'), 'manual_approval', AI_EXTERNAL_SEND_POLICIES),
      budget_change_policy: normalizeAiEnum('budget change policy', String(payload.budget_change_policy ?? existing?.budget_change_policy ?? 'owner_review'), 'owner_review', AI_BUDGET_CHANGE_POLICIES),
      internal_notes_policy: normalizeAiEnum('internal notes policy', String(payload.internal_notes_policy ?? existing?.internal_notes_policy ?? 'auto_allowed'), 'auto_allowed', AI_INTERNAL_NOTES_POLICIES),
      integrations_json: String(payload.integrations_json ?? existing?.integrations_json ?? '[]').trim() || '[]',
      audit_retention_days: payload.audit_retention_days != null ? BigInt(String(payload.audit_retention_days)) : (existing?.audit_retention_days ?? 90n),
      max_run_cost_microusd: payload.max_run_cost_microusd != null ? BigInt(String(payload.max_run_cost_microusd)) : (existing?.max_run_cost_microusd ?? 0n),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    if (existing) {
      ctx.db.ai_workspace_settings.org_id.update(restoredSettings);
    } else {
      ctx.db.ai_workspace_settings.insert(restoredSettings);
    }

    insertAiConfigRevision(ctx, {
      orgId: revision.org_id,
      actorUserId: user.id,
      scopeType: 'workspace_settings',
      scopeId: revision.org_id,
      revisionLabel: `Workspace settings restored from revision ${revision.id.toString()}`,
      payloadJson: serializeAiWorkspaceSettingsRevision(restoredSettings),
      metadataJson: JSON.stringify({
        restored_from_revision_id: revision.id.toString(),
      }),
      createdAt: now,
    });

    insertAiActivity(ctx, {
      orgId: revision.org_id,
      actorUserId: user.id,
      eventType: 'workspace_settings_restored',
      description: 'Restored AI workspace settings',
      metadataJson: JSON.stringify({
        revision_id: revision.id.toString(),
      }),
      createdAt: now,
    });
  }
);

/**
 * Keep user presence fresh (should be called periodically by the client).
 */
export const heartbeat = spacetimedb.reducer(
  { org_id: t.u64(), channel_id: t.u64(), status: t.string() },
  (ctx, { org_id, channel_id, status }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    const allowedStatuses = new Set(['online', 'away', 'dnd', 'offline']);
    if (!allowedStatuses.has(status)) {
      throw new Error('Invalid status value');
    }

    if (org_id !== 0n && !isOrganizationMember(ctx, org_id, user.id)) {
      throw new Error('You are not a member of this workspace');
    }

    if (channel_id !== 0n && !isChannelMember(ctx, channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    upsertPresence(ctx, user.id, org_id, channel_id, status, now);
  }
);

/**
 * Mark the active typing state for a user in a channel.
 */
export const setTyping = spacetimedb.reducer(
  { channel_id: t.u64(), is_typing: t.bool() },
  (ctx, { channel_id, is_typing }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isChannelMember(ctx, channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    let existing = null;
    for (const row of ctx.db.chat_typing.iter()) {
      if (row.channel_id === channel_id && row.user_id === user.id) {
        existing = row;
        break;
      }
    }

    if (existing) {
      ctx.db.chat_typing.id.update({
        ...existing,
        is_typing,
        updated_at: now,
      });
      return;
    }

    ctx.db.chat_typing.insert({
      id: 0n,
      channel_id,
      user_id: user.id,
      is_typing,
      updated_at: now,
    });
  }
);

/**
 * Track channel read state per user to power unread counts.
 */
export const markChannelRead = spacetimedb.reducer(
  { channel_id: t.u64() },
  (ctx, { channel_id }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);

    if (!isChannelMember(ctx, channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    let existing = null;
    for (const row of ctx.db.chat_read_state.iter()) {
      if (row.channel_id === channel_id && row.user_id === user.id) {
        existing = row;
        break;
      }
    }

    if (existing) {
      ctx.db.chat_read_state.id.update({
        ...existing,
        last_read_at: now,
        updated_at: now,
      });
      return;
    }

    ctx.db.chat_read_state.insert({
      id: 0n,
      channel_id,
      user_id: user.id,
      last_read_at: now,
      updated_at: now,
    });
  }
);

/**
 * Toggle emoji reactions on a message.
 */
export const toggleReaction = spacetimedb.reducer(
  { message_id: t.u64(), emoji: t.string() },
  (ctx, { message_id, emoji }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const trimmed = emoji.trim();

    if (trimmed.length === 0 || trimmed.length > 12) {
      throw new Error('Reaction emoji must be 1-12 characters');
    }

    const message = ctx.db.chat_message.id.find(message_id);
    if (!message) throw new Error('Message not found');

    if (!isChannelMember(ctx, message.channel_id, user.id)) {
      throw new Error('You are not a member of this channel');
    }

    let existing = null;
    for (const row of ctx.db.chat_reaction.iter()) {
      if (row.message_id === message_id && row.user_id === user.id && row.emoji === trimmed) {
        existing = row;
        break;
      }
    }

    if (existing) {
      ctx.db.chat_reaction.id.update({
        ...existing,
        is_active: !existing.is_active,
        updated_at: now,
      });
      return;
    }

    ctx.db.chat_reaction.insert({
      id: 0n,
      message_id,
      user_id: user.id,
      emoji: trimmed,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  }
);

/**
 * Edit an existing message sent by the current user.
 */
export const editMessage = spacetimedb.reducer(
  { message_id: t.u64(), content: t.string() },
  (ctx, { message_id, content }) => {
    const now = BigInt(Date.now());
    const user = getUserFromSender(ctx);
    const message = ctx.db.chat_message.id.find(message_id);
    if (!message) throw new Error('Message not found');
    if (message.sender_id !== user.id) throw new Error('You can only edit your own messages');
    if (content.trim().length === 0) throw new Error('Message cannot be empty');

    ctx.db.chat_message.id.update({
      ...message,
      content,
      edited_at: now,
    });
  }
);
