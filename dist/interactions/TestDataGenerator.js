"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDataGenerator = void 0;
const faker_1 = require("@faker-js/faker");
const logger_1 = require("../utils/logger");
class TestDataGenerator {
    generators;
    constructor() {
        this.generators = this.initializeGenerators();
    }
    async generateForElement(element) {
        const type = this.detectInputType(element);
        const generator = this.generators.get(type) || this.generators.get('text');
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
        }
        catch (error) {
            logger_1.logger.error('Failed to generate test data', { element, error });
            return {
                value: 'test',
                type: 'text',
                generated: false,
            };
        }
    }
    detectInputType(element) {
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
        const name = String(attributes?.name || '').toLowerCase();
        const id = String(attributes?.id || '').toLowerCase();
        const placeholder = String(metadata?.placeholder || '').toLowerCase();
        const label = String(metadata?.label || '').toLowerCase();
        const combined = `${name} ${id} ${placeholder} ${label}`;
        // Email patterns
        if (combined.includes('email') || combined.includes('e-mail')) {
            return 'email';
        }
        // Phone patterns
        if (combined.includes('phone') ||
            combined.includes('tel') ||
            combined.includes('mobile') ||
            combined.includes('cell')) {
            return 'phone';
        }
        // Name patterns
        if (combined.includes('name') && !combined.includes('username')) {
            if (combined.includes('first'))
                return 'firstName';
            if (combined.includes('last'))
                return 'lastName';
            if (combined.includes('full'))
                return 'fullName';
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
        if (combined.includes('number') ||
            combined.includes('amount') ||
            combined.includes('quantity') ||
            combined.includes('price')) {
            return 'number';
        }
        // URL patterns
        if (combined.includes('url') || combined.includes('website')) {
            return 'url';
        }
        // Default to text
        return 'text';
    }
    initializeGenerators() {
        const generators = new Map();
        // Personal information
        generators.set('email', () => faker_1.faker.internet.email());
        generators.set('username', () => faker_1.faker.internet.userName());
        generators.set('password', () => this.generateSecurePassword());
        generators.set('firstName', () => faker_1.faker.person.firstName());
        generators.set('lastName', () => faker_1.faker.person.lastName());
        generators.set('fullName', () => faker_1.faker.person.fullName());
        generators.set('name', () => faker_1.faker.person.fullName());
        // Contact information
        generators.set('phone', () => faker_1.faker.phone.number());
        generators.set('address', () => faker_1.faker.location.streetAddress());
        generators.set('city', () => faker_1.faker.location.city());
        generators.set('zipCode', () => faker_1.faker.location.zipCode());
        // Dates and numbers
        generators.set('date', () => faker_1.faker.date.future().toISOString().split('T')[0]);
        generators.set('time', () => faker_1.faker.date.future().toTimeString().split(' ')[0]);
        generators.set('number', () => faker_1.faker.number.int({ min: 1, max: 100 }));
        // Other types
        generators.set('url', () => faker_1.faker.internet.url());
        generators.set('color', () => faker_1.faker.color.rgb());
        generators.set('text', () => faker_1.faker.lorem.sentence());
        generators.set('paragraph', () => faker_1.faker.lorem.paragraph());
        generators.set('file', () => '/path/to/test/file.pdf');
        // Boolean
        generators.set('boolean', () => faker_1.faker.datatype.boolean());
        // Select options
        generators.set('select', () => 'option1');
        return generators;
    }
    generateSecurePassword() {
        // Generate a password that meets common requirements
        // const length = faker.number.int({ min: 12, max: 16 });
        const lowercase = faker_1.faker.string.alpha({ length: 4, casing: 'lower' });
        const uppercase = faker_1.faker.string.alpha({ length: 4, casing: 'upper' });
        const numbers = faker_1.faker.string.numeric({ length: 2 });
        const special = faker_1.faker.helpers.arrayElement(['!', '@', '#', '$', '%', '^', '&', '*']);
        const password = faker_1.faker.helpers
            .shuffle([...lowercase, ...uppercase, ...numbers, special].join('').split(''))
            .join('');
        return password;
    }
    generateMultipleValues(count, type) {
        const generator = this.generators.get(type) || this.generators.get('text');
        return Array.from({ length: count }, () => generator());
    }
    generateOptionsSelection(options) {
        if (options.length === 0)
            return '';
        return faker_1.faker.helpers.arrayElement(options).value;
    }
    generateMultipleOptionsSelection(options, min = 1, max = 3) {
        const count = faker_1.faker.number.int({ min, max: Math.min(max, options.length) });
        return faker_1.faker.helpers.arrayElements(options, count).map((opt) => opt.value);
    }
}
exports.TestDataGenerator = TestDataGenerator;
//# sourceMappingURL=TestDataGenerator.js.map