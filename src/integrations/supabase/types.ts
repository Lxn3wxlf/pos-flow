export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      combo_components: {
        Row: {
          allows_substitution: boolean
          category_id: string | null
          combo_product_id: string
          component_name: string
          created_at: string
          id: string
          qty: number
        }
        Insert: {
          allows_substitution?: boolean
          category_id?: string | null
          combo_product_id: string
          component_name: string
          created_at?: string
          id?: string
          qty?: number
        }
        Update: {
          allows_substitution?: boolean
          category_id?: string | null
          combo_product_id?: string
          component_name?: string
          created_at?: string
          id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_components_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_components_combo_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "combo_products"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_products: {
        Row: {
          combo_description: string | null
          created_at: string
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          combo_description?: string | null
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          combo_description?: string | null
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          id: string
          loyalty_points: number | null
          name: string
          notes: string | null
          phone: string
          preferences: Json | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name: string
          notes?: string | null
          phone: string
          preferences?: Json | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          phone?: string
          preferences?: Json | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          notes: string | null
          postal_code: string
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          notes?: string | null
          postal_code: string
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          notes?: string | null
          postal_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          created_at: string
          customer_id: string
          delivery_address_id: string
          delivery_fee: number
          delivery_notes: string | null
          delivery_time: string | null
          driver_id: string | null
          estimated_delivery: string | null
          id: string
          order_id: string
          pickup_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_address_id: string
          delivery_fee?: number
          delivery_notes?: string | null
          delivery_time?: string | null
          driver_id?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id: string
          pickup_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_address_id?: string
          delivery_fee?: number
          delivery_notes?: string | null
          delivery_time?: string | null
          driver_id?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id?: string
          pickup_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      eod_sessions: {
        Row: {
          actual_cash: number | null
          admin_notes: string | null
          cash_difference: number | null
          cashier_id: string
          cashier_notes: string | null
          created_at: string
          expected_cash: number
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shift_date: string
          status: string
          submitted_at: string | null
          total_sales: number
          total_transactions: number
          updated_at: string
        }
        Insert: {
          actual_cash?: number | null
          admin_notes?: string | null
          cash_difference?: number | null
          cashier_id: string
          cashier_notes?: string | null
          created_at?: string
          expected_cash?: number
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string
          status?: string
          submitted_at?: string | null
          total_sales?: number
          total_transactions?: number
          updated_at?: string
        }
        Update: {
          actual_cash?: number | null
          admin_notes?: string | null
          cash_difference?: number | null
          cashier_id?: string
          cashier_notes?: string | null
          created_at?: string
          expected_cash?: number
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string
          status?: string
          submitted_at?: string | null
          total_sales?: number
          total_transactions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eod_sessions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eod_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          created_at: string
          delta_qty: number
          id: string
          notes: string | null
          product_id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_qty: number
          id?: string
          notes?: string | null
          product_id: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta_qty?: number
          id?: string
          notes?: string | null
          product_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          max_selections: number | null
          min_selections: number
          name: string
          selection_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_selections?: number | null
          min_selections?: number
          name: string
          selection_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_selections?: number | null
          min_selections?: number
          name?: string
          selection_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      modifiers: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_available: boolean
          modifier_group_id: string
          name: string
          price_adjustment: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          modifier_group_id: string
          name: string
          price_adjustment?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          modifier_group_id?: string
          name?: string
          price_adjustment?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_combo_selections: {
        Row: {
          combo_component_id: string
          created_at: string
          id: string
          order_item_id: string
          qty: number
          selected_product_id: string
          selected_product_name: string
        }
        Insert: {
          combo_component_id: string
          created_at?: string
          id?: string
          order_item_id: string
          qty?: number
          selected_product_id: string
          selected_product_name: string
        }
        Update: {
          combo_component_id?: string
          created_at?: string
          id?: string
          order_item_id?: string
          qty?: number
          selected_product_id?: string
          selected_product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_combo_selections_combo_component_id_fkey"
            columns: ["combo_component_id"]
            isOneToOne: false
            referencedRelation: "combo_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_combo_selections_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_combo_selections_selected_product_id_fkey"
            columns: ["selected_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          created_at: string
          id: string
          modifier_id: string
          modifier_name: string
          order_item_id: string
          price_adjustment: number
        }
        Insert: {
          created_at?: string
          id?: string
          modifier_id: string
          modifier_name: string
          order_item_id: string
          price_adjustment?: number
        }
        Update: {
          created_at?: string
          id?: string
          modifier_id?: string
          modifier_name?: string
          order_item_id?: string
          price_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          completed_at: string | null
          cost_at_order: number
          created_at: string
          id: string
          kitchen_station: Database["public"]["Enums"]["kitchen_station"]
          line_total: number
          order_id: string
          price_at_order: number
          product_id: string
          product_name: string
          product_sku: string
          qty: number
          special_instructions: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          tax_rate: number
          updated_at: string
          weight_amount: number | null
          weight_unit: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_at_order: number
          created_at?: string
          id?: string
          kitchen_station?: Database["public"]["Enums"]["kitchen_station"]
          line_total: number
          order_id: string
          price_at_order: number
          product_id: string
          product_name: string
          product_sku: string
          qty: number
          special_instructions?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tax_rate?: number
          updated_at?: string
          weight_amount?: number | null
          weight_unit?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_at_order?: number
          created_at?: string
          id?: string
          kitchen_station?: Database["public"]["Enums"]["kitchen_station"]
          line_total?: number
          order_id?: string
          price_at_order?: number
          product_id?: string
          product_name?: string
          product_sku?: string
          qty?: number
          special_instructions?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tax_rate?: number
          updated_at?: string
          weight_amount?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount_amount: number | null
          guest_count: number | null
          id: string
          notes: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          pickup_time: string | null
          promotion_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          order_number: string
          order_type?: Database["public"]["Enums"]["order_type"]
          pickup_time?: string | null
          promotion_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          pickup_time?: string | null
          promotion_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          updated_at?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          card_brand: string | null
          card_last_four: string | null
          created_at: string | null
          currency: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          payment_method: string | null
          payment_provider: string
          processed_at: string | null
          provider_transaction_id: string | null
          sale_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_method?: string | null
          payment_provider: string
          processed_at?: string | null
          provider_transaction_id?: string | null
          sale_id?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_method?: string | null
          payment_provider?: string
          processed_at?: string | null
          provider_transaction_id?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          order_id: string
          payment_method: string
          processed_by: string | null
          sale_id: string | null
          tip_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          payment_method: string
          processed_by?: string | null
          sale_id?: string | null
          tip_amount?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          payment_method?: string
          processed_by?: string | null
          sale_id?: string | null
          tip_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifiers: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          modifier_group_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          modifier_group_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          modifier_group_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_modifiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost: number
          created_at: string
          description: string | null
          estimated_prep_minutes: number | null
          id: string
          image_url: string | null
          is_active: boolean
          kitchen_station: Database["public"]["Enums"]["kitchen_station"] | null
          name: string
          price: number
          price_per_unit: number | null
          pricing_type: string | null
          sku: string
          stock_qty: number
          tax_rate: number
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          estimated_prep_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kitchen_station?:
            | Database["public"]["Enums"]["kitchen_station"]
            | null
          name: string
          price: number
          price_per_unit?: number | null
          pricing_type?: string | null
          sku: string
          stock_qty?: number
          tax_rate?: number
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          estimated_prep_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kitchen_station?:
            | Database["public"]["Enums"]["kitchen_station"]
            | null
          name?: string
          price?: number
          price_per_unit?: number | null
          pricing_type?: string | null
          sku?: string
          stock_qty?: number
          tax_rate?: number
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      promotion_usage: {
        Row: {
          created_at: string | null
          customer_id: string | null
          discount_applied: number
          id: string
          order_id: string | null
          promotion_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          discount_applied: number
          id?: string
          order_id?: string | null
          promotion_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          discount_applied?: number
          id?: string
          order_id?: string | null
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applies_to: string
          created_at: string | null
          days_of_week: number[] | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          min_purchase_amount: number | null
          name: string
          start_date: string
          target_ids: string[] | null
          time_end: string | null
          time_start: string | null
          updated_at: string | null
          usage_count: number | null
          usage_limit: number | null
        }
        Insert: {
          applies_to: string
          created_at?: string | null
          days_of_week?: number[] | null
          description?: string | null
          discount_type: string
          discount_value: number
          end_date: string
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          name: string
          start_date: string
          target_ids?: string[] | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
        }
        Update: {
          applies_to?: string
          created_at?: string | null
          days_of_week?: number[] | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          name?: string
          start_date?: string
          target_ids?: string[] | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          guest_count: number
          id: string
          reservation_date: string
          reservation_time: string
          special_requests: string | null
          status: string
          table_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          guest_count: number
          id?: string
          reservation_date: string
          reservation_time: string
          special_requests?: string | null
          status?: string
          table_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          guest_count?: number
          id?: string
          reservation_date?: string
          reservation_time?: string
          special_requests?: string | null
          status?: string
          table_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          created_at: string
          floor_plan_id: string | null
          id: string
          is_active: boolean
          position_x: number | null
          position_y: number | null
          seats: number
          status: string
          table_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor_plan_id?: string | null
          id?: string
          is_active?: boolean
          position_x?: number | null
          position_y?: number | null
          seats?: number
          status?: string
          table_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor_plan_id?: string | null
          id?: string
          is_active?: boolean
          position_x?: number | null
          position_y?: number | null
          seats?: number
          status?: string
          table_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_at_sale: number
          id: string
          line_total: number
          price_at_sale: number
          product_id: string
          product_name: string
          product_sku: string
          qty: number
          sale_id: string
          tax_rate: number
        }
        Insert: {
          cost_at_sale: number
          id?: string
          line_total: number
          price_at_sale: number
          product_id: string
          product_name: string
          product_sku: string
          qty: number
          sale_id: string
          tax_rate?: number
        }
        Update: {
          cost_at_sale?: number
          id?: string
          line_total?: number
          price_at_sale?: number
          product_id?: string
          product_name?: string
          product_sku?: string
          qty?: number
          sale_id?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string
          created_at: string
          discount_amount: number
          id: string
          notes: string | null
          payment_method: string
          subtotal: number
          synced_at: string | null
          tax_amount: number
          total: number
        }
        Insert: {
          cashier_id: string
          created_at?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          payment_method: string
          subtotal: number
          synced_at?: string | null
          tax_amount?: number
          total: number
        }
        Update: {
          cashier_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          payment_method?: string
          subtotal?: number
          synced_at?: string | null
          tax_amount?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string
          id: string
          notes: string | null
          role: Database["public"]["Enums"]["app_role"]
          shift_date: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time: string
          id?: string
          notes?: string | null
          role: Database["public"]["Enums"]["app_role"]
          shift_date: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shift_date?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_tracking: {
        Row: {
          break_end: string | null
          break_start: string | null
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          hourly_rate: number
          id: string
          notes: string | null
          shift_id: string | null
          total_cost: number | null
          total_hours: number | null
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          hourly_rate?: number
          id?: string
          notes?: string | null
          shift_id?: string | null
          total_cost?: number | null
          total_hours?: number | null
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          hourly_rate?: number
          id?: string
          notes?: string | null
          shift_id?: string | null
          total_cost?: number | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_tracking_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_tracking_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          estimated_wait_time: number | null
          guest_count: number
          id: string
          notified_at: string | null
          seated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone: string
          estimated_wait_time?: number | null
          guest_count: number
          id?: string
          notified_at?: string | null
          seated_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          estimated_wait_time?: number | null
          guest_count?: number
          id?: string
          notified_at?: string | null
          seated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "waiter" | "kitchen"
      kitchen_station:
        | "grill"
        | "fryer"
        | "salad"
        | "dessert"
        | "bar"
        | "general"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "served"
        | "paid"
        | "cancelled"
      order_type: "dine_in" | "takeout" | "delivery" | "collection"
      user_role: "admin" | "cashier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cashier", "waiter", "kitchen"],
      kitchen_station: ["grill", "fryer", "salad", "dessert", "bar", "general"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "served",
        "paid",
        "cancelled",
      ],
      order_type: ["dine_in", "takeout", "delivery", "collection"],
      user_role: ["admin", "cashier"],
    },
  },
} as const
