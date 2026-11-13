/* Public-only settings. Do not place secrets in this file.
 * Keep enableSigning false until legal, operational and PROD intake GO.
 * Turning this on DOES NOT enable a closed Worker.
 */
window.DIGITALIS_BIZALOM_SITE = Object.freeze({
  apiBase: 'https://digitalis-bizalom-signatures-api.mazsa-peter.workers.dev',
  turnstileSiteKey: '0x4AAAAAAF_A4C8oy4kPVhKx',
  turnstileAction: 'signature_submit_prod',
  enableSigning: false
});
