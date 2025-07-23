const { chromium } = require('playwright');

async function testDetectorDirect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setContent(`
    <html>
      <body>
        <button id="test-btn">Click Me</button>
        <input type="text" id="test-input" placeholder="Enter text">
        <input type="email" name="email" required>
        <a href="#" id="test-link">Test Link</a>
        <button type="submit">Submit</button>
      </body>
    </html>
  `);
  
  // Test the actual compiled JavaScript
  const { AIElementDetector } = require('./dist/detectors/AIElementDetector');
  const detector = new AIElementDetector();
  
  // Call the private method directly (for testing)
  console.log('selectorPatterns size:', detector.selectorPatterns?.size);
  
  // Try detecting elements
  const result = await detector.detectInteractiveElements(page);
  console.log('Elements found:', result.elements.length);
  console.log('Elements:', result.elements.map(el => ({
    type: el.type,
    selector: el.selector,
    text: el.text
  })));
  
  await browser.close();
}

testDetectorDirect().catch(console.error);