/**
 * Helper to get user image, defaulting to a dynamic initials-based avatar URL
 * with a random background color if no image is present.
 */
export const getUserImageWithFallback = (
  name: string | null | undefined,
  email: string | null | undefined,
  image: string | null | undefined
): string => {
  if (image) return image;
  
  const displayName = name || (email ? email.split('@')[0] : '') || 'User';
  
  // Generates a beautiful initial-based avatar image using ui-avatars.com
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128&bold=true`;
};
