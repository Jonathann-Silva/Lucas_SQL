import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();

    const delivery = await prisma.delivery.update({
      where: { id },
      data: {
        type: body.type,
        storeName: body.storeName,
        storeId: body.storeId,
        driverName: body.driverName,
        driverId: body.driverId,
        fee: body.fee !== undefined ? Number(body.fee) : undefined,
        status: body.status,
        timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
        cleanedAddress: body.cleanedAddress,
        zoneTag: body.zoneTag,
        source: body.source,
      },
    });

    return NextResponse.json(delivery);
  } catch (error) {
    console.error('Error updating delivery:', error);
    return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    await prisma.delivery.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery:', error);
    return NextResponse.json({ error: 'Failed to delete delivery' }, { status: 500 });
  }
}
