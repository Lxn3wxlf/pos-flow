import { z } from 'zod';

// ==========================================
// Auth Validation Schemas
// ==========================================

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .max(255, 'Email must be less than 255 characters');

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be less than 128 characters');

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Full name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const pinSchema = z
  .string()
  .min(4, 'PIN must be at least 4 digits')
  .max(6, 'PIN must be at most 6 digits')
  .regex(/^\d+$/, 'PIN must contain only digits');

// ==========================================
// Customer Validation Schemas
// ==========================================

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .max(20, 'Phone number must be less than 20 characters')
  .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format');

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Customer name is required')
    .max(100, 'Name must be less than 100 characters'),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(500, 'Address must be less than 500 characters')
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes must be less than 2000 characters')
    .optional(),
});

export const deliveryAddressSchema = z.object({
  addressLine1: z
    .string()
    .trim()
    .min(1, 'Address is required')
    .max(255, 'Address must be less than 255 characters'),
  addressLine2: z
    .string()
    .trim()
    .max(255, 'Address must be less than 255 characters')
    .optional(),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City must be less than 100 characters'),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Postal code is required')
    .max(20, 'Postal code must be less than 20 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Invalid postal code format'),
  deliveryNotes: z
    .string()
    .trim()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
  deliveryFee: z
    .number()
    .min(0, 'Delivery fee cannot be negative')
    .max(10000, 'Delivery fee is too high'),
});

// ==========================================
// Product Validation Schemas
// ==========================================

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required')
    .max(200, 'Name must be less than 200 characters'),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'SKU can only contain letters, numbers, underscores, and hyphens'),
  barcode: z
    .string()
    .trim()
    .max(50, 'Barcode must be less than 50 characters')
    .regex(/^[a-zA-Z0-9]*$/, 'Barcode can only contain letters and numbers')
    .optional()
    .or(z.literal('')),
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(1000000, 'Price is too high'),
  cost: z
    .number()
    .min(0, 'Cost cannot be negative')
    .max(1000000, 'Cost is too high'),
  tax_rate: z
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%'),
  stock_qty: z
    .number()
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative')
    .max(1000000, 'Stock quantity is too high'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  is_active: z.boolean(),
  estimated_prep_minutes: z
    .number()
    .int()
    .min(1, 'Prep time must be at least 1 minute')
    .max(480, 'Prep time cannot exceed 8 hours'),
  kitchen_station: z.enum(['grill', 'fryer', 'salad', 'dessert', 'bar', 'general']),
  pricing_type: z.enum(['fixed', 'weight_based']),
  price_per_unit: z
    .number()
    .min(0, 'Price per unit cannot be negative')
    .max(100000, 'Price per unit is too high'),
  unit_type: z.string().max(20).optional(),
});

// ==========================================
// Order Validation Schemas
// ==========================================

export const specialInstructionsSchema = z
  .string()
  .trim()
  .max(500, 'Special instructions must be less than 500 characters')
  .optional();

export const orderNotesSchema = z
  .string()
  .trim()
  .max(1000, 'Notes must be less than 1000 characters')
  .optional();

// ==========================================
// Utility Functions
// ==========================================

/**
 * Safely validate and return parsed data or null with errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (path && !errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return { success: false, errors };
}

/**
 * Get first error message from validation result
 */
export function getFirstError(errors: Record<string, string>): string {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey] : 'Validation failed';
}

/**
 * Sanitize string for safe display (basic XSS prevention)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
