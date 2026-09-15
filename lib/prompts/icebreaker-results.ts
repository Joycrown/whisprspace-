export interface IcebreakerTallyEntry {
  option: string
  count: number
  percent: number
  isCorrect: boolean
}

export interface IcebreakerResults {
  entries: IcebreakerTallyEntry[]
  total: number
  headline: string
}

const CLOSE_CALL_GAP_PERCENT = 10

/**
 * Pure so it can be shared between the manage-page results view and the
 * export slide without any rendering or data-fetching involved.
 */
export function buildIcebreakerResults(
  options: string[],
  correctOptionIndex: number | null,
  optionCounts: number[]
): IcebreakerResults {
  const total = optionCounts.reduce((sum, count) => sum + count, 0)
  const entries: IcebreakerTallyEntry[] = options.map((option, index) => ({
    option,
    count: optionCounts[index] ?? 0,
    percent: total ? Math.round(((optionCounts[index] ?? 0) / total) * 100) : 0,
    isCorrect: correctOptionIndex === index,
  }))

  if (total === 0) {
    return { entries, total, headline: 'No guesses yet.' }
  }

  const sorted = [...entries].sort((a, b) => b.count - a.count)
  const top = sorted[0]
  const runnerUp = sorted[1]
  const isCloseCall = Boolean(runnerUp) && top.percent - runnerUp.percent <= CLOSE_CALL_GAP_PERCENT

  let headline: string
  if (isCloseCall) {
    headline = 'It was basically a coin flip — nobody was sure.'
  } else if (correctOptionIndex === null) {
    headline = `Most people went with "${top.option}."`
  } else if (top.isCorrect) {
    headline = "You're an open book — most people saw right through it."
  } else {
    headline = `Nope. Most people guessed "${top.option}" — you had everyone fooled.`
  }

  return { entries, total, headline }
}
