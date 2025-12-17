export interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  barcode: string;
  status?: 'healthy' | 'low' | 'out_of_stock';
  createdAt: string;
  originalStock: number;
}

export interface Transaction {
  id: string;
  barcode: string;
  action: 'DEDUCT';
  timestamp: number;
}

export const api = {
  async getItems(): Promise<Item[]> {
    const response = await fetch('/api/items');
    if (!response.ok) throw new Error('Failed to fetch items');
    return response.json();
  },

  async addItem(item: Omit<Item, 'id' | 'createdAt' | 'status' | 'originalStock'>): Promise<Item> {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!response.ok) throw new Error('Failed to add item');
    return response.json();
  },

  async deleteItem(id: string): Promise<void> {
    const response = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete item');
  },

  async updateStock(id: string, quantity: number): Promise<Item> {
    const response = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
    if (!response.ok) throw new Error('Failed to update stock');
    return response.json();
  },

  async scanBarcode(barcode: string): Promise<{
    success: boolean;
    item?: Item;
    message: string;
    newStock?: number;
  }> {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error('Failed to scan barcode');
    }
    return response.json();
  },

  async getTransactions(): Promise<Transaction[]> {
    const response = await fetch('/api/transactions');
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  },
};
