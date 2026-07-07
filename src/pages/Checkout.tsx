import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Phone, User, ShoppingBag, CreditCard, 
  Truck, ArrowRight, ArrowLeft, CheckCircle2, 
  MapPinLine, Calendar, Clock, Sparkles
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface RazorpayResponse {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  error?: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
  };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  prefill: {
    name: string;
    contact: string;
    email: string;
  };
  notes: Record<string, string>;
  theme: {
    color: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal: {
    ondismiss: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface WindowWithRazorpay extends Window {
  Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
}

interface DeliverySlot {
  id: string;
  label: string;
  time: string;
  date: 'today' | 'tomorrow';
  dateLabel: string;
  emoji: string;
}

function getISTSnapshot(): { hour: number; dateLabel: string; tomorrowLabel: string } {
  const nowUTC = new Date();
  const istMs = nowUTC.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const hour = ist.getUTCHours() + ist.getUTCMinutes() / 60;
  
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Asia/Kolkata'
  });
  
  const todayDate = new Date(istMs);
  const tomorrowDate = new Date(istMs + 24 * 60 * 60 * 1000);
  
  return { hour, dateLabel: fmt(todayDate), tomorrowLabel: fmt(tomorrowDate) };
}

function getAvailableSlots(): DeliverySlot[] {
  const { hour, dateLabel, tomorrowLabel } = getISTSnapshot();
  const slots: DeliverySlot[] = [];

  if (hour < 6) {
    slots.push({
      id: 'morning_today', label: 'Morning Delivery', emoji: '🌅',
      time: '7:00 AM – 10:00 AM', date: 'today',
      dateLabel: `Today (${dateLabel}) · 7:00 AM – 10:00 AM`
    });
  }
  if (hour < 13) {
    slots.push({
      id: 'evening_today', label: 'Evening Delivery', emoji: '🌇',
      time: '3:00 PM – 4:00 PM', date: 'today',
      dateLabel: `Today (${dateLabel}) · 3:00 PM – 4:00 PM`
    });
  }
  if (hour < 18) {
    slots.push({
      id: 'night_today', label: 'Night Delivery', emoji: '🌙',
      time: '8:00 PM – 10:00 PM', date: 'today',
      dateLabel: `Today (${dateLabel}) · 8:00 PM – 10:00 PM`
    });
  }

  slots.push({
    id: 'morning_tomorrow', label: 'Morning Delivery', emoji: '🌅',
    time: '7:00 AM – 10:00 AM', date: 'tomorrow',
    dateLabel: `Tomorrow (${tomorrowLabel}) · 7:00 AM – 10:00 AM`
  });
  slots.push({
    id: 'evening_tomorrow', label: 'Evening Delivery', emoji: '🌇',
    time: '3:00 PM – 4:00 PM', date: 'tomorrow',
    dateLabel: `Tomorrow (${tomorrowLabel}) · 3:00 PM – 4:00 PM`
  });
  slots.push({
    id: 'night_tomorrow', label: 'Night Delivery', emoji: '🌙',
    time: '8:00 PM – 10:00 PM', date: 'tomorrow',
    dateLabel: `Tomorrow (${tomorrowLabel}) · 8:00 PM – 10:00 PM`
  });

  return slots;
}

function getSlotNote(hour: number): string {
  if (hour >= 22) return "It's past 10 PM — all today's slots are closed. Tomorrow's slots are open below.";
  if (hour >= 18) return "Night slot for today is now closed. All tomorrow slots are available.";
  if (hour >= 13) return "Morning & Evening slots for today are closed. Night delivery (8–10 PM) is still available today!";
  if (hour >= 6) return "Morning slot for today is closed. Evening and Night slots are still open for today.";
  return '';
}

function getISTHour(): number {
  return getISTSnapshot().hour;
}

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

const Checkout = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '', phone: '', address: '', city: '', state: '', zipCode: ''
  });

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'success' | 'error' | 'denied'>('idle');

  const [istHour, setIstHour] = useState<number>(getISTHour());
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  useEffect(() => {
    const tick = () => { setIstHour(getISTHour()); };
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  const availableSlots = getAvailableSlots();
  const slotNote = getSlotNote(istHour);

  useEffect(() => {
    const ids = availableSlots.map(s => s.id);
    if (!ids.includes(selectedSlot)) {
      setSelectedSlot(ids[0] ?? '');
    }
  }, [istHour]);

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
        name:     userProfile.name     || '',
        phone:    userProfile.phone    || '',
        address:  userProfile.address  || '',
        city:     userProfile.city     || '',
        state:    userProfile.state    || '',
        zipCode:  userProfile.zip_code || ''
      });
    }
  }, [userProfile]);

  const { data: products } = useQuery<Tables<'products'>[]>({
    queryKey: ['products-for-cart'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      return data as Tables<'products'>[];
    },
  });

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

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Not supported', description: 'Geometry GPS is not supported.', variant: 'destructive' });
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
          toast({ title: '📍 Location captured', description: 'Address fields auto-filled from GPS.' });
        } catch {
          setLocationStatus('success');
          toast({ title: '📍 Coordinates saved', description: 'Please fill address fields manually.', variant: 'destructive' });
        }
        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
          toast({ title: 'Location permission denied', variant: 'destructive' });
        } else {
          setLocationStatus('error');
          toast({ title: 'Could not get location', variant: 'destructive' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

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

  const placeOrder = useMutation({
    mutationFn: async (paymentId?: string) => {
      if (!user) throw new Error('User not authenticated');
      if (cartWithProducts.length === 0) throw new Error('Cart is empty');
      if (cartWithProducts.filter(i => !i.product).length > 0) throw new Error('Items no longer available');
      if (!selectedSlot) throw new Error('Please select a delivery slot');

      try { await updateProfile.mutateAsync(formData); }
      catch (e) { console.log('Profile update failed:', e); }

      // 🌟 FIXED LOGIC STAGE FOR ADMIN VISIBILITY OVERLAP
      // Status hamesha 'pending' save hoga taaki Admin Panel ise fetch karke driver assign kar sake!
      const orderData: Record<string, any> = {
        user_id:           user.id,
        total:             Number(total.toFixed(2)),
        status:            'pending', 
        payment_method:    paymentMethod === 'cod' ? 'cod' : 'online',
        name:              formData.name,
        phone:             formData.phone,
        email:             user.email || '',
        address:           formData.address,
        city:              formData.city,
        state:             formData.state,
        zip_code:          formData.zipCode,
        payment_id:        paymentId || null,
        payment_order_id:  null,
        payment_signature: null,
        delivery_slot:     selectedSlot,
        created_at:        new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      };

      if (coords) {
        orderData.delivery_lat = coords.lat;
        orderData.delivery_lng = coords.lng;
      }

      const { data: order, error: orderError } = await supabase.from('orders').insert([orderData]).select().single();
      if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);
      if (!order) throw new Error('No order returned');

      const orderItems = cartWithProducts.filter(item => item.product).map(item => ({
        order_id:   order.id,
        product_id: item.resolved_product_id,
        quantity:   item.quantity,
        price:      Number(item.product!.price || 0),
        created_at: new Date().toISOString()
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw new Error(`Failed to create items: ${itemsError.message}`);

      await supabase.from('cart_items').delete().eq('user_id', user.id);
      return order.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Order placed successfully! 🎉', description: paymentMethod === 'cod' ? 'Cash on Delivery acknowledged.' : 'Online checkout secure processed.' });
      navigate('/orders');
    },
    onError: (error) => {
      toast({ title: 'Error processing order', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' });
    }
  });

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
          toast({ title: 'Payment cancelled', variant: 'destructive' });
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
    toast({ title: 'Payment failed', variant: 'destructive' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'cod') {
      try { setIsSubmitting(true); await placeOrder.mutateAsync(undefined); }
      catch (e) { console.error(e); }
      finally { setIsSubmitting(false); }
    } else {
      if (!(window as unknown as WindowWithRazorpay).Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => initializeRazorpayPayment();
        document.body.appendChild(script);
      } else {
        initializeRazorpayPayment();
      }
    }
  };

  if (isLoading) {
    return <div className="pt-28 pb-20 section-container flex justify-center"><p>Loading checkout...</p></div>;
  }

  const selectedSlotInfo = availableSlots.find(s => s.id === selectedSlot);

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="pt-28 pb-20">
      <div className="section-container">
        
        {/* Progress Tracker Bar */}
        <div className="flex items-center justify-between mb-8 max-w-md mx-auto">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${currentStep >= 1 ? 'bg-brand-red text-white' : 'bg-gray-200 text-gray-700'}`}>1</div>
          <div className={`flex-1 h-1 mx-2 ${currentStep >= 2 ? 'bg-brand-red' : 'bg-gray-200'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${currentStep >= 2 ? 'bg-brand-red text-white' : 'bg-gray-200'}`}>2</div>
          <div className={`flex-1 h-1 mx-2 ${currentStep === 3 ? 'bg-brand-red' : 'bg-gray-200'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${currentStep === 3 ? 'bg-brand-red text-white' : 'bg-gray-200'}`}>3</div>
        </div>

        <h1 className="text-3xl font-display font-bold mb-8 text-center sm:text-left">Checkout Portal</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="glass-panel p-6 mb-8">
              <form onSubmit={handleSubmit}>

                {/* STEP 1 */}
                {currentStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <h2 className="text-xl font-semibold mb-2 text-gray-800 border-b pb-2">📦 Step 1: Delivery Address Details</h2>
                    {userProfile && <div className="p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-800"><strong>Auto-filled:</strong> Details fetched from your user profile.</div>}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-1">Full Name</label>
                      <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" required />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone Number</label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter contact number" required />
                    </div>
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 bg-gray-50">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">📍 Use current GPS location</p>
                          <p className="text-xs text-gray-500">Auto-fills fields & saves coordinates for smart routing.</p>
                        </div>
                        <button type="button" onClick={handleFetchLocation} disabled={locationLoading} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${locationLoading ? 'bg-gray-200 text-gray-500' : 'bg-white text-brand-red border border-brand-red hover:bg-red-50'}`}>
                          {locationLoading ? 'Locating...' : locationStatus === 'success' ? '✅ Captured' : '🎯 Detect location'}
                        </button>
                      </div>
                      {coords && <div className="mt-2 text-xs font-mono text-green-700">Coordinates: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</div>}
                    </div>
                    <div>
                      <label htmlFor="address" className="block text-sm font-medium mb-1">Address</label>
                      <Input id="address" name="address" value={formData.address} onChange={handleChange} placeholder="House no., Street, Area" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium mb-1">City</label>
                        <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
                      </div>
                      <div>
                        <label htmlFor="state" className="block text-sm font-medium mb-1">State</label>
                        <Input id="state" name="state" value={formData.state} onChange={handleChange} required />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="zipCode" className="block text-sm font-medium mb-1">ZIP Code</label>
                      <Input id="zipCode" name="zipCode" value={formData.zipCode} onChange={handleChange} required />
                    </div>
                    <Button type="button" onClick={() => {
                      if (!formData.name || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.zipCode) {
                        toast({ title: 'Validation Alert', description: 'Please fill all required address inputs.', variant: 'destructive' });
                        return;
                      }
                      setCurrentStep(2);
                    }} className="w-full bg-brand-red hover:bg-brand-red/90 mt-6">Continue to Delivery Slots ➔</Button>
                  </motion.div>
                )}

                {/* STEP 2 */}
                {currentStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <h2 className="text-xl font-semibold mb-2 text-gray-800 border-b pb-2">⏰ Step 2: Choose Delivery Time Batch</h2>
                    {slotNote && <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">ℹ️ {slotNote}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot === slot.id;
                        return (
                          <button key={slot.id} type="button" onClick={() => setSelectedSlot(slot.id)} className={`relative text-left p-4 rounded-lg border-2 transition-all ${isSelected ? 'border-brand-red bg-red-50' : 'border-gray-200 bg-white'}`}>
                            <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${slot.date === 'today' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{slot.date === 'today' ? 'Today' : 'Tomorrow'}</span>
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-brand-red' : 'border-gray-400'}`}>{isSelected && <div className="w-2 h-2 rounded-full bg-brand-red" />}</div>
                              <div>
                                <p className="text-sm font-semibold">{slot.emoji} {slot.label}</p>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">{slot.time}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-6">
                      <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="w-1/2">🎒 Back</Button>
                      <Button type="button" onClick={() => selectedSlot ? setCurrentStep(3) : toast({ title: 'Slot Missing', variant: 'destructive' })} className="w-1/2 bg-brand-red hover:bg-brand-red/90">Proceed to Payment ➔</Button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3 */}
                {currentStep === 3 && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <h2 className="text-xl font-semibold mb-2 text-gray-800 border-b pb-2">💳 Step 3: Secure Payment Gateways</h2>
                    <div className="space-y-3 p-2 border rounded-xl bg-white">
                      <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                        <input type="radio" id="online" name="paymentMethod" value="online" checked={paymentMethod === 'online'} onChange={(e) => setPaymentMethod(e.target.value as 'online' | 'cod')} className="w-4 h-4 text-brand-red border-gray-300 focus:ring-brand-red" />
                        <label htmlFor="online" className="text-sm font-medium cursor-pointer">Online Gateway Payment (UPI, Cards, Netbanking)</label>
                      </div>
                      <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                        <input type="radio" id="cod" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={(e) => setPaymentMethod(e.target.value as 'online' | 'cod')} className="w-4 h-4 text-brand-red border-gray-300 focus:ring-brand-red" />
                        <label htmlFor="cod" className="text-sm font-medium cursor-pointer">Cash On Delivery (COD)</label>
                      </div>
                    </div>
                    {paymentMethod === 'cod' && <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800">Please pay exactly <strong>₹{total.toFixed(2)}</strong> to the logistics courier.</div>}
                    <div className="flex gap-4 mt-6">
                      <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="w-1/3">🎒 Back</Button>
                      <Button type="submit" className="w-2/3 bg-brand-red hover:bg-brand-red/90" disabled={isSubmitting || paymentProcessing}>
                        {isSubmitting || paymentProcessing ? 'Processing Order...' : paymentMethod === 'cod' ? 'Confirm Place COD Order' : 'Pay via Razorpay Secure'}
                      </Button>
                    </div>
                  </motion.div>
                )}

              </form>
            </div>
          </div>

          {/* REVIEW SUMMARY PANEL */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 sticky top-24 shadow-sm rounded-2xl bg-white border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">🛒 Order Review</h2>
              <div className="space-y-4 mb-6 max-h-48 overflow-y-auto pr-1">
                {cartWithProducts.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <span className="font-semibold block text-gray-800">{item.product?.title}</span>
                      <span className="text-gray-500 text-xs">{item.quantity} units x ₹{item.product?.price}</span>
                    </div>
                    <span className="font-medium text-gray-900">₹{(Number(item.product?.price || 0) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between"><span>Items Subtotal</span><span>₹{total.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Logistics Shipping</span><span className="text-green-600 font-medium">FREE</span></div>
              </div>
              <div className="border-t pt-3 mb-4">
                <div className="flex justify-between font-bold text-lg text-gray-900"><span>Grand Total</span><span>₹{total.toFixed(2)}</span></div>
              </div>
              {selectedSlotInfo && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 mb-2"><strong>🗓️ Delivery Batch:</strong> {selectedSlotInfo.dateLabel}</div>}
            </div>
          </div>

        </div>
      </div>
    </motion.main>
  );
};

export default Checkout;