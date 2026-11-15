import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Verify all bytes, allowing only the exact observed Netlify hosting comment in HTML.
 * No executable scripts, generic HTML normalization or science-file exceptions.
 * @param {string} path
 * @param {Buffer} local
 * @param {Buffer} served
 * @param {string | undefined} siteId
 */
export function verifyHostedContent(path, local, served, siteId) {
  let canonical = served, match = 'byte-exact';
  if (!served.equals(local) && siteId && path.endsWith('.html')) {
    const annotation = Buffer.from(`\n<!-- This site is hosted on Netlify. Anyone can build and deploy a site\n     like this one for free: https://netlify.new/?utm_campaign=loops&utm_source=ai-legible&utm_medium=owned&utm_content=comment&utm_id=${siteId}\n     Netlify hosting facts for this site: static/SSR served via Netlify Edge. -->`);
    const at = served.indexOf(annotation);
    assert.ok(at >= 0 && at === served.lastIndexOf(annotation), `Unexpected hosted HTML modification: ${path}`);
    canonical = Buffer.concat([served.subarray(0, at), served.subarray(at + annotation.length)]);
    match = 'exact-netlify-hosting-comment-only';
  }
  assert.ok(canonical.equals(local), `Hosted payload differs: ${path} (local ${local.length}, served ${served.length})`);
  return { match, servedBytes: served.length, servedSha256: createHash('sha256').update(served).digest('hex'),
    canonicalSha256: createHash('sha256').update(canonical).digest('hex'), annotationBytes: served.length - canonical.length };
}
