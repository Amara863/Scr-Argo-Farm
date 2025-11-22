
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import sahiwal from "../../public/sahiwal.png";
import { supabase } from "../integrations/supabase/client";
import OfflineCard from "@/components/OfflineCard";

// Updated Product interface to match Admin component exactly with live stock
interface Product {
  id: string;
  title: string;
  image: string;
  price: number | string;
  unit: string;
  description: string;
  full_description?: string;
  ingredients?: string;
  usage_instructions?: string;
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level: number;
  actual_stock: number; // Live stock from stock_movements
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  created_at?: string;
  updated_at?: string;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const Products = () => {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  // Online/offline state
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const queryClient = useQueryClient();

  // Set up real-time subscription for live stock updates
  useEffect(() => {
    // Listen for online/offline events
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Set initial state in case it changed before listeners attached
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel("products_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["live-stock"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_movements" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["live-stock"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["live-stock"] });
        }
      )
      .subscribe();
    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Fetch live stock data from stock_movements table (same as admin)
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

  // Fetch products with live stock information (updated to match admin logic)
  const {
    data: products,
    isLoading: productsLoading,
    error,
  } = useQuery<Product[]>({
    queryKey: ["products", stockData],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, stock_quantity, min_stock_level, max_stock_level")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map products with live stock data
      return (data || []).map((product) => {
        // Find live stock for this product
        const liveStock = stockData.find(stock => stock.product_id === product.id);
        const actualStock = liveStock ? liveStock.actual_stock : (product.stock_quantity || 0);
        
        return {
          ...product,
          stock_quantity: product.stock_quantity ?? 0,
          min_stock_level: product.min_stock_level ?? 10,
          max_stock_level: product.max_stock_level ?? 100,
          full_description: product.full_description || "",
          ingredients: product.ingredients || "",
          usage_instructions: product.usage_instructions || "",
          actual_stock: actualStock,
          stock_status: actualStock <= 0 ? 'out_of_stock' :
            actualStock <= (product.min_stock_level || 10) ? 'low_stock' :
              'in_stock'
        } as Product;
      });
    },
    enabled: !stockLoading, // Wait for stock data to load first
  });

  // Update filtered products when products change
  useEffect(() => {
    if (products) {
      setFilteredProducts(products);
    }
  }, [products]);

  const handleSearch = (query: string) => {
    if (!products) return;

    if (query.trim() === "") {
      setFilteredProducts(products);
      return;
    }

    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    const filtered = products.filter((product) => {
      const titleMatch = searchTerms.some((term) =>
        product.title.toLowerCase().includes(term)
      );
      const descMatch = searchTerms.some((term) =>
        product.description.toLowerCase().includes(term)
      );
      return titleMatch || descMatch;
    });

    setFilteredProducts(filtered);
  };

  // Helper function to determine stock status - matches Admin component logic
  const getStockStatus = (
    product: Product
  ): "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK" => {
    if (product.actual_stock === 0) {
      return "OUT_OF_STOCK";
    } else if (product.actual_stock <= product.min_stock_level) {
      return "LOW_STOCK";
    } else {
      return "IN_STOCK";
    }
  };

  // Helper function to get stock status display
  const getStockStatusDisplay = (status: string) => {
    switch (status) {
      case "OUT_OF_STOCK":
        return { label: "Out of Stock", color: "text-red-600 bg-red-50" };
      case "LOW_STOCK":
        return { label: "Low Stock", color: "text-yellow-600 bg-yellow-50" };
      case "IN_STOCK":
        return { label: "In Stock", color: "text-green-600 bg-green-50" };
      default:
        return { label: "Unknown", color: "text-gray-600 bg-gray-50" };
    }
  };

  const isLoading = productsLoading || stockLoading;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="pt-20 pb-20"
    >
      {/* Search and Products Section */}
      <section className="py-6 bg-brand-blue/10">
        <div className="section-container py-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-4 text-center">
              Our Premium Products
            </h1>
            <SearchBar onSearch={handleSearch} className="border border-gray-900 rounded-lg shadow-sm focus-within:border-brand-red " />
          </div>

          {/* Product Grid - Moved inside the same section */}
          <div className="mt-8">
            {isLoading && !isOnline ? (
              <div className="text-center py-8">
                <OfflineCard message="You are offline. Please check your internet connection to view products." />
              </div>
            ) : isLoading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-500 bg-blue-100 transition ease-in-out duration-150">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading products and live stock data...
                </div>
              </div>
            ) : error && !isOnline ? (
              <div className="text-center py-8">
                <OfflineCard message="You are offline. Please check your internet connection to view products." />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <h3 className="text-xl text-gray-600">
                  Error loading products. Please try again.
                </h3>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <h3 className="text-xl text-gray-600">
                  No products found. Try a different search term.
                </h3>
              </div>
            ) : (
              // Display products in a grid
              <div className="space-y-6">
                {chunkArray(filteredProducts, 4).map((group, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="overflow-x-auto sm:overflow-visible"
                  >
                    <div className="flex gap-0 sm:grid sm:grid-cols-4 sm:gap-4 w-max">
                      {group.map((product) => {
                        const stockStatus = getStockStatus(product);
                        const stockDisplay = getStockStatusDisplay(stockStatus);

                        return (
                          <div
                            key={product.id}
                            className="min-w-[180px] max-w-[220px] sm:min-w-[250px] sm:max-w-[300px] mx-auto scale-[0.85] sm:scale-[0.95] flex-shrink-0"
                          >
                            <ProductCard
                              id={product.id}
                              title={product.title}
                              image={product.image}
                              price={
                                typeof product.price === "number"
                                  ? product.price.toString()
                                  : product.price.toString()
                              }
                              unit={product.unit}
                              description={product.description}
                              stockQuantity={product.actual_stock} // Use live stock instead of DB stock
                              stockStatus={product.stock_status}
                              minStockLevel={product.min_stock_level}
                              maxStockLevel={product.max_stock_level}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stock Summary Section - Updated to use live stock data */}
      <section className="py-8 bg-gray-50">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                <div>
                  <h3 className="font-semibold text-green-700">In Stock</h3>
                  <p className="text-2xl font-bold text-green-800">
                    {products?.filter(
                      (p) => p.actual_stock > p.min_stock_level
                    ).length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Products available</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
                <div>
                  <h3 className="font-semibold text-yellow-700">Low Stock</h3>
                  <p className="text-2xl font-bold text-yellow-800">
                    {products?.filter(
                      (p) =>
                        p.actual_stock > 0 &&
                        p.actual_stock <= p.min_stock_level
                    ).length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Products running low</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
                <div>
                  <h3 className="font-semibold text-red-700">Out of Stock</h3>
                  <p className="text-2xl font-bold text-red-800">
                    {products?.filter((p) => p.actual_stock === 0).length ||
                      0}
                  </p>
                  <p className="text-sm text-gray-600">Products unavailable</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Alert for customers - Updated to use live stock */}
          {products &&
            products.some((p) => p.actual_stock <= p.min_stock_level) && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Limited Stock Alert
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Some products are running low on stock. Order now to
                        avoid disappointment!
                      </p>
                      <div className="mt-2">
                        <p className="font-medium">Low stock items:</p>
                        <ul className="mt-1 list-disc list-inside">
                          {products
                            .filter((p) => p.actual_stock <= p.min_stock_level && p.actual_stock > 0)
                            .slice(0, 3)
                            .map((product) => (
                              <li key={product.id} className="text-xs">
                                {product.title} - Only {product.actual_stock} left
                              </li>
                            ))}
                          {products.filter((p) => p.actual_stock <= p.min_stock_level && p.actual_stock > 0).length > 3 && (
                            <li className="text-xs">
                              ...and {products.filter((p) => p.actual_stock <= p.min_stock_level && p.actual_stock > 0).length - 3} more items
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Out of Stock Notice */}
          {products &&
            products.some((p) => p.actual_stock === 0) && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Out of Stock Items
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        The following items are currently out of stock:
                      </p>
                      <div className="mt-2">
                        <ul className="list-disc list-inside">
                          {products
                            .filter((p) => p.actual_stock === 0)
                            .slice(0, 3)
                            .map((product) => (
                              <li key={product.id} className="text-xs">
                                {product.title}
                              </li>
                            ))}
                          {products.filter((p) => p.actual_stock === 0).length > 3 && (
                            <li className="text-xs">
                              ...and {products.filter((p) => p.actual_stock === 0).length - 3} more items
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </section>

      {/* Product Benefits */}
      <section className="py-16 bg-brand-cream">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-display font-bold mb-6">
                Why Choose Our A2 Products?
              </h2>
              <div className="space-y-4">
                <div className="glass-panel p-4">
                  <h3 className="font-semibold mb-1">Immunity Booster</h3>
                  <p className="text-sm">
                    Strengthens your immune system with its natural nutrients.
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <h3 className="font-semibold mb-1">Bone Strengthener</h3>
                  <p className="text-sm">
                    Rich in calcium that supports strong bones and teeth
                    development.
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <h3 className="font-semibold mb-1">Heart-Healthy</h3>
                  <p className="text-sm">
                    Good for cardiovascular health and helps maintain
                    cholesterol.
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <h3 className="font-semibold mb-1">Deeply Nourishing</h3>
                  <p className="text-sm">
                    Provides essential nutrients for overall wellbeing.
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <h3 className="font-semibold mb-1">Easier to Digest</h3>
                  <p className="text-sm">
                    A2 proteins are gentler on the digestive system.
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <h3 className="font-semibold mb-1">Rich in Nutrients</h3>
                  <p className="text-sm">
                    Packed with essential vitamins and minerals.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <div className="aspect-w-4 aspect-h-3 rounded-2xl overflow-hidden">
                <img
                  src={sahiwal}
                  alt="A2 Sahiwal Cows"
                  className="object-cover w-full h-full"
                />
              </div>
              <p className="mt-4 text-sm text-center italic">
                Our Sahiwal cows are raised with love and care in a natural
                environment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ordering Info */}
      <section className="py-16">
        <div className="section-container">
          <div className="glass-panel p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-display font-semibold mb-6 text-center">
              How to Order
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-brand-red text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                  <span className="font-bold">1</span>
                </div>
                <h3 className="font-medium mb-2">Call Us</h3>
                <p className="text-sm">
                  Call Mrs. Sarika Reddy at +91 9868220018 or S. Chandrasheker
                  Reddy at +91 9701039748.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-brand-red text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                  <span className="font-bold">2</span>
                </div>
                <h3 className="font-medium mb-2">Place Your Order</h3>
                <p className="text-sm">
                  Tell us what products you'd like to order and provide your
                  delivery details.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-brand-red text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                  <span className="font-bold">3</span>
                </div>
                <h3 className="font-medium mb-2">Receive at Home</h3>
                <p className="text-sm">
                  Enjoy home delivery of fresh dairy products right to your
                  doorstep.
                </p>
              </div>
            </div>
            <div className="mt-8 text-center">
              <p className="text-sm mb-2">
                <span className="font-semibold">Note:</span> Orders placed
                before 4 PM will be delivered the next day.
              </p>
              <p className="text-brand-red font-medium">
                Home Delivery Available!
              </p>
            </div>
          </div>
        </div>
      </section>
    </motion.main>
  );
};

export default Products;
