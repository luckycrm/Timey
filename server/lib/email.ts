const ZEPTOMAIL_URL = process.env.ZEPTOMAIL_URL ?? 'https://api.zeptomail.com/v1.1/email';
const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_TOKEN ?? '';
const SENDER_EMAIL = process.env.SENDER_EMAIL ?? 'noreply@timey.app';

export async function sendEmail(opts: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    attachments?: { name: string; content: string; mimeType: string }[];
}): Promise<void> {
    if (!ZEPTOMAIL_TOKEN) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[email:dev] Would send to ${opts.to}: ${opts.subject}`);
            return;
        }
        throw new Error('ZEPTOMAIL_TOKEN not configured');
    }

    const body: Record<string, unknown> = {
        from: { address: SENDER_EMAIL },
        to: [{ email_address: { address: opts.to, name: opts.toName ?? opts.to } }],
        subject: opts.subject,
        htmlbody: opts.html,
    };

    if (opts.attachments?.length) {
        body.attachments = opts.attachments.map((a) => ({
            name: a.name,
            content: a.content,
            mime_type: a.mimeType,
        }));
    }

    const res = await fetch(ZEPTOMAIL_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ZeptoMail ${res.status}: ${text}`);
    }
}
