// Skeleton placeholders shown while a page's data loads (Next.js loading.tsx).

export function SkeletonCard() {
  return (
    <div className="sk-card">
      <div className="sk-card-top">
        <div className="sk" style={{ height: 20, width: 140 }} />
        <div className="sk" style={{ height: 22, width: 60, borderRadius: 999 }} />
      </div>
      <div className="sk-metrics">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="sk sk-line" style={{ width: "60%" }} />
            <div className="sk sk-line" style={{ width: "80%", height: 18 }} />
          </div>
        ))}
      </div>
      <div className="sk" style={{ height: 26, width: 130, borderRadius: 999, marginTop: 16 }} />
    </div>
  );
}

export function SkeletonHead() {
  return (
    <div className="page-head">
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
    </div>
  );
}
