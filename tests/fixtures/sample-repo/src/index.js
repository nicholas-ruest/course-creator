import { add, multiply } from './lib/utils.js';

export function calculate(a, b, op) {
  if (op === 'add') return add(a, b);
  if (op === 'multiply') return multiply(a, b);
  throw new Error(`Unknown operation: ${op}`);
}
