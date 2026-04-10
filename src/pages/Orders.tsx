// import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle, ChevronDown, ChevronUp, Clock, Package, Truck, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Define order status colors and icons
const STATUS_CONFIG = {
  pending: {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock,
    label: 'Cash on Delivery'
  },
  paid: {
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
    label: 'Paid'
  },
  shipped: {
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Truck,
    label: 'Shipped'
  },
  delivered: {
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: Package,
    label: 'Delivered'
  },
  failed: {
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
    label: 'Failed'
  }
};

// Payment method labels
const PAYMENT_METHODS = {
  cod: 'Cash on Delivery',
  online: 'Online Payment',
  card: 'Card Payment',
  upi: 'UPI Payment',
  wallet: 'Wallet Payment'
};

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  products?: {
    title: string;
    image?: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  payment_method: string;
  delivery_otp: string | null;
  order_items: OrderItem[];
}

const Orders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [selectedOtp, setSelectedOtp] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);

  const handleShowOtp = (otp: string) => {
    setSelectedOtp(otp);
    setShowOtpModal(true);
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Fetch user's orders with order items and try to get product details
  const { data: orders, isLoading, error } = useQuery<Order[], Error>({
    queryKey: ['orders', user?.id],
    queryFn: async (): Promise<Order[]> => {
      if (!user) return [];

      try {
        // First try to fetch orders with product details
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id, 
            order_number,
            total, 
            status, 
            created_at,
            name,
            email,
            phone,
            address,
            city,
            state,
            zip_code,
            payment_method,
            delivery_otp,
            order_items (
              id, 
              product_id, 
              quantity, 
              price,
              products (
                title,
                image
              )
            )
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error with product relationship:', error);

          // Fallback: fetch orders without product details
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('orders')
            .select(`
              id, 
              order_number,
              total, 
              status, 
              created_at,
              name,
              email,
              phone,
              address,
              city,
              state,
              zip_code,
              payment_method,
              delivery_otp,
              order_items (
                id, 
                product_id, 
                quantity, 
                price
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (fallbackError) throw fallbackError;
          return (fallbackData || []) as unknown as Order[];      // Remove "unknown" when order_number is fixed, since its sending null
        }
        console.log(data);

        return (data || []) as unknown as Order[];      // Remove "unknown" when order_number is fixed, since its sending null
      } catch (err) {
        console.error('Query error:', err);
        throw err;
      }
    },
    enabled: !!user
  });

  // Fetch product details separately if needed
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, image');

      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!orders && orders.length > 0
  });

  // Create a product lookup map
  const productMap = React.useMemo(() => {
    if (!products) return {};
    return products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as Record<string, any>);
  }, [products]);

  if (isLoading) {
    return (
      <div className="pt-28 pb-20 section-container flex justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-28 pb-20 section-container flex justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Unable to load orders</p>
          <p className="text-gray-600 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="pt-28 pb-20 section-container flex flex-col items-center">
        <Package className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Orders Yet</h2>
        <p className="text-gray-600 mb-6">You haven't placed any orders yet. Start shopping to see your orders here.</p>
        <Button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-700">
          Start Shopping
        </Button>
      </div>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="pt-16 pb-20 bg-gray-50 min-h-screen"
    >
      <div className="section-container">
        <div className="mb-4">
          <h1 className="text-3xl font-display font-bold text-gray-900 mb-1">My Orders</h1>
          <p className="text-gray-600 text-base">Track and manage your orders</p>
        </div>

        <div className="space-y-4">
          {orders.map((order) => {
            const orderDate = new Date(order?.created_at);
            const totalItems = order?.order_items.reduce(
              (sum, item) => sum + item.quantity,
              0
            );
            const statusConfig = STATUS_CONFIG[order?.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedOrders.has(order?.id);

            return (
              <Card key={order?.id} className="w-full shadow-sm border-gray-500 hover:shadow-md transition-shadow hover:border-gray-900 hover:bg-gray-300">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="mb-2">
                        <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-left">
                          <div className="flex flex-col items-start">
                            <CardTitle className="text-lg font-semibold">
                              Order #{order?.order_number || order?.id.slice(0, 8).toUpperCase()}
                            </CardTitle>

                            {/* Only show on small screens (left aligned) */}
                            <div className="sm:hidden mt-1">
                              <Badge className={`${statusConfig.color} border font-medium w-fit`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </div>
                          </div>

                          {/* Only show on medium and above (inline right) */}
                          <div className="hidden sm:block">
                            <Badge className={`${statusConfig.color} border font-medium w-fit`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </div>

                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>Placed on {orderDate.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}</span>
                        <span>•</span>
                        <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span className="font-medium text-gray-900">₹{order?.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => order.delivery_otp && handleShowOtp(order.delivery_otp)}
                        disabled={!order.delivery_otp}
                        className={`min-w-[110px] rounded-md text-xs sm:text-sm transition-all ${order.delivery_otp ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100' : 'border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed'}`}
                      >
                        {order.delivery_otp ? 'View OTP' : 'OTP pending'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOrderExpansion(order?.id)}
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-xs sm:text-sm"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Less Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            More Details
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Order Items Preview (Always Visible) */}
                <CardContent className="pt-0">
                  <div className="w-full border rounded-lg bg-white shadow-sm px-4 py-3 sm:px-6 sm:py-4">

                    {/* Table header: hide on mobile, show on sm+ */}
                    <div className="hidden sm:block bg-gray-50 px-4 py-3 border-b rounded-t-lg">
                      <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-gray-700">
                        <span>Product</span>
                        <span className="text-left">Qty</span>
                        <span className="text-left">Each Price</span>
                        <span className="text-lef">Total</span>
                      </div>
                    </div>
                    <div className="space-y-2 sm:space-y-0">
                      {order?.order_items.map((item) => {
                        const productInfo = item.products || productMap[item.product_id];
                        return (
                          <div
                            key={item.id}
                            className="flex flex-col sm:grid sm:grid-cols-4 gap-2 sm:gap-4 p-2 sm:p-4 border-b last:border-b-0 bg-gray-50 sm:bg-transparent rounded-lg sm:rounded-none"
                          >
                            {/* Product info */}
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              {productInfo?.image && (
                                <img
                                  src={productInfo.image}
                                  alt={productInfo.title}
                                  className="w-12 h-12 object-cover rounded-md border"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 truncate text-sm sm:text-base">
                                  {productInfo?.title || `Product ${item.product_id.slice(0, 8)}`}
                                </p>
                                <p className="text-xs text-gray-500">
                                  ID: {item.product_id.slice(0, 8)}...
                                </p>
                              </div>
                            </div>
                            {/* On mobile, show all details stacked */}
                            <div className="flex sm:hidden flex-col gap-1 mt-1 text-xs text-gray-700 pl-14">
                              <span>
                                <span className="font-semibold">Qty:</span> {item.quantity}
                              </span>
                              <span>
                                <span className="font-semibold">Each:</span> ₹{item.price.toFixed(2)}
                              </span>
                              <span>
                                <span className="font-semibold">Total:</span> ₹{(item.quantity * item.price).toFixed(2)}
                              </span>
                            </div>
                            {/* On desktop, show columns */}
                            <div className="hidden sm:flex text-center self-center font-medium">
                              {item.quantity}
                            </div>
                            <div className="hidden sm:flex text-center self-center font-medium">
                              ₹{item.price.toFixed(2)}
                            </div>
                            <div className="hidden sm:flex text-right self-center font-semibold text-base">
                              ₹{(item.quantity * item.price).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-6 pt-6 border-t border-gray-200"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Customer Information */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            Customer Information
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Name:</span>
                              <span className="font-medium">{order?.name || 'Not provided'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Email:</span>
                              <span className="font-medium">{order?.email || 'Not provided'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Phone:</span>
                              <span className="font-medium">{order.phone || 'Not provided'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Payment:</span>
                              <span className="font-medium">
                                {PAYMENT_METHODS[order.payment_method] || order.payment_method || 'Not specified'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Delivery Information */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Delivery Address
                          </h3>
                          <div className="text-sm">
                            {order.address || order.city || order.state ? (
                              <div className="space-y-1">
                                {order.address && (
                                  <p className="font-medium">{order.address}</p>
                                )}
                                {(order.city || order.state || order.zip_code) && (
                                  <p className="text-gray-600">
                                    {[order.city, order.state, order.zip_code]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-500 italic">No delivery address provided</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}


                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* OTP Modal */}
      <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
        <DialogContent className="sm:max-w-lg w-full rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Delivery OTP</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4 py-2">
            <p className="text-base text-gray-600">Your delivery OTP is ready.</p>
            <div className="mx-auto inline-flex items-center justify-center rounded-3xl bg-blue-50 px-6 py-4 text-4xl font-semibold tracking-widest text-blue-700 shadow-sm">
              {selectedOtp}
            </div>
            <p className="text-sm text-gray-600">
              Share this code with the delivery person to complete your order.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </motion.main>
  );
};

export default Orders;
