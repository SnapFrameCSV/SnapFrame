/** Plain HTML pages. No scripts, no external resources, nothing to load. */

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — Snapframe</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1.25rem; color: #1e1e2e; line-height: 1.5; }
  h1 { font-size: 1.5rem; }
  code.key { display: block; padding: 1rem; background: #f4f4f8; border-radius: 8px; font-size: 0.95rem; word-break: break-all; user-select: all; }
  ol { padding-left: 1.25rem; }
  label { display: block; margin: 1rem 0 0.25rem; }
  input { font: inherit; padding: 0.5rem; width: 100%; max-width: 24rem; box-sizing: border-box; }
  button { font: inherit; margin-top: 1rem; padding: 0.5rem 1rem; }
  .muted { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
${body}
<p class="muted">Snapframe — Code Screenshot. Questions: <a href="SUPPORT_URL_PLACEHOLDER">GitHub Issues</a>.</p>
</body>
</html>`;
}

export function successPage(key: string, supportUrl: string): string {
  return layout(
    'Your Snapframe Pro key',
    `<h1>Thank you — here is your Snapframe Pro key</h1>
<code class="key">${escapeHtml(key)}</code>
<ol>
  <li>In VS Code, run <strong>Snapframe: Enter Licence Key</strong> (Command Palette).</li>
  <li>Paste the key. It is checked on your machine only — nothing is sent anywhere.</li>
</ol>
<p><strong>Bookmark this page</strong> — it always shows your key. Works on up to three machines; no account, no sign-in.</p>`,
  ).replace('SUPPORT_URL_PLACEHOLDER', escapeHtml(supportUrl));
}

export function refundedPage(supportUrl: string): string {
  return layout(
    'Purchase refunded',
    `<h1>This purchase was refunded</h1>
<p>The key for this purchase is no longer issued. If you think that is a mistake, open an issue and we will sort it out on the next weekly run.</p>`,
  ).replace('SUPPORT_URL_PLACEHOLDER', escapeHtml(supportUrl));
}

export function pendingPage(supportUrl: string): string {
  return layout(
    'Payment not confirmed yet',
    `<h1>Payment not confirmed yet</h1>
<p>Stripe has not marked this checkout as paid. Reload this page in a minute; if it still shows this message, reply to your Stripe receipt or open an issue and the key will be issued on the next run.</p>`,
  ).replace('SUPPORT_URL_PLACEHOLDER', escapeHtml(supportUrl));
}

export function lostKeyForm(supportUrl: string, message?: string): string {
  return layout(
    'Find your key',
    `<h1>Find your Snapframe Pro key</h1>
${message ? `<p><strong>${escapeHtml(message)}</strong></p>` : ''}
<form method="post" action="/lost-key">
  <label for="email">Email used at checkout</label>
  <input id="email" name="email" type="email" required autocomplete="email">
  <label for="last4">Last 4 digits of the card</label>
  <input id="last4" name="last4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required>
  <button type="submit">Show my key</button>
</form>
<p class="muted">Five attempts per hour. Nothing is emailed; the key is shown here.</p>`,
  ).replace('SUPPORT_URL_PLACEHOLDER', escapeHtml(supportUrl));
}

export function errorPage(title: string, text: string, supportUrl: string): string {
  return layout(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>`).replace('SUPPORT_URL_PLACEHOLDER', escapeHtml(supportUrl));
}
