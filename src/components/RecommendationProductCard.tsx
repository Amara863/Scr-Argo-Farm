export interface RecommendationProduct {
  id: string;
  title: string;
  image: string | null;
  price: number;
  unit: string | null;
}

interface RecommendationProductCardProps {
  product: RecommendationProduct;
  onSelect: (productId: string) => void;
}

const RecommendationProductCard = ({
  product,
  onSelect,
}: RecommendationProductCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(product.id)}
    className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
  >
    <img
      src={product.image || "/placeholder.svg"}
      alt={product.title}
      className="aspect-square w-full object-cover"
    />
    <div className="p-3">
      <h3 className="line-clamp-2 font-semibold text-gray-900">{product.title}</h3>
      <p className="mt-2 text-sm font-bold text-brand-red">₹{product.price}</p>
      <p className="text-xs text-gray-500">/ {product.unit || "unit"}</p>
    </div>
  </button>
);

export default RecommendationProductCard;
