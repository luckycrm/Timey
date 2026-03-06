import { schema, table, t } from 'spacetimedb/server';

const NONE_U64 = 18446744073709551615n;

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

function getUserFromSender(ctx: any) {
  const user = ctx.db.user.identity.find(ctx.sender);
  if (!user) throw new Error('User not found');
  return user;
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
