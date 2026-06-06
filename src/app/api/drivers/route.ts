import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const driver = await prisma.driver.create({
      data: {
        name: body.name,
        phone: body.phone || '',
        plate: body.plate || '',
        vehicle: body.vehicle || '',
        status: body.status || 'Disponível',
      }
    });
    return NextResponse.json(driver);
  } catch (error) {
    console.error('Error creating driver:', error);
    return NextResponse.json({ error: 'Failed to create driver' }, { status: 500 });
  }
}
