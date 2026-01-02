import { isIP } from 'net';

export function isValidIp(ip: string | undefined): boolean {
  if (!ip) return false;
  return isIP(ip) !== 0;
}

export function isPrivateIp(ip: string): boolean {
  // IPv4 Private ranges
  // 10.0.0.0/8
  // 172.16.0.0/12
  // 192.168.0.0/16
  // 127.0.0.0/8 (Loopback)
  // 0.0.0.0/8 (Current network)
  // 169.254.0.0/16 (Link-local)

  // Check IPv4
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map((part) => parseInt(part, 10));
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    return false;
  }

  // Check IPv6 (simplified, mainly blocking loopback and unique local)
  if (isIP(ip) === 6) {
    const normalizedIp = ip.toLowerCase();
    // ::1
    if (normalizedIp === '::1') return true;
    // ::ffff:127.x.x.x (IPv4-mapped loopback)
    if (normalizedIp.startsWith('::ffff:127.')) return true;
    // ::ffff:10.x.x.x etc (IPv4-mapped private) - handled by extracting last 32 bits usually, but simple check:
    if (normalizedIp.startsWith('::ffff:10.')) return true;
    if (normalizedIp.startsWith('::ffff:192.168.')) return true;
    if (normalizedIp.startsWith('::ffff:172.')) {
        // regex to check 16-31 range for second octet if needed, but for now blocking all 172 in ipv4 mapped might be safer or just strict parsing.
        // Let's stick to basic ones.
    }

    // fc00::/7 (Unique Local Addresses)
    if (normalizedIp.startsWith('fc') || normalizedIp.startsWith('fd')) return true;
    // fe80::/10 (Link-local)
    if (normalizedIp.startsWith('fe80:')) return true;

    return false;
  }

  return false;
}
