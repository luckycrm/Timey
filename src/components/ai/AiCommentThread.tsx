import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

export interface AiTaskComment {
  id: bigint;
  taskId: bigint;
  // authorIdentity is the hex string of the SpacetimeDB Identity of the comment author.
  authorIdentity: string;
  authorDisplayName?: string;
  body: string;
  // createdAt stores microseconds since Unix epoch as a plain u64 bigint.
  createdAt: bigint;
  updatedAt: bigint;
}

interface AiCommentThreadProps {
  taskId: bigint;
  conn: {
    reducers: {
      addAiTaskComment?: (args: { taskId: bigint; body: string }) => Promise<void>;
      editAiTaskComment?: (args: { commentId: bigint; body: string }) => Promise<void>;
      deleteAiTaskComment?: (args: { commentId: bigint }) => Promise<void>;
    };
  };
  comments: AiTaskComment[];
  currentIdentityHex: string;
}

function formatCommentTime(createdAt: bigint): string {
  const ms = Number(createdAt / 1000n);
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function authorInitials(hex: string, displayName?: string): string {
  if (displayName && displayName.trim()) {
    return displayName.trim().slice(0, 2).toUpperCase();
  }
  return hex.slice(0, 2).toUpperCase();
}

interface CommentItemProps {
  comment: AiTaskComment;
  isOwn: boolean;
  onEdit: (id: bigint, body: string) => Promise<void>;
  onDelete: (id: bigint) => Promise<void>;
}

function CommentItem({ comment, isOwn, onEdit, onDelete }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveEdit = async () => {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onEdit(comment.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  };

  const displayName = comment.authorDisplayName || comment.authorIdentity.slice(0, 8);

  return (
    <Box
      sx={{
        px: 1.6,
        py: 1.2,
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.02)',
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="flex-start">
        <Avatar
          sx={{
            width: 28,
            height: 28,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: isOwn ? 'rgba(116,167,255,0.25)' : 'rgba(255,255,255,0.08)',
            color: isOwn ? '#b9d1ff' : '#aaa',
            flexShrink: 0,
            mt: 0.2,
          }}
        >
          {authorInitials(comment.authorIdentity, comment.authorDisplayName)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={0.4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: '#d5d5d5', fontWeight: 600 }}>
                {displayName}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666666' }}>
                {formatCommentTime(comment.createdAt)}
              </Typography>
            </Stack>
            {isOwn && !editing && (
              <Stack direction="row" spacing={0.2}>
                <IconButton
                  size="small"
                  onClick={() => { setEditBody(comment.body); setEditing(true); }}
                  sx={{ color: '#666666', '&:hover': { color: '#b9d1ff' }, p: 0.4 }}
                  title="Edit comment"
                >
                  <EditOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleDelete}
                  disabled={deleting}
                  sx={{ color: '#666666', '&:hover': { color: '#f5a3ad' }, p: 0.4 }}
                  title="Delete comment"
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            )}
          </Stack>

          {editing ? (
            <Stack spacing={0.8}>
              <TextField
                size="small"
                multiline
                minRows={2}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                fullWidth
                autoFocus
                sx={{
                  '& .MuiInputBase-root': { fontSize: '0.8rem', color: '#ffffff' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(116,167,255,0.4)' },
                }}
              />
              <Stack direction="row" spacing={0.8} justifyContent="flex-end">
                <IconButton
                  size="small"
                  onClick={() => setEditing(false)}
                  sx={{ color: '#666666', '&:hover': { color: '#d5d5d5' } }}
                  title="Cancel"
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleSaveEdit}
                  disabled={saving || !editBody.trim()}
                  sx={{ color: '#9de0b6', '&:hover': { color: '#38c872' } }}
                  title="Save"
                >
                  <CheckIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            </Stack>
          ) : (
            <Typography
              variant="body2"
              sx={{
                color: '#d5d5d5',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {comment.body}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

export default function AiCommentThread({ taskId, conn, comments, currentIdentityHex }: AiCommentThreadProps) {
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sorted = [...comments].sort((a, b) => Number(a.createdAt - b.createdAt));

  const handleAdd = async () => {
    const trimmed = newBody.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      if (conn.reducers.addAiTaskComment) {
        await conn.reducers.addAiTaskComment({ taskId, body: trimmed });
      }
      setNewBody('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId: bigint, body: string) => {
    if (conn.reducers.editAiTaskComment) {
      await conn.reducers.editAiTaskComment({ commentId, body });
    }
  };

  const handleDelete = async (commentId: bigint) => {
    if (conn.reducers.deleteAiTaskComment) {
      await conn.reducers.deleteAiTaskComment({ commentId });
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" sx={{ color: '#858585', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Comments ({comments.length})
      </Typography>

      {sorted.length === 0 ? (
        <Typography variant="body2" sx={{ color: '#666666', fontStyle: 'italic' }}>
          No comments yet. Be the first to leave one.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {sorted.map((comment) => (
            <CommentItem
              key={comment.id.toString()}
              comment={comment}
              isOwn={comment.authorIdentity === currentIdentityHex}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      <Stack spacing={1}>
        <TextField
          size="small"
          multiline
          minRows={2}
          placeholder="Leave a comment..."
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          fullWidth
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          sx={{
            '& .MuiInputBase-root': { fontSize: '0.82rem', color: '#ffffff' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
            '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
            '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(116,167,255,0.5)' },
          }}
        />
        <Stack direction="row" justifyContent="flex-end">
          <Button
            size="small"
            variant="outlined"
            disabled={submitting || !newBody.trim()}
            onClick={handleAdd}
            sx={{ textTransform: 'none', fontSize: '0.78rem' }}
          >
            {submitting ? 'Posting...' : 'Comment'}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
