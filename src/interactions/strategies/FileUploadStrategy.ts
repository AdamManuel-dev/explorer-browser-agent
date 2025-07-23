import * as path from 'path';
import * as fs from 'fs/promises';
import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { logger } from '../../utils/logger';

export class FileUploadStrategy implements InteractionStrategy {
  type = 'file-upload';

  async execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult> {
    const { page, testData, options } = context;

    try {
      // Locate the element
      const el = await page.$(element.selector);
      if (!el) {
        throw new Error('Element not found');
      }

      // Prepare test file
      const testFilePath = await this.prepareTestFile(testData?.value);

      // Add delay if specified
      if (options?.delay) {
        await page.waitForTimeout(options.delay);
      }

      // Set the file
      await el.setInputFiles(testFilePath);

      logger.info('File uploaded', {
        selector: element.selector,
        file: testFilePath,
      });

      return {
        success: true,
        value: testFilePath,
      };
    } catch (error) {
      logger.error('File upload failed', { element, error });
      throw error;
    }
  }

  private async prepareTestFile(requestedFile?: string): Promise<string> {
    // If a specific file is requested and exists, use it
    if (requestedFile) {
      try {
        await fs.access(requestedFile);
        return requestedFile;
      } catch {
        logger.warn('Requested file not found, creating test file', { requestedFile });
      }
    }

    // Create a test file
    const testDir = path.join(process.cwd(), 'test-files');
    await fs.mkdir(testDir, { recursive: true });

    const testFilePath = path.join(testDir, 'test-document.pdf');

    // Create a simple PDF-like file for testing
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000303 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
394
%%EOF`;

    await fs.writeFile(testFilePath, pdfContent);
    return testFilePath;
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}
