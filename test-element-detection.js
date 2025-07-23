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
  
  const result1 = await detector.detectInteractiveElements(page);
  console.log('Static HTML - Elements found:', result1.elements.length);
  console.log('Element types:', result1.elements.map(el => ({ type: el.type, selector: el.selector })));
  
  console.log('\nTesting with real website (example.com)...');
  await page.goto('https://example.com');
  await page.waitForLoadState('networkidle');
  
  const result2 = await detector.detectInteractiveElements(page);
  console.log('Example.com - Elements found:', result2.elements.length);
  console.log('Element types:', result2.elements.map(el => ({ type: el.type, selector: el.selector })));
  
  console.log('\nTesting with httpbin.org/forms/post...');
  await page.goto('https://httpbin.org/forms/post');
  await page.waitForLoadState('networkidle');
  
  const result3 = await detector.detectInteractiveElements(page);
  console.log('httpbin.org - Elements found:', result3.elements.length);
  console.log('Element types:', result3.elements.map(el => ({ type: el.type, selector: el.selector })));
  
  await browser.close();
}

testElementDetection().catch(console.error);