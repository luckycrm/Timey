import { schema, table, t } from 'spacetimedb/server';

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
      return;
    }

    const existingByEmail = ctx.db.user.email.find(email);
    if (existingByEmail) {
      ctx.db.user.id.update({ ...existingByEmail, identity, last_login_at: now });
      return;
    }

    ctx.db.user.insert({
      id: 0n,
      identity,
      email,
      name,
      created_at: now,
      last_login_at: now,
    });
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
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new Error('User not found');

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
  { channel_id: t.u64(), content: t.string() },
  (ctx, { channel_id, content }) => {
    const now = BigInt(Date.now());
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new Error('User not found');

    // Verify the user is a member of the channel
    let isMember = false;
    for (const cm of ctx.db.chat_channel_member.iter()) {
      if (cm.channel_id === channel_id && cm.user_id === user.id) {
        isMember = true;
        break;
      }
    }
    if (!isMember) throw new Error('You are not a member of this channel');

    ctx.db.chat_message.insert({
      id: 0n,
      channel_id,
      sender_id: user.id,
      content,
      created_at: now,
    });
  }
);

/**
 * Add a member to an existing chat channel.
 */
export const addChannelMember = spacetimedb.reducer(
  { channel_id: t.u64(), user_id: t.u64() },
  (ctx, { channel_id, user_id }) => {
    const now = BigInt(Date.now());
    const sender = ctx.db.user.identity.find(ctx.sender);
    if (!sender) throw new Error('User not found');

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
