"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadStrategy = void 0;
const logger_1 = require("../../utils/logger");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
class FileUploadStrategy {
    type = 'file-upload';
    async execute(element, context) {
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
            logger_1.logger.info('File uploaded', {
                selector: element.selector,
                file: testFilePath,
            });
            return {
                success: true,
                value: testFilePath,
            };
        }
        catch (error) {
            logger_1.logger.error('File upload failed', { element, error });
            throw error;
        }
    }
    async prepareTestFile(requestedFile) {
        // If a specific file is requested and exists, use it
        if (requestedFile) {
            try {
                await fs.access(requestedFile);
                return requestedFile;
            }
            catch {
                logger_1.logger.warn('Requested file not found, creating test file', { requestedFile });
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
    async validate(element) {
        return element.isEnabled && element.isVisible;
    }
}
exports.FileUploadStrategy = FileUploadStrategy;
//# sourceMappingURL=FileUploadStrategy.js.map