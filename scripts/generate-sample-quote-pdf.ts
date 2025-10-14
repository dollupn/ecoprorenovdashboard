import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { QuotesPdfService } from "../src/server/quotesPdfService";
import { sampleQuotePdfDto } from "../src/server/fixtures/sampleQuotePdfDto";

const OUTPUT_PATH = path.resolve(process.cwd(), "docs/samples/Devis-" + sampleQuotePdfDto.quote_number + ".pdf");

async function main() {
  const service = new QuotesPdfService();
  const buffer = await service.generateQuotePdfFromDto(sampleQuotePdfDto);

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, buffer);

  console.info(`PDF généré : ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Impossible de générer l'exemple de devis", error);
  process.exitCode = 1;
});
