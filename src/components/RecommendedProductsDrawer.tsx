import { recommendationMap } from "@/data/recommendationMap";
import { supabase } from "@/integrations/supabase/client";
import {
  getRecommendationKeyword,
  titleMatchesKeyword,
} from "@/lib/titleNormalization";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import RecommendationProductCard, {
  type RecommendationProduct,
} from "./RecommendationProductCard";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";

interface RecommendedProductsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProduct: {
    id: string;
    title: string;
  };
}

const MAX_RECOMMENDATIONS = 6;

const RecommendedProductsDrawer = ({
  open,
  onOpenChange,
  currentProduct,
}: RecommendedProductsDrawerProps) => {
  const navigate = useNavigate();
  const { data: availableProducts = [], isLoading, isError } = useQuery({
    queryKey: ["recommendation-products"],
    queryFn: async (): Promise<RecommendationProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, image, price, unit")
        .gt("stock_quantity", 0);

      if (error) throw error;

      return data || [];
    },
    enabled: open,
  });

  const recommendations = useMemo(() => {
    const otherAvailableProducts = availableProducts.filter(
      (product) => product.id !== currentProduct.id,
    );
    const keyword = getRecommendationKeyword(currentProduct.title);
    const mappedKeywords = keyword ? recommendationMap[keyword] : [];
    const mappedProducts = otherAvailableProducts.filter((product) =>
      mappedKeywords.some((mappedKeyword) =>
        titleMatchesKeyword(product.title, mappedKeyword),
      ),
    );

    return (mappedProducts.length > 0 ? mappedProducts : otherAvailableProducts).slice(
      0,
      MAX_RECOMMENDATIONS,
    );
  }, [availableProducts, currentProduct.id, currentProduct.title]);

  const handleSelect = (productId: string) => {
    onOpenChange(false);
    navigate(`/product/${productId}`);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[82vh]">
        <DrawerHeader className="border-b px-4 pb-4 pt-2 text-left">
          <DrawerTitle>Explore Similar Products</DrawerTitle>
          <DrawerDescription>
            You might also like these products.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-6 pt-4">
          {isLoading && (
            <p className="py-8 text-center text-sm text-gray-600">
              Finding similar products...
            </p>
          )}
          {isError && (
            <p className="py-8 text-center text-sm text-gray-600">
              Recommendations could not be loaded right now.
            </p>
          )}
          {!isLoading && !isError && recommendations.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-600">
              No other products are currently available.
            </p>
          )}
          {!isLoading && !isError && recommendations.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {recommendations.map((product) => (
                <RecommendationProductCard
                  key={product.id}
                  product={product}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default RecommendedProductsDrawer;
