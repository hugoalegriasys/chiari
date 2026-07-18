'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Purchase } from '@/lib/types'
import { formatCurrency, getToday, formatDisplayDate } from '@/lib/utils'

export default function ComprasPage() {
  const supabase = createClient()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form
  const [purchaseDate, setPurchaseDate] = useState(getToday())
  const [item, setItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [totalCost, setTotalCost] = useState('')

  // Filters
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data } = await supabase
      .from('purchases')
      .select('*')
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    setPurchases(data || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item.trim() || !totalCost) return

    setSaving(true)
    const { error } = await supabase.from('purchases').insert({
      purchase_date: purchaseDate,
      item: item,
      quantity: quantity ? parseFloat(quantity) : null,
      total_cost: parseFloat(totalCost),
    })

    if (!error) {
      setItem('')
      setQuantity('')
      setTotalCost('')
      loadData()
    }
    setSaving(false)
  }

  async function deletePurchase(id: string) {
    if (!confirm('Eliminar esta compra?')) return
    await supabase.from('purchases').delete().eq('id', id)
    loadData()
  }

  const filteredPurchases = purchases.filter((p) => {
    if (filterFrom && p.purchase_date < filterFrom) return false
    if (filterTo && p.purchase_date > filterTo) return false
    return true
  })

  const totalFiltered = filteredPurchases.reduce(
    (sum, p) => sum + (p.total_cost || 0),
    0
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-bakery-400 text-lg">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Compras</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card space-y-3">
        <h3 className="font-semibold text-chocolate">Nueva Compra</h3>

        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-1">
            Fecha
          </label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-1">
            Insumo
          </label>
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="ej: Harina, Huevos, Azucar..."
            className="input-field"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-bakery-600 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-field"
              placeholder="2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bakery-600 mb-1">
              Costo total (S/)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              className="input-field"
              placeholder="120.00"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !item.trim()}
          className="btn-primary w-full"
        >
          {saving ? 'Guardando...' : 'Registrar Compra'}
        </button>
      </form>

      {/* Filters */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-chocolate">Filtrar por fecha</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-bakery-500 mb-1">Desde</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-bakery-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="input-field text-sm"
            />
          </div>
        </div>
        {(filterFrom || filterTo) && (
          <div className="text-center py-2 bg-bakery-50 rounded-xl">
            <span className="text-sm text-bakery-500">Total filtrado: </span>
            <span className="font-bold text-chocolate">
              {formatCurrency(totalFiltered)}
            </span>
          </div>
        )}
      </div>

      {/* Purchases list */}
      <div className="space-y-2">
        <h3 className="font-semibold text-chocolate">
          Compras ({filteredPurchases.length})
        </h3>
        {filteredPurchases.length === 0 ? (
          <p className="text-bakery-400 text-center py-4">No hay compras registradas</p>
        ) : (
          filteredPurchases.map((purchase) => (
            <div key={purchase.id} className="card py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-chocolate">{purchase.item}</p>
                  <p className="text-sm text-bakery-400">
                    {purchase.quantity ? `${purchase.quantity} — ` : ''}
                    {formatDisplayDate(purchase.purchase_date)}
                  </p>
                </div>
                <div className="text-right flex items-start gap-3">
                  <p className="font-bold text-chocolate">
                    {formatCurrency(purchase.total_cost || 0)}
                  </p>
                  <button
                    onClick={() => deletePurchase(purchase.id)}
                    className="text-red-400 text-xs"
                  >
                    X
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
