export default function Loading() {
  return (
    <>
      <div className="sk sk-line" style={{ width: 110, marginBottom: 20 }} />
      <div className="dhead">
        <div className="dtitle">
          <div className="sk" style={{ width: 46, height: 46, borderRadius: "50%" }} />
          <div>
            <div className="sk" style={{ height: 26, width: 200, marginBottom: 10 }} />
            <div className="sk sk-line" style={{ width: 150 }} />
          </div>
        </div>
      </div>
      <div className="dstats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat">
            <div style={{ flex: 1 }}>
              <div className="sk sk-line" style={{ width: "55%" }} />
              <div className="sk" style={{ height: 24, width: "70%", marginTop: 10 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid2">
        <div className="panel"><div className="sk" style={{ height: 170, borderRadius: 10 }} /></div>
        <div className="panel"><div className="sk" style={{ height: 170, borderRadius: 10 }} /></div>
      </div>
    </>
  );
}
