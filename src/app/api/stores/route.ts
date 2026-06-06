import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = await prisma.store.create({
      data: {
        name: body.name,
        type: body.type || '',
        phone: body.phone || '',
        status: body.status || 'Ativo',
        autoProcess: body.autoProcess !== undefined ? body.autoProcess : true,
      }
    });
    return NextResponse.json(store);
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}
