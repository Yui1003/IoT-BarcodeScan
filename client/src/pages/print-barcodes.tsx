import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import Layout from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BarcodeDisplay from '@/components/barcode-display';
import { useRealtimeItems } from '@/hooks/use-realtime-items';

interface Item {
  id: string;
  barcode: string;
  name: string;
  category: string;
  quantity: number;
  originalStock: number;
}

export default function PrintBarcodes() {
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  
  useRealtimeItems();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[itemId] !== undefined) {
        delete next[itemId];
      } else {
        next[itemId] = 1;
      }
      return next;
    });
  };

  const updateCount = (itemId: string, count: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: Math.max(1, count)
    }));
  };

  const selectAll = () => {
    const all: Record<string, number> = {};
    items.forEach(item => {
      all[item.id] = 1;
    });
    setSelectedItems(all);
  };

  const deselectAll = () => {
    setSelectedItems({});
  };

  const handlePrint = (mode: 'all' | 'selected') => {
    const printContent = printRef.current;
    if (!printContent) return;

    let barcodeHtml = '';
    const itemsToPrint = mode === 'all' 
      ? items.map(i => ({ ...i, count: 1 })) 
      : items.filter(i => selectedItems[i.id] !== undefined).map(i => ({ ...i, count: selectedItems[i.id] }));

    if (itemsToPrint.length === 0) return;

    itemsToPrint.forEach((item) => {
      const card = printContent.querySelector(`[data-barcode-id="${item.id}"]`);
      const canvas = card?.querySelector('canvas');
      
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        for (let i = 0; i < item.count; i++) {
          barcodeHtml += `
            <div class="barcode-item">
              <h3>${item.name}</h3>
              <p>${item.category}</p>
              <img src="${dataUrl}" alt="barcode" />
              <div style="font-family: monospace; font-size: 10px; margin-top: 5px;">${item.barcode}</div>
            </div>
          `;
        }
      }
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcodes - InventoHub</title>
          <style>
            @media print {
              @page { margin: 0.5in; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20px;
            }
            h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; }
            .barcode-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              page-break-inside: auto;
            }
            .barcode-item {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 15px;
              text-align: center;
              page-break-inside: avoid;
              background: #fff;
            }
            .barcode-item h3 { margin: 0 0 5px 0; font-size: 14px; font-weight: 600; }
            .barcode-item p { margin: 0 0 10px 0; font-size: 12px; color: #666; }
            .barcode-item img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <h1>InventoHub - Barcodes</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleString()} - Total Labels: ${itemsToPrint.reduce((acc, i) => acc + i.count, 0)}</p>
          <div class="barcode-grid">
            ${barcodeHtml}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const selectedCount = Object.keys(selectedItems).length;
  const totalLabels = Object.values(selectedItems).reduce((acc, count) => acc + count, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/inventory">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                Print Barcodes
              </h1>
              <p className="text-muted-foreground">
                Select items and specify quantities for batch printing.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handlePrint('all')}
              disabled={isLoading || items.length === 0}
              data-testid="button-print-all"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print All (1 each)
            </Button>
            <Button
              onClick={() => handlePrint('selected')}
              disabled={isLoading || selectedCount === 0}
              data-testid="button-print-selected"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Selected ({totalLabels})
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Selection Options
            </CardTitle>
            <CardDescription>
              Choose which items to print and how many labels for each.
            </CardDescription>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {selectedCount} items selected | {totalLabels} labels total
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No items in inventory.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <Card 
                    key={item.id} 
                    className={`transition-colors ${selectedItems[item.id] !== undefined ? 'border-primary ring-1 ring-primary' : ''}`}
                    data-testid={`barcode-card-${item.id}`}
                  >
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          id={`check-${item.id}`}
                          checked={selectedItems[item.id] !== undefined}
                          onCheckedChange={() => toggleItem(item.id)}
                        />
                        <div className="grid gap-1">
                          <Label htmlFor={`check-${item.id}`} className="font-semibold text-sm leading-none">
                            {item.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      <div className="flex justify-center bg-white p-2 rounded border">
                        <BarcodeDisplay
                          value={item.barcode}
                          width={1.2}
                          height={50}
                          displayValue={true}
                        />
                      </div>
                      
                      {selectedItems[item.id] !== undefined && (
                        <div className="flex items-center gap-3">
                          <Label htmlFor={`count-${item.id}`} className="text-xs">Copies:</Label>
                          <Input
                            id={`count-${item.id}`}
                            type="number"
                            min="1"
                            max="100"
                            className="h-8"
                            value={selectedItems[item.id]}
                            onChange={(e) => updateCount(item.id, parseInt(e.target.value) || 1)}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hidden area for barcode data extraction */}
        <div ref={printRef} className="hidden">
          {items.map((item) => (
            <div key={item.id} data-barcode-id={item.id}>
              <BarcodeDisplay
                value={item.barcode}
                width={1.5}
                height={60}
                displayValue={true}
              />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
