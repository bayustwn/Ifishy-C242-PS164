const dns = require('dns').promises;
const net = require('net');

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

class UnsafeUrlError extends Error {
  constructor(message = 'URL is not allowed') {
    super(message);
    this.name = 'UnsafeUrlError';
    this.code = 'UNSAFE_URL';
  }
}

const expandIPv6 = (input) => {
  let address = String(input).toLowerCase().split('%')[0];
  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':');
    const octets = address.slice(lastColon + 1).split('.').map(Number);
    if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      return null;
    }
    address = `${address.slice(0, lastColon + 1)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const [head, tail] = address.split('::');
  const left = head ? head.split(':').filter(Boolean) : [];
  const right = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;

  const groups = [...left, ...Array(missing).fill('0'), ...right]
    .map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return groups.length === 8 && groups.every(Number.isInteger) ? groups : null;
};

const isPrivateIPv4 = (address) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  return a === 0
    || a === 10
    || a === 127
    || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
};

const isPrivateIPv6 = (address) => {
  const groups = expandIPv6(address);
  if (!groups) return true;

  const first = groups[0];
  const second = groups[1];
  const allZero = groups.every((group) => group === 0);
  const loopback = allZero && groups[7] === 1;
  const uniqueLocal = (first & 0xFE00) === 0xFC00;
  const linkLocal = (first & 0xFFC0) === 0xFE80;
  const multicast = (first & 0xFF00) === 0xFF00;
  const documentation = first === 0x2001 && second === 0x0DB8;
  const teredo = first === 0x2001 && second === 0x0000;

  if (allZero || loopback || uniqueLocal || linkLocal || multicast || documentation || teredo) {
    return true;
  }

  const firstFiveZero = groups.slice(0, 5).every((group) => group === 0);
  const firstSixZero = groups.slice(0, 6).every((group) => group === 0);
  if (firstFiveZero || firstSixZero) {
    const embedded = `${groups[6] >> 8}.${groups[6] & 0xFF}.${groups[7] >> 8}.${groups[7] & 0xFF}`;
    if (firstSixZero || groups[5] === 0xFFFF) return isPrivateIPv4(embedded);
  }

  if (first === 0x0064 && second === 0xFF9B) {
    const embedded = `${groups[6] >> 8}.${groups[6] & 0xFF}.${groups[7] >> 8}.${groups[7] & 0xFF}`;
    if (isPrivateIPv4(embedded)) return true;
  }

  if (first === 0x2002) {
    const embedded = `${groups[1] >> 8}.${groups[1] & 0xFF}.${groups[2] >> 8}.${groups[2] & 0xFF}`;
    if (isPrivateIPv4(embedded)) return true;
  }

  return false;
};

const isPrivateIp = (address) => {
  if (net.isIPv4(address)) return isPrivateIPv4(address);
  if (net.isIPv6(address)) return isPrivateIPv6(address);
  return true;
};

const isBlockedHostname = (hostname) => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
};

const assertPublicHttpUrl = async (rawUrl, { lookup = dns.lookup } = {}) => {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError('URL credentials are not allowed');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new UnsafeUrlError('URL port is not allowed');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError('URL host is not allowed');
  }

  let addresses;
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname }];
  } else {
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new UnsafeUrlError('URL host could not be resolved');
    }
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new UnsafeUrlError('URL host could not be resolved');
  }
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new UnsafeUrlError('URL resolves to a private address');
  }

  return parsed;
};

module.exports = {
  UnsafeUrlError,
  isPrivateIp,
  isBlockedHostname,
  assertPublicHttpUrl,
};
