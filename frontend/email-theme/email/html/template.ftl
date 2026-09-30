<#macro emailLayout>
<!doctype html>
<html lang="${locale.language}" dir="${(ltr)?then('ltr','rtl')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    h1 { margin: 0 0 10px 0; font-size: 22px; line-height: 28px; font-weight: 700; letter-spacing: -0.3px; }
    p { margin: 0 0 14px 0; font-size: 15px; line-height: 23px; color: #5c687f; }
    a { display: inline-block; padding: 10px 18px; border-radius: 8px; background-color: #2b5ce6; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; }
    @media (max-width: 620px) {
      .container { width: 100% !important; }
      .pad { padding-left: 20px !important; padding-right: 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .bg-page { background-color: #07090b !important; }
      .bg-card { background-color: #10151a !important; border-color: #1f282f !important; }
      .text-main { color: #e6edf0 !important; }
      .text-muted, p { color: #8fa0a8 !important; }
      .brand { color: #2cc2da !important; }
    }
  </style>
</head>
<body class="bg-page" style="margin:0;padding:0;background-color:#f5f7fa;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="background-color:#f5f7fa;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="container" style="width:560px;max-width:100%;">
          <tr>
            <td class="brand" style="padding:0 4px 16px 4px;font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.3px;color:#2b5ce6;">
              phisheye
            </td>
          </tr>
          <tr>
            <td class="bg-card" style="background-color:#ffffff;border:1px solid #dde3ec;border-radius:10px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="pad text-main" style="padding:32px;font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f1724;">
                    <#nested>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="text-muted" style="padding:16px 4px 0 4px;font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#5c687f;">
              ${msg("emailFooter")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
</#macro>
