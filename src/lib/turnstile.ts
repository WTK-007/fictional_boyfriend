interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // 未配置 secret 时跳过校验,避免本地开发被卡死;生产应保证已设置
    if (process.env.NODE_ENV === 'production') {
      return { success: false, errorCodes: ['missing-secret'] };
    }
    return { success: true };
  }

  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  const payload: Record<string, string> = {
    secret,
    response: token,
  };
  if (remoteIp) payload.remoteip = remoteIp;

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as SiteVerifyResponse;
    return {
      success: !!data.success,
      errorCodes: data['error-codes'],
    };
  } catch (err) {
    console.error('Turnstile verify error:', err);
    return { success: false, errorCodes: ['network-error'] };
  }
}

export function getClientIp(request: Request): string | null {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('cf-connecting-ip') || headers.get('x-real-ip') || null;
}
