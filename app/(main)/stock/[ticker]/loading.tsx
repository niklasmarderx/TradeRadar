export default function StockDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-40" />
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-4 w-48" />
        </div>
        <div className="skeleton h-8 w-24" />
      </div>
      <div className="skeleton h-[450px]" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 skeleton h-64" />
        <div className="skeleton h-64" />
      </div>
    </div>
  );
}
