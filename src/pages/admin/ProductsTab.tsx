

// Updated ProductsTab.tsx with live stock from stock_movements table
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Package, Pencil, Plus, SaveIcon, Trash2, X, Minus, Search, History } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StockManager } from './stockmanagement';

interface ProductVariant {
  unit: string;
  price: string;
}

interface ProductWithStock extends Tables<'products'> {
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  actual_stock: number; // Live stock from stock_movements
}

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  created_at: string;
  notes?: string;
}

const ProductsTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const getVariantsFromProduct = (product: Partial<ProductWithStock>) => {
    const incomingVariants = product.variants?.length ? product.variants : [{ unit: product.unit || '', price: product.price || '' }];
    return incomingVariants.map(variant => ({
      unit: variant.unit?.trim() || '',
      price: variant.price?.toString().trim() || ''
    })).filter(variant => variant.unit || variant.price);
  };

  const buildLegacyProductPayload = (product: Partial<ProductWithStock>) => {
    const normalizedVariants = getVariantsFromProduct(product);
    const primaryVariant = normalizedVariants[0] || { unit: product.unit || '', price: product.price || '' };

    return {
      ...product,
      price: primaryVariant.price || '0',
      unit: primaryVariant.unit || 'unit',
    };
  };
  const [stockUpdateProduct, setStockUpdateProduct] = useState<ProductWithStock | null>(null);
  const [stockUpdateQuantity, setStockUpdateQuantity] = useState<number>(0);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
  const [newProduct, setNewProduct] = useState<Partial<ProductWithStock>>({
    title: '', image: '', description: '', full_description: '', 
    ingredients: '', usage_instructions: '', variants: [{ unit: '', price: '' }],
    stock_quantity: 0, min_stock_level: 10, max_stock_level: 100
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMobileTab, setActiveMobileTab] = useState<'overview' | 'manage'>('manage');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Fetch live stock data from stock_movements table
  const { data: stockData = [], isLoading: stockLoading } = useQuery({
    queryKey: ['live-stock'],
    queryFn: async () => {
      // Get the latest stock quantity for each product from stock_movements
      const { data, error } = await supabase
        .from('stock_movements')
        .select('product_id, new_quantity, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by product_id and get the latest stock for each product
      const stockMap = new Map();
      data?.forEach(movement => {
        if (!stockMap.has(movement.product_id)) {
          stockMap.set(movement.product_id, movement.new_quantity);
        }
      });

      return Array.from(stockMap.entries()).map(([product_id, stock]) => ({
        product_id,
        actual_stock: stock
      }));
    },
  });

  // Fetch products with stock information
  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery<ProductWithStock[]>({
    queryKey: ['admin-products', stockData],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, stock_quantity, min_stock_level, max_stock_level')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(product => {
        // Find live stock for this product
        const liveStock = stockData.find(stock => stock.product_id === product.id);
        const actualStock = liveStock ? liveStock.actual_stock : (product.stock_quantity || 0);
        
        return {
          ...product,
          actual_stock: actualStock,
          stock_status: actualStock <= 0 ? 'out_of_stock' :
            actualStock <= (product.min_stock_level || 10) ? 'low_stock' :
              'in_stock'
        };
      }) as ProductWithStock[];
    },
    enabled: !stockLoading, // Wait for stock data to load first
  });

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    
    return products.filter(product => {
      const normalizedSearch = searchTerm.toLowerCase();
      const normalizedVariants = getVariantsFromProduct(product);
      const variantSearch = normalizedVariants.some(variant =>
        variant.unit.toLowerCase().includes(normalizedSearch) ||
        variant.price.toLowerCase().includes(normalizedSearch)
      );

      return product.title.toLowerCase().includes(normalizedSearch) ||
        variantSearch ||
        (product.description && product.description.toLowerCase().includes(normalizedSearch));
    });
  }, [products, searchTerm]);

  // Get low stock products based on live stock
  const lowStockProducts = products.filter(product =>
    product.stock_status === 'low_stock' || product.stock_status === 'out_of_stock'
  );

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: async (product: Partial<ProductWithStock>) => {
      const persistedProduct = buildLegacyProductPayload(product);

      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...persistedProduct,
          stock_quantity: product.stock_quantity || 0,
          min_stock_level: product.min_stock_level || 10,
          max_stock_level: product.max_stock_level || 100
        }])
        .select();

      if (error) throw error;
      
      // Create initial stock movement record if stock > 0
      if (product.stock_quantity && product.stock_quantity > 0) {
        await StockManager.createStockMovement(
          data[0].id,
          'in',
          product.stock_quantity,
          'Initial stock load',
          undefined,
          undefined,
          'Initial stock when product was created'
        );
      }

      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['live-stock'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
      toast({
        title: "Product added",
        description: "The product has been added successfully with stock information."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was a problem adding the product.",
        variant: "destructive"
      });
    }
  });

  // Update product mutation
  const updateProduct = useMutation({
    mutationFn: async (product: ProductWithStock) => {
      const persistedProduct = buildLegacyProductPayload(product);
      const updateFields = {
        title: product.title, image: product.image, price: persistedProduct.price, unit: persistedProduct.unit,
        description: product.description, full_description: product.full_description, 
        ingredients: product.ingredients, usage_instructions: product.usage_instructions, 
        min_stock_level: product.min_stock_level, 
        max_stock_level: product.max_stock_level, updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('products')
        .update(updateFields)
        .eq('id', product.id)
        .select();

      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['live-stock'] });
      toast({
        title: "Product updated",
        description: "The product has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `There was a problem updating the product: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Update stock mutation using StockManager
  const updateStock = useMutation({
    mutationFn: async ({ productId, newQuantity, operation, reason }: { 
      productId: string, 
      newQuantity: number, 
      operation: 'add' | 'subtract' | 'set',
      reason?: string
    }) => {
      const movementType = operation === 'set' ? 'adjustment' : operation === 'add' ? 'in' : 'out';
      const stockReason = reason || `Manual ${operation} operation`;
      
      return await StockManager.createStockMovement(
        productId,
        movementType,
        newQuantity,
        stockReason,
        undefined,
        'manual_adjustment',
        `Stock ${operation} performed by admin`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['live-stock'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
      toast({
        title: "Stock updated",
        description: `Stock has been updated successfully.`
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was a problem updating the stock.",
        variant: "destructive"
      });
    }
  });

  // Delete product mutation
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['live-stock'] });
      toast({
        title: "Product deleted",
        description: "The product has been removed successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was a problem deleting the product.",
        variant: "destructive"
      });
    }
  });

  // Fetch stock history for a product
  const fetchStockHistory = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
        setStockHistory(data || []);
    } catch (error) {
      console.error('Error fetching stock history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch stock history.",
        variant: "destructive"
      });
    }
  };

  // Handler functions
  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      deleteProduct.mutate(productToDelete);
      setConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  const handleStockUpdate = (product: ProductWithStock) => {
    setStockUpdateProduct(product);
    setStockUpdateQuantity(0);
  };

  const handleStockSave = (operation: 'add' | 'subtract' | 'set' | 'add10', productArg?: ProductWithStock) => {
    const productToUpdate = productArg || stockUpdateProduct;
    if (!productToUpdate) return;

    let quantity = stockUpdateQuantity;
    let op = operation;
    let reason = `Manual ${operation}`;

    if (operation === 'add10') {
      quantity = 10;
      op = 'add';
      reason = 'Quick add 10 units';
    }

    updateStock.mutate({
      productId: productToUpdate.id,
      newQuantity: quantity,
      operation: op as 'add' | 'subtract' | 'set',
      reason
    }, {
      onSuccess: () => {
        setStockUpdateProduct(null);
        setStockUpdateQuantity(0);
      }
    });
  };

  const handleViewHistory = async (productId: string) => {
    setViewingHistory(productId);
    await fetchStockHistory(productId);
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out_of_stock': return 'bg-red-100 text-red-800';
      case 'low_stock': return 'bg-yellow-100 text-yellow-800';
      case 'in_stock': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in': return '📈';
      case 'out': return '📉';
      case 'adjustment': return '⚖️';
      default: return '📦';
    }
  };

  const handleVariantChange = (
    variantIndex: number,
    field: 'unit' | 'price',
    value: string,
    source: 'edit' | 'new'
  ) => {
    const targetState = source === 'edit' ? editingProduct : newProduct;
    if (!targetState) return;

    const updatedVariants = [...(targetState.variants || [{ unit: '', price: '' }])];
    updatedVariants[variantIndex] = {
      ...updatedVariants[variantIndex],
      [field]: value
    };

    if (source === 'edit') {
      setEditingProduct(prev => prev ? { ...prev, variants: updatedVariants } : prev);
    } else {
      setNewProduct(prev => ({ ...prev, variants: updatedVariants }));
    }
  };

  const addVariant = (source: 'edit' | 'new') => {
    if (source === 'edit') {
      setEditingProduct(prev => prev ? {
        ...prev,
        variants: [...(prev.variants || []), { unit: '', price: '' }]
      } : prev);
    } else {
      setNewProduct(prev => ({
        ...prev,
        variants: [...(prev.variants || []), { unit: '', price: '' }]
      }));
    }
  };

  const removeVariant = (variantIndex: number, source: 'edit' | 'new') => {
    if (source === 'edit') {
      setEditingProduct(prev => prev ? {
        ...prev,
        variants: (prev.variants || []).filter((_, index) => index !== variantIndex)
      } : prev);
    } else {
      setNewProduct(prev => ({
        ...prev,
        variants: (prev.variants || []).filter((_, index) => index !== variantIndex)
      }));
    }
  };

  const handleEdit = (product: ProductWithStock) => {
    const productCopy = {
      ...product,
      full_description: product.full_description || '',
      ingredients: product.ingredients || '',
      usage_instructions: product.usage_instructions || '',
      variants: product.variants?.length ? product.variants : [{ unit: product.unit || '', price: product.price || '' }],
      stock_quantity: product.actual_stock || 0, // Use live stock for editing
      min_stock_level: product.min_stock_level || 10,
      max_stock_level: product.max_stock_level || 100
    };

    setEditingProduct(productCopy);
    setIsAddingNew(false);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!editingProduct) return;

    const { name, value, type } = e.target;
    let processedValue: any = value;

    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }

    setEditingProduct(prev => ({
      ...prev!,
      [name]: processedValue
    }));
  };

  const handleSaveEdit = () => {
    if (!editingProduct) return;

    const normalizedVariants = getVariantsFromProduct(editingProduct);
    const hasValidVariants = normalizedVariants.length > 0 && normalizedVariants.every(variant => variant.unit && variant.price);

    if (!editingProduct.title || !hasValidVariants) {
      toast({
        title: "Validation Error",
        description: "Title and at least one complete quantity variant are required.",
        variant: "destructive"
      });
      return;
    }

    updateProduct.mutate({
      ...editingProduct,
      variants: normalizedVariants
    }, {
      onSuccess: () => {
        setEditingProduct(null);
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
  };

  const handleNewProductChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setNewProduct({
      ...newProduct,
      [e.target.name]: value
    });
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setNewProduct({
      title: '', image: '', description: '', full_description: '',
      ingredients: '', usage_instructions: '', variants: [{ unit: '', price: '' }], stock_quantity: 0, min_stock_level: 10, max_stock_level: 100
    });
  };

  const handleSaveNew = () => {
    const normalizedVariants = getVariantsFromProduct(newProduct);
    const hasValidVariants = normalizedVariants.length > 0 && normalizedVariants.every(variant => variant.unit && variant.price);

    if (!newProduct.title || !hasValidVariants) {
      toast({
        title: "Missing information",
        description: "Please fill in at least the title and one complete quantity variant.",
        variant: "destructive"
      });
      return;
    }

    const productToAdd = {
      ...newProduct,
      title: newProduct.title ?? '',
      image: newProduct.image ?? 'https://images.unsplash.com/photo-1550583724-b2692b85b150?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
      variants: normalizedVariants,
      description: newProduct.description ?? '',
      stock_quantity: newProduct.stock_quantity ?? 0,
      min_stock_level: newProduct.min_stock_level ?? 10,
      max_stock_level: newProduct.max_stock_level ?? 100
    };

    createProduct.mutate(productToAdd, {
      onSuccess: () => {
        setIsAddingNew(false);
        setNewProduct({ 
          title: '', image: '', description: '', full_description: '', 
          ingredients: '', usage_instructions: '', variants: [{ unit: '', price: '' }],
          stock_quantity: 0, min_stock_level: 10, max_stock_level: 100 
        });
      }
    });
  };

  // Set up real-time subscriptions
  useEffect(() => {
    const subscription = supabase
      .channel('admin_products_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['live-stock'] });
          queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
          queryClient.invalidateQueries({ queryKey: ['live-stock'] });
          
          // Show toast notification for stock changes
          if (payload.eventType === 'INSERT') {
            const movement = payload.new as StockMovement;
            if (movement.movement_type === 'out' && movement.reason.includes('order')) {
              toast({
                title: "Stock Updated",
                description: `Stock reduced due to new order - ${movement.reason}`,
                variant: "default"
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          queryClient.invalidateQueries({ queryKey: ['live-stock'] });
          
          // Show toast for order-related stock changes
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Order Received",
              description: "Stock levels have been updated automatically",
              variant: "default"
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, toast]);

  const isLoading = productsLoading || stockLoading;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-base md:text-xl lg:text-2xl font-semibold text-gray-800">Products & Stock Management</h2>
        {!isAddingNew && (
          <Button 
            onClick={() => {
              setIsAddingNew(true);
              setEditingProduct(null);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hidden md:flex"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Product
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search products by name, unit, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-600">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Mobile-only sub-tabs */}
      <div className="mb-6 md:hidden">
        <div className="flex justify-between bg-gray-100 p-1 rounded-md shadow-sm">
          <button
            onClick={() => setActiveMobileTab('overview')}
            className={`flex-1 text-xs md:text-sm font-medium py-2 px-2 whitespace-nowrap rounded-l-lg transition-all duration-200
              ${activeMobileTab === 'overview'
                ? 'bg-teal-500 shadow-md'
                : 'text-black bg-teal-100 hover:bg-blue-200'
              }`}
          >
            Stock Overview
          </button>
          <button
            onClick={() => setActiveMobileTab('manage')}
            className={`flex-1 text-xs md:text-sm font-medium py-2 px-2 whitespace-nowrap rounded-r-lg transition-all duration-200
              ${activeMobileTab === 'manage'
                ? 'bg-teal-500 shadow-md'
                : 'text-black bg-teal-100 hover:bg-blue-100'
              }`}
          >
            Manage Products
          </button>
        </div>
      </div>

      {/* Mobile Add Product Button */}
      {!isAddingNew && (
        <div className="mb-4 md:hidden">
          {activeMobileTab === 'manage' && (
            <Button 
              onClick={() => {
                setActiveMobileTab('manage');
                setIsAddingNew(true);
                setEditingProduct(null);
              }}
              className="w-full bg-indigo-400 border border-indigo-500 hover:bg-blue-700 text-black shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Product
            </Button>
          )}
        </div>
      )}

      {/* Stock Alerts Section */}
      <div className={`${activeMobileTab === 'overview' ? 'block' : 'hidden'} md:block`}>
        {lowStockProducts.length > 0 && (
          <div className="mb-6 p-3 md:p-4 bg-gradient-to-r from-yellow-100 to-orange-200 border border-black rounded-lg shadow-sm">
            <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center text-yellow-800">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 mr-2 text-yellow-600" />
              <span className="text-sm md:text-base">Stock Alerts ({lowStockProducts.length} items)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
              {lowStockProducts.map(product => (
                <div key={product.id} className="flex justify-between items-center p-2 md:p-3 bg-white rounded-lg shadow-sm border border-yellow-700">
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-md flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 text-xs md:text-sm block truncate">{product.title}</span>
                      <div className="flex flex-col gap-0.5 mt-0.5 md:mt-1">
                        {(getVariantsFromProduct(product)).map((variant, index) => (
                          <span key={`${product.id}-alert-variant-${index}`} className="text-xs text-gray-600">
                            {variant.unit || 'unit'} · ₹{variant.price || '0'}
                          </span>
                        ))}
                        <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs font-medium ${getStockStatusColor(product.stock_status)}`}>
                         Live Stock: {product.actual_stock}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleStockUpdate(product)}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white border border-black rounded-lg p-1.5 md:p-2 shadow-sm flex-shrink-0"
                    >
                      <Package className="w-3 h-3 md:w-4 md:h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleViewHistory(product.id)}
                      className="text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-lg p-1.5 md:p-2 shadow-sm flex-shrink-0"
                    >
                      <History className="w-3 h-3 md:w-4 md:h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Products Table/Cards */}
      <div className={`${activeMobileTab === 'manage' ? 'block' : 'hidden'} md:block`}>
        {/* Add New Product Form */}
        {isAddingNew && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 md:p-6 border border-gray-900 rounded-lg bg-gray-300"
          >
            <h3 className="text-lg font-medium mb-4 text-gray-800">Add New Product</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 border-b border-gray-900 pb-4">
              <div>
                <label htmlFor="new-title" className="block text-sm font-medium mb-1 text-gray-700">Title *</label>
                <Input
                  id="new-title"
                  name="title"
                  value={newProduct.title ?? ''}
                  onChange={handleNewProductChange}
                  placeholder="Product title"
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="new-image" className="block text-sm font-medium mb-1 text-gray-700">Image URL</label>
                <Input
                  id="new-image"
                  name="image"
                  value={newProduct.image ?? ''}
                  onChange={handleNewProductChange}
                  placeholder="https://example.com/image.jpg"
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Variants *</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addVariant('new')}
                    className="border-gray-900 text-gray-900"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Variant
                  </Button>
                </div>
                <div className="space-y-2">
                  {(newProduct.variants || [{ unit: '', price: '' }]).map((variant, index) => (
                    <div key={`new-variant-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <Input
                        value={variant.unit ?? ''}
                        onChange={(e) => handleVariantChange(index, 'unit', e.target.value, 'new')}
                        placeholder="Unit (e.g. 1 L)"
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                      <Input
                        value={variant.price ?? ''}
                        onChange={(e) => handleVariantChange(index, 'price', e.target.value, 'new')}
                        placeholder="Price (₹)"
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeVariant(index, 'new')}
                        className="border-red-500 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock Management Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <label htmlFor="new-stock-quantity" className="block text-sm font-medium mb-1 text-blue-800">Initial Stock Quantity</label>
                <Input
                  id="new-stock-quantity"
                  name="stock_quantity"
                  type="number"
                  min="0"
                  value={newProduct.stock_quantity ?? 0}
                  onChange={handleNewProductChange}
                  placeholder="0"
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="new-min-stock" className="block text-sm font-medium mb-1 text-blue-800">Minimum Stock Level</label>
                <Input
                  id="new-min-stock"
                  name="min_stock_level"
                  type="number"
                  min="0"
                  value={newProduct.min_stock_level ?? 10}
                  onChange={handleNewProductChange}
                  placeholder="10"
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="new-max-stock" className="block text-sm font-medium mb-1 text-blue-800">Maximum Stock Level</label>
                <Input
                  id="new-max-stock"
                  name="max_stock_level"
                  type="number"
                  min="0"
                  value={newProduct.max_stock_level ?? 100}
                  onChange={handleNewProductChange}
                  placeholder="100"
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="new-description" className="block text-sm font-medium mb-1 text-gray-700">Short Description</label>
              <Textarea
                id="new-description"
                name="description"
                value={newProduct.description ?? ''}
                onChange={handleNewProductChange}
                placeholder="Brief description for product card"
                rows={2}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-gray-200">
              <Button
                onClick={handleSaveNew}
                disabled={createProduct.isPending}
                className="bg-green-600 hover:bg-green-700 text-white shadow-sm w-full md:w-auto"
              >
                <SaveIcon className="w-4 h-4 mr-2" />
                {createProduct.isPending ? 'Saving...' : 'Save Product'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelNew}
                className="border-gray-300 hover:bg-gray-50 w-full md:w-auto"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stock Update Modal/Dialog */}
        {stockUpdateProduct && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Update Stock: {stockUpdateProduct.title}
              </h3>
              
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600">Current Live Stock:</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${getStockStatusColor(stockUpdateProduct.stock_status)}`}>
                    {stockUpdateProduct.actual_stock} units
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="stock-quantity" className="block text-sm font-medium mb-2 text-gray-700">
                  Quantity to Add/Subtract/Set
                </label>
                <Input
                  id="stock-quantity"
                  type="number"
                  value={stockUpdateQuantity}
                  onChange={(e) => setStockUpdateQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2 mb-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleStockSave('add')}
                    disabled={updateStock.isPending || stockUpdateQuantity <= 0}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    Add (+{stockUpdateQuantity})
                  </Button>
                  <Button
                    onClick={() => handleStockSave('subtract')}
                    disabled={updateStock.isPending || stockUpdateQuantity <= 0}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm"
                  >
                    Subtract (-{stockUpdateQuantity})
                  </Button>
                </div>
                <Button
                  onClick={() => handleStockSave('set')}
                  disabled={updateStock.isPending || stockUpdateQuantity < 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                  Set to {stockUpdateQuantity}
                </Button>
                <Button
                  onClick={() => handleStockSave('add10', stockUpdateProduct)}
                  disabled={updateStock.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-sm"
                >
                  Quick Add +10
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStockUpdateProduct(null);
                    setStockUpdateQuantity(0);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stock History Modal */}
        {viewingHistory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Stock Movement History</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewingHistory(null);
                    setStockHistory([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="overflow-y-auto max-h-96">
                {stockHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No stock movements recorded for this product.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stockHistory.map((movement) => (
                      <div key={movement.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getMovementIcon(movement.movement_type)}</span>
                            <span className="font-medium capitalize text-gray-800">
                              {movement.movement_type === 'in' ? 'Stock In' : 
                               movement.movement_type === 'out' ? 'Stock Out' : 'Adjustment'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(movement.created_at).toLocaleDateString()} {new Date(movement.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Quantity: </span>
                            <span className={`font-medium ${movement.movement_type === 'in' ? 'text-green-600' : 
                              movement.movement_type === 'out' ? 'text-red-600' : 'text-blue-600'}`}>
                              {movement.movement_type === 'in' ? '+' : movement.movement_type === 'out' ? '-' : ''}
                              {movement.quantity}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Change: </span>
                            <span className="font-medium">
                              {movement.previous_quantity} → {movement.new_quantity}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="text-gray-600 text-sm">Reason: </span>
                          <span className="text-sm">{movement.reason}</span>
                        </div>
                        {movement.notes && (
                          <div className="mt-1">
                            <span className="text-gray-600 text-sm">Notes: </span>
                            <span className="text-sm text-gray-700">{movement.notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-500 bg-blue-100 transition ease-in-out duration-150">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading products and live stock data...
            </div>
          </div>
        ) : productsError ? (
          <div className="text-center py-12">
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 inline-block">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
              Error loading products: {productsError.message}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-900 shadow-sm">
            {/* Mobile: Card layout, Desktop: Table layout */}
            <div className="md:hidden">
              {filteredProducts.map((product, index) => (
                <div key={product.id} className="border-b-2 border-gray-300 p-4 bg-white shadow-sm">
                  {editingProduct?.id === product.id ? (
                    // Mobile Edit Form
                    <div>
                      <div className="mb-2">
                        <label className="block text-xs font-medium mb-1 text-gray-700">Title *</label>
                        <Input
                          name="title"
                          value={editingProduct.title}
                          onChange={handleEditChange}
                          className="font-medium focus:ring-2 focus:ring-blue-500"
                          placeholder="Product title"
                        />
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-gray-700">Variants *</label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addVariant('edit')}
                            className="border-gray-900 text-gray-900 h-8 px-2"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(editingProduct.variants || [{ unit: '', price: '' }]).map((variant, index) => (
                            <div key={`edit-variant-${index}`} className="grid grid-cols-2 gap-2 items-center">
                              <Input
                                value={variant.unit ?? ''}
                                onChange={(e) => handleVariantChange(index, 'unit', e.target.value, 'edit')}
                                placeholder="Unit"
                                className="focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex gap-2">
                                <Input
                                  value={variant.price ?? ''}
                                  onChange={(e) => handleVariantChange(index, 'price', e.target.value, 'edit')}
                                  placeholder="Price"
                                  className="focus:ring-2 focus:ring-blue-500"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeVariant(index, 'edit')}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Stock fields for mobile edit */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-blue-800">Min Level</label>
                          <Input
                            name="min_stock_level"
                            type="number"
                            min="0"
                            value={editingProduct.min_stock_level}
                            onChange={handleEditChange}
                            className="focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-blue-800">Max Level</label>
                          <Input
                            name="max_stock_level"
                            type="number"
                            min="0"
                            value={editingProduct.max_stock_level}
                            onChange={handleEditChange}
                            className="focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="mb-2">
                        <label className="block text-xs font-medium mb-1 text-gray-700">Description</label>
                        <Textarea
                          name="description"
                          value={editingProduct.description || ''}
                          onChange={handleEditChange}
                          rows={2}
                          placeholder="Product description"
                          className="text-sm"
                        />
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={updateProduct.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white flex-1 text-xs px-2"
                        >
                          <SaveIcon className="w-3 h-3 mr-1" />
                          {updateProduct.isPending ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="border-gray-300 hover:bg-gray-50 flex-1 text-xs px-2"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Mobile Product Card View
                    <div>
                      <div className="flex items-start gap-3 mb-3">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{product.title}</h3>
                          <div className="space-y-1 mb-1">
                            {(getVariantsFromProduct(product)).map((variant, index) => (
                              <div key={`${product.id}-mobile-variant-${index}`} className="flex items-center gap-2">
                                <span className="text-sm font-medium text-green-600">₹{variant.price || '0'}</span>
                                <span className="text-xs text-gray-500">per {variant.unit || 'unit'}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatusColor(product.stock_status)}`}>
                                     {product.actual_stock}
                            </span>
                            <span className="text-xs text-gray-500">
                              Min: {product.min_stock_level} | Max: {product.max_stock_level}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {product.description && (
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleEdit(product)}
                          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 flex-1"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStockUpdate(product)}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 flex-1"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          Stock
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleViewHistory(product.id)}
                          className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-2 py-1"
                        >
                          <History className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDeleteClick(product.id)}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Product Details</TableHead>
                    <TableHead className="w-32">Price & Unit</TableHead>
                    <TableHead className="w-40">Live Stock Status</TableHead>
                    <TableHead className="w-32">Stock Levels</TableHead>
                    <TableHead className="w-48">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <TableCell>
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      </TableCell>
                      <TableCell>
                        {editingProduct?.id === product.id ? (
                          <div className="space-y-2">
                            <Input
                              name="title"
                              value={editingProduct.title}
                              onChange={handleEditChange}
                              className="font-medium"
                              placeholder="Product title"
                            />
                            <Textarea
                              name="description"
                              value={editingProduct.description || ''}
                              onChange={handleEditChange}
                              rows={2}
                              placeholder="Product description"
                              className="text-sm"
                            />
                          </div>
                        ) : (
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">{product.title}</h3>
                            {product.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingProduct?.id === product.id ? (
                          <div className="space-y-2">
                            {(editingProduct.variants || [{ unit: '', price: '' }]).map((variant, index) => (
                              <div key={`desktop-edit-variant-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-1 items-center">
                                <Input
                                  value={variant.unit ?? ''}
                                  onChange={(e) => handleVariantChange(index, 'unit', e.target.value, 'edit')}
                                  placeholder="Unit"
                                />
                                <Input
                                  value={variant.price ?? ''}
                                  onChange={(e) => handleVariantChange(index, 'price', e.target.value, 'edit')}
                                  placeholder="Price"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeVariant(index, 'edit')}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addVariant('edit')}
                              className="border-gray-900 text-gray-900"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Variant
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {(getVariantsFromProduct(product)).map((variant, index) => (
                              <div key={`${product.id}-variant-${index}`} className="text-sm">
                                <div className="font-medium text-green-600">₹{variant.price || '0'}</div>
                                <div className="text-gray-500">per {variant.unit || 'unit'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-full text-sm font-medium ${getStockStatusColor(product.stock_status)} inline-block w-fit`}>
                           {product.actual_stock} units
                          </span>
                          <span className="text-xs text-gray-500 capitalize">
                            {product.stock_status.replace('_', ' ')}
                          </span>
                          {product.actual_stock !== product.stock_quantity && (
                            <span className="text-xs text-orange-600">
                              (DB: {product.stock_quantity})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingProduct?.id === product.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-1">
                              <Input
                                name="min_stock_level"
                                type="number"
                                min="0"
                                value={editingProduct.min_stock_level}
                                onChange={handleEditChange}
                                placeholder="Min"
                                className="text-xs"
                              />
                              <Input
                                name="max_stock_level"
                                type="number"
                                min="0"
                                value={editingProduct.max_stock_level}
                                onChange={handleEditChange}
                                placeholder="Max"
                                className="text-xs"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm">
                            <div>Min: {product.min_stock_level}</div>
                            <div>Max: {product.max_stock_level}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingProduct?.id === product.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={updateProduct.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <SaveIcon className="w-4 h-4 mr-1" />
                              {updateProduct.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="border-gray-300 hover:bg-gray-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleEdit(product)}
                              className="bg-blue-500 hover:bg-blue-600 text-white"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleStockUpdate(product)}
                              className="bg-green-500 hover:bg-green-600 text-white"
                            >
                              <Package className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleViewHistory(product.id)}
                              className="bg-gray-500 hover:bg-gray-600 text-white"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDeleteClick(product.id)}
                              className="bg-red-500 hover:bg-red-600 text-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first product.'}
                  </p>
                  {!searchTerm && (
                    <Button
                      onClick={() => setIsAddingNew(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Product
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone and will remove all associated stock movement history."
        confirmText="Delete Product"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};

export default ProductsTab;
