import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Item } from '@/lib/api';
import Layout from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, Filter, Trash2, Edit2, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import BarcodeDisplay, { type BarcodeDisplayHandle } from '@/components/barcode-display';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const calculateStatus = (quantity: number, originalStock: number): 'healthy' | 'low' | 'out_of_stock' => {
  if (quantity === 0) return 'out_of_stock';
  const percentage = (quantity / originalStock) * 100;
  if (percentage >= 50) return 'healthy';
  return 'low';
};

export default function Inventory() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: api.getItems,
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [barcodeDialogItem, setBarcodeDialogItem] = useState<Item | null>(null);
  const [editDialogItem, setEditDialogItem] = useState<Item | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const barcodeRef = useRef<BarcodeDisplayHandle>(null);

  useEffect(() => {
    if (editDialogItem) {
      setEditQuantity(editDialogItem.quantity);
    }
  }, [editDialogItem]);

  const deleteMutation = useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: "Item Deleted",
        description: "The item has been removed from inventory.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete item.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => 
      api.updateStock(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditDialogItem(null);
      toast({
        title: "Item Updated",
        description: "The item quantity has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update item.",
        variant: "destructive",
      });
    },
  });

  const itemsWithStatus = items.map(item => ({
    ...item,
    status: calculateStatus(item.quantity, item.originalStock),
  }));

  const categories = Array.from(new Set(itemsWithStatus.map(i => i.category)));

  const filteredItems = itemsWithStatus.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25';
      case 'low': return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25';
      case 'out_of_stock': return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25';
      default: return 'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25';
    }
  };

  const handleDownloadBarcode = () => {
    if (barcodeRef.current && barcodeDialogItem) {
      barcodeRef.current.downloadPNG(`barcode-${barcodeDialogItem.barcode}`);
      toast({
        title: "Barcode Downloaded",
        description: "The barcode image has been saved to your downloads.",
      });
    }
  };

  const handleExportToExcel = () => {
    const exportData = itemsWithStatus.map(item => ({
      'Item Name': item.name,
      'Category': item.category,
      'Barcode': item.barcode,
      'Quantity': item.quantity,
      'Original Stock': item.originalStock,
      'Status': item.status.replace('_', ' ').toUpperCase(),
      'Created At': new Date(item.createdAt).toLocaleDateString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    
    const colWidths = [
      { wch: 25 }, { wch: 15 }, { wch: 20 }, 
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `inventory-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Complete",
      description: "Inventory data has been exported to Excel.",
    });
  };

  const handleUpdateItem = () => {
    if (editDialogItem) {
      updateMutation.mutate({ id: editDialogItem.id, quantity: editQuantity });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading inventory...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage your products and stock levels.</p>
        </div>
        <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or barcode..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full md:w-[200px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-md bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No items found.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{item.barcode}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={() => setBarcodeDialogItem(item)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">{item.quantity}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(item.status)}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditDialogItem(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this item?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Barcode Dialog */}
      <Dialog open={!!barcodeDialogItem} onOpenChange={(open) => !open && setBarcodeDialogItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Barcode for {barcodeDialogItem?.name}</DialogTitle>
            <DialogDescription>
              Scan this code to manage inventory
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            {barcodeDialogItem && (
              <BarcodeDisplay 
                ref={barcodeRef} 
                value={barcodeDialogItem.barcode} 
                height={80}
                width={2}
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleDownloadBarcode} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Download PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDialogItem} onOpenChange={(open) => !open && setEditDialogItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editDialogItem?.name}</DialogTitle>
            <DialogDescription>
              Update the item quantity
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Input value={editDialogItem?.category || ''} disabled className="bg-muted" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Barcode</label>
                <Input value={editDialogItem?.barcode || ''} disabled className="bg-muted font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Quantity</label>
                <Input 
                  type="number" 
                  value={editQuantity} 
                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateItem} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
