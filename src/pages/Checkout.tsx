// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { useAuth } from '@/contexts/AuthContext';
// import { useToast } from '@/hooks/use-toast';
// import { supabase } from '@/integrations/supabase/client';
// import { Tables } from '@/integrations/supabase/types';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { motion } from 'framer-motion';
// import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { StockManager } from './admin/stockmanagement';

// // Razorpay interfaces
// interface RazorpayResponse {
//   razorpay_payment_id?: string;
//   razorpay_order_id?: string;
//   razorpay_signature?: string;
//   error?: {
//     code: string;
//     description: string;
//     source: string;
//     step: string;
//     reason: string;
//   };
// }

// interface RazorpayOptions {
//   key: string;
//   amount: number;
//   currency: string;
//   name: string;
//   description: string;
//   image?: string;
//   prefill: {
//     name: string;
//     contact: string;
//     email: string;
//   };
//   notes: Record<string, string>;
//   theme: {
//     color: string;
//   };
//   handler: (response: RazorpayResponse) => void;
//   modal: {
//     ondismiss: () => void;
//   };
// }

// interface RazorpayInstance {
//   open: () => void;
//   close: () => void;
// }

// interface WindowWithRazorpay extends Window {
//   Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
// }

// const Checkout = () => {
//   const { user } = useAuth();
//   const queryClient = useQueryClient();
//   const navigate = useNavigate();
//   const { toast } = useToast();
  
//   const [formData, setFormData] = useState({
//     name: '',
//     phone: '',
//     address: '',
//     city: '',
//     state: '',
//     zipCode: ''
//   });

//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [paymentProcessing, setPaymentProcessing] = useState(false);
//   const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');

//   // Fetch user profile
//   const { data: userProfile } = useQuery({
//     queryKey: ['user-profile', user?.id],
//     queryFn: async () => {
//       if (!user) return null;
      
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('*')
//         .eq('id', user.id)
//         .single();
        
//       if (error) {
//         console.log('Profile fetch error:', error);
//         return null;
//       }
//       return data;
//     },
//     enabled: !!user,
//   });

//   // Auto-fill form with profile data when profile loads
//   useEffect(() => {
//     if (userProfile) {
//       setFormData({
//         name: userProfile.name || '', // Changed from full_name to name
//         phone: userProfile.phone || '',
//         address: userProfile.address || '',
//         city: userProfile.city || '',
//         state: userProfile.state || '',
//         zipCode: userProfile.zip_code || ''
//       });
//     }
//   }, [userProfile]);

//   // Fetch products
//   const { data: products } = useQuery<Tables<'products'>[]>({
//     queryKey: ['products-for-cart'],
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('products')
//         .select('*');
        
//       if (error) throw error;
//       return data as Tables<'products'>[];
//     },
//   });

//   // Fetch cart items
//   const { data: cartItems, isLoading } = useQuery({
//     queryKey: ['cart', user?.id],
//     queryFn: async () => {
//       if (!user) return [];
      
//       const { data, error } = await supabase
//         .from('cart_items')
//         .select('*')
//         .eq('user_id', user.id);
        
//       if (error) throw error;
//       return data || [];
//     },
//     enabled: !!user,
//   });

//   // Find product details for cart items - Handle type mismatch
//   const cartWithProducts = cartItems?.map(item => {
//     const product = products?.find(p => {
//       // Handle the text vs uuid comparison issue
//       const productId = p.id.toString();
//       const cartProductId = item.product_id.toString();
//       return productId === cartProductId;
//     });
//     return {
//       ...item,
//       product,
//       // Ensure we have the correct product_id format for order creation
//       resolved_product_id: product?.id || item.product_id
//     };
//   }) || [];

//   // Calculate total
//   const total = cartWithProducts.reduce((sum, item) => {
//     return sum + (Number(item.product?.price || 0) * item.quantity);
//   }, 0);

//   // Update form data
//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//   };

//   // Update user profile mutation
//   const updateProfile = useMutation({
//     mutationFn: async (profileData: any) => {
//       if (!user) return;
      
//       const { error } = await supabase
//         .from('profiles')
//         .upsert({
//           id: user.id,
//           name: profileData.name, // Changed from full_name to name
//           phone: profileData.phone,
//           address: profileData.address,
//           city: profileData.city,
//           state: profileData.state,
//           zip_code: profileData.zipCode,
//           updated_at: new Date().toISOString()
//         });
        
//       if (error) throw error;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['user-profile'] });
//     },
//     onError: (error) => {
//       console.error('Profile update error:', error);
//       // Don't show error toast for profile update as it's secondary
//     }
//   });

//   // Process order - FIXED: Better type handling and error prevention
//   const placeOrder = useMutation({
//     mutationFn: async (paymentId?: string) => {
//       if (!user) throw new Error("User not authenticated");

//       // Validate cart has products
//       if (cartWithProducts.length === 0) {
//         throw new Error("Cart is empty");
//       }

//       // Check if all cart items have valid products
//       const invalidItems = cartWithProducts.filter(item => !item.product);
//       if (invalidItems.length > 0) {
//         throw new Error("Some items in your cart are no longer available");
//       }

//       // Update user profile with current form data
//       try {
//         await updateProfile.mutateAsync(formData);
//       } catch (error) {
//         console.log('Profile update failed, but continuing with order:', error);
//       }

//       // Create order in Supabase orders table
//       const orderData = {
//         user_id: user.id, // This should be UUID, make sure user.id is UUID
//         total: Number(total.toFixed(2)),
//         status: paymentId ? 'paid' : (paymentMethod === 'cod' ? 'pending' : 'pending'),
//         payment_method: paymentMethod === 'cod' ? 'cod' : 'online',
//         name: formData.name, // Changed from customer_name to name
//         phone: formData.phone, // Changed from customer_phone to phone
//         email: user.email || '', // Changed from customer_email to email
//         // NOTE: the live code now prefixes these with `delivery_` to match the
//         // orders table. This old snippet shows the previous field names that
//         // were causing address data to be dropped.
//         address: formData.address,
//         city: formData.city,
//         state: formData.state,
//         zip_code: formData.zipCode,
//         payment_id: paymentId || null,
//         payment_order_id: null,
//         payment_signature: null,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString()
//       };

//       console.log('Creating order with data:', orderData);

//       const { data: order, error: orderError } = await supabase
//         .from('orders')
//         .insert([orderData])
//         .select()
//         .single();

//       if (orderError) {
//         console.error('Order creation error:', orderError);
//         throw new Error(`Failed to create order: ${orderError.message}`);
//       }

//       if (!order) {
//         throw new Error('No order returned from database');
//       }

//       console.log('Order created successfully:', order);

//       // Create order items - Use resolved product ID
//       const orderItems = cartWithProducts
//         .filter(item => item.product) // Only include items with valid products
//         .map(item => ({
//           order_id: order.id,
//           product_id: item.resolved_product_id, // Use resolved ID that matches products table
//           quantity: item.quantity,
//           price: Number(item.product!.price || 0),
//           created_at: new Date().toISOString()
//         }));

//       console.log('Creating order items:', orderItems);

//       if (orderItems.length === 0) {
//         throw new Error('No valid items to create order');
//       }

//       const { error: itemsError } = await supabase
//         .from('order_items')
//         .insert(orderItems);

//       if (itemsError) {
//         console.error('Order items creation error:', itemsError);
//         throw new Error(`Failed to create order items: ${itemsError.message}`);
//       }

//       // Aggregate quantities for each product to avoid duplicate deductions
//       const productQuantityMap: Record<string, number> = {};
//       for (const item of orderItems) {
//         const pid = item.product_id.toString();
//         productQuantityMap[pid] = (productQuantityMap[pid] || 0) + item.quantity;
//       }
//       const aggregatedOrderItems = Object.entries(productQuantityMap).map(([product_id, quantity]) => ({ product_id, quantity }));

//       // Deduct stock for each product using StockManager (ensures stock_movements are created)
//       try {
//         await StockManager.handleOrderPlacement(
//           aggregatedOrderItems,
//           order.id
//         );
//       } catch (err) {
//         console.error('StockManager.handleOrderPlacement error:', err);
//         // Optionally, show a toast or handle error
//       }

//       // Clear the cart
//       const { error: clearCartError } = await supabase
//         .from('cart_items')
//         .delete()
//         .eq('user_id', user.id);
        
//       if (clearCartError) {
//         console.error('Cart clearing error:', clearCartError);
//         throw new Error(`Failed to clear cart: ${clearCartError.message}`);
//       }
      
//       return order.id;
//     },
//     onSuccess: (orderId) => {
//       console.log('Order placed successfully with ID:', orderId);
//       queryClient.invalidateQueries({ queryKey: ['cart'] });
//       queryClient.invalidateQueries({ queryKey: ['products'] });
//       queryClient.invalidateQueries({ queryKey: ['admin-products'] });
//       toast({
//         title: "Order placed successfully",
//         description: paymentMethod === 'cod' 
//           ? "Your COD order has been placed. Please keep the exact amount ready for delivery." 
//           : "Thank you for your order!"
//       });
//       navigate('/');
//     },
//     onError: (error) => {
//       console.error("Error placing order:", error);
//       toast({
//         title: "Error processing order",
//         description: error instanceof Error ? error.message : "There was a problem placing your order. Please try again.",
//         variant: "destructive"
//       });
//     }
//   });

//   // Initialize Razorpay payment
//   const initializeRazorpayPayment = () => {
//     setPaymentProcessing(true);
    
//     const options: RazorpayOptions = {
//       key: 'rzp_live_OtMj4vjVpeRjg8', // Replace with your Razorpay key ID
//       amount: total * 100, // Razorpay expects amount in paise (1 INR = 100 paise)
//       currency: 'INR',
//       name: 'SCR Farms',
//       description: 'Purchase from SCR Farms',
//       image: '/logo.png', // Your company logo
//       prefill: {
//         name: formData.name,
//         contact: formData.phone,
//         email: user?.email || ''
//       },
//       notes: {
//         address: formData.address
//       },
//       theme: {
//         color: '#E53935' // Match with your brand color
//       },
//       handler: function(response: RazorpayResponse) {
//         // Handle successful payment
//         if (response.razorpay_payment_id) {
//           handlePaymentSuccess(response.razorpay_payment_id);
//         } else {
//           handlePaymentFailure('No payment ID received');
//         }
//       },
//       modal: {
//         ondismiss: function() {
//           setPaymentProcessing(false);
//           toast({
//             title: "Payment cancelled",
//             description: "You have cancelled the payment process.",
//             variant: "destructive"
//           });
//         }
//       }
//     };

//     const rzp = new (window as unknown as WindowWithRazorpay).Razorpay(options);
//     rzp.open();
//   };

//   // Handle successful payment
//   const handlePaymentSuccess = async (paymentId: string) => {
//     try {
//       await placeOrder.mutateAsync(paymentId);
//       setPaymentProcessing(false);
//     } catch (error) {
//       setPaymentProcessing(false);
//       console.error("Error processing order after payment:", error);
//     }
//   };

//   // Handle payment failure
//   const handlePaymentFailure = (error: string | Error) => {
//     setPaymentProcessing(false);
//     toast({
//       title: "Payment failed",
//       description: "There was a problem processing your payment. Please try again.",
//       variant: "destructive"
//     });
//     console.error("Payment failed:", error);
//   };

//   // Handle COD order placement
//   const handleCODOrder = async () => {
//     try {
//       setIsSubmitting(true);
//       console.log('Placing COD order...');
//       await placeOrder.mutateAsync(undefined);
//     } catch (error) {
//       console.error("Error placing COD order:", error);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setIsSubmitting(true);
    
//     // Validate form
//     const { name, phone, address, city, state, zipCode } = formData;
//     if (!name || !phone || !address || !city || !state || !zipCode) {
//       toast({
//         title: "Missing information",
//         description: "Please fill in all the required fields",
//         variant: "destructive"
//       });
//       setIsSubmitting(false);
//       return;
//     }

//     // Validate cart is not empty
//     if (cartWithProducts.length === 0) {
//       toast({
//         title: "Cart is empty",
//         description: "Please add items to your cart before placing an order",
//         variant: "destructive"
//       });
//       setIsSubmitting(false);
//       return;
//     }

//     // Validate all cart items have valid products
//     const invalidItems = cartWithProducts.filter(item => !item.product);
//     if (invalidItems.length > 0) {
//       toast({
//         title: "Invalid items in cart",
//         description: "Some items in your cart are no longer available. Please refresh and try again.",
//         variant: "destructive"
//       });
//       setIsSubmitting(false);
//       return;
//     }

//     // Handle COD order
//     if (paymentMethod === 'cod') {
//       await handleCODOrder();
//       return;
//     }
    
//     // Handle online payment
//     if (!(window as unknown as WindowWithRazorpay).Razorpay) {
//       const script = document.createElement('script');
//       script.src = 'https://checkout.razorpay.com/v1/checkout.js';
//       script.async = true;
//       script.onload = () => {
//         initializeRazorpayPayment();
//       };
//       script.onerror = () => {
//         toast({
//           title: "Payment gateway error",
//           description: "Failed to load payment gateway. Please try again later.",
//           variant: "destructive"
//         });
//         setIsSubmitting(false);
//       };
//       document.body.appendChild(script);
//     } else {
//       initializeRazorpayPayment();
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="pt-28 pb-20 section-container flex justify-center">
//         <p>Loading checkout...</p>
//       </div>
//     );
//   }

  
//   // if (cartWithProducts.length === 0) {
//   //   navigate('/cart');
//   //   return null;
//   // }

  
//   return (
//     <motion.main
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       exit={{ opacity: 0 }}
//       transition={{ duration: 0.5 }}
//       className="pt-28 pb-20"
//     >
//       <div className="section-container">
//         <h1 className="text-3xl font-display font-bold mb-8">Checkout</h1>
        
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           <div className="lg:col-span-2">
//             <div className="glass-panel p-6 mb-8">
//               <h2 className="text-xl font-semibold mb-4">Delivery Information</h2>
              
//               {userProfile && (
//                 <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
//                   <p className="text-sm text-green-800">
//                     <strong>Info:</strong> Your delivery details have been auto-filled from your profile. You can modify them if needed.
//                   </p>
//                 </div>
//               )}
              
//               <form onSubmit={handleSubmit} className="space-y-4">
//                 <div>
//                   <label htmlFor="name" className="block text-sm font-medium mb-1">Full Name</label>
//                   <Input
//                     id="name"
//                     name="name"
//                     value={formData.name}
//                     onChange={handleChange}
//                     placeholder="Enter your full name"
//                     required
//                   />
//                 </div>
                
//                 <div>
//                   <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone Number</label>
//                   <Input
//                     id="phone"
//                     name="phone"
//                     value={formData.phone}
//                     onChange={handleChange}
//                     placeholder="Enter your phone number"
//                     required
//                   />
//                 </div>
                
//                 <div>
//                   <label htmlFor="address" className="block text-sm font-medium mb-1">Address</label>
//                   <Input
//                     id="address"
//                     name="address"
//                     value={formData.address}
//                     onChange={handleChange}
//                     placeholder="Enter your address"
//                     required
//                   />
//                 </div>
                
//                 <div className="grid grid-cols-2 gap-4">
//                   <div>
//                     <label htmlFor="city" className="block text-sm font-medium mb-1">City</label>
//                     <Input
//                       id="city"
//                       name="city"
//                       value={formData.city}
//                       onChange={handleChange}
//                       placeholder="Enter your city"
//                       required
//                     />
//                   </div>
                  
//                   <div>
//                     <label htmlFor="state" className="block text-sm font-medium mb-1">State</label>
//                     <Input
//                       id="state"
//                       name="state"
//                       value={formData.state}
//                       onChange={handleChange}
//                       placeholder="Enter your state"
//                       required
//                     />
//                   </div>
//                 </div>
                
//                 <div>
//                   <label htmlFor="zipCode" className="block text-sm font-medium mb-1">ZIP Code</label>
//                   <Input
//                     id="zipCode"
//                     name="zipCode"
//                     value={formData.zipCode}
//                     onChange={handleChange}
//                     placeholder="Enter your ZIP code"
//                     required
//                   />
//                 </div>

//                 {/* Payment Method Selection */}
//                 <div className="mt-6">
//                   <label className="block text-sm font-medium mb-3">Payment Method</label>
//                   <div className="space-y-3">
//                     <div className="flex items-center space-x-3">
//                       <input
//                         type="radio"
//                         id="online"
//                         name="paymentMethod"
//                         value="online"
//                         checked={paymentMethod === 'online'}
//                         onChange={(e) => setPaymentMethod(e.target.value as 'online' | 'cod')}
//                         className="w-4 h-4 text-brand-red border-gray-300 focus:ring-brand-red"
//                       />
//                       <label htmlFor="online" className="text-sm font-medium">
//                         Online Payment (Credit/Debit Card, UPI, Net Banking)
//                       </label>
//                     </div>
                    
//                     <div className="flex items-center space-x-3">
//                       <input
//                         type="radio"
//                         id="cod"
//                         name="paymentMethod"
//                         value="cod"
//                         checked={paymentMethod === 'cod'}
//                         onChange={(e) => setPaymentMethod(e.target.value as 'online' | 'cod')}
//                         className="w-4 h-4 text-brand-red border-gray-300 focus:ring-brand-red"
//                       />
//                       <label htmlFor="cod" className="text-sm font-medium">
//                         Cash on Delivery (COD)
//                       </label>
//                     </div>
//                   </div>

//                   {paymentMethod === 'cod' && (
//                     <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
//                       <p className="text-sm text-yellow-800">
//                         <strong>Note:</strong> Please keep the exact amount ready (₹{total.toFixed(2)}) for cash payment during delivery.
//                       </p>
//                     </div>
//                   )}
//                 </div>
                
//                 <Button
//                   type="submit"
//                   className="w-full bg-brand-red hover:bg-brand-red/90 mt-6"
//                   disabled={isSubmitting || paymentProcessing}
//                 >
//                   {isSubmitting || paymentProcessing 
//                     ? 'Processing...' 
//                     : paymentMethod === 'cod' 
//                       ? 'Place COD Order' 
//                       : 'Proceed to Payment'
//                   }
//                 </Button>
//               </form>
//             </div>
//           </div>
          
//           <div className="lg:col-span-1">
//             <div className="glass-panel p-6 sticky top-24">
//               <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              
//               <div className="space-y-4 mb-6">
//                 {cartWithProducts.map((item) => (
//                   <div key={item.id} className="flex justify-between">
//                     <div>
//                       <span className="font-medium">{item.product?.title}</span>
//                       <span className="text-gray-500 block text-sm">
//                         {item.quantity} x ₹{item.product?.price}
//                       </span>
//                     </div>
//                     <span className="font-medium">
//                       ₹{(Number(item.product?.price || 0) * item.quantity).toFixed(2)}
//                     </span>
//                   </div>
//                 ))}
//               </div>
              
//               <div className="border-t pt-4 space-y-2 mb-4">
//                 <div className="flex justify-between">
//                   <span>Subtotal</span>
//                   <span>₹{total.toFixed(2)}</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span>Shipping</span>
//                   <span>₹0.00</span>
//                 </div>
//                 {paymentMethod === 'cod' && (
//                   <div className="flex justify-between text-sm text-gray-600">
//                     <span>COD Charges</span>
//                     <span>₹0.00</span>
//                   </div>
//                 )}
//               </div>
              
//               <div className="border-t pt-4 mb-6">
//                 <div className="flex justify-between font-bold">
//                   <span>Total</span>
//                   <span>₹{total.toFixed(2)}</span>
//                 </div>
//               </div>
              
//               <div className="text-sm text-gray-600">
//                 <p>Payment Method: {paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Razorpay)'}</p>
//                 <p className="mt-2">Estimated Delivery: 1-2 business days</p>
//                 {paymentMethod === 'cod' && (
//                   <p className="mt-2 text-yellow-700 font-medium">
//                     Please keep exact change ready: ₹{total.toFixed(2)}
//                   </p>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </motion.main>
//   );
// };

// export default Checkout;
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StockManager } from './admin/stockmanagement';

// ─────────────────────────────────────────────
// Razorpay interfaces
// ─────────────────────────────────────────────
interface RazorpayResponse {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  error?: { code: string; description: string; source: string; step: string; reason: string };
}
interface RazorpayOptions {
  key: string; amount: number; currency: string; name: string;
  description: string; image?: string;
  prefill: { name: string; contact: string; email: string };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}
interface RazorpayInstance { open: () => void; close: () => void }
interface WindowWithRazorpay extends Window {
  Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
}

// ─────────────────────────────────────────────
// Delivery Slot Logic  (real-time, IST)
// ─────────────────────────────────────────────
interface DeliverySlot {
  id: string;
  label: string;
  time: string;
  date: 'today' | 'tomorrow';
  dateLabel: string;
  emoji: string;
}

/**
 * Three delivery batches per day:
 *   Morning  07:00 – 10:00   (cutoff: order before 06:00)
 *   Evening  15:00 – 16:00   (cutoff: order before 13:00)
 *   Night    20:00 – 22:00   (cutoff: order before 18:00)
 *
 * Slots are computed from a live IST snapshot so they are ALWAYS correct:
 *   - "Today" labels flip to the real calendar date at midnight automatically
 *   - Expired today-slots disappear the moment their cutoff passes
 *   - The interval in the component re-calls this every minute
 */

/** Full IST snapshot — recalculated fresh each call. */
function getISTSnapshot(): { hour: number; dateLabel: string; tomorrowLabel: string } {
  const nowUTC       = new Date();
  const istMs        = nowUTC.getTime() + 5.5 * 60 * 60 * 1000;
  const ist          = new Date(istMs);

  const hour         = ist.getUTCHours() + ist.getUTCMinutes() / 60;

  // Real calendar labels (e.g. "Mon, 2 Jun") so they flip at midnight.
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
      timeZone: 'Asia/Kolkata',
    });

  const todayDate    = new Date(istMs);
  const tomorrowDate = new Date(istMs + 24 * 60 * 60 * 1000);

  return {
    hour,
    dateLabel:     fmt(todayDate),      // e.g. "Mon, 2 Jun"
    tomorrowLabel: fmt(tomorrowDate),   // e.g. "Tue, 3 Jun"
  };
}

function getAvailableSlots(): DeliverySlot[] {
  const { hour, dateLabel, tomorrowLabel } = getISTSnapshot();
  const slots: DeliverySlot[] = [];

  // ── TODAY slots — shown only before their order cutoff ──
  if (hour < 6) {
    slots.push({
      id: 'morning_today', label: 'Morning Delivery', emoji: '🌅',
      time: '7:00 AM – 10:00 AM', date: 'today',
      dateLabel: `Today (${dateLabel}) · 7:00 AM – 10:00 AM`,
    });
  }
  if (hour < 13) {
    slots.push({
      id: 'evening_today', label: 'Evening Delivery', emoji: '🌇',
      time: '3:00 PM – 4:00 PM', date: 'today',
      dateLabel: `Today (${dateLabel}) · 3:00 PM – 4:00 PM`,
    });
  }
  if (hour < 18) {
    slots.push({
      id: 'night_today', label: 'Night Delivery', emoji: '🌙',
      time: '8:00 PM – 10:00 PM', date: 'today',
      dateLabel: `Today (${dateLabel}) · 8:00 PM – 10:00 PM`,
    });
  }

  // ── TOMORROW slots — always available, show real date so at midnight
  //    they automatically read as the new "today" on the NEXT render tick ──
  slots.push({
    id: 'morning_tomorrow', label: 'Morning Delivery', emoji: '🌅',
    time: '7:00 AM – 10:00 AM', date: 'tomorrow',
    dateLabel: `Tomorrow (${tomorrowLabel}) · 7:00 AM – 10:00 AM`,
  });
  slots.push({
    id: 'evening_tomorrow', label: 'Evening Delivery', emoji: '🌇',
    time: '3:00 PM – 4:00 PM', date: 'tomorrow',
    dateLabel: `Tomorrow (${tomorrowLabel}) · 3:00 PM – 4:00 PM`,
  });
  slots.push({
    id: 'night_tomorrow', label: 'Night Delivery', emoji: '🌙',
    time: '8:00 PM – 10:00 PM', date: 'tomorrow',
    dateLabel: `Tomorrow (${tomorrowLabel}) · 8:00 PM – 10:00 PM`,
  });

  return slots;
}

function getSlotNote(hour: number): string {
  if (hour >= 22)
    return "It's past 10 PM — all today's slots are closed. Tomorrow's slots are open below.";
  if (hour >= 18)
    return "Night slot for today is now closed. All tomorrow slots are available.";
  if (hour >= 13)
    return "Morning & Evening slots for today are closed. Night delivery (8–10 PM) is still available today!";
  if (hour >= 6)
    return "Morning slot for today is closed. Evening and Night slots are still open for today.";
  return ''; // Before 6 AM — all three today slots visible, no note needed
}

/** Fractional IST hour — used to drive the live clock state. */
function getISTHour(): number {
  return getISTSnapshot().hour;
}

// ─────────────────────────────────────────────
// Location helpers
// ─────────────────────────────────────────────

/**
 * Reverse-geocodes lat/lng using the free Nominatim API (no API key needed).
 * Returns best-effort address parts — user should always verify.
 */
async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string; city: string; state: string; zipCode: string;
}> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  const a = data.address || {};

  const parts = [a.house_number, a.road || a.pedestrian || a.footway, a.neighbourhood || a.suburb].filter(Boolean);
  const address = parts.join(', ') || a.display_name?.split(',').slice(0, 2).join(',') || '';
  const city    = a.city || a.town || a.village || a.county || '';
  const state   = a.state || '';
  const zipCode = a.postcode || '';

  return { address, city, state, zipCode };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const Checkout = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '', phone: '', address: '', city: '', state: '', zipCode: ''
  });

  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod]     = useState<'online' | 'cod'>('online');

  // ── GPS / location state ──
  const [coords, setCoords]               = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus]   = useState<'idle' | 'success' | 'error' | 'denied'>('idle');

  // ── Live IST clock — ticks every minute so slots update without page reload ──
  const [istHour, setIstHour] = useState<number>(getISTHour());
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  useEffect(() => {
    const tick = () => {
      const h = getISTHour();
      setIstHour(h);
    };
    const timer = setInterval(tick, 60_000); // refresh every minute
    return () => clearInterval(timer);
  }, []);

  const availableSlots = getAvailableSlots();
  const slotNote       = getSlotNote(istHour);

  // Auto-select first slot on load; also auto-advance if the selected slot
  // expires while the checkout page is open (e.g. user left tab open).
  useEffect(() => {
    const ids = availableSlots.map(s => s.id);
    if (!ids.includes(selectedSlot)) {
      setSelectedSlot(ids[0] ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [istHour]);

  // ── Fetch user profile ──
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) { console.log('Profile fetch error:', error); return null; }
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name:    userProfile.name     || '',
        phone:   userProfile.phone    || '',
        address: userProfile.address  || '',
        city:    userProfile.city     || '',
        state:   userProfile.state    || '',
        zipCode: userProfile.zip_code || ''
      });
    }
  }, [userProfile]);

  // ── Fetch products ──
  const { data: products } = useQuery<Tables<'products'>[]>({
    queryKey: ['products-for-cart'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      return data as Tables<'products'>[];
    },
  });

  // ── Fetch cart ──
  const { data: cartItems, isLoading } = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('cart_items').select('*').eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const cartWithProducts = cartItems?.map(item => {
    const product = products?.find(p => p.id.toString() === item.product_id.toString());
    return { ...item, product, resolved_product_id: product?.id || item.product_id };
  }) || [];

  const total = cartWithProducts.reduce(
    (sum, item) => sum + (Number(item.product?.price || 0) * item.quantity), 0
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ─────────────────────────────────────────────
  // GPS: fetch current location + reverse geocode
  // ─────────────────────────────────────────────
  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Not supported', description: 'Geolocation is not supported by your browser.', variant: 'destructive' });
      return;
    }

    setLocationLoading(true);
    setLocationStatus('idle');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        try {
          const geo = await reverseGeocode(lat, lng);
          setFormData(prev => ({
            ...prev,
            address: geo.address || prev.address,
            city:    geo.city    || prev.city,
            state:   geo.state   || prev.state,
            zipCode: geo.zipCode || prev.zipCode,
          }));
          setLocationStatus('success');
          toast({
            title: '📍 Location captured',
            description: 'Address fields auto-filled from GPS. Please verify before placing order.',
          });
        } catch {
          // coords saved even if reverse geocoding fails
          setLocationStatus('success');
          toast({
            title: '📍 Coordinates saved',
            description: 'Could not auto-fill address. Please fill address fields manually.',
            variant: 'destructive',
          });
        }
        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
          toast({
            title: 'Location permission denied',
            description: 'Allow location access in browser settings and try again.',
            variant: 'destructive',
          });
        } else {
          setLocationStatus('error');
          toast({
            title: 'Could not get location',
            description: 'Unable to determine location. Please fill the address manually.',
            variant: 'destructive',
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ─────────────────────────────────────────────
  // Profile update
  // ─────────────────────────────────────────────
  const updateProfile = useMutation({
    mutationFn: async (profileData: any) => {
      if (!user) return;
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name:       profileData.name,
        phone:      profileData.phone,
        address:    profileData.address,
        city:       profileData.city,
        state:      profileData.state,
        zip_code:   profileData.zipCode,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-profile'] }); },
    onError: (error) => { console.error('Profile update error:', error); }
  });

  // ─────────────────────────────────────────────
  // Place order — writes delivery_lat / delivery_lng when available
  // ─────────────────────────────────────────────
  const placeOrder = useMutation({
    mutationFn: async (paymentId?: string) => {
      if (!user) throw new Error('User not authenticated');
      if (cartWithProducts.length === 0) throw new Error('Cart is empty');
      if (cartWithProducts.filter(i => !i.product).length > 0)
        throw new Error('Some items in your cart are no longer available');
      if (!selectedSlot) throw new Error('Please select a delivery slot');

      try { await updateProfile.mutateAsync(formData); }
      catch (e) { console.log('Profile update failed, continuing:', e); }

      const orderData: Record<string, any> = {
        user_id:           user.id,
        total:             Number(total.toFixed(2)),
        status:            paymentId ? 'paid' : 'pending',
        payment_method:    paymentMethod === 'cod' ? 'cod' : 'online',
        name:              formData.name,
        phone:             formData.phone,
        email:             user.email || '',
        // use the "delivery_" prefix to match our Supabase schema
       address:  formData.address,
        city:     formData.city,
        state:    formData.state,
        zip_code: formData.zipCode,
        payment_id:        paymentId || null,
        payment_order_id:  null,
        payment_signature: null,
        delivery_slot:     selectedSlot,
        created_at:        new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      };

      // ── Persist GPS coordinates if the customer used "Detect location" ──
      if (coords) {
        orderData.delivery_lat = coords.lat;
        orderData.delivery_lng = coords.lng;
      }

      const { data: order, error: orderError } = await supabase
        .from('orders').insert([orderData]).select().single();
      if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);
      if (!order) throw new Error('No order returned from database');

      const orderItems = cartWithProducts
        .filter(item => item.product)
        .map(item => ({
          order_id:   order.id,
          product_id: item.resolved_product_id,
          quantity:   item.quantity,
          price:      Number(item.product!.price || 0),
          created_at: new Date().toISOString()
        }));

      if (orderItems.length === 0) throw new Error('No valid items to create order');

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw new Error(`Failed to create order items: ${itemsError.message}`);

      const productQuantityMap: Record<string, number> = {};
      for (const item of orderItems) {
        const pid = item.product_id.toString();
        productQuantityMap[pid] = (productQuantityMap[pid] || 0) + item.quantity;
      }
      try {
        await StockManager.handleOrderPlacement(
          Object.entries(productQuantityMap).map(([product_id, quantity]) => ({ product_id, quantity })),
          order.id
        );
      } catch (err) { console.error('StockManager error:', err); }

      const { error: clearCartError } = await supabase.from('cart_items').delete().eq('user_id', user.id);
      if (clearCartError) throw new Error(`Failed to clear cart: ${clearCartError.message}`);

      return order.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      const slot = availableSlots.find(s => s.id === selectedSlot);
      toast({
        title: 'Order placed successfully! 🎉',
        description: paymentMethod === 'cod'
          ? `COD order placed. Delivery: ${slot?.dateLabel}. Please keep ₹${total.toFixed(2)} ready.`
          : `Thank you! Delivery: ${slot?.dateLabel}.`
      });
      navigate('/');
    },
    onError: (error) => {
      console.error('Error placing order:', error);
      toast({
        title: 'Error processing order',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
    }
  });

  // ─────────────────────────────────────────────
  // Razorpay helpers
  // ─────────────────────────────────────────────
  const initializeRazorpayPayment = () => {
    setPaymentProcessing(true);
    const options: RazorpayOptions = {
      key: 'rzp_live_OtMj4vjVpeRjg8',
      amount: total * 100,
      currency: 'INR',
      name: 'SCR Farms',
      description: 'Purchase from SCR Farms',
      image: '/logo.png',
      prefill: { name: formData.name, contact: formData.phone, email: user?.email || '' },
      notes: { address: formData.address },
      theme: { color: '#E53935' },
      handler: (response: RazorpayResponse) => {
        if (response.razorpay_payment_id) handlePaymentSuccess(response.razorpay_payment_id);
        else handlePaymentFailure('No payment ID received');
      },
      modal: {
        ondismiss: () => {
          setPaymentProcessing(false);
          toast({ title: 'Payment cancelled', description: 'You cancelled the payment.', variant: 'destructive' });
        }
      }
    };
    new (window as unknown as WindowWithRazorpay).Razorpay(options).open();
  };

  const handlePaymentSuccess = async (paymentId: string) => {
    try { await placeOrder.mutateAsync(paymentId); }
    finally { setPaymentProcessing(false); }
  };
  const handlePaymentFailure = (error: string | Error) => {
    setPaymentProcessing(false);
    toast({ title: 'Payment failed', description: 'Please try again.', variant: 'destructive' });
    console.error('Payment failed:', error);
  };

  const handleCODOrder = async () => {
    try { setIsSubmitting(true); await placeOrder.mutateAsync(undefined); }
    catch (e) { console.error('COD order error:', e); }
    finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { name, phone, address, city, state, zipCode } = formData;
    if (!name || !phone || !address || !city || !state || !zipCode) {
      toast({ title: 'Missing information', description: 'Please fill in all required fields.', variant: 'destructive' });
      setIsSubmitting(false); return;
    }
    if (!selectedSlot) {
      toast({ title: 'No delivery slot selected', description: 'Please choose a delivery time slot.', variant: 'destructive' });
      setIsSubmitting(false); return;
    }
    if (cartWithProducts.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      setIsSubmitting(false); return;
    }
    if (cartWithProducts.filter(i => !i.product).length > 0) {
      toast({ title: 'Invalid items in cart', description: 'Some items are no longer available. Refresh and try again.', variant: 'destructive' });
      setIsSubmitting(false); return;
    }
    if (paymentMethod === 'cod') { await handleCODOrder(); return; }
    if (!(window as unknown as WindowWithRazorpay).Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => initializeRazorpayPayment();
      script.onerror = () => {
        toast({ title: 'Payment gateway error', description: 'Failed to load payment gateway.', variant: 'destructive' });
        setIsSubmitting(false);
      };
      document.body.appendChild(script);
    } else {
      initializeRazorpayPayment();
    }
  };

  if (isLoading) {
    return <div className="pt-28 pb-20 section-container flex justify-center"><p>Loading checkout...</p></div>;
  }

  const selectedSlotInfo = availableSlots.find(s => s.id === selectedSlot);

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }} className="pt-28 pb-20"
    >
      <div className="section-container">
        <h1 className="text-3xl font-display font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ════════════════════════════════
               LEFT: Delivery form
          ════════════════════════════════ */}
          <div className="lg:col-span-2">
            <div className="glass-panel p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Delivery Information</h2>

              {userProfile && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>Info:</strong> Your details have been auto-filled from your profile. Modify if needed.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">Full Name</label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Enter your full name" required />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone Number</label>
                  <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter your phone number" required />
                </div>

                {/* ══════════════════════════════
                     GPS Location detector
                ══════════════════════════════ */}
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">📍 Use my current location</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Auto-fills address fields &amp; saves GPS coordinates for accurate delivery routing
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleFetchLocation}
                      disabled={locationLoading}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                        ${locationLoading
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : locationStatus === 'success'
                            ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                            : locationStatus === 'denied'
                              ? 'bg-red-100 text-red-700 border border-red-300 cursor-not-allowed'
                              : 'bg-white text-brand-red border border-brand-red hover:bg-red-50'
                        }
                      `}
                    >
                      {locationLoading ? (
                        <>
                          {/* Spinner */}
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Locating…
                        </>
                      ) : locationStatus === 'success' ? (
                        <>✅ Location saved</>
                      ) : locationStatus === 'denied' ? (
                        <>🚫 Permission denied</>
                      ) : (
                        <>🎯 Detect location</>
                      )}
                    </button>
                  </div>

                  {/* Coordinates pill */}
                  {coords && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-mono">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                        {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                      </span>
                      <span className="text-xs text-gray-400">Saved with order for route optimization</span>
                    </div>
                  )}

                  {/* Permission-denied help text */}
                  {locationStatus === 'denied' && (
                    <p className="mt-2 text-xs text-red-600">
                      To enable: open browser settings → Site settings → Location → Allow for this site, then refresh the page.
                    </p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="address" className="block text-sm font-medium mb-1">
                    Address
                    {locationStatus === 'success' && (
                      <span className="ml-2 text-xs text-green-600 font-normal">← auto-filled · please verify</span>
                    )}
                  </label>
                  <Input id="address" name="address" value={formData.address} onChange={handleChange} placeholder="House no., Street, Area" required />
                </div>

                {/* City + State */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium mb-1">City</label>
                    <Input id="city" name="city" value={formData.city} onChange={handleChange} placeholder="Enter your city" required />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium mb-1">State</label>
                    <Input id="state" name="state" value={formData.state} onChange={handleChange} placeholder="Enter your state" required />
                  </div>
                </div>

                {/* ZIP */}
                <div>
                  <label htmlFor="zipCode" className="block text-sm font-medium mb-1">ZIP Code</label>
                  <Input id="zipCode" name="zipCode" value={formData.zipCode} onChange={handleChange} placeholder="Enter your ZIP code" required />
                </div>

                {/* ══════════════════════════════
                     Delivery Slot Selector
                ══════════════════════════════ */}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-3">
                    Delivery Slot <span className="text-brand-red">*</span>
                  </label>

                  {slotNote && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">ℹ️ {slotNote}</p>
                    </div>
                  )}

                  {availableSlots.length === 0 ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">No slots are currently available. Please try again later.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlot(slot.id)}
                            className={`
                              relative text-left p-4 rounded-lg border-2 transition-all duration-200
                              ${isSelected
                                ? 'border-brand-red bg-red-50 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'}
                            `}
                          >
                            <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full
                              ${slot.date === 'today' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {slot.date === 'today' ? 'Today' : 'Tomorrow'}
                            </span>
                            <div className="flex items-start gap-3 pr-16">
                              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                ${isSelected ? 'border-brand-red' : 'border-gray-400'}`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-brand-red" />}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {slot.emoji} {slot.label}
                                </p>
                                <p className="text-sm text-gray-500 mt-0.5">🕐 {slot.time}</p>
                                {slot.date === 'today' && (
                                  <p className="text-xs text-orange-500 mt-1 font-medium">
                                    {slot.id === 'morning_today' && 'Order before 6:00 AM'}
                                    {slot.id === 'evening_today' && 'Order before 1:00 PM'}
                                    {slot.id === 'night_today'   && 'Order before 6:00 PM'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ══════════════════════════════
                     Payment Method
                ══════════════════════════════ */}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-3">Payment Method</label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input type="radio" id="online" name="paymentMethod" value="online"
                        checked={paymentMethod === 'online'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'online' | 'cod')}
                        className="w-4 h-4 text-brand-red border-gray-300 focus:ring-brand-red" />
                      <label htmlFor="online" className="text-sm font-medium">
                        Online Payment (Credit/Debit Card, UPI, Net Banking)
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input type="radio" id="cod" name="paymentMethod" value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'online' | 'cod')}
                        className="w-4 h-4 text-brand-red border-gray-300 focus:ring-brand-red" />
                      <label htmlFor="cod" className="text-sm font-medium">Cash on Delivery (COD)</label>
                    </div>
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Please keep exact amount ready (₹{total.toFixed(2)}) during delivery.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-brand-red hover:bg-brand-red/90 mt-6"
                  disabled={isSubmitting || paymentProcessing || availableSlots.length === 0}
                >
                  {isSubmitting || paymentProcessing
                    ? 'Processing...'
                    : paymentMethod === 'cod' ? 'Place COD Order' : 'Proceed to Payment'}
                </Button>
              </form>
            </div>
          </div>

          {/* ════════════════════════════════
               RIGHT: Order Summary
          ════════════════════════════════ */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 sticky top-24">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

              <div className="space-y-4 mb-6">
                {cartWithProducts.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div>
                      <span className="font-medium">{item.product?.title}</span>
                      <span className="text-gray-500 block text-sm">{item.quantity} x ₹{item.product?.price}</span>
                    </div>
                    <span className="font-medium">₹{(Number(item.product?.price || 0) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2 mb-4">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{total.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>₹0.00</span></div>
                {paymentMethod === 'cod' && (
                  <div className="flex justify-between text-sm text-gray-600"><span>COD Charges</span><span>₹0.00</span></div>
                )}
              </div>

              <div className="border-t pt-4 mb-4">
                <div className="flex justify-between font-bold"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
              </div>

              {/* Slot summary */}
              {selectedSlotInfo && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-semibold text-green-800 mb-1">🚚 Delivery Slot</p>
                  <p className="text-sm text-green-700">{selectedSlotInfo.dateLabel}</p>
                </div>
              )}

              {/* Location summary */}
              {coords ? (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm font-semibold text-blue-800 mb-1">📍 GPS Saved</p>
                  <p className="text-xs font-mono text-blue-700">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p>
                  <p className="text-xs text-blue-500 mt-1">Used for route optimization</p>
                </div>
              ) : (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-xs text-gray-500">
                    💡 Use "Detect location" for faster, GPS-optimized delivery routing.
                  </p>
                </div>
              )}

              <div className="text-sm text-gray-600 space-y-1 border-t pt-3">
                <p>Payment: {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)'}</p>
                {paymentMethod === 'cod' && (
                  <p className="text-yellow-700 font-medium">Keep exact change: ₹{total.toFixed(2)}</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.main>
  );
};

export default Checkout;