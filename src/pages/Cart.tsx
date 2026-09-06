import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Minus, ShoppingBag, ShoppingCart, ArrowLeft, Heart, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface CartProduct {
  id: string;
  title: string;
  image: string;
  price: string | number;
  unit: string;
  variants?: Array<{ unit: string; price: string | number }>;
}

interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  selected_unit?: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: CartProduct;
}

const Cart = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch cart items
  const { data: cartItems, isLoading, error } = useQuery<CartItem[]>({
    queryKey: ['cart', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) throw error;
      return data as CartItem[];
    },
    enabled: !!user,
  });

  // Fetch product details
  const { data: products } = useQuery<CartProduct[]>({
    queryKey: ['products-for-cart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*');
        
      if (error) throw error;
      return data as CartProduct[];
    },
  });

  // Mutation for updating cart item quantity
  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string, quantity: number }) => {
      const { error } = await supabase
        .from('cart_items')
        .update({ 
          quantity, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive"
      });
      console.error("Error updating quantity:", error);
    }
  });

  // Mutation for removing cart item
  const removeFromCart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast({
        title: "Item removed",
        description: "Item has been removed from your cart"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive"
      });
      console.error("Error removing item:", error);
    }
  });

  const resolveLatestProductPrice = (product?: CartProduct, selectedUnit?: string | null) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const normalizedSelectedUnit = String(selectedUnit || '').trim().toLowerCase();

    if (variants.length > 0 && normalizedSelectedUnit) {
      const matchedVariant = variants.find(variant => String(variant.unit || '').trim().toLowerCase() === normalizedSelectedUnit);
      if (matchedVariant) {
        return Number(matchedVariant.price || 0);
      }
    }

    return Number(product?.price || 0);
  };

  // Find product details for cart items
  const cartWithProducts = cartItems?.map(item => {
    const product = products?.find(p => p.id === item.product_id || p.id.toString() === item.product_id);
    return {
      ...item,
      product,
      resolvedPrice: resolveLatestProductPrice(product, item.selected_unit)
    };
  }) || [];

  // Calculate total with shipping
  const subtotal = cartWithProducts.reduce((sum, item) => {
    return sum + (Number(item.resolvedPrice || 0) * item.quantity);
  }, 0);
  const shippingCost = subtotal >= 200 ? 0 : 50;
  const total = subtotal + shippingCost;

  const handleIncreaseQuantity = (item: CartItem) => {
    updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 });
  };

  const handleDecreaseQuantity = (item: CartItem) => {
    if (item.quantity > 1) {
      updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 });
    } else {
      removeFromCart.mutate(item.id);
    }
  };

  const handleRemoveItem = (id: string) => {
    removeFromCart.mutate(id);
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pt-28 pb-20 flex justify-center items-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-lg text-slate-600 font-medium">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pt-28 pb-20">
        <div className="max-w-md mx-auto text-center bg-white rounded-2xl shadow-xl p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-600 font-semibold mb-4">Error loading your cart. Please try again.</p>
          <Button onClick={() => window.location.reload()} className="bg-indigo-600 hover:bg-indigo-700">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="pt-28 pb-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="text-slate-600 hover:text-slate-900 hover:bg-white/50"
              >
                <Link to="/products">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Continue Shopping
                </Link>
              </Button>
            </div>
            <div className="text-sm text-slate-500 bg-white/60 px-3 py-1 rounded-full">
              {cartWithProducts.length} {cartWithProducts.length === 1 ? 'item' : 'items'} in cart
            </div>
          </div>

          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold text-slate-900 mb-12 flex items-center"
          >
            <ShoppingBag className="w-10 h-10 mr-4 text-indigo-600" />
            Your Cart
          </motion.h1>
          
          {cartWithProducts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white rounded-3xl shadow-2xl p-12 text-center border border-slate-200">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShoppingCart className="w-12 h-12 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Your cart is empty</h2>
                <p className="text-slate-500 mb-8">Discover amazing products and start building your order</p>
                <Button 
                  asChild 
                  size="lg"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link to="/products">
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    Browse Products
                  </Link>
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-xl lg:rounded-2xl shadow-lg lg:shadow-xl border border-slate-200 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-2 lg:p-6">
                    <h2 className="text-lg lg:text-xl font-bold text-white">Order Items</h2>
                  </div>
                  
                  <AnimatePresence mode="popLayout">
                    {cartWithProducts.map((item, index) => (
                      item.product && (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          transition={{ 
                            delay: index * 0.1,
                            duration: 0.3,
                            layout: { duration: 0.3 }
                          }}
                          layout
                          className="border-b border-slate-100 last:border-b-0 p-4 lg:p-6 hover:bg-slate-50 transition-colors duration-200"
                        >
                          <div className="flex gap-3 lg:gap-6">
                            {/* Product Image */}
                            <div className="relative group flex-shrink-0">
                              <div className="w-20 h-20 lg:w-32 lg:h-32 rounded-lg lg:rounded-2xl overflow-hidden shadow-md lg:shadow-lg bg-gradient-to-br from-slate-100 to-slate-200">
                                <img 
                                  src={item.product?.image} 
                                  alt={item.product?.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <button className="absolute -top-1 -right-1 lg:-top-2 lg:-right-2 w-6 h-6 lg:w-8 lg:h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                                <Heart className="w-3 h-3 lg:w-4 lg:h-4 text-slate-400 hover:text-red-500" />
                              </button>
                              {/* Quality Badge */}
                              <div className="absolute -bottom-1 -left-1 lg:-bottom-2 lg:-left-2 bg-emerald-500 text-white text-xs px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-full flex items-center shadow-lg">
                                <Star className="w-2.5 h-2.5 lg:w-3 lg:h-3 mr-0.5 lg:mr-1 fill-current" />
                                4.8
                              </div>
                            </div>
                            
                            {/* Product Details */}
                            <div className="flex-grow min-w-0">
                              <div className="flex justify-between items-start mb-2 lg:mb-3">
                                <div className="flex-1 min-w-0 pr-2">
                                  <h3 className="text-sm lg:text-lg font-bold text-slate-900 mb-1 truncate">{item.product?.title}</h3>
                                  <p className="text-xs lg:text-sm text-slate-500 bg-slate-100 px-2 py-0.5 lg:px-3 lg:py-1 rounded-full inline-block">
                                    ₹{item.resolvedPrice.toFixed(2)} per {item.selected_unit || item.product?.unit}
                                  </p>
                                  <div className="flex items-center mt-1 lg:mt-2 space-x-1 lg:space-x-2">
                                    <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-emerald-500 rounded-full"></div>
                                    <span className="text-xs text-emerald-600 font-medium">In Stock</span>
                                    <span className="text-xs text-slate-400">•</span>
                                    <span className="text-xs text-slate-500">Free shipping</span>
                                  </div>
                                </div>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="w-8 h-8 lg:w-10 lg:h-10 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center text-red-500 hover:text-red-600 transition-all duration-200 flex-shrink-0"
                                >
                                  <Trash2 className="w-3 h-3 lg:w-4 lg:h-4" />
                                </motion.button>
                              </div>
                              
                              {/* Quantity Controls */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center bg-slate-100 rounded-lg lg:rounded-xl p-0.5 lg:p-1">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDecreaseQuantity(item)}
                                    className="w-8 h-8 lg:w-10 lg:h-10 bg-white rounded-md lg:rounded-lg shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
                                  >
                                    <Minus className="w-3 h-3 lg:w-4 lg:h-4 text-slate-600" />
                                  </motion.button>
                                  <span className="mx-2 lg:mx-4 font-bold text-base lg:text-lg text-slate-900 min-w-[1.5rem] lg:min-w-[2rem] text-center">
                                    {item.quantity}
                                  </span>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleIncreaseQuantity(item)}
                                    className="w-8 h-8 lg:w-10 lg:h-10 bg-white rounded-md lg:rounded-lg shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
                                  >
                                    <Plus className="w-3 h-3 lg:w-4 lg:h-4 text-slate-600" />
                                  </motion.button>
                                </div>
                                
                                <div className="text-right">
                                  <p className="text-lg lg:text-2xl font-bold text-slate-900">
                                    ₹{(Number(item.resolvedPrice || 0) * item.quantity).toFixed(2)}
                                  </p>
                                  <p className="text-xs lg:text-sm text-slate-500">
                                    {item.quantity} × ₹{item.resolvedPrice.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    ))}
                  </AnimatePresence>
                </motion.div>
              </div>
              
              {/* Order Summary */}
              <div className="lg:col-span-1">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="sticky top-24"
                >
                  <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg lg:shadow-xl border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-2 lg:p-6">
                      <h2 className="text-lg lg:text-xl font-bold text-white flex items-center">
                        <ShoppingBag className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                        Order Summary
                      </h2>
                    </div>
                    
                    <div className="p-4 lg:p-6 space-y-3 lg:space-y-4">
                      <div className="space-y-2 lg:space-y-3">
                        <div className="flex justify-between items-center py-1 lg:py-2">
                          <span className="text-sm lg:text-base text-slate-600">Subtotal</span>
                          <span className="font-semibold text-sm lg:text-base text-slate-900">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 lg:py-2">
                          <span className="text-sm lg:text-base text-slate-600">Shipping</span>
                          <span className={`font-semibold text-sm lg:text-base ${subtotal >= 200 ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {subtotal >= 200 ? 'Free' : '₹50.00'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 lg:py-2">
                          <span className="text-sm lg:text-base text-slate-600">Tax</span>
                          <span className="font-semibold text-sm lg:text-base text-slate-900">₹0.00</span>
                        </div>
                      </div>
                      
                      <div className="border-t border-slate-200 pt-3 lg:pt-4">
                        <div className="flex justify-between items-center py-1 lg:py-2">
                          <span className="text-base lg:text-lg font-bold text-slate-900">Total</span>
                          <span className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            ₹{total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button 
                          className="w-full bg-gradient-to-r from-green-400 to-green-500 border border-green-700 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 lg:py-4 rounded-lg lg:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-base lg:text-lg"
                          onClick={handleCheckout}
                          disabled={cartWithProducts.length === 0}
                        >
                          <ShoppingBag className="mr-2 lg:mr-3 h-4 w-4 lg:h-5 lg:w-5" />
                          Proceed to Checkout
                        </Button>
                      </motion.div>
                      
                      <div className="text-center pt-3 lg:pt-4">
                        <Link 
                          to="/products" 
                          className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors duration-200 flex items-center justify-center text-sm lg:text-base"
                        >
                          <ArrowLeft className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
                          Continue Shopping
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  {/* Trust Badges */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-6 bg-white rounded-2xl shadow-lg border border-slate-200 p-4"
                  >
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold text-slate-900 text-sm">Secure Checkout</h3>
                      <p className="text-xs text-slate-500">SSL encrypted • Safe payments • Money back guarantee</p>
                      <div className="flex justify-center space-x-2 pt-2">
                        <div className="w-8 h-5 bg-gradient-to-r from-blue-600 to-blue-800 rounded text-white text-xs flex items-center justify-center font-bold">VISA</div>
                        <div className="w-8 h-5 bg-gradient-to-r from-red-600 to-orange-600 rounded text-white text-xs flex items-center justify-center font-bold">MC</div>
                        <div className="w-8 h-5 bg-gradient-to-r from-blue-800 to-blue-900 rounded text-white text-xs flex items-center justify-center font-bold">PP</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Promotional Banner */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 text-white relative overflow-hidden"
                  >
                    {/* Confetti Animation - Only show when free delivery is achieved */}
                    {subtotal >= 200 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {[...Array(12)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                            initial={{ 
                              x: Math.random() * 100 + '%', 
                              y: '100%',
                              rotate: 0,
                              scale: 0
                            }}
                            animate={{ 
                              y: '-20px',
                              rotate: 360,
                              scale: [0, 1, 0]
                            }}
                            transition={{
                              duration: 2,
                              delay: i * 0.1,
                              repeat: Infinity,
                              repeatDelay: 3
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="text-center relative z-10">
                      <motion.h4 
                        className="font-bold text-sm mb-1"
                        animate={subtotal >= 200 ? {
                          scale: [1, 1.1, 1],
                          color: ['#ffffff', '#ffd700', '#ffffff']
                        } : {}}
                        transition={{ duration: 0.6, repeat: subtotal >= 200 ? Infinity : 0, repeatDelay: 2 }}
                      >
                        {subtotal >= 200 ? '🎉 HOORAY! Free Delivery Unlocked! 🎉' : '🎁 Special Offer!'}
                      </motion.h4>
                      
                      <motion.p 
                        className="text-xs opacity-90"
                        animate={subtotal >= 200 ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 0.8, repeat: subtotal >= 200 ? Infinity : 0, repeatDelay: 1.5 }}
                      >
                        Free delivery on orders above ₹200
                      </motion.p>
                      
                      <div className="mt-2 bg-white/20 rounded-full h-2 relative">
                        <motion.div 
                          className="bg-white rounded-full h-2 transition-all duration-500 relative overflow-hidden"
                          style={{ width: `${Math.min((subtotal / 200) * 100, 100)}%` }}
                          animate={subtotal >= 200 ? {
                            boxShadow: ['0 0 5px rgba(255,255,255,0.5)', '0 0 20px rgba(255,255,255,0.8)', '0 0 5px rgba(255,255,255,0.5)']
                          } : {}}
                          transition={{ duration: 1, repeat: subtotal >= 200 ? Infinity : 0 }}
                        >
                          {/* Sparkle effect on progress bar when completed */}
                          {subtotal >= 200 && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200 to-transparent"
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
                            />
                          )}
                        </motion.div>
                      </div>
                      
                      <motion.p 
                        className="text-xs mt-1 opacity-75"
                        animate={subtotal >= 200 ? {
                          y: [0, -2, 0],
                          opacity: [0.75, 1, 0.75]
                        } : {}}
                        transition={{ duration: 1, repeat: subtotal >= 200 ? Infinity : 0, repeatDelay: 1 }}
                      >
                        {subtotal >= 200 ? (
                          <span className="flex items-center justify-center gap-1">
                            🚚 You qualify for free delivery! 
                            <motion.span
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                            >
                              🎊
                            </motion.span>
                          </span>
                        ) : (
                          `Add ₹${(200 - subtotal).toFixed(2)} more for free delivery`
                        )}
                      </motion.p>

                      {/* Bell Notification Animation - Shows briefly when threshold is reached */}
                      {subtotal >= 200 && (
                        <motion.div
                          className="absolute -top-2 -right-2"
                          initial={{ scale: 0, rotate: 0 }}
                          animate={{ 
                            scale: [0, 1.2, 1],
                            rotate: [-10, 10, -10, 0]
                          }}
                          transition={{ 
                            duration: 0.8,
                            times: [0, 0.5, 1],
                            repeat: 3,
                            repeatDelay: 4
                          }}
                        >
                          🔔
                        </motion.div>
                      )}
                    </div>

                    {/* Pulsing Background Effect */}
                    {subtotal >= 200 && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-2xl"
                        animate={{ opacity: [0, 0.3, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                </motion.div>
              </div>
            </div>
          )}
        </div>
      </motion.main>
    </div>
  );
};

export default Cart;
