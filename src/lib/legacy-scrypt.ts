// 老鉴权遗留的 scrypt 密码格式校验
// 格式: `scrypt$<saltHex>$<hashHex>` —— 见已删除的 src/lib/auth.ts 历史实现
// BetterAuth 全面接管后,新注册密码用 BetterAuth 默认格式存到 accounts.password
// 老 users.passwordHash 通过一次性脚本迁到 accounts.password,继续以本文件识别和校验
import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

export function isLegacyScryptHash(stored: string): boolean {
  return /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/i.test(stored);
}

export async function verifyLegacyScrypt(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = await scrypt(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(expected, actual);
}
