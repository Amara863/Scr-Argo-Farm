
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, ShoppingCart } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  title: string;
  image: string;
  price: string;
  unit: string;
  description?: string;
  id: string | number;
  stockQuantity?: number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  isPreviouslyPurchased?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  title, 
  image, 
  price, 
  unit, 
  description, 
  id,
  stockQuantity = 0,
   stockStatus = 'OUT_OF_STOCK',
  isPreviouslyPurchased = false,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOutOfStock = stockStatus === 'OUT_OF_STOCK';

  const handleAddToCart = async () => {
    if (isOutOfStock) {
      toast({
        title: "Out of Stock",
        description: "This product is currently out of stock",
        variant: "destructive"
      });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to add items to your cart",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if the product is already in the cart
      const { data: existingCartItem } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('product_id', id.toString())
        .single();

      if (existingCartItem) {
        // Check if adding one more would exceed available stock
        if (existingCartItem.quantity + 1 > stockQuantity) {
          toast({
            title: "Not enough stock",
            description: `Only ${stockQuantity} items available`,
            variant: "destructive"
          });
          return;
        }

        // Update quantity if already in cart
        const { error } = await supabase
          .from('cart_items')
          .update({ 
            quantity: existingCartItem.quantity + 1, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', existingCartItem.id);

        if (error) throw error;
      } else {
        // Add new item to cart
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: session.user.id,
            product_id: id.toString(),
            quantity: 1
          });

        if (error) throw error;
      }

      // Invalidate cart query to refresh the cart
      queryClient.invalidateQueries({ queryKey: ['cart'] });

      //button added in message
     toast({
        title: "Added to cart",
        description: (
          <div className="flex flex-col items-start gap-2">
            <span>{title} has been added to your cart.</span>
            <a
              href="/cart"
              className="px-3 py-1 text-sm rounded-md bg-brand-red text-white hover:bg-brand-red/90 text-center block"
            >
              View Cart
            </a>
          </div>
        ),
      });

      
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast({
        title: "Error",
        description: "There was a problem adding the item to your cart.",
        variant: "destructive"
      });
    }
  };

  return (
    <motion.div 
      className={`glass-panel overflow-hidden flex flex-col h-full ${
        isOutOfStock ? 'opacity-75' : ''
      }`}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Link to={`/product/${id}`} className="relative aspect-square overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
        <div className="absolute top-2 right-2 bg-brand-red text-white text-xs px-2 py-1 rounded-full">
          A2 Sahiwal
        </div>

        {isPreviouslyPurchased && (
  <div className="absolute bottom-2 left-2 z-20 bg-yellow-100 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-md shadow">
    Buy Again
  </div>
)}
        
        {/* Stock Status Badge */}
        {stockQuantity > 0 && (
          <div className="absolute top-2 left-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              stockStatus === 'LOW_STOCK' 
                ? 'bg-yellow-500 text-white' 
                : 'bg-green-500 text-white'
            }`}>
              {stockQuantity} left
            </span>
          </div>
        )}
        
        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
            <span className="bg-red-600 text-white px-3 py-1 rounded-md font-semibold text-sm">
              Out of Stock
            </span>
          </div>
        )}
      </Link>
      
      <div className="p-6 flex flex-col flex-grow">
        <Link to={`/product/${id}`}>
          <h3 className="font-display text-xl font-semibold mb-2 hover:text-brand-red transition-colors">{title}</h3>
        </Link>
        {description && (
          <p className="text-sm text-gray-600 mb-4">{description}</p>
        )}
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-lg font-bold text-brand-red">₹{price}</span>
              <span className="text-sm text-gray-500 ml-1">/ {unit}</span>
            </div>
            {stockQuantity > 0 && (
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  stockStatus === 'LOW_STOCK' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {stockQuantity} available
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1 bg-white border-2 border-brand-red text-brand-red hover:bg-brand-red/10"
              asChild
            >
              <Link to={`/product/${id}`}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </Link>
            </Button>
            <Button 
              size="sm" 
              className={`flex-1 ${
                isOutOfStock 
                  ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-brand-red hover:bg-brand-red/90 text-white'
              }`}
              onClick={handleAddToCart}
              disabled={isOutOfStock}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isOutOfStock ? 'Out of Stock' : 'Add'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
