import { calculate } from '../src/index.js';

test('add', () => {
  expect(calculate(2, 3, 'add')).toBe(5);
});

test('multiply', () => {
  expect(calculate(2, 3, 'multiply')).toBe(6);
});
