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
