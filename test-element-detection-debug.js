const { chromium } = require('playwright');
const { AIElementDetector } = require('./dist/detectors/AIElementDetector');

async function testElementDetection() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const detector = new AIElementDetector();
  
  console.log('Testing with static HTML...');
  await page.setContent(`
    <html>
      <body>
        <button id="test-btn">Click Me</button>
        <input type="text" id="test-input" placeholder="Enter text">
        <a href="#" id="test-link">Test Link</a>
        <form id="test-form">
          <input type="email" name="email" required>
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
  
  // Wait for content to be ready
  await page.waitForLoadState('domcontentloaded');
  
  // Test individual selectors
  console.log('\nTesting individual selectors:');
  const buttons = await page.$$('button');
  console.log('Buttons found with $$:', buttons.length);
  
  const inputs = await page.$$('input[type="text"]');
  console.log('Text inputs found:', inputs.length);
  
  const allInputs = await page.$$('input');
  console.log('All inputs found:', allInputs.length);
  
  const links = await page.$$('a[href]');
  console.log('Links found:', links.length);
  
  // Test if we can get element properties
  if (buttons.length > 0) {
    const firstButton = buttons[0];
    const text = await firstButton.textContent();
    const isVisible = await firstButton.isVisible();
    console.log('First button text:', text, 'Visible:', isVisible);
  }
  
  // Check if detector has selector patterns
  console.log('\nChecking detector properties:');
  console.log('Detector has selectorPatterns:', detector.selectorPatterns !== undefined);
  if (detector.selectorPatterns) {
    console.log('Pattern keys:', Array.from(detector.selectorPatterns.keys()));
  }
  
  await browser.close();
}

testElementDetection().catch(console.error);