/**
 * Landmark Visit Storage
 * 地标打卡状态存储
 */

const VISITED_LANDMARKS_KEY = 'tt_visited_landmarks'

export interface VisitedLandmark {
  provinceCode: string
  landmarkName: string
  visitedAt: number
}

/**
 * Get all visited landmarks
 * 获取所有已打卡的地标
 */
export function getVisitedLandmarks(): Set<string> {
  try {
    const data = localStorage.getItem(VISITED_LANDMARKS_KEY)
    if (!data) return new Set()
    const visited: VisitedLandmark[] = JSON.parse(data)
    return new Set(visited.map(v => `${v.provinceCode}:${v.landmarkName}`))
  } catch (error) {
    console.error('Failed to load visited landmarks:', error)
    return new Set()
  }
}

/**
 * Get the check-in timestamp for one landmark (epoch ms), or undefined.
 * 地标的打卡时间
 */
export function getLandmarkVisitedAt(provinceCode: string, landmarkName: string): number | undefined {
  try {
    const data = localStorage.getItem(VISITED_LANDMARKS_KEY)
    if (!data) return undefined
    const visited: VisitedLandmark[] = JSON.parse(data)
    return visited.find(v => `${v.provinceCode}:${v.landmarkName}` === `${provinceCode}:${landmarkName}`)?.visitedAt
  } catch {
    return undefined
  }
}

/**
 * Check if a landmark is visited
 * 检查地标是否已打卡
 */
export function isLandmarkVisited(provinceCode: string, landmarkName: string): boolean {
  const visited = getVisitedLandmarks()
  return visited.has(`${provinceCode}:${landmarkName}`)
}

/**
 * Mark a landmark as visited
 * 标记地标为已打卡
 */
export function markLandmarkVisited(provinceCode: string, landmarkName: string): void {
  try {
    const data = localStorage.getItem(VISITED_LANDMARKS_KEY)
    const visited: VisitedLandmark[] = data ? JSON.parse(data) : []

    // Check if already visited
    const key = `${provinceCode}:${landmarkName}`
    if (visited.some(v => `${v.provinceCode}:${v.landmarkName}` === key)) {
      return
    }

    visited.push({
      provinceCode,
      landmarkName,
      visitedAt: Date.now(),
    })

    localStorage.setItem(VISITED_LANDMARKS_KEY, JSON.stringify(visited))
  } catch (error) {
    console.error('Failed to mark landmark as visited:', error)
  }
}

/**
 * Unmark a landmark as visited
 * 取消地标打卡
 */
export function unmarkLandmarkVisited(provinceCode: string, landmarkName: string): void {
  try {
    const data = localStorage.getItem(VISITED_LANDMARKS_KEY)
    if (!data) return

    const visited: VisitedLandmark[] = JSON.parse(data)
    const key = `${provinceCode}:${landmarkName}`
    const filtered = visited.filter(v => `${v.provinceCode}:${v.landmarkName}` !== key)

    localStorage.setItem(VISITED_LANDMARKS_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to unmark landmark:', error)
  }
}

/**
 * Toggle landmark visit status
 * 切换地标打卡状态
 */
export function toggleLandmarkVisit(provinceCode: string, landmarkName: string): boolean {
  const isVisited = isLandmarkVisited(provinceCode, landmarkName)
  if (isVisited) {
    unmarkLandmarkVisited(provinceCode, landmarkName)
    // Same-tab listeners (Atlas sidebar count, map markers) — storage events
    // only fire across tabs.
    window.dispatchEvent(new Event('tt-checkins-changed'))
    return false
  } else {
    markLandmarkVisited(provinceCode, landmarkName)
    window.dispatchEvent(new Event('tt-checkins-changed'))
    return true
  }
}
