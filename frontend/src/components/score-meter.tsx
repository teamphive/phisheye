type ScoreMeterProps = {
  score: number
  thresholds: { suspicious: number; phishing: number }
}

/** Three zone scale with a marker, no ready made component fits this. */
export function ScoreMeter({ score, thresholds }: ScoreMeterProps) {
  const zones = [
    { key: "clean", width: thresholds.suspicious, className: "bg-clean" },
    {
      key: "suspicious",
      width: thresholds.phishing - thresholds.suspicious,
      className: "bg-suspicious",
    },
    { key: "phishing", width: 100 - thresholds.phishing, className: "bg-phishing" },
  ]

  const activeZone =
    score >= thresholds.phishing
      ? "phishing"
      : score >= thresholds.suspicious
        ? "suspicious"
        : "clean"

  return (
    <div className="flex flex-col gap-4">
      <div className="relative pb-5">
        <div className="flex h-[9px] gap-0.5 overflow-hidden rounded-full">
          {zones.map((zone) => (
            <span
              key={zone.key}
              style={{ flex: zone.width }}
              className={`${zone.className} ${zone.key === activeZone ? "" : "opacity-30"}`}
            />
          ))}
        </div>

        <div
          className="bg-foreground ring-card absolute -top-[5px] w-[3px] rounded-sm ring-[3px]"
          style={{ left: `${score}%`, height: 19, transform: "translateX(-50%)" }}
        />

        {[0, thresholds.suspicious, thresholds.phishing, 100].map((tick) => (
          <span
            key={tick}
            className="text-faint absolute top-3.5 font-mono text-[10px]"
            style={{ left: `${tick}%`, transform: "translateX(-50%)" }}
          >
            {tick}
          </span>
        ))}
      </div>

      <div className="text-muted-foreground flex gap-4 text-[11.5px]">
        <span className="flex items-center gap-1.5">
          <i className="bg-clean block size-2 rounded-sm" />0–{thresholds.suspicious - 1} Sauber
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-suspicious block size-2 rounded-sm" />
          {thresholds.suspicious}–{thresholds.phishing - 1} Verdächtig
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-phishing block size-2 rounded-sm" />
          {thresholds.phishing}–100 Phishing
        </span>
      </div>
    </div>
  )
}
