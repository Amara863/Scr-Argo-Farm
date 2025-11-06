// paymentRoutes.js - Handle Razorpay payment integration and COD orders



import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import Razorpay from 'razorpay';

dotenv.config();

const router = express.Router();

// Initialize Supabase client with service role key for backend operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role key for enhanced permissions
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Save order to database (for both COD and online payments)
router.post('/save-order', async (req, res) => {
  try {
    console.log('Received order data:', req.body);

    const {
      user_id,
      total,
      status,
      payment_method = 'online',
      name,
      phone,
      address,
      city,
      state,
      zip_code,
      email
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!user_id) missingFields.push('user_id');
    if (!total && total !== 0) missingFields.push('total');
    if (!name) missingFields.push('name');
    if (!phone) missingFields.push('phone');
    if (!address) missingFields.push('address');
    if (!city) missingFields.push('city');
    if (!state) missingFields.push('state');
    if (!zip_code) missingFields.push('zip_code');

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields',
        missingFields: missingFields
      });
    }

    // Generate order number
    const orderNumber = `SCR${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare order data
    const orderData = {
      user_id,
      order_number: orderNumber,
      total: parseFloat(total),
      status: status || (payment_method === 'cod' ? 'pending_cod' : 'pending'),
      payment_method,
      customer_name: name,
      customer_phone: phone,
      delivery_address: address,
      delivery_city: city,
      delivery_state: state,
      delivery_zip_code: zip_code,
      customer_email: email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Creating order with data:', orderData);

    // Create order in database
    const { data: order, error } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating order:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create order',
        details: error.message,
        hint: error.hint
      });
    }

    console.log('Order created successfully:', order);

    // Send response
    res.status(201).json({
      success: true,
      message: payment_method === 'cod' ? 'COD order created successfully' : 'Order created successfully',
      id: order.id,
      order: {
        id: order.id,
        order_number: orderNumber,
        total: parseFloat(total),
        status: order.status,
        payment_method: payment_method
      }
    });

  } catch (error) {
    console.error('Error in save-order:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Create a Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    
    if (!amount) {
      return res.status(400).json({ 
        success: false,
        error: 'Amount is required' 
      });
    }
    
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt,
      notes
    };
    
    const order = await razorpay.orders.create(options);
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verify Razorpay payment
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      order_id
    } = req.body;
    
    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    
    const isAuthentic = expectedSignature === razorpay_signature;
    
    if (isAuthentic) {
      // Update order status in Supabase
      if (order_id) {
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            payment_id: razorpay_payment_id,
            payment_order_id: razorpay_order_id,
            payment_signature: razorpay_signature,
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id);
        
        if (error) {
          console.error('Error updating order status:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to update order status'
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all orders for a user
router.get('/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch orders'
      });
    }
    
    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Error in get orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update order status (for admin use)
router.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'pending_cod', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'paid', 'failed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating order status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update order status'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order: data
    });
  } catch (error) {
    console.error('Error in update order status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get payment details
router.get('/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await razorpay.payments.fetch(paymentId);
    
    res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
});

// Webhook to handle payment events from Razorpay
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const shasum = crypto.createHmac('sha256', webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');
    
    if (digest !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    
    const { event, payload } = req.body;
    
    // Handle different webhook events
    switch (event) {
      case 'payment.authorized':
        await handlePaymentAuthorized(payload.payment);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload.payment);
        break;
      // Add more event handlers as needed
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


