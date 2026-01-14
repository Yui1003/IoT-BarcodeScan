import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import AddItem from "@/pages/add-item";
import Login from "@/pages/login";
import Transactions from "@/pages/transactions";
import PrintBarcodes from "@/pages/print-barcodes";
import ScannerModePage from "@/pages/scanner-mode";
import EmailSettings from "@/pages/email-settings";

function Router() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated && location !== '/login') {
      setLocation('/login');
    }
  }, [location, setLocation]);

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/add" component={AddItem} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/print-barcodes" component={PrintBarcodes} />
      <Route path="/mode" component={ScannerModePage} />
      <Route path="/settings/email" component={EmailSettings} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
