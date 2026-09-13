/**
 * Icon Configuration System for TT Activities
 *
 * Differentiated from original TREK design:
 * - Thicker stroke width (2.5 vs default 2)
 * - Rounded caps and joins
 * - Slightly larger sizes for better visibility
 * - Consistent sizing across all activity components
 */

export const ICON_CONFIG = {
  // Activity-specific icons - thicker, more prominent
  activity: {
    size: 18,
    strokeWidth: 2.5,
  },

  // Small icons for inline elements
  inline: {
    size: 14,
    strokeWidth: 2.5,
  },

  // Action buttons (add, delete, etc)
  action: {
    size: 16,
    strokeWidth: 2.5,
  },

  // Large decorative icons
  decorative: {
    size: 48,
    strokeWidth: 1.5,
  },

  // View toggle icons
  toggle: {
    size: 18,
    strokeWidth: 2.5,
  },
}

/**
 * Helper function to apply icon props consistently
 */
export function getIconProps(type: keyof typeof ICON_CONFIG) {
  return ICON_CONFIG[type]
}
