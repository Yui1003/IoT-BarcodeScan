import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, ArrowDown, Package, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebSocket } from '@/hooks/use-websocket';

interface Transaction {
  id: string;
  barcode: string;
  action: string;
  timestamp: number;
  itemName: string;
  category: string;
}

export default function Transactions() {
  const [realtimeTransactions, setRealtimeTransactions] = useState<Transaction[]>([]);
  const [location] = useLocation();

  const { data: transactions = [], isLoading, refetch } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  useEffect(() => {
    if (location === '/transactions') {
      refetch();
      setRealtimeTransactions([]);
    }
  }, [location, refetch]);

  useWebSocket({
    onMessage: (message: { type: string; data: unknown }) => {
      if (message.type === 'transaction_added') {
        const newTransaction = message.data as Transaction;
        setRealtimeTransactions((prev) => {
          const exists = prev.some((t) => t.id === newTransaction.id);
          if (exists) return prev;
          return [newTransaction, ...prev];
        });
      }
    },
  });


  const allTransactions = [...realtimeTransactions, ...transactions].filter(
    (t, index, self) => index === self.findIndex((item) => item.id === t.id)
  );

  const formatTimestamp = (timestamp: number) => {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              Transaction History
            </h1>
            <p className="text-muted-foreground">
              Real-time log of all inventory deductions.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-transactions"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Transactions
            </CardTitle>
            <CardDescription>
              Showing the last 100 transactions. New transactions appear in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : allTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet.</p>
                <p className="text-sm">Scan an item to record a transaction.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTransactions.map((transaction, index) => (
                      <TableRow
                        key={transaction.id}
                        data-testid={`row-transaction-${transaction.id}`}
                        className={index < realtimeTransactions.length ? 'bg-primary/5' : ''}
                      >
                        <TableCell className="font-mono text-sm">
                          {formatTimestamp(transaction.timestamp)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {transaction.itemName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {transaction.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {transaction.barcode}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <ArrowDown className="h-3 w-3" />
                            {transaction.action}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
