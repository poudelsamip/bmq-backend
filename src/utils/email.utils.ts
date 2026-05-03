import { Resend } from "resend";
import { env } from "../config/env.config";
import { AppError } from "./AppError";

const resend = new Resend(env.RESEND_API_KEY);

export const sendVerificationEmail = async (
    to: string,
    otp: string,
) => {
    const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: "Verify your email address",
        html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          text-align: center;
          padding: 20px;
          background: #f4f4f5;
          border-radius: 8px;
          margin: 24px 0;
        ">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>
    `,
    });

    if (error) {
        throw new AppError(
            502,
            "Failed to send verification email. Please try again shortly.",
        );
    }
};
