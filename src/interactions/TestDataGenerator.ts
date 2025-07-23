import { faker } from '@faker-js/faker';
import { InteractiveElement } from '../types/elements';
import { TestData } from '../types/interactions';
import { logger } from '../utils/logger';

export class TestDataGenerator {
  private generators: Map<string, () => string | number | boolean>;

  constructor() {
    this.generators = this.initializeGenerators();
  }

  async generateForElement(element: InteractiveElement): Promise<TestData> {
    const type = this.detectInputType(element);
    const generator = this.generators.get(type) || this.generators.get('text')!;

    try {
      const value = generator();
      return {
        value,
        type,
        generated: true,
        metadata: {
          elementType: element.type,
          inputType: type,
        },
      };
    } catch (error) {
      logger.error('Failed to generate test data', { element, error });
      return {
        value: 'test',
        type: 'text',
        generated: false,
      };
    }
  }

  private detectInputType(element: InteractiveElement): string {
    // Check element type first
    switch (element.type) {
      case 'email-input':
        return 'email';
      case 'password-input':
        return 'password';
      case 'number-input':
        return 'number';
      case 'tel-input':
        return 'phone';
      case 'date-picker':
        return 'date';
      case 'time-picker':
        return 'time';
      case 'color-picker':
        return 'color';
      case 'file-upload':
        return 'file';
      default:
        // Fall through to text analysis
        break;
    }

    // Check attributes for hints
    const { attributes, metadata } = element;

    // Check name attribute
    const name = attributes?.name?.toLowerCase() || '';
    const id = attributes?.id?.toLowerCase() || '';
    const placeholder = metadata?.placeholder?.toLowerCase() || '';
    const label = metadata?.label?.toLowerCase() || '';

    const combined = `${name} ${id} ${placeholder} ${label}`;

    // Email patterns
    if (combined.includes('email') || combined.includes('e-mail')) {
      return 'email';
    }

    // Phone patterns
    if (
      combined.includes('phone') ||
      combined.includes('tel') ||
      combined.includes('mobile') ||
      combined.includes('cell')
    ) {
      return 'phone';
    }

    // Name patterns
    if (combined.includes('name') && !combined.includes('username')) {
      if (combined.includes('first')) return 'firstName';
      if (combined.includes('last')) return 'lastName';
      if (combined.includes('full')) return 'fullName';
      return 'name';
    }

    // Username patterns
    if (combined.includes('username') || combined.includes('user')) {
      return 'username';
    }

    // Password patterns
    if (combined.includes('password') || combined.includes('pwd')) {
      return 'password';
    }

    // Address patterns
    if (combined.includes('address') || combined.includes('street')) {
      return 'address';
    }

    // City patterns
    if (combined.includes('city')) {
      return 'city';
    }

    // Zip/Postal code patterns
    if (combined.includes('zip') || combined.includes('postal')) {
      return 'zipCode';
    }

    // Date patterns
    if (combined.includes('date') || combined.includes('dob') || combined.includes('birth')) {
      return 'date';
    }

    // Number patterns
    if (
      combined.includes('number') ||
      combined.includes('amount') ||
      combined.includes('quantity') ||
      combined.includes('price')
    ) {
      return 'number';
    }

    // URL patterns
    if (combined.includes('url') || combined.includes('website')) {
      return 'url';
    }

    // Default to text
    return 'text';
  }

  private initializeGenerators(): Map<string, () => string | number | boolean> {
    const generators = new Map<string, () => string | number | boolean>();

    // Personal information
    generators.set('email', () => faker.internet.email());
    generators.set('username', () => faker.internet.userName());
    generators.set('password', () => this.generateSecurePassword());
    generators.set('firstName', () => faker.person.firstName());
    generators.set('lastName', () => faker.person.lastName());
    generators.set('fullName', () => faker.person.fullName());
    generators.set('name', () => faker.person.fullName());

    // Contact information
    generators.set('phone', () => faker.phone.number());
    generators.set('address', () => faker.location.streetAddress());
    generators.set('city', () => faker.location.city());
    generators.set('zipCode', () => faker.location.zipCode());

    // Dates and numbers
    generators.set('date', () => faker.date.future().toISOString().split('T')[0]);
    generators.set('time', () => faker.date.future().toTimeString().split(' ')[0]);
    generators.set('number', () => faker.number.int({ min: 1, max: 100 }));

    // Other types
    generators.set('url', () => faker.internet.url());
    generators.set('color', () => faker.color.rgb());
    generators.set('text', () => faker.lorem.sentence());
    generators.set('paragraph', () => faker.lorem.paragraph());
    generators.set('file', () => '/path/to/test/file.pdf');

    // Boolean
    generators.set('boolean', () => faker.datatype.boolean());

    // Select options
    generators.set('select', () => 'option1');

    return generators;
  }

  private generateSecurePassword(): string {
    // Generate a password that meets common requirements
    // const length = faker.number.int({ min: 12, max: 16 });
    const lowercase = faker.string.alpha({ length: 4, casing: 'lower' });
    const uppercase = faker.string.alpha({ length: 4, casing: 'upper' });
    const numbers = faker.string.numeric({ length: 2 });
    const special = faker.helpers.arrayElement(['!', '@', '#', '$', '%', '^', '&', '*']);

    const password = faker.helpers
      .shuffle([...lowercase, ...uppercase, ...numbers, special].join('').split(''))
      .join('');

    return password;
  }

  generateMultipleValues(count: number, type: string): Array<string | number | boolean> {
    const generator = this.generators.get(type) || this.generators.get('text')!;
    return Array.from({ length: count }, () => generator());
  }

  generateOptionsSelection(options: Array<{ value: string; text: string }>): string {
    if (options.length === 0) return '';
    return faker.helpers.arrayElement(options).value;
  }

  generateMultipleOptionsSelection(
    options: Array<{ value: string; text: string }>,
    min = 1,
    max = 3
  ): string[] {
    const count = faker.number.int({ min, max: Math.min(max, options.length) });
    return faker.helpers.arrayElements(options, count).map((opt) => opt.value);
  }
}
