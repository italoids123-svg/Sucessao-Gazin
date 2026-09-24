const MIN_PCT_TEXTO = 15;

export default function CoverageBar({ verde, amarelo, vermelho, total }: { verde: number; amarelo: number; vermelho: number; total: number }) {
  const seg = [
    { k: "verde", n: verde, label: "2+ sucessores" },
    { k: "amarelo", n: amarelo, label: "1 sucessor" },
    { k: "vermelho", n: vermelho, label: "Sem sucessor" },
  ];
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <>
      <div className="bar" role="img" aria-label={seg.map((s) => `${s.label}: ${s.n}`).join(", ")}>
        {seg.map((s) =>
          s.n > 0 ? (
            <div key={s.k} className={s.k} style={{ width: `${(s.n / total) * 100}%` }}>
              {(s.n / total) * 100 >= MIN_PCT_TEXTO ? `${s.n} · ${pct(s.n)}%` : ""}
            </div>
          ) : null,
        )}
      </div>
      <div className="legend">
        {seg.map((s) => (
          <span key={s.k}>
            <i className={`dot ${s.k}`} /> {s.label}: <b>{s.n}</b> ({pct(s.n)}%)
          </span>
        ))}
      </div>
    </>
  );
}
