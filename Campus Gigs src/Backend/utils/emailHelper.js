const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendOTP(to, otp, type = 'verification') {
    const isReset = type === 'reset';
    const subject = isReset ? 'Campus Gigs - Password Reset Code' : 'Campus Gigs - Verify Your Email';
    const heading = isReset ? 'Password Reset Code' : 'Verify Your Email';
    const body = isReset
        ? 'Use the code below to reset your password. It expires in 10 minutes.'
        : 'Use the code below to verify your email address. It expires in 10 minutes.';

    await transporter.sendMail({
        from: `"Campus Gigs" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                <h2 style="color:#111827;margin-bottom:8px;">${heading}</h2>
                <p style="color:#6b7280;margin-bottom:24px;">${body}</p>
                <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
                    <span style="font-size:40px;font-weight:700;letter-spacing:10px;color:#3b82f6;">${otp}</span>
                </div>
                <p style="color:#9ca3af;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `
    });
}

module.exports = { sendOTP };
