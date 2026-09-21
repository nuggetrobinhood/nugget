export default function Loading() {
  return (
    <>
      <div className="top">
        <div>
          <div className="sk" style={{ height: 30, width: 120, marginBottom: 10 }} />
          <div className="sk sk-line" style={{ width: 320 }} />
        </div>
      </div>
      <div className="stats">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="stat">
            <div style={{ flex: 1 }}>
              <div className="sk sk-line" style={{ width: "50%" }} />
              <div className="sk" style={{ height: 26, width: "70%", margin: "10px 0 6px" }} />
              <div className="sk sk-line" style={{ width: "40%" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid2">
        <div className="panel"><div className="sk" style={{ height: 180, borderRadius: 10 }} /></div>
        <div className="panel"><div className="sk" style={{ height: 180, borderRadius: 10 }} /></div>
      </div>
      <div className="tbl" style={{ marginTop: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="sk" style={{ height: 56, marginBottom: 1, opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </>
  );
}
