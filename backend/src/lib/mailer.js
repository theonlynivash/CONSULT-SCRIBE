import nodemailer from 'nodemailer';

function env(name) {
  return String(process.env[name] ?? '').trim();
}

function hasSmtpConfigured() {
  return Boolean(
    env('SMTP_HOST') &&
    env('EMAIL_USER') &&
    env('EMAIL_PASSWORD')
  );
}

function createTransporter() {
  const port = Number(env('SMTP_PORT') || 587);

  const secure = env('SMTP_SECURE')
    ? env('SMTP_SECURE').toLowerCase() === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure,

    
    
    
    requireTLS: !secure && port === 587,

    auth: {
      user: env('EMAIL_USER'),
      pass: env('EMAIL_PASSWORD'),
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}












function reportEmailBody({ consultation, patient }) {
  return [
    `Consultation report for ${patient?.name ?? 'Patient'}`,
    `Date: ${new Date(consultation.startedAt).toLocaleString()}`,
    '',
    'The approved consultation report is attached as a PDF.',
    '',
    'This patient-facing PDF contains the doctor-approved report for this consultation.',
  ].join('\n');
}

export async function sendReportEmail({
  consultation,
  patient,
  to,
  pdfBase64,
}) {
  const recipient = String(
    to ||
    patient?.email ||
    env('EMAIL_TO') ||
    ''
  ).trim();

  const body = reportEmailBody({
    consultation,
    patient,
  });

  if (!recipient) {
    return {
      sent: false,
      preview: true,
      to: '(no recipient set)',
      body,
      error: 'No patient email address was provided.',
    };
  }

  if (!hasSmtpConfigured()) {
    return {
      sent: false,
      preview: true,
      to: recipient,
      body,
      error:
        'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, EMAIL_USER and EMAIL_PASSWORD in backend/.env, then restart the backend.',
    };
  }

  





  if (
    typeof pdfBase64 !== 'string' ||
    !pdfBase64.trim()
  ) {
    return {
      sent: false,
      preview: true,
      to: recipient,
      body,
      error:
        'Approved PDF data is missing. Generate the PDF again and retry.',
    };
  }

  let pdfBuffer;

  try {
    pdfBuffer = Buffer.from(
      pdfBase64,
      'base64'
    );
  } catch {
    return {
      sent: false,
      preview: true,
      to: recipient,
      body,
      error: 'Invalid PDF data.',
    };
  }

  if (
    !pdfBuffer ||
    pdfBuffer.length === 0
  ) {
    return {
      sent: false,
      preview: true,
      to: recipient,
      body,
      error: 'The approved PDF is empty.',
    };
  }

  



  const pdfHeader = pdfBuffer
    .subarray(0, 4)
    .toString('ascii');

  if (pdfHeader !== '%PDF') {
    return {
      sent: false,
      preview: true,
      to: recipient,
      body,
      error:
        'The supplied attachment is not a valid PDF.',
    };
  }

  try {
    const transporter = createTransporter();

    await transporter.verify();

    await transporter.sendMail({
      from:
        env('EMAIL_FROM') ||
        env('EMAIL_USER'),

      to: recipient,

      subject:
        `Consultation report — ${
          patient?.name ?? 'Patient'
        }`,

      











      text: body,

      attachments: [
        {
          filename:
            `consultation-report-${consultation.id}.pdf`,

          content: pdfBuffer,

          contentType: 'application/pdf',
        },
      ],
    });

    return {
      sent: true,
      preview: false,
      to: recipient,
    };
  } catch (err) {
    return {
      sent: false,
      preview: true,
      to: recipient,
      body,
      error:
        `SMTP send failed: ${err.message}`,
    };
  }
}






export async function sendPasswordResetOtp({
  to,
  otp,
}) {
  const body =
    `Your Consult Scribe password reset code is ${otp}. It expires in 10 minutes.`;

  if (!hasSmtpConfigured()) {
    console.log(
      `[mailer] Password reset OTP for ${to}: ${otp}`
    );

    return {
      sent: false,
      preview: true,
      to,
      otp,
    };
  }

  try {
    await createTransporter().sendMail({
      from:
        env('EMAIL_FROM') ||
        env('EMAIL_USER'),

      to,

      subject:
        'Your Consult Scribe password reset code',

      text: body,
    });

    return {
      sent: true,
      preview: false,
      to,
    };
  } catch (err) {
    console.log(
      `[mailer] Password reset OTP for ${to}: ${otp} (send failed: ${err.message})`
    );

    return {
      sent: false,
      preview: true,
      to,
      otp,
      error:
        `SMTP send failed: ${err.message}`,
    };
  }
}