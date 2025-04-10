import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const history = await prisma.taskHistory.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch task history' },
      { status: 500 }
    );
  }
}