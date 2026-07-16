'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DailySalesSummary,
  DailyExpenseSummary,
  WeeklyProductionSummary,
  WeeklySalesSummary,
  WeeklyProfitSummary,
  WeeklySalesByVariant,
  ProductStock,
  Product,
} from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  formatDisplayDate,
  getWeekStart,
  addDays,
  getToday,
} from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const COLORS = ['#e08522', '#8b5cf6', '#22c55e', '#ec4899', '#3b82f6']

export default function DashboardPage() {
  const supabase = createClient()
  const [dailySales, setDailySales] = useState<DailySalesSummary[]>([])
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpenseSummary[]>([])
  const [weeklyProduction, setWeeklyProduction] = useState<WeeklyProductionSummary[]>([])
  const [weeklySales, setWeeklySales] = useState<WeeklySalesSummary[]>([])
  const [weeklyProfit, setWeeklyProfit] = useState<WeeklyProfitSummary[]>([])
  const [weeklySalesByVariant, setWeeklySalesByVariant] = useState<WeeklySalesByVariant[]>([])
  const [productStock, setProductStock] = useState<ProductStock[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Week selector
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(
    formatDate(getWeekStart(new Date()))
  )

  useEffect(() => {
    loadData()
  }, [selectedWeekStart])

  async function loadData() {
    const weekStart = new Date(selectedWeekStart)
    const weekEnd = addDays(weekStart, 6)

    const [
      dailySalesRes,
      dailyExpensesRes,
      weeklyProdRes,
      weeklySalesRes,
      weeklyProfitRes,
      weeklyByVariantRes,
      stockRes,
      prodsRes,
    ] = await Promise.all([
      supabase
        .from('daily_sales_summary')
        .select('*')
        .gte('sale_date', selectedWeekStart)
        .lte('sale_date', formatDate(weekEnd))
        .order('sale_date'),
      supabase
        .from('daily_expense_summary')
        .select('*')
        .gte('purchase_date', selectedWeekStart)
        .lte('purchase_date', formatDate(weekEnd))
        .order('purchase_date'),
      supabase
        .from('weekly_production_summary')
        .select('*, products(name)')
        .eq('week_start', selectedWeekStart),
      supabase
        .from('weekly_sales_summary')
        .select('*, products(name)')
        .eq('week_start', selectedWeekStart),
      supabase
        .from('weekly_profit_summary')
        .select('*')
        .eq('week_start', selectedWeekStart),
      supabase
        .from('weekly_sales_by_variant')
        .select('*')
        .eq('week_start', selectedWeekStart),
      supabase
        .from('product_stock')
        .select('*')
        .order('product_name'),
      supabase.from('products').select('*').eq('active', true),
    ])

    setDailySales(dailySalesRes.data || [])
    setDailyExpenses(dailyExpensesRes.data || [])
    setWeeklyProduction(weeklyProdRes.data || [])
    setWeeklySales(weeklySalesRes.data || [])
    setWeeklyProfit(weeklyProfitRes.data || [])
    setWeeklySalesByVariant(weeklyByVariantRes.data || [])
    setProductStock(stockRes.data || [])
    setProducts(prodsRes.data || [])
    setLoading(false)
  }

  // Build daily combined data for charts
  const dailyData = dailySales.map((sale) => {
    const expense = dailyExpenses.find((e) => e.purchase_date === sale.sale_date)
    return {
      date: formatDisplayDate(sale.sale_date),
      yape: sale.total_yape || 0,
      efectivo: sale.total_efectivo || 0,
      gastos: expense?.total_gastado || 0,
      ganancia: (sale.total_dia || 0) - (expense?.total_gastado || 0),
    }
  })

  // Build product comparison data
  const productComparison = products.map((prod) => {
    const prodData = weeklyProduction.find((wp) => wp.product_id === prod.id)
    const salesData = weeklySales.find((ws) => ws.product_id === prod.id)
    return {
      name: prod.name,
      producido: prodData?.total_producido || 0,
      vendido: salesData?.total_vendido || 0,
    }
  }).filter((p) => p.producido > 0 || p.vendido > 0)

  // Build variant breakdown per product (only for products with variant sales)
  const variantBreakdown = products
    .map((prod) => {
      const prodSales = weeklySalesByVariant.filter((v) => v.product_id === prod.id)
      if (prodSales.length === 0) return null
      const hasVariants = prodSales.some((v) => v.variant_id !== null)
      if (!hasVariants) return null
      return {
        productId: prod.id,
        productName: prod.name,
        totalQuantity: prodSales.reduce((sum, v) => sum + v.total_vendido, 0),
        totalRevenue: prodSales.reduce((sum, v) => sum + v.ingreso_total, 0),
        variants: prodSales.map((v) => ({
          name: v.variant_name || 'Sin variante',
          quantity: v.total_vendido,
          revenue: v.ingreso_total,
        })),
      }
    })
    .filter(Boolean)

  // Payment method pie data
  const totalYape = dailySales.reduce((sum, s) => sum + (s.total_yape || 0), 0)
  const totalEfectivo = dailySales.reduce((sum, s) => sum + (s.total_efectivo || 0), 0)
  const pieData = [
    { name: 'Yape', value: totalYape },
    { name: 'Efectivo', value: totalEfectivo },
  ].filter((d) => d.value > 0)

  const weekProfit = weeklyProfit[0]

  // Calculate date range
  const weekEnd = addDays(new Date(selectedWeekStart), 6)
  const prevWeek = addDays(new Date(selectedWeekStart), -7)
  const nextWeek = addDays(new Date(selectedWeekStart), 7)
  const isCurrentWeek =
    formatDate(getWeekStart(new Date())) === selectedWeekStart

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-bakery-400 text-lg">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Dashboard</h1>
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
          className="text-sm text-bakery-400"
        >
          Salir
        </button>
      </div>

      {/* Week selector */}
      <div className="card">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedWeekStart(formatDate(prevWeek))}
            className="btn-secondary py-2 px-3 text-sm"
          >
            Anterior
          </button>
          <div className="text-center">
            <p className="font-semibold text-chocolate text-sm">
              {formatDisplayDate(selectedWeekStart)} - {formatDisplayDate(formatDate(weekEnd))}
            </p>
            {isCurrentWeek && (
              <p className="text-xs text-caramel font-medium">Esta semana</p>
            )}
          </div>
          <button
            onClick={() => setSelectedWeekStart(formatDate(nextWeek))}
            className="btn-secondary py-2 px-3 text-sm"
            disabled={isCurrentWeek}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Daily summary cards */}
      <div className="space-y-2">
        <h3 className="font-semibold text-chocolate">Resumen del dia</h3>
        {dailySales.length === 0 && dailyExpenses.length === 0 ? (
          <p className="text-bakery-400 text-center py-4 text-sm">
            No hay datos para esta semana
          </p>
        ) : (
          <div className="space-y-2">
            {dailySales.map((sale) => {
              const expense = dailyExpenses.find(
                (e) => e.purchase_date === sale.sale_date
              )
              return (
                <div key={sale.sale_date} className="card py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-chocolate">
                      {formatDisplayDate(sale.sale_date)}
                    </p>
                    <p className="font-bold text-chocolate">
                      {formatCurrency(sale.total_dia || 0)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-bakery-400">Yape</span>
                      <p className="font-medium text-purple-600">
                        {formatCurrency(sale.total_yape || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-bakery-400">Efectivo</span>
                      <p className="font-medium text-green-600">
                        {formatCurrency(sale.total_efectivo || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-bakery-400">Gastos</span>
                      <p className="font-medium text-red-500">
                        {formatCurrency(expense?.total_gastado || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Weekly profit summary */}
      {weekProfit && (
        <div className="card bg-gradient-to-br from-bakery-50 to-bakery-100 border-bakery-200">
          <h3 className="font-semibold text-chocolate mb-2">Ganancia Semanal</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-bakery-400">Ingresos</p>
              <p className="font-bold text-green-600">
                {formatCurrency(weekProfit.ingreso_total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-bakery-400">Gastos</p>
              <p className="font-bold text-red-500">
                {formatCurrency(weekProfit.total_gastado || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-bakery-400">Ganancia</p>
              <p
                className={`font-bold ${
                  weekProfit.ganancia >= 0 ? 'text-chocolate' : 'text-red-600'
                }`}
              >
                {formatCurrency(weekProfit.ganancia)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stock by variant */}
      {productStock.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-chocolate">Stock por variante</h3>
          <div className="space-y-2">
            {(() => {
              // Group by product
              const grouped = new Map<string, { name: string; items: ProductStock[] }>()
              productStock.forEach((s) => {
                if (!grouped.has(s.product_id)) {
                  grouped.set(s.product_id, { name: s.product_name, items: [] })
                }
                grouped.get(s.product_id)!.items.push(s)
              })
              return Array.from(grouped.entries()).map(([productId, group]) => (
                <div key={productId} className="card py-3">
                  <p className="font-medium text-chocolate mb-2">{group.name}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const hasWhole = item.stock_unidades_enteras !== 0
                      const hasPortions = item.stock_porciones !== 0
                      if (!hasWhole && !hasPortions) return null
                      const sizeLabel = item.size ? ` (${item.size})` : ''
                      return (
                        <div key={item.variant_id} className="text-sm">
                          <span className="text-bakery-500">{item.variant_name}{sizeLabel}:</span>{' '}
                          {hasWhole && (
                            <span className="text-chocolate font-medium">
                              {item.stock_unidades_enteras} {item.stock_unidades_enteras === 1 ? 'entera' : 'enteras'}
                            </span>
                          )}
                          {hasWhole && hasPortions && <span className="text-bakery-400"> · </span>}
                          {hasPortions && (
                            <span className="text-chocolate font-medium">
                              {item.stock_porciones} {item.stock_porciones === 1 ? 'porcion' : 'porciones'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* Production vs Sales comparison */}
      {productComparison.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-chocolate">Producido vs Vendido</h3>
          <div className="card">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #f0e6d6',
                  }}
                />
                <Legend />
                <Bar dataKey="producido" fill="#e08522" name="Producido" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vendido" fill="#22c55e" name="Vendido" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Variant breakdown */}
          {variantBreakdown.length > 0 && variantBreakdown.map((item) => item && (
            <div key={item.productId} className="card py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-chocolate">{item.productName}</p>
                <p className="font-bold text-chocolate text-sm">
                  {item.totalQuantity} vendidas ({formatCurrency(item.totalRevenue)})
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-bakery-500">
                {item.variants.map((v, i) => (
                  <span key={i}>
                    {v.name}: {v.quantity} ({formatCurrency(v.revenue)})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily sales chart */}
      {dailyData.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-chocolate">Ventas diarias</h3>
          <div className="card">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #f0e6d6',
                  }}
                />
                <Legend />
                <Bar dataKey="yape" fill="#8b5cf6" name="Yape" radius={[4, 4, 0, 0]} />
                <Bar dataKey="efectivo" fill="#22c55e" name="Efectivo" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill="#ef4444" name="Gastos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payment method pie chart */}
      {pieData.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-chocolate">Ventas por metodo</h3>
          <div className="card">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #f0e6d6',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
