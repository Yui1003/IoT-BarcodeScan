import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Layout from '@/components/layout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Plus, Loader2, Download, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BarcodeDisplay, { type BarcodeDisplayHandle } from '@/components/barcode-display';
import { useLocation } from 'wouter';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  category: z.string().min(1, 'Please enter a category'),
  quantity: z.coerce.number().min(0, 'Quantity must be positive'),
});

export default function AddItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [generatedBarcode, setGeneratedBarcode] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const categoryInputRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<BarcodeDisplayHandle>(null);

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: api.getItems,
  });

  const existingCategories = Array.from(new Set(items.map(item => item.category)));
  const filteredCategories = existingCategories.filter(cat => 
    cat.toLowerCase().includes(categoryFilter.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryInputRef.current && !categoryInputRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateNewBarcode = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const code = `ITEM-${new Date().getFullYear()}-${randomNum}`;
    setGeneratedBarcode(code);
    return code;
  };

  if (!generatedBarcode) {
    generateNewBarcode();
  }

  const addMutation = useMutation({
    mutationFn: api.addItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: "Item Added",
        description: "The item has been successfully added to inventory.",
      });
      setLocation('/inventory');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: '',
      quantity: 0,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    addMutation.mutate({
      name: values.name,
      category: values.category,
      quantity: values.quantity,
      barcode: generatedBarcode,
    });
  }

  const handleDownloadBarcode = () => {
    if (barcodeRef.current && generatedBarcode) {
      barcodeRef.current.downloadPNG(`barcode-${generatedBarcode}`);
      toast({
        title: "Barcode Downloaded",
        description: "The barcode image has been saved to your downloads.",
      });
    }
  };

  const handleCategorySelect = (category: string) => {
    form.setValue('category', category);
    setCategoryFilter(category);
    setShowCategoryDropdown(false);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Add New Item</h1>
          <p className="text-muted-foreground">Register new products into the system.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Item Details</CardTitle>
                <CardDescription>Enter product information below.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Arduino Uno" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                              <div ref={categoryInputRef} className="relative">
                                <div className="relative">
                                  <Input 
                                    placeholder="e.g. Electronics, Sensors" 
                                    {...field}
                                    value={field.value}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setCategoryFilter(e.target.value);
                                      setShowCategoryDropdown(true);
                                    }}
                                    onFocus={() => setShowCategoryDropdown(true)}
                                    autoComplete="off"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                  >
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </div>
                                {showCategoryDropdown && filteredCategories.length > 0 && (
                                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                                    {filteredCategories.map((cat) => (
                                      <button
                                        key={cat}
                                        type="button"
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                                        onClick={() => handleCategorySelect(cat)}
                                      >
                                        {cat}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                      <Button variant="outline" type="button" onClick={() => setLocation('/')}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addMutation.isPending}>
                        {addMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Barcode</CardTitle>
                <CardDescription>Auto-generated ID</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-4">
                {generatedBarcode && (
                  <div className="w-full flex justify-center overflow-hidden">
                    <BarcodeDisplay 
                      ref={barcodeRef} 
                      value={generatedBarcode} 
                      width={1.5} 
                      height={60} 
                    />
                  </div>
                )}
                <div className="text-center">
                  <p className="font-mono text-sm font-bold">{generatedBarcode}</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button 
                  variant="default" 
                  className="w-full" 
                  onClick={handleDownloadBarcode}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => generateNewBarcode()}
                >
                  Regenerate ID
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
