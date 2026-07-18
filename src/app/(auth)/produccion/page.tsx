'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Product,
  ProductionBatch,
  WEEKDAY_NAMES,
  WEEKDAY_NAMES_FULL,
} from '@/lib/types'
import { formatDisplayDate, getToday, getWeekday } from '@/lib/utils'

export default function ProduccionPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [schedules, setSchedules] = useState<{ product_id: string; weekday: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form
  const [productionDate, setProductionDate] = useState(getToday())
  const [productId, setProductId] = useState('')
  const [batchSize, setBatchSize] = useState<'grande' | 'pequena' | ''>('')
  const [quantityProduced, setQuantityProduced] = useState('')
  const [portionsCut, setPortionsCut] = useState('')
  const [notes, setNotes] = useState('')

  // Filter
  const [filterDate, setFilterDate] = useState(getToday())

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [prodsRes, batchesRes, schedRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('active', true).order('name'),
      supabase
        .from('production_batches')
        .select('*, products(name)')
        .order('production_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('product_schedule').select('product_id, weekday'),
    ])
    setProducts(prodsRes.data || [])
    setBatches(batchesRes.data || [])
    setSchedules(schedRes.data || [])
    setLoading(false)
  }

  const selectedWeekday = getWeekday(productionDate)
  const scheduledProducts = products.filter((p) =>
    schedules.some((s) => s.product_id === p.id && s.weekday === selectedWeekday)
  )
  const unscheduledProducts = products.filter(
    (p) => !scheduledProducts.some((sp) => sp.id === p.id)
  )

  const selectedProduct = products.find((p) => p.id === productId)
  const isTorta = selectedProduct?.categories?.name?.toLowerCase() === 'torta'

  useEffect(() => {
    setBatchSize('')
    setPortionsCut('')
  }, [productId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || !quantityProduced) return

    setSaving(true)
    const { error } = await supabase.from('production_batches').insert({
      production_date: productionDate,
      product_id: productId,
      size: isTorta && batchSize ? batchSize : null,
      quantity_produced: parseInt(quantityProduced),
      portions_cut: portionsCut ? parseInt(portionsCut) : null,
      notes: notes || null,
    })

    if (!error) {
      setProductId('')
      setBatchSize('')
      setQuantityProduced('')
      setPortionsCut('')
      setNotes('')
      loadData()
    }
    setSaving(false)
  }

  function quickAdd(product: Product) {
    setProductId(product.id)
    setBatchSize('')
    setQuantityProduced('1')
    setPortionsCut('')
    setNotes('')
  }

  async function deleteBatch(id: string) {
    if (!confirm('Eliminar este registro?')) return
    await supabase.from('production_batches').delete().eq('id', id)
    loadData()
  }

  const filteredBatches = batches.filter((b) => b.production_date === filterDate)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-bakery-400 text-lg">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Produccion</h1>

      {/* Date selector */}
      <div className="card">
        <label className="block text-sm font-medium text-bakery-600 mb-1">
          Fecha de produccion
        </label>
        <input
          type="date"
          value={productionDate}
          onChange={(e) => setProductionDate(e.target.value)}
          className="input-field"
        />
        <p className="text-sm text-bakery-400 mt-1">
          {WEEKDAY_NAMES_FULL[getWeekday(productionDate)]}
        </p>
      </div>

      {/* Scheduled for today */}
      {scheduledProducts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-chocolate">
            Produccion sugerida ({WEEKDAY_NAMES[getWeekday(productionDate)]})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {scheduledProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => quickAdd(product)}
                className={`card text-left py-3 transition-all ${
                  productId === product.id
                    ? 'border-2 border-caramel bg-bakery-50'
                    : 'hover:bg-bakery-50'
                }`}
              >
                <p className="font-medium text-chocolate text-sm">{product.name}</p>
                <p className="text-xs text-bakery-400">Toca producir hoy</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Production form */}
      <form onSubmit={handleSubmit} className="card space-y-3">
        <h3 className="font-semibold text-chocolate">Registrar Produccion</h3>

        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-1">
            Producto
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="input-field"
            required
          >
            <option value="">Seleccionar...</option>
            <optgroup label="Programados para hoy">
              {scheduledProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            {unscheduledProducts.length > 0 && (
              <optgroup label="Otros productos">
                {unscheduledProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Size selector - only for Torta category */}
        {isTorta && (
          <div>
            <label className="block text-sm font-medium text-bakery-600 mb-2">
              Tamano
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBatchSize('grande')}
                className={`py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                  batchSize === 'grande'
                    ? 'bg-caramel text-white border-caramel'
                    : 'bg-white text-chocolate border-bakery-200'
                }`}
              >
                Grande
              </button>
              <button
                type="button"
                onClick={() => setBatchSize('pequena')}
                className={`py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                  batchSize === 'pequena'
                    ? 'bg-caramel text-white border-caramel'
                    : 'bg-white text-chocolate border-bakery-200'
                }`}
              >
                Pequena
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-1">
            Cantidad producida
          </label>
          <input
            type="number"
            min="1"
            value={quantityProduced}
            onChange={(e) => setQuantityProduced(e.target.value)}
            className="input-field text-center text-2xl"
            placeholder="0"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-1">
            Porciones que salen de este lote (opcional)
          </label>
          <input
            type="number"
            min="1"
            value={portionsCut}
            onChange={(e) => setPortionsCut(e.target.value)}
            className="input-field text-center"
            placeholder="Ej: 10 porciones"
          />
          <p className="text-xs text-bakery-400 mt-1">
            Si se va a partir. Dejar vacio si se vende entera.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-bakery-600 mb-1">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Alguna nota..."
            className="input-field"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !productId}
          className="btn-primary w-full"
        >
          {saving ? 'Guardando...' : 'Registrar Produccion'}
        </button>
      </form>

      {/* Filter and list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-chocolate">Produccion registrada</h3>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="text-sm border border-bakery-200 rounded-lg px-2 py-1"
          />
        </div>

        {filteredBatches.length === 0 ? (
          <p className="text-bakery-400 text-center py-4">
            No hay produccion registrada para este dia
          </p>
        ) : (
          filteredBatches.map((batch) => (
            <div key={batch.id} className="card flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-chocolate">{batch.products?.name}</p>
                <p className="text-sm text-bakery-400">
                  {batch.quantity_produced} unidades
                  {batch.size && ` · ${batch.size === 'grande' ? 'Grande' : 'Pequena'}`}
                  {batch.portions_cut && ` · ${batch.portions_cut} porciones`}
                  {batch.notes ? ` · ${batch.notes}` : ''}
                </p>
              </div>
              <button
                onClick={() => deleteBatch(batch.id)}
                className="text-red-400 text-xs font-medium"
              >
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
