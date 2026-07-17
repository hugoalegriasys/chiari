'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, Product, ProductSchedule, ProductVariant, WEEKDAY_NAMES } from '@/lib/types'

export default function ProductosPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [schedules, setSchedules] = useState<ProductSchedule[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'inactive' | 'categories'>('products')

  // Category form
  const [catName, setCatName] = useState('')
  const [editingCat, setEditingCat] = useState<string | null>(null)

  // Product form
  const [prodName, setProdName] = useState('')
  const [prodCategory, setProdCategory] = useState('')
  const [prodPrice, setProdPrice] = useState('')
  const [editingProd, setEditingProd] = useState<string | null>(null)
  const [prodSchedule, setProdSchedule] = useState<number[]>([])

  // Variant form (inline editing per product)
  const [editingVariant, setEditingVariant] = useState<string | null>(null)
  const [variantName, setVariantName] = useState('')
  const [variantPrice, setVariantPrice] = useState('')
  const [variantSize, setVariantSize] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [catsRes, prodsRes, schedRes, varRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('products').select('*, categories(*)').order('name'),
      supabase.from('product_schedule').select('*'),
      supabase.from('product_variants').select('*').order('name'),
    ])
    setCategories(catsRes.data || [])
    setProducts(prodsRes.data || [])
    setSchedules(schedRes.data || [])
    setVariants(varRes.data || [])
    setLoading(false)
  }

  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!catName.trim()) return

    if (editingCat) {
      await supabase.from('categories').update({ name: catName }).eq('id', editingCat)
    } else {
      await supabase.from('categories').insert({ name: catName })
    }
    setCatName('')
    setEditingCat(null)
    loadData()
  }

  async function deleteCategory(id: string) {
    if (!confirm('Eliminar esta categoria?')) return
    await supabase.from('categories').delete().eq('id', id)
    loadData()
  }

  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prodName.trim() || !prodCategory) return

    const productData = {
      name: prodName,
      category_id: prodCategory,
      default_price: prodPrice ? parseFloat(prodPrice) : null,
    }

    let productId = editingProd

    if (editingProd) {
      await supabase.from('products').update(productData).eq('id', editingProd)
    } else {
      const res = await supabase.from('products').insert(productData).select().single()
      productId = res.data?.id
    }

    // Save schedule
    if (productId) {
      await supabase.from('product_schedule').delete().eq('product_id', productId)
      if (prodSchedule.length > 0) {
        await supabase.from('product_schedule').insert(
          prodSchedule.map((day) => ({ product_id: productId!, weekday: day }))
        )
      }
    }

    resetProductForm()
    loadData()
  }

  function resetProductForm() {
    setProdName('')
    setProdCategory('')
    setProdPrice('')
    setEditingProd(null)
    setProdSchedule([])
  }

  function startEditProduct(product: Product) {
    setProdName(product.name)
    setProdCategory(product.category_id)
    setProdPrice(product.default_price?.toString() || '')
    setEditingProd(product.id)
    const prodSched = schedules
      .filter((s) => s.product_id === product.id)
      .map((s) => s.weekday)
    setProdSchedule(prodSched)
    setActiveTab('products')
  }

  function toggleScheduleDay(day: number) {
    setProdSchedule((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  async function deleteProduct(id: string) {
    if (!confirm('Desactivar este producto?')) return
    await supabase.from('products').update({ active: false }).eq('id', id)
    loadData()
  }

  async function reactivateProduct(id: string) {
    await supabase.from('products').update({ active: true }).eq('id', id)
    loadData()
  }

  // --- Variant management ---
  function startAddVariant(productId: string) {
    setEditingVariant(`new:${productId}`)
    setVariantName('')
    setVariantPrice('')
    setVariantSize('')
  }

  function startEditVariant(variant: ProductVariant) {
    setEditingVariant(variant.id)
    setVariantName(variant.name)
    setVariantPrice(variant.price.toString())
    setVariantSize(variant.size || '')
  }

  function cancelVariantForm() {
    setEditingVariant(null)
    setVariantName('')
    setVariantPrice('')
    setVariantSize('')
  }

  async function saveVariant(productId: string) {
    if (!variantName.trim() || !variantPrice) return
    const data = {
      product_id: productId,
      name: variantName,
      price: parseFloat(variantPrice),
      size: variantSize || null,
    }

    if (editingVariant && !editingVariant.startsWith('new:')) {
      await supabase.from('product_variants').update(data).eq('id', editingVariant)
    } else {
      await supabase.from('product_variants').insert(data)
    }
    cancelVariantForm()
    loadData()
  }

  async function deleteVariant(id: string) {
    if (!confirm('Desactivar esta variante?')) return
    await supabase.from('product_variants').update({ active: false }).eq('id', id)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-bakery-400 text-lg">Cargando...</div>
      </div>
    )
  }

  const activeProducts = products.filter((p) => p.active)
  const inactiveProducts = products.filter((p) => !p.active)

  return (
    <div className="space-y-4">
      <h1 className="page-title">Productos</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'products'
              ? 'bg-caramel text-white'
              : 'bg-white text-bakery-500'
          }`}
        >
          Activos ({activeProducts.length})
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={`flex-1 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'inactive'
              ? 'bg-caramel text-white'
              : 'bg-white text-bakery-500'
          }`}
        >
          Inactivos ({inactiveProducts.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'categories'
              ? 'bg-caramel text-white'
              : 'bg-white text-bakery-500'
          }`}
        >
          Categorias ({categories.length})
        </button>
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <form onSubmit={handleCategorySubmit} className="card space-y-3">
            <h3 className="font-semibold text-chocolate">
              {editingCat ? 'Editar Categoria' : 'Nueva Categoria'}
            </h3>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Nombre (ej: Torta, Gelatina...)"
              className="input-field"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                {editingCat ? 'Guardar' : 'Agregar'}
              </button>
              {editingCat && (
                <button
                  type="button"
                  onClick={() => { setEditingCat(null); setCatName('') }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="card flex items-center justify-between">
                <span className="font-medium text-chocolate">{cat.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingCat(cat.id); setCatName(cat.name) }}
                    className="text-caramel text-sm font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="text-red-400 text-sm font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <form onSubmit={handleProductSubmit} className="card space-y-3">
            <h3 className="font-semibold text-chocolate">
              {editingProd ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>

            <div>
              <label className="block text-sm font-medium text-bakery-600 mb-1">
                Categoria
              </label>
              <select
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Seleccionar...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-bakery-600 mb-1">
                Nombre del producto
              </label>
              <input
                type="text"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="ej: Torta de chocolate"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bakery-600 mb-1">
                Precio sugerido (S/)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                placeholder="0.00"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bakery-600 mb-2">
                Dias de produccion
              </label>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_NAMES.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleScheduleDay(idx)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      prodSchedule.includes(idx)
                        ? 'bg-caramel text-white'
                        : 'bg-bakery-50 text-bakery-400'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                {editingProd ? 'Guardar' : 'Agregar'}
              </button>
              {editingProd && (
                <button
                  type="button"
                  onClick={resetProductForm}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="space-y-2">
            {activeProducts.map((prod) => {
              const prodSched = schedules
                .filter((s) => s.product_id === prod.id)
                .map((s) => s.weekday)
              const prodVariants = variants.filter((v) => v.product_id === prod.id && v.active)
              const isEditingNewVariant = editingVariant === `new:${prod.id}`
              return (
                <div key={prod.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-chocolate">{prod.name}</p>
                      <p className="text-sm text-bakery-400">
                        {prod.categories?.name} · S/ {prod.default_price || '0.00'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditProduct(prod)}
                        className="text-caramel text-sm font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteProduct(prod.id)}
                        className="text-red-400 text-sm font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  {prodSched.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {prodSched.sort().map((day) => (
                        <span
                          key={day}
                          className="px-2 py-0.5 bg-bakery-100 text-bakery-600 rounded text-xs font-medium"
                        >
                          {WEEKDAY_NAMES[day]}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Variants */}
                  <div className="mt-3 pt-3 border-t border-bakery-100 space-y-2">
                    <p className="text-xs font-medium text-bakery-500">Variantes de precio</p>
                    {prodVariants.map((v) => (
                      <div key={v.id} className="flex items-center justify-between">
                        {editingVariant === v.id ? (
                          <div className="flex flex-col gap-2 flex-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={variantName}
                                onChange={(e) => setVariantName(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-bakery-200 rounded-lg"
                                placeholder="Nombre"
                              />
                              <input
                                type="number"
                                step="0.50"
                                min="0"
                                value={variantPrice}
                                onChange={(e) => setVariantPrice(e.target.value)}
                                className="w-20 px-2 py-1 text-sm border border-bakery-200 rounded-lg"
                                placeholder="S/"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={variantSize}
                                onChange={(e) => setVariantSize(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-bakery-200 rounded-lg"
                              >
                                <option value="">Ninguno</option>
                                <option value="grande">Grande</option>
                                <option value="pequena">Pequena</option>
                              </select>
                              <button onClick={() => saveVariant(prod.id)} className="text-caramel text-xs font-bold">OK</button>
                              <button onClick={cancelVariantForm} className="text-bakery-400 text-xs">X</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-chocolate">{v.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-chocolate">S/ {v.price}</span>
                              <button onClick={() => startEditVariant(v)} className="text-caramel text-xs">Editar</button>
                              <button onClick={() => deleteVariant(v.id)} className="text-red-400 text-xs">X</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {/* Add variant form or button */}
                    {isEditingNewVariant ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={variantName}
                            onChange={(e) => setVariantName(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-bakery-200 rounded-lg"
                            placeholder="Nombre (ej: Entero, Medio)"
                          />
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            value={variantPrice}
                            onChange={(e) => setVariantPrice(e.target.value)}
                            className="w-20 px-2 py-1 text-sm border border-bakery-200 rounded-lg"
                            placeholder="S/"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={variantSize}
                            onChange={(e) => setVariantSize(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-bakery-200 rounded-lg"
                          >
                            <option value="">Ninguno</option>
                            <option value="grande">Grande</option>
                            <option value="pequena">Pequena</option>
                          </select>
                          <button onClick={() => saveVariant(prod.id)} className="text-caramel text-xs font-bold">OK</button>
                          <button onClick={cancelVariantForm} className="text-bakery-400 text-xs">X</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startAddVariant(prod.id)}
                        className="text-caramel text-xs font-medium"
                      >
                        + Agregar variante
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inactive Products Tab */}
      {activeTab === 'inactive' && (
        <div className="space-y-2">
          {inactiveProducts.length === 0 ? (
            <p className="text-bakery-400 text-center py-4">No hay productos inactivos</p>
          ) : (
            inactiveProducts.map((prod) => (
              <div key={prod.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-chocolate">{prod.name}</p>
                    <p className="text-sm text-bakery-400">
                      {prod.categories?.name} · S/ {prod.default_price || '0.00'}
                    </p>
                  </div>
                  <button
                    onClick={() => reactivateProduct(prod.id)}
                    className="btn-secondary py-2 px-4 text-sm"
                  >
                    Reactivar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
