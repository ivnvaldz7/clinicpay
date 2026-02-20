import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address must be a verified domain in your Resend account.
// During development you can use the Resend sandbox address.
const FROM = process.env.EMAIL_FROM ?? "ClinicPay <noreply@clinicpay.app>";

/**
 * Sends an overdue invoice reminder to a patient.
 *
 * @param {object} opts
 * @param {string} opts.to         Patient email
 * @param {string} opts.patientName
 * @param {string} opts.clinicName
 * @param {string} opts.concept    Invoice concept/description
 * @param {number} opts.amount
 * @param {string} opts.currency
 * @param {Date}   opts.dueDate
 */
export const sendOverdueReminder = async ({
  to,
  patientName,
  clinicName,
  concept,
  amount,
  currency,
  dueDate,
}) => {
  const formattedAmount = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

  const formattedDate = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dueDate));

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Recordatorio de pago pendiente — ${clinicName}`,
    html: buildReminderHtml({
      patientName,
      clinicName,
      concept,
      formattedAmount,
      formattedDate,
    }),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
};

// ─── email template ──────────────────────────────────────────────────────────

const buildReminderHtml = ({ patientName, clinicName, concept, formattedAmount, formattedDate }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recordatorio de pago</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

          <!-- header -->
          <tr>
            <td style="background:#2563eb;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${clinicName}</p>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#111827;font-size:16px;">
                Hola <strong>${patientName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
                Te recordamos que tenés un pago pendiente con <strong>${clinicName}</strong>
                que venció el <strong>${formattedDate}</strong>.
              </p>

              <!-- invoice card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">
                      Concepto
                    </p>
                    <p style="margin:0 0 12px;color:#111827;font-size:15px;font-weight:600;">${concept}</p>
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">
                      Importe
                    </p>
                    <p style="margin:0;color:#dc2626;font-size:22px;font-weight:700;">${formattedAmount}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">
                Por favor, comunicate con nosotros para regularizar tu situación.
              </p>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Este es un mensaje automático de <strong>${clinicName}</strong> enviado a través de ClinicPay.
                Si ya realizaste el pago, por favor ignorá este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
