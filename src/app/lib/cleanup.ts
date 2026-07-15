import { prisma } from './prisma.js';

/**
 * Runs a cleanup query to delete users whose email is not verified
 * and whose accounts were created more than 2 hours ago.
 */
const runCleanup = async () => {
  try {
    console.log('⏳ Running cleanup for unverified users...');
    const thresholdDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    
    const deleted = await prisma.user.deleteMany({
      where: {
        emailVerified: false,
        createdAt: {
          lt: thresholdDate
        }
      }
    });
    
    if (deleted.count > 0) {
      console.log(`🧹 Cleaned up ${deleted.count} unverified users from database.`);
    } else {
      console.log('✅ Unverified user cleanup checked: no users to clean.');
    }
  } catch (error) {
    console.error('❌ Failed to run unverified user cleanup:', error);
  }
};

export const startUnverifiedCleanup = () => {
  // Run once immediately on startup
  runCleanup();

  // Run every 1 hour (3600000 milliseconds)
  setInterval(runCleanup, 60 * 60 * 1000);
};
