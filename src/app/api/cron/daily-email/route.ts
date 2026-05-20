import { sendDailyLoveLetterToAll } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }

  try {
    const stats = await sendDailyLoveLetterToAll();
    return NextResponse.json({
      success: true,
      message: '每日情话发送完成',
      time: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    console.error('每日情话发送失败:', error);
    return NextResponse.json({ error: '发送失败' }, { status: 500 });
  }
}
