import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, Package, PlusSquare, LogOut, ScanLine, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [scanInput, setScanInput] = useState('');
  const [isScanOpen, setIsScanOpen] = useState(false);

  const scanMutation = useMutation({
    mutationFn: api.scanBarcode,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      
      if (data.success) {
        toast({
          title: "Scan Successful",
          description: `Scanned: ${data.item?.name}. New Stock: ${data.newStock}`,
          className: "bg-emerald-500 text-white border-none",
        });
        setScanInput('');
        setIsScanOpen(false);
      } else {
        toast({
          title: "Scan Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process scan",
        variant: "destructive",
      });
    },
  });

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    scanMutation.mutate(scanInput);
  };

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/inventory', icon: Package, label: 'Inventory' },
    { href: '/add', icon: PlusSquare, label: 'Add Item' },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex font-sans text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <ScanLine className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">Invento<span className="text-primary">Hub</span></span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t">
            <Dialog open={isScanOpen} onOpenChange={setIsScanOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full justify-start gap-3">
                  <QrCode className="h-4 w-4" />
                  Simulate Scan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Simulate ESP32 Scan</DialogTitle>
                  <DialogDescription>
                    Enter a barcode ID to simulate a scan event from the hardware.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleScan} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Input 
                      placeholder="e.g. ITEM-2025-00012" 
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      autoFocus
                      disabled={scanMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter any barcode from your inventory
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={scanMutation.isPending}>
                      {scanMutation.isPending ? 'Processing...' : 'Process Scan'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </nav>

        <div className="p-4 border-t">
          <Link href="/login" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header (visible on small screens) */}
        <header className="h-16 border-b bg-card flex items-center px-6 md:hidden justify-between">
           <div className="flex items-center">
            <ScanLine className="h-6 w-6 text-primary mr-2" />
            <span className="font-bold text-lg">InventoHub</span>
           </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
