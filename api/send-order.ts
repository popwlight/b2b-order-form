import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server'; // 即使你不是 Next.js 也能用

const resend = new Resend(process.env.RESEND_API_KEY);

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const body = await req.json();
  const { to, subject, htmlContent, csvContent } = body;

  const csvFile = new File([csvContent], 'order.csv', { type: 'text/csv' });

  try {
    const data = await resend.emails.send({
      from: 'Your Company <your@yourdomain.com>',
      to,
      subject,
      html: htmlContent,
      attachments: [csvFile],
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send' }, { status: 500 });
  }
}
