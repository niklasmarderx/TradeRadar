export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="skeleton h-4 w-32 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-48" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
      <div>
        <div className="skeleton h-4 w-32 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}
