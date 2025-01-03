// /src/lib/aws-ses-util.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Env } from '@/types/env';

export class EmailService {
  private ses: SESClient;
  private fromAddress: string;

  constructor(env: Env) {
    this.ses = new SESClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    });
    this.fromAddress = env.AWS_SES_FROM_ADDRESS;
  }

  async sendPasswordResetEmail(
    toAddress: string,
    resetToken: string,
    appUrl: string
  ): Promise<void> {
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

    const emailParams = {
      Source: this.fromAddress,
      Destination: {
        ToAddresses: [toAddress],
      },
      Message: {
        Subject: {
          Data: 'Reset Your Password - H2H.bot',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <h1>Reset Your Password</h1>
              <p>Hello,</p>
              <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
              <p>To reset your password, click the link below:</p>
              <p><a href="${resetLink}">${resetLink}</a></p>
              <p>This link will expire in 1 hour.</p>
              <p>Best regards,<br>H2H.bot Team</p>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: `
              Reset Your Password
              
              Hello,
              
              We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
              
              To reset your password, click the link below:
              ${resetLink}
              
              This link will expire in 1 hour.
              
              Best regards,
              H2H.bot Team
            `,
            Charset: 'UTF-8',
          },
        },
      },
    };

    try {
      const command = new SendEmailCommand(emailParams);
      await this.ses.send(command);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }
}