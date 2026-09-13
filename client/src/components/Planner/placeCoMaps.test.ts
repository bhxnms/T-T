import { describe, expect, it } from 'vitest'
import { getCoMapsUrlForPlace } from './placeCoMaps'
import type { Place } from '../../types'

// FE-PLANNER-COMAPS-001 to FE-PLANNER-COMAPS-004

function place(overrides: Partial<Place> = {}): Place {
  return { name: 'Stephansdom', lat: 48.2038, lng: 16.3616, ...overrides } as unknown as Place
}

describe('getCoMapsUrlForPlace', () => {
  it('FE-PLANNER-COMAPS-001: drops a named pin at the place', () => {
    expect(getCoMapsUrlForPlace(place()))
      .toBe('https://comaps.at/map?v=1&ll=48.2038,16.3616&n=Stephansdom')
  })

  it('FE-PLANNER-COMAPS-002: links over https, so an install-less device lands somewhere', () => {
    // The cm:// scheme opens the app but dead-ends in a browser without it;
    // comaps.at is both the app link and the install page.
    expect(getCoMapsUrlForPlace(place())).toMatch(/^https:\/\/comaps\.at\//)
  })

  it('FE-PLANNER-COMAPS-003: a nameless place still gets its pin', () => {
    expect(getCoMapsUrlForPlace(place({ name: '' })))
      .toBe('https://comaps.at/map?v=1&ll=48.2038,16.3616')
  })

  it('FE-PLANNER-COMAPS-004: without coordinates there is nothing to pin', () => {
    expect(getCoMapsUrlForPlace(place({ lat: null, lng: null }))).toBeNull()
    expect(getCoMapsUrlForPlace(null)).toBeNull()
  })
})
