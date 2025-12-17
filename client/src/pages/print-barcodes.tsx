import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import Layout from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import BarcodeDisplay from '@/components/barcode-display';

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

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>All Barcodes - InventoHub</title>
          <style>
            @media print {
              @page {
                margin: 0.5in;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20px;
            }
            h1 {
              text-align: center;
              margin-bottom: 10px;
              font-size: 24px;
            }
            .subtitle {
              text-align: center;
              color: #666;
              margin-bottom: 30px;
              font-size: 14px;
            }
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
            .barcode-item h3 {
              margin: 0 0 5px 0;
              font-size: 14px;
              font-weight: 600;
            }
            .barcode-item p {
              margin: 0 0 10px 0;
              font-size: 12px;
              color: #666;
            }
            .barcode-item canvas {
              max-width: 100%;
              height: auto;
            }
            @media print {
              .barcode-item {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <h1>InventoHub - All Barcodes</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleString()} - Total Items: ${items.length}</p>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

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
                Print All Barcodes
              </h1>
              <p className="text-muted-foreground">
                Preview and print all inventory barcodes in a single document.
              </p>
            </div>
          </div>
          <Button
            onClick={handlePrint}
            disabled={isLoading || items.length === 0}
            data-testid="button-print-all"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print All ({items.length})
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Barcode Preview
            </CardTitle>
            <CardDescription>
              All barcodes will be arranged in a printable grid format.
            </CardDescription>
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
                <p className="text-sm">Add items to generate barcodes.</p>
              </div>
            ) : (
              <div
                ref={printRef}
                className="barcode-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="barcode-item border rounded-lg p-4 text-center bg-white"
                    data-testid={`barcode-card-${item.id}`}
                  >
                    <h3 className="font-semibold text-sm mb-1 text-foreground">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{item.category}</p>
                    <BarcodeDisplay
                      value={item.barcode}
                      width={1.5}
                      height={60}
                      displayValue={true}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
