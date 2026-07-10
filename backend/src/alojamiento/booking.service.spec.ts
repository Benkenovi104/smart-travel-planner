import { describe, it, expect } from '@jest/globals';
import { habitacionesPara } from './booking.service.js';

describe('habitacionesPara', () => {
  it('pide una habitación doble cada dos personas', () => {
    expect(habitacionesPara(2)).toBe(1);
    expect(habitacionesPara(4)).toBe(2);
    expect(habitacionesPara(6)).toBe(3);
  });

  it('redondea para arriba con un número impar de personas', () => {
    expect(habitacionesPara(3)).toBe(2);
    expect(habitacionesPara(5)).toBe(3);
  });

  it('nunca pide menos de una habitación', () => {
    expect(habitacionesPara(1)).toBe(1);
    expect(habitacionesPara(0)).toBe(1);
  });
});
