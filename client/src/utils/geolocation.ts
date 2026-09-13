/**
 * Geolocation utilities for TT
 * Provides user location services with permission handling
 */

export interface UserLocation {
  lat: number
  lng: number
  accuracy?: number
}

/**
 * Request and get user's current location
 * Returns null if permission denied or geolocation not available
 */
export async function getUserLocation(): Promise<UserLocation | null> {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser')
    return null
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      })
    })

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
    }
  } catch (error) {
    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          console.warn('User denied geolocation permission')
          break
        case error.POSITION_UNAVAILABLE:
          console.warn('Location information unavailable')
          break
        case error.TIMEOUT:
          console.warn('Location request timed out')
          break
      }
    }
    return null
  }
}

/**
 * Check if geolocation permission has been granted
 */
export async function checkGeolocationPermission(): Promise<PermissionState | null> {
  if (!navigator.permissions) {
    return null
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return result.state
  } catch (error) {
    console.warn('Could not check geolocation permission', error)
    return null
  }
}

/**
 * Store user's last known location in localStorage
 */
export function saveLastLocation(location: UserLocation): void {
  try {
    localStorage.setItem('tt_last_location', JSON.stringify(location))
  } catch (error) {
    console.warn('Could not save last location', error)
  }
}

/**
 * Retrieve user's last known location from localStorage
 */
export function getLastLocation(): UserLocation | null {
  try {
    const stored = localStorage.getItem('tt_last_location')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.warn('Could not retrieve last location', error)
  }
  return null
}

/**
 * Default center for China (Beijing)
 */
export const CHINA_CENTER: UserLocation = {
  lat: 39.9042,
  lng: 116.4074,
}
