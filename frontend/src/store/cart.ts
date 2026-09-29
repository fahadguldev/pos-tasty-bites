import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine } from '../lib/types';

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'key'>) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const lineKey = (ref: string, kind: string, variantName?: string) =>
  `${kind}:${ref}:${variantName || 'default'}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      add: (line) =>
        set((s) => {
          const key = lineKey(line.ref, line.kind, line.variantName);
          const existing = s.lines.find((l) => l.key === key);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.key === key ? { ...l, qty: Math.min(l.qty + line.qty, 50) } : l,
              ),
              open: true,
            };
          }
          return { lines: [...s.lines, { ...line, key }], open: true };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.key !== key)
              : s.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, 50) } : l)),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
      setOpen: (v) => set({ open: v }),
    }),
    { name: 'tb_cart' },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
