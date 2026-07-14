/**
 * The showcase account. The dashboard and navbar render this fake,
 * funded portfolio so the site always looks like a live, connected
 * session; no wallet or backend involved.
 */
export const SHOWCASE_ADDRESS = '0x7f3adc04b2e91c55a8d06f14b93e2a7d40cbe91c'
export const SHOWCASE_DEPOSIT_ADDRESS = 'ALuT1cDepXk9vmGQhVRPUUm9s3ECL4zqZWxpKedZtAkM'
export const SHOWCASE_NETWORK = 'mainnet'
export const SHOWCASE_BALANCE = 184_306.42

/**
 * Live wallet balance, shared by the dashboard and navbar so they can
 * never disagree. Streamed trade fees are spent from it, which keeps
 * the books exact: deployed + balance + fees paid stays constant.
 */
let balance = SHOWCASE_BALANCE
const subscribers = new Set<() => void>()

export const showcaseBalance = {
  get: () => balance,
  spend(amount: number) {
    balance -= amount
    subscribers.forEach((fn) => fn())
  },
  subscribe(fn: () => void) {
    subscribers.add(fn)
    return () => {
      subscribers.delete(fn)
    }
  },
}
