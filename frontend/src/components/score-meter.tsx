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
    {
      key: "phishing",
      width: 100 - thresholds.phishing,
      className: "bg-phishing",
    },
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
          className="absolute -top-[5px] w-[3px] rounded-sm bg-foreground ring-[3px] ring-card"
          style={{
            left: `${score}%`,
            height: 19,
            transform: "translateX(-50%)",
          }}
        />

        {[0, thresholds.suspicious, thresholds.phishing, 100].map((tick) => (
          <span
            key={tick}
            className="absolute top-3.5 text-[10px] text-faint"
            style={{ left: `${tick}%`, transform: "translateX(-50%)" }}
          >
            {tick}
          </span>
        ))}
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="block size-2 rounded-sm bg-clean" />
          0–{thresholds.suspicious - 1} Legitim
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block size-2 rounded-sm bg-suspicious" />
          {thresholds.suspicious}–{thresholds.phishing - 1} Verdächtig
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block size-2 rounded-sm bg-phishing" />
          {thresholds.phishing}–100 Phishing
        </span>
      </div>
    </div>
  )
}
