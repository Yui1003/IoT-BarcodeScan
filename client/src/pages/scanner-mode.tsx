import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings2, Plus, Minus, Eye, Save, Loader2 } from 'lucide-react';
import Layout from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/use-websocket';

interface ScannerMode {
  mode: 'INCREMENT' | 'DECREMENT' | 'DETAILS';
  quantity: number;
}

export default function ScannerModePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState<ScannerMode['mode']>('DECREMENT');
  const [quantity, setQuantity] = useState(1);

  const { data: scannerMode, isLoading } = useQuery<ScannerMode>({
    queryKey: ['/api/scanner-mode'],
  });

  useWebSocket({
    onMessage: (message: { type: string; data: unknown }) => {
      if (message.type === 'scanner_mode_update') {
        queryClient.setQueryData(['/api/scanner-mode'], message.data as ScannerMode);
      }
    },
  });

  useEffect(() => {
    if (scannerMode) {
      setSelectedMode(scannerMode.mode);
      setQuantity(scannerMode.quantity);
    }
  }, [scannerMode]);

  const updateModeMutation = useMutation({
    mutationFn: async (data: ScannerMode) => {
      return apiRequest('PUT', '/api/scanner-mode', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scanner-mode'] });
      toast({
        title: 'Mode Updated',
        description: `Scanner mode set to ${selectedMode === 'INCREMENT' ? 'Increment' : selectedMode === 'DECREMENT' ? 'Decrement' : 'Show Details'}${selectedMode !== 'DETAILS' ? ` by ${quantity}` : ''}`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update scanner mode',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateModeMutation.mutate({
      mode: selectedMode,
      quantity: selectedMode === 'DETAILS' ? 1 : quantity,
    });
  };

  const modeDescriptions = {
    INCREMENT: 'Each barcode scan will ADD the specified quantity to the item stock.',
    DECREMENT: 'Each barcode scan will REMOVE the specified quantity from the item stock.',
    DETAILS: 'Each barcode scan will only display item details without changing stock.',
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Scanner Mode
          </h1>
          <p className="text-muted-foreground">
            Configure how the barcode scanner affects inventory.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Scan Mode Settings
            </CardTitle>
            <CardDescription>
              Choose what happens when a barcode is scanned by the ESP32 device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <RadioGroup
                  value={selectedMode}
                  onValueChange={(value) => setSelectedMode(value as ScannerMode['mode'])}
                  className="space-y-4"
                >
                  <div className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSelectedMode('INCREMENT')}>
                    <RadioGroupItem value="INCREMENT" id="increment" className="mt-1" data-testid="radio-increment" />
                    <div className="flex-1">
                      <Label htmlFor="increment" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Plus className="h-4 w-4 text-emerald-500" />
                        Increment Stock
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {modeDescriptions.INCREMENT}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSelectedMode('DECREMENT')}>
                    <RadioGroupItem value="DECREMENT" id="decrement" className="mt-1" data-testid="radio-decrement" />
                    <div className="flex-1">
                      <Label htmlFor="decrement" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Minus className="h-4 w-4 text-red-500" />
                        Decrement Stock
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {modeDescriptions.DECREMENT}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSelectedMode('DETAILS')}>
                    <RadioGroupItem value="DETAILS" id="details" className="mt-1" data-testid="radio-details" />
                    <div className="flex-1">
                      <Label htmlFor="details" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Eye className="h-4 w-4 text-blue-500" />
                        Show Details Only
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {modeDescriptions.DETAILS}
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {selectedMode !== 'DETAILS' && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="quantity">
                      Quantity to {selectedMode === 'INCREMENT' ? 'Add' : 'Remove'} per Scan
                    </Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="quantity"
                        type="number"
                        min={1}
                        max={1000}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-32"
                        data-testid="input-quantity"
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedMode === 'INCREMENT' ? '+' : '-'}{quantity} per scan
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Current Mode: </span>
                      <span className="font-medium">
                        {scannerMode?.mode === 'INCREMENT' && `Increment by ${scannerMode.quantity}`}
                        {scannerMode?.mode === 'DECREMENT' && `Decrement by ${scannerMode.quantity}`}
                        {scannerMode?.mode === 'DETAILS' && 'Show Details Only'}
                        {!scannerMode && 'Not set'}
                      </span>
                    </div>
                    <Button
                      onClick={handleSave}
                      disabled={updateModeMutation.isPending}
                      data-testid="button-save-mode"
                    >
                      {updateModeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Mode
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The scanner mode determines what action is performed when a barcode is scanned by your ESP32 device.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-foreground">Increment:</strong> Ideal for receiving new stock or restocking items.
              </li>
              <li>
                <strong className="text-foreground">Decrement:</strong> Ideal for checkout, consumption, or issuing items.
              </li>
              <li>
                <strong className="text-foreground">Show Details:</strong> Ideal for checking item information without affecting stock.
              </li>
            </ul>
            <p>
              All scans are logged in the Transaction History regardless of the mode selected.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
