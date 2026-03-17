import type { ContactSubmission } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type ContactSubmissionsTableProps = {
  submissions: ContactSubmission[];
};

export function ContactSubmissionsTable({ submissions }: ContactSubmissionsTableProps) {
  if (submissions.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No contact submissions yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Location</th>
            <th>Message</th>
            <th>Captcha</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => (
            <tr key={submission.id}>
              <td className="font-semibold text-stone-900">{submission.buyerName}</td>
              <td>
                <div className="text-sm text-stone-900">{submission.phone || "No phone"}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{submission.email || "No email"}</div>
              </td>
              <td className="max-w-xs text-sm text-[color:var(--muted)]">
                {submission.location || "Not provided"}
              </td>
              <td className="max-w-xs text-sm text-[color:var(--muted)]">{submission.message}</td>
              <td className="max-w-xs text-xs text-[color:var(--muted)]">{submission.captchaPrompt}</td>
              <td>{formatDateTime(submission.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
