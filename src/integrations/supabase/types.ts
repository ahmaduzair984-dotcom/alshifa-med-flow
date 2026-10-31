export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      clinical_services: {
        Row: {
          category: string;
          cost_paisa: number;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          price_paisa: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category?: string;
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          price_paisa?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category?: string;
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_paisa?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          changes: Json | null;
          created_at: string;
          description: string | null;
          entity: string;
          entity_id: string | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          changes?: Json | null;
          created_at?: string;
          description?: string | null;
          entity: string;
          entity_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          changes?: Json | null;
          created_at?: string;
          description?: string | null;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount_paisa: number;
          category: string;
          created_at: string;
          description: string | null;
          expense_date: string;
          id: string;
          notes: string | null;
          payment_method: string;
          user_id: string | null;
        };
        Insert: {
          amount_paisa: number;
          category: string;
          created_at?: string;
          description?: string | null;
          expense_date?: string;
          id?: string;
          notes?: string | null;
          payment_method?: string;
          user_id?: string | null;
        };
        Update: {
          amount_paisa?: number;
          category?: string;
          created_at?: string;
          description?: string | null;
          expense_date?: string;
          id?: string;
          notes?: string | null;
          payment_method?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      lab_sale_items: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          lab_sale_id: string;
          lab_test_id: string | null;
          line_total_paisa: number;
          quantity: number;
          test_name: string;
          unit_cost_paisa: number;
          unit_price_paisa: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          lab_sale_id: string;
          lab_test_id?: string | null;
          line_total_paisa: number;
          quantity: number;
          test_name: string;
          unit_cost_paisa?: number;
          unit_price_paisa: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          lab_sale_id?: string;
          lab_test_id?: string | null;
          line_total_paisa?: number;
          quantity?: number;
          test_name?: string;
          unit_cost_paisa?: number;
          unit_price_paisa?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lab_sale_items_lab_sale_id_fkey";
            columns: ["lab_sale_id"];
            isOneToOne: false;
            referencedRelation: "lab_sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lab_sale_items_lab_test_id_fkey";
            columns: ["lab_test_id"];
            isOneToOne: false;
            referencedRelation: "lab_tests";
            referencedColumns: ["id"];
          },
        ];
      };
      lab_sales: {
        Row: {
          change_paisa: number;
          client_token: string | null;
          cost_paisa: number;
          created_at: string;
          discount_paisa: number;
          id: string;
          invoice_no: string;
          note: string | null;
          paid_paisa: number;
          patient_age: number | null;
          patient_gender: string | null;
          patient_id: string | null;
          patient_name: string;
          patient_phone: string | null;
          payment_method: string;
          profit_paisa: number;
          referring_doctor: string | null;
          status: string;
          subtotal_paisa: number;
          total_paisa: number;
          user_id: string | null;
        };
        Insert: {
          change_paisa?: number;
          client_token?: string | null;
          cost_paisa?: number;
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          invoice_no: string;
          note?: string | null;
          paid_paisa?: number;
          patient_age?: number | null;
          patient_gender?: string | null;
          patient_id?: string | null;
          patient_name: string;
          patient_phone?: string | null;
          payment_method?: string;
          profit_paisa?: number;
          referring_doctor?: string | null;
          status?: string;
          subtotal_paisa?: number;
          total_paisa?: number;
          user_id?: string | null;
        };
        Update: {
          change_paisa?: number;
          client_token?: string | null;
          cost_paisa?: number;
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          invoice_no?: string;
          note?: string | null;
          paid_paisa?: number;
          patient_age?: number | null;
          patient_gender?: string | null;
          patient_id?: string | null;
          patient_name?: string;
          patient_phone?: string | null;
          payment_method?: string;
          profit_paisa?: number;
          referring_doctor?: string | null;
          status?: string;
          subtotal_paisa?: number;
          total_paisa?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lab_sales_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      lab_tests: {
        Row: {
          category: string;
          cost_paisa: number;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          price_paisa: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category?: string;
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          price_paisa?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category?: string;
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_paisa?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          address: string | null;
          age: number | null;
          code: string;
          created_at: string;
          gender: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
        };
        Insert: {
          address?: string | null;
          age?: number | null;
          code?: string;
          created_at?: string;
          gender?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
        };
        Update: {
          address?: string | null;
          age?: number | null;
          code?: string;
          created_at?: string;
          gender?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      product_batches: {
        Row: {
          batch_number: string;
          cost_price_paisa: number;
          created_at: string;
          expiry_date: string | null;
          id: string;
          initial_quantity_base: number;
          product_id: string;
          quantity_base: number;
          supplier_id: string | null;
        };
        Insert: {
          batch_number: string;
          cost_price_paisa?: number;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          initial_quantity_base?: number;
          product_id: string;
          quantity_base?: number;
          supplier_id?: string | null;
        };
        Update: {
          batch_number?: string;
          cost_price_paisa?: number;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          initial_quantity_base?: number;
          product_id?: string;
          quantity_base?: number;
          supplier_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "product_batches_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          barcode: string | null;
          base_unit: string;
          brand_name: string;
          carton_unit: string | null;
          category_id: string | null;
          cost_price_paisa: number;
          created_at: string;
          dosage_form: string | null;
          generic_name: string | null;
          id: string;
          is_active: boolean;
          manufacturer: string | null;
          min_stock: number;
          notes: string | null;
          pack_unit: string | null;
          packs_per_carton: number;
          prescription_required: boolean;
          sale_price_paisa: number;
          strength: string | null;
          units_per_pack: number;
          updated_at: string;
        };
        Insert: {
          barcode?: string | null;
          base_unit?: string;
          brand_name: string;
          carton_unit?: string | null;
          category_id?: string | null;
          cost_price_paisa?: number;
          created_at?: string;
          dosage_form?: string | null;
          generic_name?: string | null;
          id?: string;
          is_active?: boolean;
          manufacturer?: string | null;
          min_stock?: number;
          notes?: string | null;
          pack_unit?: string | null;
          packs_per_carton?: number;
          prescription_required?: boolean;
          sale_price_paisa?: number;
          strength?: string | null;
          units_per_pack?: number;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          base_unit?: string;
          brand_name?: string;
          carton_unit?: string | null;
          category_id?: string | null;
          cost_price_paisa?: number;
          created_at?: string;
          dosage_form?: string | null;
          generic_name?: string | null;
          id?: string;
          is_active?: boolean;
          manufacturer?: string | null;
          min_stock?: number;
          notes?: string | null;
          pack_unit?: string | null;
          packs_per_carton?: number;
          prescription_required?: boolean;
          sale_price_paisa?: number;
          strength?: string | null;
          units_per_pack?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
        };
        Relationships: [];
      };
      purchase_items: {
        Row: {
          batch_id: string | null;
          batch_number: string | null;
          cost_price_paisa: number;
          created_at: string;
          expiry_date: string | null;
          id: string;
          line_total_paisa: number;
          product_id: string;
          product_name: string;
          purchase_id: string;
          quantity_base: number;
        };
        Insert: {
          batch_id?: string | null;
          batch_number?: string | null;
          cost_price_paisa: number;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          line_total_paisa: number;
          product_id: string;
          product_name: string;
          purchase_id: string;
          quantity_base: number;
        };
        Update: {
          batch_id?: string | null;
          batch_number?: string | null;
          cost_price_paisa?: number;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          line_total_paisa?: number;
          product_id?: string;
          product_name?: string;
          purchase_id?: string;
          quantity_base?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "product_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      purchases: {
        Row: {
          created_at: string;
          discount_paisa: number;
          id: string;
          note: string | null;
          paid_paisa: number;
          purchase_date: string;
          reference: string | null;
          subtotal_paisa: number;
          supplier_id: string | null;
          total_paisa: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          note?: string | null;
          paid_paisa?: number;
          purchase_date?: string;
          reference?: string | null;
          subtotal_paisa?: number;
          supplier_id?: string | null;
          total_paisa?: number;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          note?: string | null;
          paid_paisa?: number;
          purchase_date?: string;
          reference?: string | null;
          subtotal_paisa?: number;
          supplier_id?: string | null;
          total_paisa?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      return_items: {
        Row: {
          batch_id: string | null;
          cost_paisa: number;
          created_at: string;
          id: string;
          product_id: string;
          product_name: string;
          quantity_base: number;
          refund_paisa: number;
          return_id: string;
          sale_item_id: string | null;
        };
        Insert: {
          batch_id?: string | null;
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          product_id: string;
          product_name: string;
          quantity_base: number;
          refund_paisa?: number;
          return_id: string;
          sale_item_id?: string | null;
        };
        Update: {
          batch_id?: string | null;
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          product_id?: string;
          product_name?: string;
          quantity_base?: number;
          refund_paisa?: number;
          return_id?: string;
          sale_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "return_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "product_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "return_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "sale_returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_sale_item_id_fkey";
            columns: ["sale_item_id"];
            isOneToOne: false;
            referencedRelation: "sale_items";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_items: {
        Row: {
          batch_id: string | null;
          batch_number: string | null;
          cost_paisa: number;
          created_at: string;
          discount_paisa: number;
          id: string;
          line_total_paisa: number;
          product_id: string;
          product_name: string;
          quantity: number;
          quantity_base: number;
          returned_base: number;
          sale_id: string;
          unit_label: string;
          unit_price_paisa: number;
          units_per_sale_unit: number;
        };
        Insert: {
          batch_id?: string | null;
          batch_number?: string | null;
          cost_paisa?: number;
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          line_total_paisa: number;
          product_id: string;
          product_name: string;
          quantity: number;
          quantity_base: number;
          returned_base?: number;
          sale_id: string;
          unit_label?: string;
          unit_price_paisa: number;
          units_per_sale_unit?: number;
        };
        Update: {
          batch_id?: string | null;
          batch_number?: string | null;
          cost_paisa?: number;
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          line_total_paisa?: number;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          quantity_base?: number;
          returned_base?: number;
          sale_id?: string;
          unit_label?: string;
          unit_price_paisa?: number;
          units_per_sale_unit?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "product_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_service_items: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          line_total_paisa: number;
          quantity: number;
          sale_id: string;
          service_id: string | null;
          service_name: string;
          unit_cost_paisa: number;
          unit_price_paisa: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          line_total_paisa: number;
          quantity: number;
          sale_id: string;
          service_id?: string | null;
          service_name: string;
          unit_cost_paisa?: number;
          unit_price_paisa: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          line_total_paisa?: number;
          quantity?: number;
          sale_id?: string;
          service_id?: string | null;
          service_name?: string;
          unit_cost_paisa?: number;
          unit_price_paisa?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_service_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_service_items_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "clinical_services";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_returns: {
        Row: {
          cost_paisa: number;
          created_at: string;
          id: string;
          profit_adjustment_paisa: number;
          reason: string | null;
          return_no: string;
          sale_id: string | null;
          source: string;
          total_paisa: number;
          user_id: string | null;
        };
        Insert: {
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          profit_adjustment_paisa?: number;
          reason?: string | null;
          return_no: string;
          sale_id?: string | null;
          source?: string;
          total_paisa?: number;
          user_id?: string | null;
        };
        Update: {
          cost_paisa?: number;
          created_at?: string;
          id?: string;
          profit_adjustment_paisa?: number;
          reason?: string | null;
          return_no?: string;
          sale_id?: string | null;
          source?: string;
          total_paisa?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_returns_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          change_paisa: number;
          client_token: string | null;
          clinical_service_paisa: number;
          cost_paisa: number;
          created_at: string;
          discount_paisa: number;
          id: string;
          invoice_no: string;
          note: string | null;
          paid_paisa: number;
          patient_id: string | null;
          patient_name: string | null;
          payment_method: string;
          profit_paisa: number;
          service_charge_paisa: number;
          status: string;
          subtotal_paisa: number;
          total_paisa: number;
          user_id: string | null;
        };
        Insert: {
          change_paisa?: number;
          client_token?: string | null;
          clinical_service_paisa?: number;
          cost_paisa?: number;
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          invoice_no: string;
          note?: string | null;
          paid_paisa?: number;
          patient_id?: string | null;
          patient_name?: string | null;
          payment_method?: string;
          profit_paisa?: number;
          service_charge_paisa?: number;
          status?: string;
          subtotal_paisa?: number;
          total_paisa?: number;
          user_id?: string | null;
        };
        Update: {
          change_paisa?: number;
          client_token?: string | null;
          clinical_service_paisa?: number;
          cost_paisa?: number;
          created_at?: string;
          discount_paisa?: number;
          id?: string;
          invoice_no?: string;
          note?: string | null;
          paid_paisa?: number;
          patient_id?: string | null;
          patient_name?: string | null;
          payment_method?: string;
          profit_paisa?: number;
          service_charge_paisa?: number;
          status?: string;
          subtotal_paisa?: number;
          total_paisa?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          address: string;
          clinic_name: string;
          currency: string;
          doctor_name: string;
          expiry_warning_days: number;
          id: number;
          invoice_footer: string;
          low_stock_default: number;
          phone: string;
          updated_at: string;
        };
        Insert: {
          address?: string;
          clinic_name?: string;
          currency?: string;
          doctor_name?: string;
          expiry_warning_days?: number;
          id?: number;
          invoice_footer?: string;
          low_stock_default?: number;
          phone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          clinic_name?: string;
          currency?: string;
          doctor_name?: string;
          expiry_warning_days?: number;
          id?: number;
          invoice_footer?: string;
          low_stock_default?: number;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          balance_after: number | null;
          batch_id: string | null;
          change_base: number;
          created_at: string;
          id: string;
          note: string | null;
          product_id: string;
          reason: Database["public"]["Enums"]["movement_reason"];
          reference_id: string | null;
          reference_type: string | null;
          user_id: string | null;
        };
        Insert: {
          balance_after?: number | null;
          batch_id?: string | null;
          change_base: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          product_id: string;
          reason: Database["public"]["Enums"]["movement_reason"];
          reference_id?: string | null;
          reference_type?: string | null;
          user_id?: string | null;
        };
        Update: {
          balance_after?: number | null;
          batch_id?: string | null;
          change_base?: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          product_id?: string;
          reason?: Database["public"]["Enums"]["movement_reason"];
          reference_id?: string | null;
          reference_type?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "product_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address: string | null;
          company: string | null;
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
        };
        Insert: {
          address?: string | null;
          company?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
        };
        Update: {
          address?: string | null;
          company?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      product_stock: {
        Row: {
          nearest_expiry: string | null;
          product_id: string | null;
          sellable_base: number | null;
          stock_base: number | null;
          stock_value_paisa: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_manage_staff: {
        Args: {
          p_is_active: boolean;
          p_role: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: Json;
      };
      admin_delete_record: {
        Args: { p_record_id: string; p_table: string };
        Returns: Json;
      };
      admin_delete_return: {
        Args: { p_return_id: string };
        Returns: Json;
      };
      admin_remove_medicine: {
        Args: { p_product_id: string };
        Returns: Json;
      };
      admin_remove_clinical_service: {
        Args: { p_service_id: string };
        Returns: Json;
      };
      adjust_stock: {
        Args: {
          p_batch_id: string;
          p_change: number;
          p_note?: string;
          p_reason: Database["public"]["Enums"]["movement_reason"];
        };
        Returns: Json;
      };
      create_purchase: {
        Args: {
          p_discount_paisa?: number;
          p_items: Json;
          p_note?: string;
          p_paid_paisa?: number;
          p_purchase_date?: string;
          p_reference?: string;
          p_supplier_id?: string;
        };
        Returns: Json;
      };
      create_direct_return: {
        Args: { p_items: Json; p_reason?: string };
        Returns: Json;
      };
      create_lab_sale: {
        Args: {
          p_client_token?: string;
          p_discount_paisa?: number;
          p_items: Json;
          p_note?: string;
          p_paid_paisa?: number;
          p_patient_age?: number;
          p_patient_gender?: string;
          p_patient_id?: string;
          p_patient_name?: string;
          p_patient_phone?: string;
          p_payment_method?: string;
          p_referring_doctor?: string;
        };
        Returns: Json;
      };
      create_sale: {
        Args: {
          p_client_token?: string;
          p_discount_paisa?: number;
          p_items: Json;
          p_note?: string;
          p_paid_paisa?: number;
          p_patient_id?: string;
          p_payment_method?: string;
          p_service_charge_paisa?: number;
          p_services?: Json;
        };
        Returns: Json;
      };
      create_sale_return: {
        Args: { p_items: Json; p_reason?: string; p_sale_id: string };
        Returns: Json;
      };
      list_lab_tests_with_costs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          category: string;
          cost_paisa: number;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          price_paisa: number;
          sort_order: number;
          updated_at: string;
        }[];
      };
      lab_financial_summary: {
        Args: { p_from: string; p_to: string };
        Returns: Json;
      };
      lab_backup_data: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_remove_lab_test: {
        Args: { p_lab_test_id: string };
        Returns: Json;
      };
      admin_delete_lab_sale: {
        Args: { p_lab_sale_id: string };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "manager" | "pharmacist";
      movement_reason:
        | "purchase"
        | "sale"
        | "sale_return"
        | "purchase_return"
        | "damage"
        | "expired"
        | "adjustment"
        | "correction"
        | "opening";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "pharmacist"],
      movement_reason: [
        "purchase",
        "sale",
        "sale_return",
        "purchase_return",
        "damage",
        "expired",
        "adjustment",
        "correction",
        "opening",
      ],
    },
  },
} as const;
