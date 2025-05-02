// src/pages/api/send-order.ts
import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, htmlContent, csvContent } = req.body;

  try {
    const result = await resend.emails.send({
      from: "no-reply@yourdomain.com",
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

    return res.status(200).json({ message: "Email sent", result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
