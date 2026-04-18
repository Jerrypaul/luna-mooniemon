const { getExpiredGraceLinks } = require('./linkStore');
const { applySubscriberState, fetchLiveSubscriberRoleState } = require('./roleSync');

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let schedulerHandle = null;

async function processExpiredGracePeriods(client) {
  const expiredLinks = await getExpiredGraceLinks();

  if (expiredLinks.length === 0) {
    return;
  }

  console.log(`[minecraft] Processing ${expiredLinks.length} expired whitelist grace period(s).`);

  for (const link of expiredLinks) {
    try {
      const stillSubscribed = await fetchLiveSubscriberRoleState(client, link.discordUserId);
      await applySubscriberState(client, link.discordUserId, stillSubscribed, {
        source: 'grace-period-check',
        allowGracePeriod: false
      });
    } catch (error) {
      console.error(`[minecraft] Failed processing grace expiration for ${link.minecraftUsername}:`, error);
    }
  }
}

function startMinecraftScheduler(client) {
  if (schedulerHandle) {
    return;
  }

  schedulerHandle = setInterval(() => {
    processExpiredGracePeriods(client).catch((error) => {
      console.error('[minecraft] Scheduler run failed:', error);
    });
  }, CHECK_INTERVAL_MS);

  schedulerHandle.unref?.();

  processExpiredGracePeriods(client).catch((error) => {
    console.error('[minecraft] Initial scheduler run failed:', error);
  });
}

function stopMinecraftScheduler() {
  if (!schedulerHandle) {
    return;
  }

  clearInterval(schedulerHandle);
  schedulerHandle = null;
}

module.exports = {
  startMinecraftScheduler,
  stopMinecraftScheduler,
  processExpiredGracePeriods
};
