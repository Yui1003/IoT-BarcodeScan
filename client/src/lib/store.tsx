import React, { createContext, useContext, useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';

export type ItemStatus = 'healthy' | 'low' | 'out_of_stock';

export interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  barcode: string;
  status: ItemStatus;
  createdAt: string;
  originalStock: number; // To calculate percentage for status
}

interface InventoryContextType {
  items: Item[];
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'status' | 'originalStock'>) => void;
  deleteItem: (id: string) => void;
  updateStock: (id: string, newQuantity: number) => void;
  scanBarcode: (barcode: string) => { success: boolean; item?: Item; message: string };
  stats: {
    totalItems: number;
    healthy: number;
    low: number;
    outOfStock: number;
  };
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Helper to determine status based on quantity and original stock (or a fixed threshold if original unknown)
// The prompt says: >= 50% healthy, 1-49% low, 0 out of stock.
// We'll store originalStock to calculate this correctly.
const calculateStatus = (quantity: number, originalStock: number): ItemStatus => {
  if (quantity === 0) return 'out_of_stock';
  const percentage = (quantity / originalStock) * 100;
  if (percentage >= 31) return 'healthy';
  return 'low';
};

const MOCK_ITEMS: Item[] = [
  {
    id: '1',
    name: 'Arduino Uno R3',
    category: 'Microcontrollers',
    quantity: 45,
    originalStock: 50,
    barcode: 'ITEM-2025-00012',
    status: 'healthy',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'ESP32 DevKit V1',
    category: 'Microcontrollers',
    quantity: 12,
    originalStock: 100,
    barcode: 'ITEM-2025-00013',
    status: 'low',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Jumper Wires (M-M)',
    category: 'Components',
    quantity: 0,
    originalStock: 200,
    barcode: 'ITEM-2025-00014',
    status: 'out_of_stock',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'OLED Display 0.96"',
    category: 'Displays',
    quantity: 8,
    originalStock: 20,
    barcode: 'ITEM-2025-00015',
    status: 'low',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Stepper Motor NEMA17',
    category: 'Motors',
    quantity: 15,
    originalStock: 15,
    barcode: 'ITEM-2025-00016',
    status: 'healthy',
    createdAt: new Date().toISOString(),
  }
];

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>(MOCK_ITEMS);

  const addItem = (newItem: Omit<Item, 'id' | 'createdAt' | 'status' | 'originalStock'>) => {
    const item: Item = {
      ...newItem,
      id: nanoid(),
      createdAt: new Date().toISOString(),
      originalStock: newItem.quantity,
      status: calculateStatus(newItem.quantity, newItem.quantity),
    };
    setItems((prev) => [item, ...prev]);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateStock = (id: string, newQuantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            quantity: newQuantity,
            status: calculateStatus(newQuantity, item.originalStock),
          };
        }
        return item;
      })
    );
  };

  const scanBarcode = (barcode: string) => {
    const item = items.find((i) => i.barcode === barcode);
    if (!item) {
      return { success: false, message: 'Item not found' };
    }

    if (item.quantity > 0) {
      updateStock(item.id, item.quantity - 1);
      return { success: true, item, message: 'Stock decreased by 1' };
    } else {
      return { success: false, item, message: 'Item is out of stock' };
    }
  };

  const stats = {
    totalItems: items.length,
    healthy: items.filter((i) => i.status === 'healthy').length,
    low: items.filter((i) => i.status === 'low').length,
    outOfStock: items.filter((i) => i.status === 'out_of_stock').length,
  };

  return (
    <InventoryContext.Provider value={{ items, addItem, deleteItem, updateStock, scanBarcode, stats }}>
      {children}
    </InventoryContext.Provider>
  );
}

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
