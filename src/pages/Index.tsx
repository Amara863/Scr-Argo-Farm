
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Shield, Leaf, Truck, ShoppingBag, Award } from 'lucide-react';
import HeroSection from '@/components/HeroSection';
import ProductCard from '@/components/ProductCard';
import BenefitCard from '@/components/BenefitCard';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Product } from '@/types/products';
import packaging from '../../public/package.png';

const Index = () => {
  // Fetch products from Supabase
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, stock_quantity, min_stock_level')
        .limit(4);
      
      if (error) throw error;
      return data.map(product => ({
        ...product,
        stock_quantity: product.stock_quantity ?? 0,
        min_stock_level: product.min_stock_level ?? 10
      })) as Product[];
    },
  });

  // Animate on scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in-section').forEach(section => {
      observer.observe(section);
    });

    return () => {
      document.querySelectorAll('.fade-in-section').forEach(section => {
        observer.unobserve(section);
      });
    };
  }, []);

  return (
    <main>
      {/* Hero Section */}
      <HeroSection />

      {/* Benefits Section */}
      <section className="py-20 bg-brand-cream">
        <div className="section-container">
          <div className="text-center mb-12 fade-in-section">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Benefits of A2 Milk Products
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Experience the goodness of traditional dairy with our pure A2 Sahiwal milk products, 
              crafted with love and care using the ancient Bilona method.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <BenefitCard 
              icon={<Shield className="h-8 w-8" />}
              title="Immunity Booster"
              description="A2 milk strengthens your immune system with its natural nutrients and beneficial enzymes."
            />
            <BenefitCard 
              icon={<Award className="h-8 w-8" />}
              title="Bone Strengthener"
              description="Rich in calcium and other minerals that support strong bones and teeth development."
            />
            <BenefitCard 
              icon={<Heart className="h-8 w-8" />}
              title="Heart Healthy"
              description="A2 milk products are good for cardiovascular health and help maintain healthy cholesterol levels."
            />
            <BenefitCard 
              icon={<Leaf className="h-8 w-8" />}
              title="100% Organic"
              description="Our cows are fed with organic fodder and raised in a natural environment without antibiotics."
            />
            <BenefitCard 
              icon={<Truck className="h-8 w-8" />}
              title="Home Delivery"
              description="Fresh dairy products delivered right to your doorstep, preserving quality and freshness."
            />
            <BenefitCard 
              icon={<ShoppingBag className="h-8 w-8" />}
              title="Premium Packaging"
              description="Our products come in high-quality packaging that maintains purity and extends shelf life."
            />
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-20">
        <div className="section-container">
          <div className="text-center mb-12 fade-in-section">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Our Premium Products
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Discover our range of farm-fresh A2 dairy products, each made with traditional methods 
              that preserve the natural goodness and flavor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              // Calculate stock status
              const stockStatus = product.stock_quantity <= 0 
                ? 'OUT_OF_STOCK'
                : product.stock_quantity <= product.min_stock_level
                ? 'LOW_STOCK'
                : 'IN_STOCK';

              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  image={product.image}
                  price={product.price}
                  unit={product.unit}
                  description={product.description}
                  stockQuantity={product.stock_quantity}
                  stockStatus={stockStatus}
                />
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link to="/products">
              <Button size="lg" className="bg-brand-red hover:bg-brand-red/90 text-white">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Bilona Method Section */}
      <section className="py-20 bg-gradient-to-br from-white via-brand-blue/10 to-white">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              className="fade-in-section"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
                The Traditional Bilona Method
              </h2>
              <p className="text-lg text-gray-700 mb-4">
                Our dairy products are created using the ancient Bilona method, 
                which has been practiced in India for centuries. This traditional process 
                ensures that all the natural goodness and flavor of the milk is preserved.
              </p>
              
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <span className="text-brand-red font-bold mr-2">•</span>
                  <span>Rich in probiotics for better digestion</span>
                </li>
                <li className="flex items-start">
                  <span className="text-brand-red font-bold mr-2">•</span>
                  <span>Natural fermentation improves gut health</span>
                </li>
                <li className="flex items-start">
                  <span className="text-brand-red font-bold mr-2">•</span>
                  <span>No artificial additives or preservatives</span>
                </li>
                <li className="flex items-start">
                  <span className="text-brand-red font-bold mr-2">•</span>
                  <span>Traditional clay pot fermentation enhances taste and texture</span>
                </li>
              </ul>
              
              <Link to="/bilona-method">
                <Button className="bg-brand-red hover:bg-brand-red/90 text-white">
                  Learn More About The Process
                </Button>
              </Link>
            </motion.div>
            
            <motion.div 
              className="relative"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <div className="aspect-w-4 aspect-h-3 rounded-2xl overflow-hidden">
                <img 
                  src={packaging}
                  alt="Traditional Bilona Method" 
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 glass-panel p-4 rounded-xl shadow-lg max-w-xs">
                <p className="text-sm italic">
                  "Our commitment to the traditional Bilona method ensures you get dairy products 
                  that are not just delicious but also nutritionally superior."
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-brand-red text-white">
        <div className="section-container">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
              Ready to Experience the Goodness?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Order now and have farm-fresh dairy products delivered right to your doorstep.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-white text-brand-red hover:bg-brand-cream">
                Order Now
              </Button>
              <Link to="/contact">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Index;