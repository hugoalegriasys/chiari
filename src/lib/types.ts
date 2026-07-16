export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Product {
  id: string
  category_id: string
  name: string
  default_price: number | null
  active: boolean
  created_at: string
  categories?: Category
}

export interface ProductSchedule {
  id: string
  product_id: string
  weekday: number
  active: boolean
}

export interface ProductWithSchedule extends Product {
  product_schedule: ProductSchedule[]
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  price: number
  size: 'grande' | 'pequena' | null
  active: boolean
  created_at: string
}

export interface Purchase {
  id: string
  purchase_date: string
  item: string
  quantity: number | null
  unit: string | null
  unit_cost: number | null
  total_cost: number | null
  category_id: string | null
  notes: string | null
  created_at: string
  categories?: Category
}

export interface ProductionBatch {
  id: string
  production_date: string
  product_id: string
  variant_id: string | null
  quantity_produced: number
  portions_cut: number | null
  notes: string | null
  created_at: string
  products?: Product
  product_variants?: ProductVariant
}

export interface Sale {
  id: string
  sale_date: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_price: number
  total_amount: number | null
  payment_method: 'yape' | 'efectivo'
  created_at: string
  products?: Product
  product_variants?: ProductVariant
}

export interface DailySalesSummary {
  sale_date: string
  total_yape: number | null
  total_efectivo: number | null
  total_dia: number | null
}

export interface DailyExpenseSummary {
  purchase_date: string
  total_gastado: number | null
}

export interface WeeklyProductionSummary {
  week_start: string
  product_id: string
  total_producido: number
  products?: Product
}

export interface WeeklySalesSummary {
  week_start: string
  product_id: string
  total_vendido: number
  ingreso_total: number
  products?: Product
}

export interface WeeklyProfitSummary {
  week_start: string
  ingreso_total: number
  total_gastado: number | null
  ganancia: number
}

export interface WeeklySalesByVariant {
  week_start: string
  product_id: string
  product_name: string
  variant_id: string | null
  variant_name: string | null
  total_vendido: number
  ingreso_total: number
}

export interface ProductStock {
  product_id: string
  product_name: string
  variant_id: string
  variant_name: string
  size: 'grande' | 'pequena' | null
  stock_unidades_enteras: number
  stock_porciones: number
}

export const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
export const WEEKDAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
