'use client'

let stack: string[] = []
let position = -1
let pendingPop = false
let listening = false

export function startHistoryTracking() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('popstate', () => {
    pendingPop = true
  })
}

export function recordNavigation(url: string) {
  if (position === -1) {
    stack = [url]
    position = 0
    return
  }
  if (stack[position] === url) {
    pendingPop = false
    return
  }
  if (pendingPop) {
    pendingPop = false
    if (position > 0 && stack[position - 1] === url) {
      position -= 1
      return
    }
    if (stack[position + 1] === url) {
      position += 1
      return
    }
    stack = [url]
    position = 0
    return
  }
  stack = stack.slice(0, position + 1)
  stack.push(url)
  position += 1
}

export function canGoBackInApp() {
  return position > 0
}
