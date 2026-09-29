/** A tick step that splits the axis into at most four clean intervals. */
export function niceStep(max: number) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
  return (
    steps.find((step) => max / step <= 4) ?? 10 ** Math.ceil(Math.log10(max))
  )
}
