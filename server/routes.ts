import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./firebase";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const itemsRef = db.ref('items');
  const transactionsRef = db.ref('transactions');

  app.get("/api/items", async (req, res) => {
    try {
      const snapshot = await itemsRef.once('value');
      const data = snapshot.val() || {};
      
      const items = Object.entries(data).map(([barcode, item]: [string, any]) => ({
        id: barcode,
        barcode,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        originalStock: item.originalStock || item.quantity,
        createdAt: item.createdAt || new Date().toISOString(),
      }));
      
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(items);
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const { name, category, quantity, barcode } = req.body;

      if (!name || !category || quantity === undefined || !barcode) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existingSnapshot = await itemsRef.child(barcode).once('value');
      if (existingSnapshot.exists()) {
        return res.status(400).json({ error: 'Item with this barcode already exists' });
      }

      const itemData = {
        name,
        category,
        quantity: Number(quantity),
        originalStock: Number(quantity),
        createdAt: new Date().toISOString(),
      };

      await itemsRef.child(barcode).set(itemData);
      
      res.status(201).json({
        id: barcode,
        barcode,
        ...itemData,
      });
    } catch (error) {
      console.error('Error adding item:', error);
      res.status(500).json({ error: 'Failed to add item' });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await itemsRef.child(id).remove();
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).json({ error: 'Failed to delete item' });
    }
  });

  app.patch("/api/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined) {
        return res.status(400).json({ error: 'Quantity is required' });
      }

      await itemsRef.child(id).update({
        quantity: Number(quantity),
      });

      const snapshot = await itemsRef.child(id).once('value');
      const item = snapshot.val();
      
      res.json({
        id,
        barcode: id,
        ...item,
      });
    } catch (error) {
      console.error('Error updating item:', error);
      res.status(500).json({ error: 'Failed to update item' });
    }
  });

  app.post("/api/scan", async (req, res) => {
    try {
      const { barcode } = req.body;

      if (!barcode) {
        return res.status(400).json({ error: 'Barcode is required' });
      }

      const snapshot = await itemsRef.child(barcode).once('value');

      if (!snapshot.exists()) {
        return res.status(404).json({ 
          success: false,
          error: 'Item not found' 
        });
      }

      const item = snapshot.val();
      const currentQuantity = item.quantity || 0;

      if (currentQuantity <= 0) {
        return res.json({
          success: false,
          item: {
            id: barcode,
            barcode,
            ...item,
          },
          message: 'Item is out of stock',
          newStock: 0,
        });
      }

      const newQuantity = currentQuantity - 1;
      await itemsRef.child(barcode).update({
        quantity: newQuantity,
      });

      const transactionData = {
        barcode,
        action: 'DEDUCT',
        timestamp: Date.now(),
      };
      await transactionsRef.push(transactionData);

      const updatedItem = {
        id: barcode,
        barcode,
        ...item,
        quantity: newQuantity,
      };

      res.json({
        success: true,
        item: updatedItem,
        name: item.name,
        category: item.category,
        newStock: newQuantity,
        message: 'Stock decreased successfully',
      });
    } catch (error) {
      console.error('Error scanning barcode:', error);
      res.status(500).json({ error: 'Failed to process scan' });
    }
  });

  app.get("/api/item/:barcode", async (req, res) => {
    try {
      const { barcode } = req.params;

      const snapshot = await itemsRef.child(barcode).once('value');

      if (!snapshot.exists()) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = snapshot.val();
      const quantity = item.quantity || 0;
      const originalStock = item.originalStock || quantity;
      const percentage = originalStock > 0 ? (quantity / originalStock) * 100 : 0;
      
      let status = 'out_of_stock';
      if (quantity > 0) {
        status = percentage >= 50 ? 'healthy' : 'low';
      }

      res.json({
        id: barcode,
        barcode,
        ...item,
        status,
      });
    } catch (error) {
      console.error('Error fetching item:', error);
      res.status(500).json({ error: 'Failed to fetch item' });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      const snapshot = await transactionsRef.orderByChild('timestamp').limitToLast(100).once('value');
      const data = snapshot.val() || {};
      
      const transactions = Object.entries(data).map(([id, transaction]: [string, any]) => ({
        id,
        ...transaction,
      }));
      
      transactions.sort((a, b) => b.timestamp - a.timestamp);
      
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  return httpServer;
}
