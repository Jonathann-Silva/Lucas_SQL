'use server';
/**
 * @fileOverview A Genkit flow for extracting delivery information from unstructured WhatsApp chat logs.
 *
 * - whatsappDeliveryExtraction - A function that processes WhatsApp content to extract delivery details.
 * - WhatsappDeliveryExtractionInput - The input type for the whatsappDeliveryExtraction function.
 * - WhatsappDeliveryExtractionOutput - The return type for the whatsappDeliveryExtraction function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input Schema for the flow
const WhatsappDeliveryExtractionInputSchema = z.object({
  whatsappContent: z.string().describe('Unstructured WhatsApp chat logs containing delivery addresses.'),
  baseFee: z.number().describe('The base delivery fee configured for this specific store.'),
  storeName: z.string().describe('The name of the store (WhatsApp group name).'),
  expectedCount: z.number().optional().describe('Optional: Expected number of deliveries for validation purposes.'),
});
export type WhatsappDeliveryExtractionInput = z.infer<typeof WhatsappDeliveryExtractionInputSchema>;

// Output Schema for a single delivery item
const DeliveryItemSchema = z.object({
  cleanedAddress: z.string().describe('The cleaned and formatted delivery address.'),
  zoneTag: z.string().describe('The identified delivery zone (e.g., "Standard", "Store Fixed", "Premium Sector").'),
  fee: z.number().describe('The calculated delivery fee for this address.'),
});

// Output Schema for the entire flow
const WhatsappDeliveryExtractionOutputSchema = z.object({
  deliveries: z.array(DeliveryItemSchema).describe('A list of extracted and processed delivery items.'),
  totalDeliveries: z.number().describe('The total number of deliveries extracted.'),
  totalValue: z.number().describe('The total sum of all calculated delivery fees.'),
  validationStatus: z.string().describe('Validation status comparing extracted count with expected count (e.g., "Conferido", "Divergente", "N/A").'),
});
export type WhatsappDeliveryExtractionOutput = z.infer<typeof WhatsappDeliveryExtractionOutputSchema>;


// Prompt Schema - LLM will extract raw addresses first
const RawAddressExtractionInputSchema = z.object({
  whatsappContent: z.string().describe('Unstructured WhatsApp chat logs.'),
});

const RawAddressExtractionOutputSchema = z.object({
  rawAddresses: z.array(z.string()).describe('An array of raw delivery addresses extracted from the WhatsApp content.'),
});


const extractRawAddressesPrompt = ai.definePrompt({
  name: 'extractRawAddressesPrompt',
  input: { schema: RawAddressExtractionInputSchema },
  output: { schema: RawAddressExtractionOutputSchema },
  prompt: `You are an expert logistics assistant. Your task is to extract all distinct delivery addresses from the provided WhatsApp chat logs.
Each address should be on a new line in the original content. If a line looks like an address, extract it.
Do not clean or modify the addresses yet, just extract them as they appear.

WhatsApp Content:
{{{whatsappContent}}}

Extract addresses in a JSON array format, for example:
{
  "rawAddresses": [
    "Rua das Flores 123",
    "Avenida Central 456 - Italian Ville",
    "Rua Principal 789"
  ]
}`
});

export async function whatsappDeliveryExtraction(
  input: WhatsappDeliveryExtractionInput
): Promise<WhatsappDeliveryExtractionOutput> {
  return whatsappDeliveryExtractionFlow(input);
}

const whatsappDeliveryExtractionFlow = ai.defineFlow(
  {
    name: 'whatsappDeliveryExtractionFlow',
    inputSchema: WhatsappDeliveryExtractionInputSchema,
    outputSchema: WhatsappDeliveryExtractionOutputSchema,
  },
  async (input) => {
    const { output } = await extractRawAddressesPrompt({ whatsappContent: input.whatsappContent });
    const rawAddresses = output!.rawAddresses;

    const processedDeliveries: z.infer<typeof DeliveryItemSchema>[] = [];
    let totalValue = 0;

    rawAddresses.forEach((rawAddress) => {
      let cleanedAddress = rawAddress.trim();
      let fee = input.baseFee; 
      let zoneTag = 'Padrão Unidade';

      // Cleaning Rules
      cleanedAddress = cleanedAddress.replace(/Rua\s+/gi, '').trim();
      cleanedAddress = cleanedAddress.replace(/Avenida\s+/gi, 'AV. ').trim();

      // Special Locations Logic (overrides store-specific if present)
      // Exemplo: Taxa fixa para condomínios conhecidos
      if (rawAddress.toLowerCase().includes('italian ville') || rawAddress.toLowerCase().includes('golden garden')) {
        fee = 10.00;
        zoneTag = 'Setor Premium';
      }

      totalValue += fee;
      processedDeliveries.push({
        cleanedAddress,
        zoneTag,
        fee,
      });
    });

    const totalDeliveries = processedDeliveries.length;
    let validationStatus = 'N/A';
    if (input.expectedCount !== undefined && input.expectedCount > 0) {
      if (input.expectedCount === totalDeliveries) {
        validationStatus = 'Conferido';
      } else {
        validationStatus = `Divergente (${totalDeliveries} vs ${input.expectedCount})`;
      }
    }

    return {
      deliveries: processedDeliveries,
      totalDeliveries,
      totalValue,
      validationStatus,
    };
  }
);
