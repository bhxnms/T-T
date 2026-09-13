import { describe, expect, it } from 'vitest'
import { clusterAMapPoints } from './amapClusters'

const point = (id: number, lat: number, lng: number) => ({ item: { id }, lat, lng })

describe('clusterAMapPoints', () => {
  it('groups nearby points into a single screen-space cluster below zoom 11', () => {
    const clusters = clusterAMapPoints([
      point(1, 39.908, 116.397),
      point(2, 39.9081, 116.3971),
    ], 10)

    expect(clusters).toHaveLength(1)
    expect(clusters[0].members.map(member => member.id)).toEqual([1, 2])
  })

  it('keeps distant points in separate grid cells', () => {
    const clusters = clusterAMapPoints([
      point(1, 39.908, 116.397),
      point(2, 40.908, 117.397),
    ], 10)

    expect(clusters).toHaveLength(2)
  })

  it('dissolves all clusters at zoom 11', () => {
    const clusters = clusterAMapPoints([
      point(1, 39.908, 116.397),
      point(2, 39.9081, 116.3971),
    ], 11)

    expect(clusters).toHaveLength(2)
    expect(clusters.every(cluster => cluster.members.length === 1)).toBe(true)
  })

  it('returns an empty collection for no points', () => {
    expect(clusterAMapPoints([], 5)).toEqual([])
  })
})
