import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle, ChevronDown, ChevronUp, Clock, Package, Truck, XCircle, Star, Download } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Define brand-consistent order status colors and icons (SCR Agro Farms Red Identity)
const STATUS_CONFIG = {
  pending: {
    color: 'bg-red-50 text-brand-red border-red-100',
    icon: Clock,
    label: 'Order Placed (COD)'
  },
  paid: {
    color: 'bg-red-50 text-brand-red border-red-100',
    icon: CheckCircle,
    label: 'Payment Received / Preparing'
  },
  shipped: {
    color: 'bg-red-50 text-brand-red border-red-100',
    icon: Truck,
    label: 'Out for Delivery / Shipped'
  },
  delivered: {
    color: 'bg-red-600 text-white border-transparent',
    icon: Package,
    label: 'Delivered'
  },
  done: {
    color: 'bg-red-600 text-white border-transparent',
    icon: Package,
    label: 'Delivered'
  },
  failed: {
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: XCircle,
    label: 'Failed'
  }
};

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
  
  // Review control states
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');

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

  // Fetch user's orders
  const { data: userOrders, isLoading, error } = useQuery<Order[], Error>({
    queryKey: ['orders', user?.id],
    queryFn: async (): Promise<Order[]> => {
      if (!user) return [];
      try {
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
          return (fallbackData || []) as unknown as Order[];
        }
        return (data || []) as unknown as Order[];
      } catch (err) {
        console.error('Query error:', err);
        throw err;
      }
    },
    enabled: !!user
  });

  const submitOrderReview = async () => {
    if (!user || !reviewOrderId) return;
    try {
      const selectedOrder = userOrders?.find(o => o.id === reviewOrderId);
      const targetProductId = selectedOrder?.order_items[0]?.product_id || '';

      const { error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          product_id: targetProductId,
          rating: rating,
          comment: comment,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      alert("Order review submitted successfully!");
      setReviewOrderId(null);
      setComment('');
    } catch (err) {
      console.error(err);
      alert("Failed to submit review.");
    }
  };

  // Fetch product details separately
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, image');
      if (error) return [];
      return data || [];
    },
    enabled: !!userOrders && userOrders.length > 0
  });

  const productMap = React.useMemo(() => {
    if (!products) return {};
    return products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {} as Record<string, any>);
  }, [products]);

  // ─────────────────────────────────────────────────────────
  // BRAND THEMED INVOICE GENERATOR WITH DYNAMIC STATUS MATRIX
  // ─────────────────────────────────────────────────────────
  const triggerInvoiceDownload = (order: Order) => {
    const doc = new jsPDF();

    autoTable(doc, {
      startY: 83,
      // 🌟 TAX COLUMN POORI TARAH SE HATAYA HAI MATCH KARNE KE LIYE
      head: [['Product Description Title', 'Qty', 'Gross Amt', 'Discount', 'Taxable Val', 'Total']],
      body: order.order_items.map((item) => {
        const productInfo = item.products || productMap[item.product_id];
        const title = productInfo?.title || `Farm Product (ID: ${item.product_id.slice(0,6)})`;
        const qty = item.quantity;
        const unitPrice = item.price;
        const grossAmount = unitPrice * qty;
        const discount = 0.00;
        const taxableVal = grossAmount - discount;

        return [
          title,
          qty,
          "Rs. " + grossAmount.toFixed(2),
          "-Rs. " + discount.toFixed(2),
          "Rs. " + taxableVal.toFixed(2),
          "Rs. " + taxableVal.toFixed(2)
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [229, 57, 53], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    // Brand Header Layout
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(229, 57, 53); // SCR Brand Red Color Theme
    doc.text('SCR Agro Farms', 14, 18);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Premium Farm Fresh Organic Produce Network', 14, 23);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('Tax Invoice', 152, 18);

    doc.setDrawColor(229, 57, 53);
    doc.setLineWidth(0.5);
    doc.line(14, 26, 196, 26);

    // Metadata Blocks Layout
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text('Sold By: SCR Agro Farms Distribution Pvt Ltd.', 14, 32);
    doc.text('Ship-from Address: Warehouse Block-4, Farukhnagar, HR - 122503', 14, 36);
    doc.text('GSTIN - 06AAFCH0247Q1ZC | PAN - AAFCH0247Q', 14, 40);

    doc.setFont('helvetica', 'bold');
    doc.text("Order ID: " + (order.order_number || order.id.slice(0, 12).toUpperCase()), 125, 32);
    doc.setFont('helvetica', 'normal');
    doc.text("Order Date: " + new Date(order.created_at).toLocaleDateString('en-IN'), 125, 36);
    doc.text("Invoice No: #FAJ3RS" + order.id.slice(0, 8).toUpperCase(), 125, 40);

    doc.setDrawColor(210);
    doc.setLineWidth(0.1);
    doc.rect(14, 45, 182, 34);
    doc.line(105, 45, 105, 79); 

    // Addresses Mapping
    doc.setFont('helvetica', 'bold');
    doc.text('Billed To:', 17, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(String(order.name || 'Amara Firdous'), 17, 55);
    doc.text(String(order.address || 'Saltanat Plaza, Okhla'), 17, 60);
    doc.text(String((order.city || 'New Delhi') + ", " + (order.state || 'Delhi') + " - " + (order.zip_code || '110025')), 17, 65);
    doc.text("Phone: " + String(order.phone || 'N/A'), 17, 70);

    doc.setFont('helvetica', 'bold');
    doc.text('Shipped To:', 108, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(String(order.name || 'Amara Firdous'), 108, 55);
    doc.text(String(order.address || 'Saltanat Plaza, Okhla'), 108, 60);
    doc.text(String((order.city || 'New Delhi') + ", " + (order.state || 'Delhi') + " - " + (order.zip_code || '110025')), 108, 65);
    doc.text("Phone: " + String(order.phone || 'N/A'), 108, 70);

    const lastY = (doc as any).lastAutoTable.finalY + 10;

    // 🌟 DYNAMIC PAYMENT LIFECYCLE VALUE CHECKS
    let invoicePaymentStatus = "Paid"; 
    if (order.payment_method === 'cod') {
      invoicePaymentStatus = (order.status === 'delivered' || order.status === 'done') ? "Paid" : "Pending (Collect upon delivery)";
    }

    // 🌟 SAFE PLAIN CONCATENATION (Fixes &1 Variable Bug completely)
    const grandTotalText = "Rs. " + Number(order.total || 0).toFixed(2);
    const paymentMethodText = "Payment Method: " + (PAYMENT_METHODS[order.payment_method as keyof typeof PAYMENT_METHODS] || order.payment_method);
    const paymentStatusText = "Payment Status: " + invoicePaymentStatus;

    // Display summary footprint box
    doc.rect(120, lastY, 76, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Grand Total:', 124, lastY + 6);
    doc.text(grandTotalText, 158, lastY + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(paymentMethodText, 124, lastY + 12);
    
    doc.setFont('helvetica', 'bold');
    doc.text(paymentStatusText, 124, lastY + 17);

    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text('Declaration: The goods sold are intended for retail end user consumption and not for commercial resale.', 14, lastY + 30);
    doc.text('This document is a certified system computer-generated tax invoice. No manual signatures are demanded.', 14, lastY + 34);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(229, 57, 53);
    doc.text('Thank you for choosing SCR Agro Farms! Enjoy fresh organic produce.', 14, lastY + 42);

    doc.save(`SCR_Agro_Farms_Invoice_${order.id.slice(0, 8).toUpperCase()}.pdf`);
  };

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
        </div>
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
          {userOrders?.map((order) => {
            const orderDate = new Date(order?.created_at);
            const totalItems = order?.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
            const statusConfig = STATUS_CONFIG[order?.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedOrders.has(order?.id);

            return (
              <Card key={order?.id} className="w-full shadow-sm border-gray-200 hover:shadow-md transition-shadow bg-white">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="mb-2">
                        <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-left">
                          <div className="flex flex-col items-start">
                            <CardTitle className="text-lg font-semibold text-gray-900">
                              Order #{order?.order_number || order?.id.slice(0, 8).toUpperCase()}
                            </CardTitle>
                            <div className="sm:hidden mt-1">
                              <Badge className={`${statusConfig.color} border font-medium w-fit px-2.5 py-0.5 rounded-full text-xs`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </div>
                          </div>
                          <div className="hidden sm:block">
                            <Badge className={`${statusConfig.color} border font-medium w-fit px-2.5 py-0.5 rounded-full text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>Placed on {orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span>•</span>
                        <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span className="font-semibold text-gray-900">₹{order?.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 ml-4">
                      {/* Brand Aligned Download Invoice Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => triggerInvoiceDownload(order)}
                        className="min-w-[140px] rounded-md text-xs border-brand-red bg-red-50 text-brand-red hover:bg-brand-red hover:text-white flex items-center justify-center gap-1.5 shadow-xs transition-all font-medium h-8"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Invoice
                      </Button>

                      {/* Security Key Display */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => order.delivery_otp && handleShowOtp(order.delivery_otp)}
                        disabled={!order.delivery_otp}
                        className={`min-w-[130px] h-8 rounded-md text-xs transition-all ${
                          order.delivery_otp 
                            ? 'border-brand-red bg-red-50 text-brand-red hover:bg-brand-red hover:text-white font-medium animate-pulse' 
                            : 'border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed'
                          }`}
                      >
                        {order.delivery_otp ? 'View Delivery OTP' : 'OTP pending'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOrderExpansion(order?.id)}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-xs sm:text-sm h-7"
                      >
                        {isExpanded ? (<><ChevronUp className="h-4 w-4" />Less Details</>) : (<><ChevronDown className="h-4 w-4" />More Details</>)}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="w-full border rounded-lg bg-white shadow-xs px-4 py-3 sm:px-6 sm:py-4">
                    <div className="hidden sm:block bg-gray-50 px-4 py-3 border-b rounded-t-lg">
                      <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-gray-700">
                        <span>Product</span>
                        <span>Qty</span>
                        <span>Each Price</span>
                        <span className="text-right">Total</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4 sm:space-y-0 sm:divide-y sm:divide-gray-100">
                      {order?.order_items?.map((item) => {
                        const productInfo = item.products || productMap[item.product_id];
                        return (
                          <div key={item.id} className="pt-3 sm:py-4 flex flex-col w-full bg-gray-50 sm:bg-transparent rounded-xl p-3 sm:p-0">
                            <div className="flex flex-col sm:grid sm:grid-cols-4 gap-2 sm:gap-4 items-start sm:items-center w-full">
                              <div className="flex items-center space-x-3">
                                {productInfo?.image && (
                                  <img src={productInfo.image} alt={productInfo.title} className="w-12 h-12 object-cover rounded-md border" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{productInfo?.title || `Product ${item.product_id.slice(0, 8)}`}</p>
                                  <p className="text-xs text-gray-400">ID: {item.product_id.slice(0, 8)}...</p>
                                </div>
                              </div>
                              <div className="hidden sm:flex font-medium text-gray-700">{item.quantity}</div>
                              <div className="hidden sm:flex font-medium text-gray-700">₹{item.price.toFixed(2)}</div>
                              <div className="hidden sm:flex justify-end font-semibold text-base text-right text-gray-900">₹{(item.quantity * item.price).toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 🌟 REVIEW SYSTEM STAYS VISIBLE SYSTEM REGARDLESS OF DELIVERY CHECKS */}
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200 flex justify-end w-full">
                      <Button 
                        size="sm" 
                        onClick={() => setReviewOrderId(order.id)}
                        className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all h-8"
                      >
                        <Star className="w-3.5 h-3.5 fill-current text-red-100" /> Rate Order & Delivery Experience
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 pt-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-800"><div className="w-2 h-2 bg-brand-red rounded-full"></div>Customer Info</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Name:</span><span className="font-medium text-gray-900">{order?.name || 'Not provided'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Email:</span><span className="font-medium text-gray-900">{order?.email || 'Not provided'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Phone:</span><span className="font-medium text-gray-900">{order.phone || 'Not provided'}</span></div>
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-800"><div className="w-2 h-2 bg-red-400 rounded-full"></div>Delivery Address</h3>
                          <div className="text-sm text-gray-900">
                            {order.address ? <p className="font-medium">{order.address}, {order.city}, {order.state}</p> : <p className="text-gray-500 italic">No address provided</p>}
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
        <DialogContent className="sm:max-w-md w-full rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader><DialogTitle>Delivery OTP Code</DialogTitle></DialogHeader>
          <div className="text-center space-y-4 py-2">
            <p className="text-sm text-gray-600">Share this security code with your delivery partner to receive products:</p>
            <div className="mx-auto inline-flex items-center justify-center rounded-3xl bg-red-50 px-6 py-4 text-4xl font-semibold tracking-widest text-brand-red shadow-sm">{selectedOtp}</div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog Form */}
      <Dialog open={!!reviewOrderId} onOpenChange={(open) => !open && setReviewOrderId(null)}>
        <DialogContent className="sm:max-w-md w-full rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader><DialogTitle className="text-lg font-bold">Rate Order Experience</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    onClick={() => setRating(star)} 
                    className={`w-7 h-7 cursor-pointer transition-colors ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Comments</label>
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was the overall delivery timeline and service quality?"
                className="w-full border p-2.5 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setReviewOrderId(null)}>Cancel</Button>
              <Button onClick={submitOrderReview} className="bg-brand-red hover:bg-brand-red/90 text-white">Submit Feedback</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.main>
  );
};

export default Orders;