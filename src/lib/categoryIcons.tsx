import {
  Laptop,
  Monitor,
  Cpu,
  HardDrive,
  Mouse,
  Wifi,
  Headphones,
  Package,
  FileCode,
  Wrench,
  Keyboard,
  Usb,
  Cable,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

// Map category names to appropriate icons for PC sales
const categoryIconMap: Record<string, LucideIcon> = {
  // Laptops
  'laptops': Laptop,
  'laptop': Laptop,
  'notebooks': Laptop,
  
  // Desktop PCs
  'desktop pcs': Monitor,
  'desktop': Monitor,
  'desktops': Monitor,
  'pcs': Monitor,
  'computers': Monitor,
  
  // Monitors
  'monitors': Monitor,
  'monitor': Monitor,
  'displays': Monitor,
  'screens': Monitor,
  
  // Components
  'components': Cpu,
  'component': Cpu,
  'cpu': Cpu,
  'processors': Cpu,
  'gpu': Cpu,
  'graphics cards': Cpu,
  'motherboards': Cpu,
  'ram': Cpu,
  'memory': Cpu,
  'power supply': Cpu,
  'psu': Cpu,
  
  // Storage
  'storage': HardDrive,
  'hard drives': HardDrive,
  'hdd': HardDrive,
  'ssd': HardDrive,
  'drives': HardDrive,
  'usb drives': Usb,
  
  // Peripherals
  'peripherals': Mouse,
  'peripheral': Mouse,
  'mouse': Mouse,
  'mice': Mouse,
  'keyboards': Keyboard,
  'keyboard': Keyboard,
  'headsets': Headphones,
  'headphones': Headphones,
  'speakers': Headphones,
  'webcams': Monitor,
  
  // Networking
  'networking': Wifi,
  'network': Wifi,
  'routers': Wifi,
  'switches': Wifi,
  'wifi': Wifi,
  'ethernet': Cable,
  'cables': Cable,
  
  // Accessories
  'accessories': ShoppingBag,
  'accessory': ShoppingBag,
  'bags': ShoppingBag,
  'cases': ShoppingBag,
  
  // Software
  'software': FileCode,
  'programs': FileCode,
  'licenses': FileCode,
  'windows': FileCode,
  'office': FileCode,
  'antivirus': FileCode,
  
  // Services
  'services': Wrench,
  'service': Wrench,
  'repairs': Wrench,
  'repair': Wrench,
  'installation': Wrench,
  'support': Wrench,
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
  'laptops': 'text-blue-500',
  'laptop': 'text-blue-500',
  'desktop pcs': 'text-slate-600',
  'desktop': 'text-slate-600',
  'desktops': 'text-slate-600',
  'monitors': 'text-purple-500',
  'monitor': 'text-purple-500',
  'components': 'text-green-500',
  'component': 'text-green-500',
  'storage': 'text-orange-500',
  'peripherals': 'text-pink-500',
  'peripheral': 'text-pink-500',
  'networking': 'text-cyan-500',
  'network': 'text-cyan-500',
  'accessories': 'text-amber-500',
  'accessory': 'text-amber-500',
  'software': 'text-indigo-500',
  'services': 'text-emerald-500',
  'service': 'text-emerald-500',
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
