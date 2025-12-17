import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./firebase";
import { WebSocketServer, WebSocket } from "ws";
import { scannerModeSchema, type ScannerMode } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const itemsRef = db.ref('items');
  const transactionsRef = db.ref('transactions');
  const scannerModeRef = db.ref('scannerMode');

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });
  });

  const broadcast = (type: string, data: any) => {
    const message = JSON.stringify({ type, data });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  itemsRef.on('value', async (snapshot) => {
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
    broadcast('items_update', items);
  });

  transactionsRef.on('child_added', async (snapshot) => {
    const transaction = snapshot.val();
    if (transaction) {
      const itemSnapshot = await itemsRef.child(transaction.barcode).once('value');
      const item = itemSnapshot.val();
      const enrichedTransaction = {
        id: snapshot.key,
        ...transaction,
        itemName: item?.name || 'Unknown Item',
        category: item?.category || 'Unknown',
      };
      broadcast('transaction_added', enrichedTransaction);
    }
  });

  scannerModeRef.on('value', (snapshot) => {
    const mode = snapshot.val() || { mode: 'DECREMENT', quantity: 1 };
    broadcast('scanner_mode_update', mode);
  });

  app.get("/api/scanner-mode", async (req, res) => {
    try {
      const snapshot = await scannerModeRef.once('value');
      const mode = snapshot.val() || { mode: 'DECREMENT', quantity: 1 };
      res.json(mode);
    } catch (error) {
      console.error('Error fetching scanner mode:', error);
      res.status(500).json({ error: 'Failed to fetch scanner mode' });
    }
  });

  app.put("/api/scanner-mode", async (req, res) => {
    try {
      const result = scannerModeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid scanner mode', details: result.error.errors });
      }

      const modeData = result.data;
      await scannerModeRef.set(modeData);
      
      res.json(modeData);
    } catch (error) {
      console.error('Error updating scanner mode:', error);
      res.status(500).json({ error: 'Failed to update scanner mode' });
    }
  });

  app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

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
      const { quantity, originalStock } = req.body;

      if (quantity === undefined) {
        return res.status(400).json({ error: 'Quantity is required' });
      }

      const updateData: { quantity: number; originalStock?: number } = {
        quantity: Number(quantity),
      };

      if (originalStock !== undefined) {
        updateData.originalStock = Number(originalStock);
      }

      await itemsRef.child(id).update(updateData);

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
          error: 'Item not found',
          action: 'NOT_FOUND',
        });
      }

      const item = snapshot.val();
      const currentQuantity = item.quantity || 0;

      const modeSnapshot = await scannerModeRef.once('value');
      const scannerMode: ScannerMode = modeSnapshot.val() || { mode: 'DECREMENT', quantity: 1 };
      const { mode, quantity: modeQuantity } = scannerMode;

      if (mode === 'DETAILS') {
        const originalStock = item.originalStock || currentQuantity;
        
        const getStockHealth = (qty: number, origStock: number) => {
          if (qty <= 0) return 'out_of_stock';
          const percentage = origStock > 0 ? (qty / origStock) * 100 : 100;
          return percentage >= 31 ? 'healthy' : 'low';
        };
        
        const stockHealth = getStockHealth(currentQuantity, originalStock);
        
        const transactionData = {
          barcode,
          action: 'VIEW',
          quantity: 0,
          timestamp: Date.now(),
        };
        await transactionsRef.push(transactionData);

        return res.json({
          success: true,
          item: {
            id: barcode,
            barcode,
            ...item,
          },
          name: item.name,
          category: item.category,
          currentStock: currentQuantity,
          originalStock: originalStock,
          action: 'VIEW',
          stockHealth,
          message: 'Item details retrieved',
        });
      }

      if (mode === 'DECREMENT') {
        const originalStock = item.originalStock || currentQuantity;
        
        const getStockHealth = (qty: number, origStock: number) => {
          if (qty <= 0) return 'out_of_stock';
          const percentage = origStock > 0 ? (qty / origStock) * 100 : 100;
          return percentage >= 31 ? 'healthy' : 'low';
        };

        if (currentQuantity <= 0) {
          return res.json({
            success: false,
            item: {
              id: barcode,
              barcode,
              ...item,
            },
            name: item.name,
            category: item.category,
            action: 'DEDUCT',
            quantityChanged: 0,
            requestedQuantity: modeQuantity,
            message: 'Item is out of stock',
            newStock: 0,
            stockHealth: 'out_of_stock',
          });
        }

        const deductAmount = Math.min(modeQuantity, currentQuantity);
        const newQuantity = currentQuantity - deductAmount;
        const wasPartialDeduction = deductAmount < modeQuantity;
        
        await itemsRef.child(barcode).update({
          quantity: newQuantity,
        });

        const transactionData = {
          barcode,
          action: 'DEDUCT',
          quantity: deductAmount,
          timestamp: Date.now(),
        };
        await transactionsRef.push(transactionData);

        const stockHealth = getStockHealth(newQuantity, originalStock);
        
        let message = `Stock decreased by ${deductAmount}`;
        if (wasPartialDeduction) {
          message = `Only ${deductAmount} deducted (was max available). Requested: ${modeQuantity}`;
        }

        return res.json({
          success: true,
          item: {
            id: barcode,
            barcode,
            ...item,
            quantity: newQuantity,
          },
          name: item.name,
          category: item.category,
          action: 'DEDUCT',
          quantityChanged: deductAmount,
          requestedQuantity: modeQuantity,
          wasPartialDeduction,
          newStock: newQuantity,
          stockHealth,
          message,
        });
      }

      if (mode === 'INCREMENT') {
        const originalStock = item.originalStock || currentQuantity;
        const newQuantity = currentQuantity + modeQuantity;
        
        const getStockHealth = (qty: number, origStock: number) => {
          if (qty <= 0) return 'out_of_stock';
          const percentage = origStock > 0 ? (qty / origStock) * 100 : 100;
          return percentage >= 31 ? 'healthy' : 'low';
        };
        
        await itemsRef.child(barcode).update({
          quantity: newQuantity,
        });

        const transactionData = {
          barcode,
          action: 'ADD',
          quantity: modeQuantity,
          timestamp: Date.now(),
        };
        await transactionsRef.push(transactionData);

        const stockHealth = getStockHealth(newQuantity, originalStock);

        return res.json({
          success: true,
          item: {
            id: barcode,
            barcode,
            ...item,
            quantity: newQuantity,
          },
          name: item.name,
          category: item.category,
          action: 'ADD',
          quantityChanged: modeQuantity,
          newStock: newQuantity,
          stockHealth,
          message: `Stock increased by ${modeQuantity}`,
        });
      }

      res.status(400).json({ error: 'Invalid scanner mode' });
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
        status = percentage >= 31 ? 'healthy' : 'low';
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
      const itemsSnapshot = await itemsRef.once('value');
      const itemsData = itemsSnapshot.val() || {};
      
      const transactions = await Promise.all(
        Object.entries(data).map(async ([id, transaction]: [string, any]) => {
          const item = itemsData[transaction.barcode];
          return {
            id,
            ...transaction,
            itemName: item?.name || 'Unknown Item',
            category: item?.category || 'Unknown',
          };
        })
      );
      
      transactions.sort((a, b) => b.timestamp - a.timestamp);
      
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  return httpServer;
}
