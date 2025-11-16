import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
})

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      html,
    }

    const result = await transporter.sendMail(mailOptions)
    return { success: true, result }
  } catch (error) {
    console.error('Error sending email:', error)
    return { error: 'Failed to send email' }
  }
}