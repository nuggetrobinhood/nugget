import { Nav, Footer } from "../../../components/Chrome";

export default function Loading() {
  return (
    <>
      <Nav />
      <main className="wrap">
        <div className="sk sk-line" style={{ width: 80, marginBottom: 20 }} />
        <div className="sk" style={{ height: 30, width: 220, marginBottom: 10 }} />
        <div className="sk sk-line" style={{ width: 140 }} />

        <div className="section-label">Fee generation</div>
        <div className="panel">
          <div className="horizons">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="h" key={i}>
                <div className="sk sk-line" style={{ width: "50%", margin: "0 auto 8px" }} />
                <div className="sk sk-line" style={{ width: "70%", height: 18, margin: "0 auto" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="section-label">Pool activity</div>
        <div className="panel">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="sk sk-line"
              style={{ height: 20, margin: "12px 0", opacity: 1 - i * 0.08 }}
            />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
