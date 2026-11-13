/* Public-only settings. Do not place secrets in this file.
 * Signing UI is allowed only after the PROD public registry API returns valid data.
 * This public setting cannot enable a closed Worker or database.
 */
window.DIGITALIS_BIZALOM_SITE = Object.freeze({
  apiBase: 'https://digitalis-bizalom-signatures-api.mazsa-peter.workers.dev',
  turnstileSiteKey: '0x4AAAAAAF_A4C8oy4kPVhKx',
  turnstileAction: 'signature_submit_prod',
  enableSigning: true
});
