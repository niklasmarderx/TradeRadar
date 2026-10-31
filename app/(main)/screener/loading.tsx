export default function ScreenerLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
