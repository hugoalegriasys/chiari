'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Purchase, ProductionBatch, Sale } from '@/lib/types'
import { formatCurrency, formatDisplayDate, getToday, getWeekStart, formatDate } from '@/lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type PeriodMode = 'day' | 'week' | 'month'

export default function ReportesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<PeriodMode>('week')

  // Period state
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [weekStart, setWeekStart] = useState(formatDate(getWeekStart(new Date())))
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Data
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Compute date range
  function getDateRange(): { from: string; to: string } {
    if (mode === 'day') {
      return { from: selectedDate, to: selectedDate }
    }
    if (mode === 'week') {
      const ws = new Date(weekStart)
      const we = new Date(ws)
      we.setDate(we.getDate() + 6)
      return { from: weekStart, to: formatDate(we) }
    }
    // month
    const [y, m] = monthYear.split('-').map(Number)
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { from: first, to: last }
  }

  const range = getDateRange()

  useEffect(() => {
    loadData()
  }, [mode, selectedDate, weekStart, monthYear])

  async function loadData() {
    setLoading(true)
    const { from, to } = getDateRange()

    const [purchRes, batchRes, salesRes, prodsRes] = await Promise.all([
      supabase
        .from('purchases')
        .select('*, categories(name)')
        .gte('purchase_date', from)
        .lte('purchase_date', to)
        .order('purchase_date'),
      supabase
        .from('production_batches')
        .select('*, products(name)')
        .gte('production_date', from)
        .lte('production_date', to)
        .order('production_date'),
      supabase
        .from('sales')
        .select('*, products(name), product_variants(name)')
        .gte('sale_date', from)
        .lte('sale_date', to)
        .order('sale_date'),
      supabase.from('products').select('*'),
    ])

    setPurchases(purchRes.data || [])
    setBatches(batchRes.data || [])
    setSales(salesRes.data || [])
    setProducts(prodsRes.data || [])
    setLoading(false)
  }

  // Summary
  const totalComprado = purchases.reduce((s, p) => s + (p.total_cost || 0), 0)
  const totalVendido = sales.reduce((s, s2) => s2.total_amount ?? 0 + s, 0) // need reduce carefully
  const totalVendidoCalc = sales.reduce((s, s2) => s + (s2.total_amount || 0), 0)
  const totalYape = sales.filter((s2) => s2.payment_method === 'yape').reduce((s, s2) => s + (s2.total_amount || 0), 0)
  const totalEfectivo = sales.filter((s2) => s2.payment_method === 'efectivo').reduce((s, s2) => s + (s2.total_amount || 0), 0)
  const ganancia = totalVendidoCalc - totalComprado

  function getPeriodLabel(): string {
    if (mode === 'day') return formatDisplayDate(selectedDate)
    if (mode === 'week') {
      const ws = new Date(weekStart)
      const we = new Date(ws)
      we.setDate(we.getDate() + 6)
      return `${formatDisplayDate(formatDate(ws))} al ${formatDisplayDate(formatDate(we))}`
    }
    const [y, m] = monthYear.split('-')
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${monthNames[parseInt(m) - 1]} ${y}`
  }

  function generatePDF() {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 20

    // Title
    doc.setFontSize(16)
    doc.text('Chiari - Pasteleria', pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(11)
    doc.text(`Reporte ${mode === 'day' ? 'diario' : mode === 'week' ? 'semanal' : 'mensual'}`, pageWidth / 2, y, { align: 'center' })
    y += 6
    doc.setFontSize(10)
    doc.text(getPeriodLabel(), pageWidth / 2, y, { align: 'center' })
    y += 12

    // COMPRAS
    doc.setFontSize(12)
    doc.text('COMPRAS', 14, y)
    y += 2
    if (purchases.length === 0) {
      doc.setFontSize(9)
      doc.text('Sin registros', 14, y + 6)
      y += 12
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Insumo', 'Cant.', 'Costo']],
        body: purchases.map((p) => [
          p.item,
          p.quantity?.toString() || '-',
          `S/ ${(p.total_cost || 0).toFixed(2)}`,
        ]),
        foot: [['', 'Total', `S/ ${totalComprado.toFixed(2)}`]],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [224, 133, 34] },
        footStyles: { fillColor: [245, 238, 230], textColor: [60, 40, 20], fontStyle: 'bold' },
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }

    // PRODUCCION
    doc.setFontSize(12)
    doc.text('PRODUCCION', 14, y)
    y += 2
    if (batches.length === 0) {
      doc.setFontSize(9)
      doc.text('Sin registros', 14, y + 6)
      y += 12
    } else {
      const prodRows = batches.map((b) => {
        const productName = b.products?.name || 'Producto'
        const size = b.size ? ` (${b.size})` : ''
        const portions = b.portions_cut ? `${b.portions_cut} porc. ` : ''
        return [
          `${productName}${size}`,
          b.quantity_produced.toString(),
          portions || '-',
          b.notes || '',
        ]
      })
      autoTable(doc, {
        startY: y,
        head: [['Producto', 'Cant.', 'Porciones', 'Notas']],
        body: prodRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [224, 133, 34] },
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }

    // VENTAS
    doc.setFontSize(12)
    doc.text('VENTAS', 14, y)
    y += 2
    if (sales.length === 0) {
      doc.setFontSize(9)
      doc.text('Sin registros', 14, y + 6)
      y += 12
    } else {
      const saleRows = sales.map((s) => {
        const productName = s.products?.name || 'Producto'
        const variant = s.product_variants?.name ? ` (${s.product_variants.name})` : ''
        return [
          `${productName}${variant}`,
          s.quantity.toString(),
          s.payment_method === 'yape' ? 'Yape' : 'Efectivo',
          `S/ ${(s.total_amount || 0).toFixed(2)}`,
        ]
      })
      autoTable(doc, {
        startY: y,
        head: [['Producto', 'Cant.', 'Pago', 'Total']],
        body: saleRows,
        foot: [
          ['', '', 'Yape', `S/ ${totalYape.toFixed(2)}`],
          ['', '', 'Efectivo', `S/ ${totalEfectivo.toFixed(2)}`],
          ['', '', 'Total', `S/ ${totalVendidoCalc.toFixed(2)}`],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [224, 133, 34] },
        footStyles: { fillColor: [245, 238, 230], textColor: [60, 40, 20], fontStyle: 'bold' },
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }

    // Check if we need a new page for the summary
    if (y > 250) {
      doc.addPage()
      y = 20
    }

    // RESUMEN
    doc.setFillColor(245, 238, 230)
    doc.rect(10, y, pageWidth - 20, 28, 'F')
    doc.setDrawColor(224, 133, 34)
    doc.rect(10, y, pageWidth - 20, 28, 'S')
    y += 8
    doc.setFontSize(11)
    doc.text('RESUMEN DEL PERIODO', pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(9)
    doc.text(`Total vendido: S/ ${totalVendidoCalc.toFixed(2)}`, 16, y)
    doc.text(`Total comprado: S/ ${totalComprado.toFixed(2)}`, pageWidth / 2 + 5, y)
    y += 6
    doc.setFontSize(10)
    doc.setFont(undefined as any, 'bold')
    doc.text(`Ganancia estimada: S/ ${ganancia.toFixed(2)}`, pageWidth / 2, y, { align: 'center' })
    doc.setFont(undefined as any, 'normal')

    // Footer
    y += 14
    doc.setFontSize(7)
    doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}`, pageWidth / 2, y, { align: 'center' })

    // Save
    const modeLabel = mode === 'day' ? 'dia' : mode === 'week' ? 'semana' : 'mes'
    doc.save(`reporte-${modeLabel}-${range.from}.pdf`)
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Reportes</h1>

      {/* Period selector */}
      <div className="card space-y-3">
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as PeriodMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-xl font-medium text-sm transition-all ${
                mode === m
                  ? 'bg-caramel text-white'
                  : 'bg-white text-bakery-500 border border-bakery-200'
              }`}
            >
              {m === 'day' ? 'Dia' : m === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {mode === 'day' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field"
          />
        )}

        {mode === 'week' && (
          <div>
            <label className="block text-xs text-bakery-500 mb-1">Semana desde</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-bakery-400 mt-1">
              Semana: {getPeriodLabel()}
            </p>
          </div>
        )}

        {mode === 'month' && (
          <input
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="input-field"
          />
        )}

        <p className="text-sm text-bakery-500 text-center font-medium">
          {getPeriodLabel()}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="text-bakery-400">Cargando reporte...</div>
        </div>
      ) : (
        <>
          {/* COMPRAS */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-chocolate">Compras</h3>
            {purchases.length === 0 ? (
              <p className="text-bakery-400 text-sm py-2">Sin registros</p>
            ) : (
              <>
                {purchases.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-chocolate">
                      {p.item}{p.quantity ? ` x${p.quantity}` : ''}
                    </span>
                    <span className="font-medium text-chocolate">
                      {formatCurrency(p.total_cost || 0)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-bakery-100 pt-2 flex justify-between">
                  <span className="font-semibold text-chocolate">Total</span>
                  <span className="font-bold text-chocolate">{formatCurrency(totalComprado)}</span>
                </div>
              </>
            )}
          </div>

          {/* PRODUCCION */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-chocolate">Produccion</h3>
            {batches.length === 0 ? (
              <p className="text-bakery-400 text-sm py-2">Sin registros</p>
            ) : (
              batches.map((b) => (
                <div key={b.id} className="text-sm">
                  <span className="font-medium text-chocolate">{b.products?.name}</span>
                  {b.size && <span className="text-bakery-400"> ({b.size})</span>}
                  <span className="text-bakery-400">
                    {' — '}{b.quantity_produced} unid.
                    {b.portions_cut ? `, ${b.portions_cut} porc.` : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* VENTAS */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-chocolate">Ventas</h3>
            {sales.length === 0 ? (
              <p className="text-bakery-400 text-sm py-2">Sin registros</p>
            ) : (
              <>
                {sales.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-chocolate">
                      {s.products?.name}
                      {s.product_variants?.name ? ` (${s.product_variants.name})` : ''}
                      {s.quantity > 1 ? ` x${s.quantity}` : ''}
                      <span className={`ml-1 text-xs ${s.payment_method === 'yape' ? 'text-purple-500' : 'text-green-600'}`}>
                        {s.payment_method === 'yape' ? 'Y' : 'E'}
                      </span>
                    </span>
                    <span className="font-medium text-chocolate">
                      {formatCurrency(s.total_amount || 0)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-bakery-100 pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600">Yape</span>
                    <span className="font-medium">{formatCurrency(totalYape)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Efectivo</span>
                    <span className="font-medium">{formatCurrency(totalEfectivo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-chocolate">Total</span>
                    <span className="font-bold text-chocolate">{formatCurrency(totalVendidoCalc)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RESUMEN */}
          <div className="card bg-gradient-to-br from-bakery-50 to-bakery-100 border-bakery-200 space-y-2">
            <h3 className="font-semibold text-chocolate">Resumen</h3>
            <div className="flex justify-between text-sm">
              <span className="text-bakery-500">Total vendido</span>
              <span className="font-medium text-green-600">{formatCurrency(totalVendidoCalc)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-bakery-500">Total comprado</span>
              <span className="font-medium text-red-500">{formatCurrency(totalComprado)}</span>
            </div>
            <div className="border-t border-bakery-200 pt-2 flex justify-between">
              <span className="font-semibold text-chocolate">Ganancia estimada</span>
              <span className={`font-bold text-lg ${ganancia >= 0 ? 'text-chocolate' : 'text-red-600'}`}>
                {formatCurrency(ganancia)}
              </span>
            </div>
          </div>

          {/* PDF button */}
          <button onClick={generatePDF} className="btn-primary w-full">
            Descargar PDF
          </button>
        </>
      )}
    </div>
  )
}
