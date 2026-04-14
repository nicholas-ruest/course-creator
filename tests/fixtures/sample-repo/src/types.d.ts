export type Operation = 'add' | 'multiply';

export interface CalculateOptions {
  a: number;
  b: number;
  op: Operation;
}
