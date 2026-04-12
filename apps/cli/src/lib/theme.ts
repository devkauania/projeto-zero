import pc from 'picocolors';

/**
 * Global Visual Identity based on Terminal UX Design Handshake.
 * Using picocolors for high performance, no-dependency formatting.
 */
export const theme = {
  /** Banners, main prompts, highlighted paths */
  brand: pc.cyan,
  
  /** Completed steps, successful saves */
  success: pc.green,
  
  /** Missing configurations, cancellations, reset prompts */
  warning: pc.yellow,
  
  /** Corrupted state, failed generations */
  error: pc.red,
  
  /** File paths, descriptive hints, JSON structures */
  muted: pc.dim,
};
