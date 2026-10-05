import { isIP } from 'node:net';

export class PortalError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PortalError';
    this.status = status;
  }
}

const BLOCKED_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;

/**
 * Accept only public HTTPS Home Access hosts.
 * The proxy refuses loopback, private names, and raw IP addresses.
 */
export function resolvePortal(input) {
  let url;
  try {
    url = new URL(String(input || '').trim());
  } catch {
    throw new PortalError('Enter a full HTTPS portal address.');
  }

  if (url.protocol !== 'https:') {
    throw new PortalError('The district portal must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new PortalError('Remove any username or password from the portal URL.');
  }
  if (BLOCKED_HOST.test(url.hostname) || isIP(url.hostname)) {
    throw new PortalError('That portal address is not allowed.');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const index = parts.findIndex((part) => part.toLowerCase().startsWith('homeaccess'));
  const prefix = index > 0 ? `/${parts.slice(0, index).join('/')}` : '';
  const segment = index >= 0 ? parts[index] : 'HomeAccess';
  const base = `${url.origin}${prefix}/${segment}`;

  return {
    origin: url.origin,
    base,
    loginUrl: `${base}/Account/LogOn?ReturnUrl=%2fhomeaccess%2f`,
  };
}
