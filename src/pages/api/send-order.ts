// pages/api/send-order.ts
import { Resend } from "resend";
import type { NextApiRequest, NextApiResponse } from "next";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, htmlContent, csvContent } = req.body;
  if (!to || !subject || !htmlContent || !csvContent) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await resend.emails.send({
      from: "B2B Order <SwingOrder@capezioanz.com>", // 替换为你在 Resend 验证过的发件邮箱
      to,
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: "order.csv",
          content: csvContent,
        },
      ],
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Resend error", err);
    return res.status(500).json({ error: err.message || "Failed to send email" });
  }
}
