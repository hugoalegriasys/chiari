'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductWithSchedule, ProductVariant, Sale } from '@/lib/types'
import { formatCurrency, getToday, getWeekday } from '@/lib/utils'

export default function VentasPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [todaySales, setTodaySales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'efectivo'>('efectivo')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (productId) {
      const productVariants = variants.filter(
        (v) => v.product_id === productId && v.active
      )
      setVariantId('')
      if (productVariants.length === 1) {
        setUnitPrice(productVariants[0].price.toString())
        setVariantId(productVariants[0].id)
      } else if (productVariants.length === 0) {
        const product = products.find((p) => p.id === productId)
        if (product?.default_price) {
          setUnitPrice(product.default_price.toString())
        }
      } else {
        setUnitPrice('')
      }
    }
  }, [productId, products, variants])

  async function loadData() {
    const today = getToday()
    const [prodsRes, salesRes, varRes] = await Promise.all([
      supabase.from('products').select('*').eq('active', true).order('name'),
      supabase
        .from('sales')
        .select('*, products(name)')
        .eq('sale_date', today)
        .order('created_at', { ascending: false }),
      supabase.from('product_variants').select('*').eq('active', true),
    ])
    setProducts(prodsRes.data || [])
    setTodaySales(salesRes.data || [])
    setVariants(varRes.data || [])
    setLoading(false)
  }

  async function handleSaleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || !unitPrice || parseInt(quantity) < 1) return

    setSaving(true)
    const { error } = await supabase.from('sales').insert({
      sale_date: getToday(),
      product_id: productId,
      variant_id: variantId || null,
      quantity: parseInt(quantity),
      unit_price: parseFloat(unitPrice),
      payment_method: paymentMethod,
    })

    if (!error) {
      setSuccess(true)
      setQuantity('1')
      setTimeout(() => setSuccess(false), 2000)
      loadData()
    }
    setSaving(false)
  }

  const todayTotal = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
  const todayYape = todaySales
    .filter((s) => s.payment_method === 'yape')
    .reduce((sum, s) => sum + (s.total_amount || 0), 0)
  const todayEfectivo = todaySales
    .filter((s) => s.payment_method === 'efectivo')
    .reduce((sum, s) => sum + (s.total_amount || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-bakery-400 text-lg">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Ventas</h1>

      {/* Today summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-3">
          <p className="text-xs text-bakery-400">Total</p>
          <p className="font-bold text-chocolate">{formatCurrency(todayTotal)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-bakery-400">Yape</p>
          <p className="font-bold text-purple-600">{formatCurrency(todayYape)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-bakery-400">Efectivo</p>
          <p className="font-bold text-green-600">{formatCurrency(todayEfectivo)}</p>
        </div>
      </div>

      {/* Sale Form */}
      <form onSubmit={handleSaleSubmit} className="card space-y-4">
        <h3 className="font-semibold text-chocolate text-lg">Nueva Venta</h3>

        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-1">
            Producto
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="input-field text-lg"
            required
          >
            <option value="">Elegir producto...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - S/ {p.default_price || '0.00'}
              </option>
            ))}
          </select>
        </div>

        {/* Variant selector - show if product has any active variants */}
        {productId && variants.filter((v) => v.product_id === productId && v.active).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-bakery-600 mb-1">
              Variante
            </label>
            <div className="grid grid-cols-2 gap-2">
              {variants
                .filter((v) => v.product_id === productId && v.active)
                .map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVariantId(v.id)
                      setUnitPrice(v.price.toString())
                    }}
                    className={`py-3 rounded-xl font-medium text-sm transition-all border-2 ${
                      variantId === v.id
                        ? 'bg-caramel text-white border-caramel'
                        : 'bg-white text-chocolate border-bakery-200'
                    }`}
                  >
                    {v.name} - S/ {v.price}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-bakery-600 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-field text-lg text-center"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bakery-600 mb-1">
              Precio (S/)
            </label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="input-field text-lg"
              required
            />
          </div>
        </div>

        {/* Total preview */}
        {unitPrice && quantity && (
          <div className="text-center py-2 bg-bakery-50 rounded-xl">
            <span className="text-sm text-bakery-500">Total: </span>
            <span className="text-xl font-bold text-chocolate">
              {formatCurrency(parseInt(quantity) * parseFloat(unitPrice || '0'))}
            </span>
          </div>
        )}

        {/* Payment method - big buttons */}
        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-2">
            Metodo de pago
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('efectivo')}
              className={`py-4 rounded-xl font-bold text-lg transition-all border-2 ${
                paymentMethod === 'efectivo'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-green-600 border-green-200'
              }`}
            >
              Efectivo
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('yape')}
              className={`py-4 rounded-xl font-bold text-lg transition-all border-2 ${
                paymentMethod === 'yape'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-purple-600 border-purple-200'
              }`}
            >
              Yape
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !productId}
          className="btn-primary w-full text-xl py-4"
        >
          {saving ? 'Guardando...' : success ? 'Venta Registrada!' : 'Registrar Venta'}
        </button>
      </form>

      {/* Today's sales list */}
      <div className="space-y-2">
        <h3 className="font-semibold text-chocolate">Ventas de hoy</h3>
        {todaySales.length === 0 ? (
          <p className="text-bakery-400 text-center py-4">No hay ventas hoy</p>
        ) : (
          todaySales.map((sale) => (
            <div key={sale.id} className="card flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-chocolate">{sale.products?.name}</p>
                <p className="text-sm text-bakery-400">
                  {sale.quantity} x S/ {sale.unit_price}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-chocolate">
                  {formatCurrency(sale.total_amount || 0)}
                </p>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    sale.payment_method === 'yape'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-green-100 text-green-600'
                  }`}
                >
                  {sale.payment_method === 'yape' ? 'Yape' : 'Efectivo'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
