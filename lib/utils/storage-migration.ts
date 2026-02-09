/**
 * Storage Migration Utility
 * Handles localStorage cleanup and version migrations
 */

const STORAGE_VERSION_KEY = 'whisprspace-storage-version'
const CURRENT_VERSION = '2.0.0' // Update this when storage structure changes

/**
 * List of localStorage keys used by the app
 */
const VALID_STORAGE_KEYS = [
  'whisprspace-user-session',
  'whisprspace-storage-version',
  'supabase.auth.session', // Raw Auth session key
  // Add other legitimate keys here
]

/**
 * Check if localStorage needs migration/cleanup
 */
export const needsStorageMigration = (): boolean => {
  const currentVersion = localStorage.getItem(STORAGE_VERSION_KEY)
  return currentVersion !== CURRENT_VERSION
}

/**
 * Clear all localStorage except whitelisted keys
 */
export const clearOldStorage = (): void => {
  const keysToKeep: { [key: string]: string | null } = {}
  
  // Save whitelisted keys
  VALID_STORAGE_KEYS.forEach(key => {
    keysToKeep[key] = localStorage.getItem(key)
  })
  
  // Clear everything
  localStorage.clear()
  
  // Restore whitelisted keys
  Object.entries(keysToKeep).forEach(([key, value]) => {
    if (value !== null) {
      localStorage.setItem(key, value)
    }
  })
  

}

/**
 * Perform storage migration based on version
 */
export const migrateStorage = (): void => {
  const currentVersion = localStorage.getItem(STORAGE_VERSION_KEY)
  
  if (!currentVersion) {

    // clearOldStorage() // DISABLED: To fix session persistence issues
  } else if (currentVersion !== CURRENT_VERSION) {

    // Add version-specific migrations here if needed
    // clearOldStorage() // DISABLED: To fix session persistence issues
  }
  
  // Set current version
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION)

}

/**
 * Force clear all storage (for debugging)
 */
export const forceResetStorage = (): void => {

  localStorage.clear()
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION)

}

/**
 * Check for and remove any mock/test data keys
 */
export const cleanupMockData = (): void => {
  const mockDataPatterns = [
    'mock-',
    'test-',
    'demo-',
    'temp-',
    'debug-',
  ]
  
  const keysToRemove: string[] = []
  
  // Find all keys that match mock data patterns
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && mockDataPatterns.some(pattern => key.includes(pattern))) {
      keysToRemove.push(key)
    }
  }
  
  // Remove mock data keys
  keysToRemove.forEach(key => {
    localStorage.removeItem(key)

  })
  
  if (keysToRemove.length > 0) {

  }
}

/**
 * Initialize storage on app load
 */
export const initializeStorage = (): void => {
  try {
    // Check if migration is needed
    if (needsStorageMigration()) {
      migrateStorage()
    }
    
    // Always cleanup any mock data
    cleanupMockData()
    

  } catch (error) {
    console.error('❌ Storage initialization failed:', error)
  }
}

/**
 * Get current storage info (for debugging)
 */
export const getStorageInfo = () => {
  const info = {
    version: localStorage.getItem(STORAGE_VERSION_KEY),
    totalKeys: localStorage.length,
    keys: [] as string[],
    sizeEstimate: 0,
  }
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      info.keys.push(key)
      const value = localStorage.getItem(key)
      if (value) {
        info.sizeEstimate += value.length
      }
    }
  }
  
  return info
}
