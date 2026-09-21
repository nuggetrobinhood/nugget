import { Nav, Footer } from "../components/Chrome";
import { SkeletonHead } from "../components/Skeletons";

export default function Loading() {
  return (
    <>
      <Nav active="pulse" />
      <main className="wrap">
        <SkeletonHead />
        <div className="stats">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat">
              <div className="sk sk-line" style={{ width: "50%" }} />
              <div className="sk" style={{ height: 26, width: "70%", margin: "8px 0 6px" }} />
              <div className="sk sk-line" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="sk" style={{ height: 150, borderRadius: 10 }} />
        </div>
        <div style={{ marginTop: 22 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="sk"
              style={{ height: 58, borderRadius: 12, marginBottom: 8, opacity: 1 - i * 0.12 }}
            />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
