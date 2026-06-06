
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { whatsappDeliveryExtraction } from '@/ai/flows/whatsapp-delivery-extraction';

/**
 * Webhook para processamento automático de grupos do WhatsApp.
 * O robô deve enviar: { text: string, groupName: string }
 * groupName deve coincidir com o nome da Loja cadastrada no sistema.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, groupName } = body;

    if (!text || !groupName) {
      return NextResponse.json({ error: 'Texto ou nome do grupo não fornecido' }, { status: 400 });
    }

    // Busca a loja que tem o mesmo nome do grupo
    const store = await prisma.store.findFirst({
      where: { name: groupName }
    });

    if (!store) {
      return NextResponse.json({
        success: false,
        message: 'Loja/Grupo não cadastrado no Lucas Expresso.'
      }, { status: 200 }); // Retornamos 200 para evitar retentativas infinitas do robô se for algo esperado
    }

    const storeId = store.id;
    // Note: Assuming store has a fee property, but schema doesn't have fee, wait! Let me check schema.prisma
    // Schema: id, name, status, createdAt, updatedAt. No fee in Store! So base fee is 7.00.
    const baseFee = 7.00; // Hardcoded default for now

    // VERIFICAÇÃO DE AUTOMAÇÃO ATIVA
    // If autoProcess doesn't exist on Store schema, we can ignore or adapt it.
    // For now we just process it.

    // Processa o texto usando a IA com a taxa da loja encontrada
    const extraction = await whatsappDeliveryExtraction({
      whatsappContent: text,
      baseFee: baseFee,
      storeName: groupName
    });

    // Salva cada entrega no PostgreSQL via Prisma
    const deliveryPromises = extraction.deliveries.map((delivery) => {
      return prisma.delivery.create({
        data: {
          timestamp: new Date(),
          type: 'LUCRO',
          storeName: groupName,
          storeId: storeId,
          driverName: null,
          driverId: null,
          cleanedAddress: delivery.cleanedAddress,
          zoneTag: delivery.zoneTag,
          fee: delivery.fee,
          status: 'Pendente',
          source: 'whatsapp_webhook',
        }
      });
    });

    await Promise.all(deliveryPromises);

    return NextResponse.json({
      success: true,
      storeIdentified: true,
      count: extraction.totalDeliveries,
      totalValue: extraction.totalValue
    });

  } catch (error: any) {
    console.error('Erro no Webhook WhatsApp:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
