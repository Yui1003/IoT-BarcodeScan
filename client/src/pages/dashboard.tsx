import { useQuery } from '@tanstack/react-query';
import { api, type Item } from '@/lib/api';
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, CheckCircle, Ban, FileSpreadsheet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const calculateStatus = (quantity: number, originalStock: number): 'healthy' | 'low' | 'out_of_stock' => {
  if (quantity === 0) return 'out_of_stock';
  const percentage = (quantity / originalStock) * 100;
  if (percentage >= 50) return 'healthy';
  return 'low';
};

const COLORS = {
  healthy: '#10b981',
  low: '#f59e0b',
  outOfStock: '#ef4444',
};

export default function Dashboard() {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: api.getItems,
    refetchInterval: 5000,
  });

  const itemsWithStatus = items.map(item => ({
    ...item,
    status: calculateStatus(item.quantity, item.originalStock),
  }));

  const stats = {
    totalItems: itemsWithStatus.length,
    healthy: itemsWithStatus.filter(i => i.status === 'healthy').length,
    low: itemsWithStatus.filter(i => i.status === 'low').length,
    outOfStock: itemsWithStatus.filter(i => i.status === 'out_of_stock').length,
  };

  const statusData = [
    { name: 'Healthy', value: stats.healthy, color: COLORS.healthy },
    { name: 'Low Stock', value: stats.low, color: COLORS.low },
    { name: 'Out of Stock', value: stats.outOfStock, color: COLORS.outOfStock },
  ].filter(item => item.value > 0);

  const categoryDataMap = itemsWithStatus.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryDataMap).map(([name, value]) => ({
    name,
    value,
  }));

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

  const statCards = [
    {
      title: 'Total Items',
      value: stats.totalItems,
      icon: Package,
      description: 'Total products in inventory',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Healthy Stock',
      value: stats.healthy,
      icon: CheckCircle,
      description: 'Items with sufficient quantity',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Low Stock',
      value: stats.low,
      icon: AlertTriangle,
      description: 'Items needing restock',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'Out of Stock',
      value: stats.outOfStock,
      icon: Ban,
      description: 'Items completely depleted',
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Real-time overview of your inventory status.</p>
        </div>
        <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ 
                        borderRadius: '8px', 
                        border: '1px solid hsl(var(--border))', 
                        background: 'hsl(var(--popover))', 
                        color: 'hsl(var(--popover-foreground))' 
                      }} 
                    />
                    <Bar 
                      dataKey="value" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                      name="Quantity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock Health Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {items.length > 0 ? (
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={2}
                          stroke="hsl(var(--background))"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '8px', 
                            border: '1px solid hsl(var(--border))', 
                            background: 'hsl(var(--popover))', 
                            color: 'hsl(var(--popover-foreground))' 
                          }}
                          formatter={(value: number) => [`${value} items`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.healthy }} />
                      <span className="text-sm">Healthy ({stats.healthy})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.low }} />
                      <span className="text-sm">Low ({stats.low})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.outOfStock }} />
                      <span className="text-sm">Out ({stats.outOfStock})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No items in inventory
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
