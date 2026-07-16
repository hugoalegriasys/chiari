import BottomNav from '@/components/BottomNav'

export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-cream pb-20">
      <main className="max-w-lg mx-auto p-4">{children}</main>
      <BottomNav />
    </div>
  )
}
