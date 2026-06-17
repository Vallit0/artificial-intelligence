// ============================================
// Email Service (Resend API)
// ============================================

import config from '../config/index.js';
import { InternalError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!config.resendApiKey) {
    throw new InternalError('Email service not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.resendFromEmail,
      to: [to],
      subject: 'Restablecer tu contraseña - Señoriales',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">Señoriales</h1>
            <p style="color: #666; margin-top: 5px;">Plataforma de Práctica de Ventas</p>
          </div>
          <div style="background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1f2937;">Restablecer Contraseña</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p>Haz clic en el botón de abajo para crear una nueva contraseña:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="display: inline-block; background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Restablecer Contraseña
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Este enlace expirará en 1 hora por seguridad.</p>
          </div>
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
            <p>Tu contraseña actual permanecerá sin cambios.</p>
          </div>
        </body>
        </html>
      `,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    getLogger({ component: 'email', op: 'send-password-reset' }).error(
      { statusCode: response.status, errorData },
      'Resend API error',
    );
    throw new InternalError('Failed to send email');
  }
}

// Envoltura común para enviar un correo transaccional con el layout Señoriales.
async function sendBrandedEmail(to: string, subject: string, innerHtml: string, op: string): Promise<void> {
  if (!config.resendApiKey) {
    throw new InternalError('Email service not configured');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #4F46E5; margin: 0;">Señoriales</h1>
        <p style="color: #666; margin-top: 5px;">Plataforma de Práctica de Ventas</p>
      </div>
      <div style="background: #f9fafb; border-radius: 12px; padding: 30px;">
        ${innerHtml}
      </div>
    </body>
    </html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.resendFromEmail, to: [to], subject, html }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    getLogger({ component: 'email', op }).error(
      { statusCode: response.status, errorData },
      'Resend API error',
    );
    throw new InternalError('Failed to send email');
  }
}

// Notifica al usuario que su registro fue aprobado y ya puede iniciar sesión.
export async function sendAccountApprovedEmail(to: string, loginUrl: string): Promise<void> {
  await sendBrandedEmail(
    to,
    'Tu cuenta fue aprobada - Señoriales',
    `
      <h2 style="margin-top: 0; color: #1f2937;">¡Tu cuenta fue aprobada! 🎉</h2>
      <p>Un administrador dio el visto bueno a tu registro. Ya puedes iniciar sesión y empezar a practicar.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}"
           style="display: inline-block; background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Iniciar sesión
        </a>
      </div>
    `,
    'send-account-approved',
  );
}

// Notifica al usuario que su registro fue rechazado, con el motivo opcional.
export async function sendAccountRejectedEmail(to: string, reason?: string): Promise<void> {
  await sendBrandedEmail(
    to,
    'Estado de tu registro - Señoriales',
    `
      <h2 style="margin-top: 0; color: #1f2937;">Sobre tu registro</h2>
      <p>Lamentablemente tu solicitud de registro no fue aprobada en este momento.</p>
      ${reason ? `<p style="color: #666;"><strong>Motivo:</strong> ${reason}</p>` : ''}
      <p style="color: #666; font-size: 14px;">Si crees que se trata de un error, contacta a tu coach o administrador.</p>
    `,
    'send-account-rejected',
  );
}
