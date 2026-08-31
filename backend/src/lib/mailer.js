import nodemailer from 'nodemailer';

function hasSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
}

function reportEmailBody({ consultation, patient }) {
  const report = consultation.finalReport || consultation.aiDraft;
  const lines = [
    `Consultation report for ${patient?.name ?? 'Unknown patient'}`,
    `Doctor: ${consultation.doctorName}`,
    `Date: ${new Date(consultation.startedAt).toLocaleString()}`,
    '',
    'Subjective:',
    report?.subjective ?? '(none)',
    '',
    'Objective:',
    report?.objective ?? '(none)',
    '',
    'Assessment:',
    report?.assessment ?? '(none)',
    '',
    'Differential (for physician review only):',
    (report?.differential || []).map((d) => `- ${d.condition} [${d.confidence}] — ${d.rationale}`).join('\n') || '(none)',
    '',
    'Plan:',
    (report?.plan || []).map((a) => `- ${a}`).join('\n') || '(none)',
  ];
  return lines.join('\n');
}

export async function sendReportEmail({ consultation, patient, to }) {
  const body = reportEmailBody({ consultation, patient });
  const recipient = to || process.env.EMAIL_TO;

  if (!hasSmtpConfigured() || !recipient) {
    return { sent: false, preview: true, to: recipient || '(no recipient set)', body };
  }

  try {
    await createTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: recipient,
      subject: `Consultation report — ${patient?.name ?? 'Patient'}`,
      text: body,
    });
    return { sent: true, preview: false, to: recipient };
  } catch (err) {
    return { sent: false, preview: true, to: recipient, body, error: err.message };
  }
}

// Used for the "forgot password" flow — always logged to the console so the
// demo works without SMTP configured; also emailed for real when SMTP is set.
export async function sendPasswordResetOtp({ to, otp }) {
  const body = `Your Consult Scribe password reset code is ${otp}. It expires in 10 minutes.`;

  if (!hasSmtpConfigured()) {
    console.log(`[mailer] Password reset OTP for ${to}: ${otp}`);
    return { sent: false, preview: true, to, otp };
  }

  try {
    await createTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: 'Your Consult Scribe password reset code',
      text: body,
    });
    return { sent: true, preview: false, to };
  } catch (err) {
    console.log(`[mailer] Password reset OTP for ${to}: ${otp} (send failed: ${err.message})`);
    return { sent: false, preview: true, to, otp, error: err.message };
  }
}
