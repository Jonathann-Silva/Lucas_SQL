import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Podemos adicionar filtros de data aqui via searchParams se necessário
    const deliveries = await prisma.delivery.findMany({
      orderBy: { timestamp: 'desc' },
    });

    // Adaptar formato para ser parecido com o Firestore
    const formatted = deliveries.map((d: any) => ({
      ...d,
      timestamp: d.timestamp.toISOString() // Adapter fará o parse para Date
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const delivery = await prisma.delivery.create({
      data: {
        type: body.type,
        storeName: body.storeName,
        storeId: body.storeId,
        driverName: body.driverName,
        driverId: body.driverId,
        fee: Number(body.fee) || 0,
        status: body.status || 'Concluído',
        timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
        cleanedAddress: body.cleanedAddress || '',
        zoneTag: body.zoneTag || '',
        source: body.source || '',
      }
    });
    return NextResponse.json(delivery);
  } catch (error) {
    console.error('Error creating delivery:', error);
    return NextResponse.json({ error: 'Failed to create delivery' }, { status: 500 });
  }
}
