import {
  Beef,
  Sandwich,
  Salad,
  Pizza,
  Cookie,
  Coffee,
  Wine,
  Beer,
  GlassWater,
  IceCream,
  Drumstick,
  Fish,
  Egg,
  Wheat,
  Soup,
  CakeSlice,
  Flame,
  UtensilsCrossed,
  Baby,
  Users,
  Package,
  Milk,
  CupSoda,
  Citrus,
  LeafyGreen,
  type LucideIcon,
} from 'lucide-react';

// Map category names to appropriate icons
const categoryIconMap: Record<string, LucideIcon> = {
  // Burgers & Sandwiches
  'burgers': Beef,
  'burgers & sandwiches': Beef,
  'sandwiches': Sandwich,
  'famous sandwiches': Sandwich,
  
  // Grills & Meats
  'grill': Flame,
  'grill & platters': Flame,
  'grills': Flame,
  'platters': UtensilsCrossed,
  'classic meals': Drumstick,
  'mains': UtensilsCrossed,
  'main course': UtensilsCrossed,
  
  // Chicken
  'chicken': Drumstick,
  'wings': Drumstick,
  
  // Seafood
  'seafood': Fish,
  'fish': Fish,
  
  // Mexican
  'mexican': Pizza,
  
  // Kids & Family
  'kids': Baby,
  'family meal': Users,
  'family': Users,
  
  // Combos
  'combos': UtensilsCrossed,
  'combo': UtensilsCrossed,
  
  // On The Go
  'on the go meals': Package,
  'on the go': Package,
  'mr beasley': Package,
  
  // Loaded Fries & Sides
  'loaded fries': Salad,
  'sides': Salad,
  'sides & extras': Salad,
  'fries': Salad,
  
  // Coffee & Hot Drinks
  'coffee': Coffee,
  'tea': Coffee,
  'hot drinks': Coffee,
  
  // Cold Drinks
  'cold coffee': IceCream,
  'milk shake': Milk,
  'milk shakes': Milk,
  'milkshakes': Milk,
  'freezos': IceCream,
  'frozen': IceCream,
  
  // Other Drinks
  'assorted drinks': CupSoda,
  'beverages': GlassWater,
  'drinks': GlassWater,
  'cooldrinks': CupSoda,
  'juices': Citrus,
  
  // Alcohol
  'alcohol': Wine,
  'bar': Beer,
  'wine': Wine,
  'beer': Beer,
  'spirits': Wine,
  
  // Desserts
  'desserts': CakeSlice,
  'dessert': CakeSlice,
  'sweets': Cookie,
  
  // Breakfast
  'breakfast': Egg,
  'eggs': Egg,
  
  // Curry
  'curry': Soup,
  'curry & bunny': Soup,
  
  // Salads
  'salads': LeafyGreen,
  'salad': LeafyGreen,
  
  // Bread
  'bread': Wheat,
  'roti': Wheat,
  
  // Starters
  'starters': Soup,
  'appetizers': Soup,
  
  // Specials
  'midweek specials': Flame,
  'specials': Flame,
};

// Get icon for a category name (case-insensitive)
export function getCategoryIcon(categoryName: string | null | undefined): LucideIcon {
  if (!categoryName) return Package;
  
  const normalizedName = categoryName.toLowerCase().trim();
  
  // Direct match
  if (categoryIconMap[normalizedName]) {
    return categoryIconMap[normalizedName];
  }
  
  // Partial match
  for (const [key, icon] of Object.entries(categoryIconMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return icon;
    }
  }
  
  return Package;
}

// Icon colors by category type
const categoryColorMap: Record<string, string> = {
  'coffee': 'text-amber-600',
  'tea': 'text-green-600',
  'cold coffee': 'text-sky-500',
  'milk shake': 'text-pink-400',
  'freezos': 'text-cyan-400',
  'assorted drinks': 'text-blue-500',
  'beverages': 'text-blue-400',
  'drinks': 'text-blue-400',
  'alcohol': 'text-purple-500',
  'bar': 'text-amber-500',
  'wine': 'text-red-500',
  'beer': 'text-amber-400',
  'burgers': 'text-orange-500',
  'burgers & sandwiches': 'text-orange-500',
  'sandwiches': 'text-yellow-600',
  'famous sandwiches': 'text-yellow-600',
  'grill': 'text-red-500',
  'grill & platters': 'text-red-500',
  'classic meals': 'text-orange-400',
  'chicken': 'text-amber-500',
  'mexican': 'text-red-400',
  'kids': 'text-pink-500',
  'family meal': 'text-green-500',
  'combos': 'text-indigo-500',
  'loaded fries': 'text-yellow-500',
  'sides': 'text-green-400',
  'desserts': 'text-pink-400',
  'dessert': 'text-pink-400',
  'curry & bunny': 'text-orange-600',
  'seafood': 'text-cyan-500',
};

export function getCategoryIconColor(categoryName: string | null | undefined): string {
  if (!categoryName) return 'text-muted-foreground/60';
  
  const normalizedName = categoryName.toLowerCase().trim();
  
  if (categoryColorMap[normalizedName]) {
    return categoryColorMap[normalizedName];
  }
  
  for (const [key, color] of Object.entries(categoryColorMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return color;
    }
  }
  
  return 'text-muted-foreground/60';
}
