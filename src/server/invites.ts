import { createServerFn } from '@tanstack/react-start';
import { SendMailClient } from 'zeptomail';

const ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
const ZEPTOMAIL_TOKEN =
    process.env.ZEPTOMAIL_TOKEN ||
    'Zoho-enczapikey wSsVR61z/EKmX68pmj2kJOw6kFoEUVrxHUoo0Frz73/+GK/KosdtxBLHAATySPEXRGZtE2MVoL4tnUgG2mIGiox5m1tSDCiF9mqRe1U4J3x17qnvhDzMX2pdlhSKKIMMwA1rmGRmGskq+g==';

const mailClient = new SendMailClient({
    url: ZEPTOMAIL_URL,
    token: ZEPTOMAIL_TOKEN,
});

/**
 * Send an invitation email to a new employee.
 */
export const sendInviteEmail = createServerFn({ method: 'POST' })
    .handler(async (ctx) => {
        const { email, orgName, token } = (ctx.data as any) as {
            email: string;
            orgName: string;
            token: string;
        };

        if (!email || !email.includes('@')) {
            return { success: false, error: 'Invalid email address' };
        }

        try {
            await mailClient.sendMail({
                from: {
                    address: 'noreply@bootserp.com',
                    name: 'Timey',
                },
                to: [
                    {
                        email_address: {
                            address: email,
                            name: email.split('@')[0],
                        },
                    },
                ],
                subject: `You've been invited to join ${orgName} on Timey`,
                htmlbody: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; border: 1px solid #eee; border-radius: 16px;">
            <h2 style="color: #1a1a2e; margin-bottom: 16px;">You're invited!</h2>
            <p style="color: #444; line-height: 1.6; margin-bottom: 24px;">
              Hello! You've been invited to join the <strong>${orgName}</strong> workspace on Timey, our employee management and time tracking system.
            </p>
            <div style="background: #f8f8fa; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #f0f0f5;">
              <p style="color: #666; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Use this Workspace ID to join:</p>
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #1a1a2e; font-family: monospace;">${token}</span>
            </div>
            <p style="color: #444; line-height: 1.6; margin-bottom: 32px;">
              To get started, please log in to Timey and enter the Workspace ID above when prompted.
            </p>
            <div style="text-align: center;">
              <a href="${process.env.APP_URL || 'http://localhost:5173'}/login" 
                 style="background: #000; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                Get Started
              </a>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px; text-align: center;">
              Timey — Modern Employee Management & Time Tracking
            </p>
          </div>
        `,
            });

            console.log(`Invitation email sent to ${email} for Org ${orgName}`);
            return { success: true };
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            return { success: false, error: 'Failed to deliver email' };
        }
    });
