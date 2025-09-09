// Validate Ethereum-style address
function isValidEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Shorten wallet address
function shortenAddress(address, chars = 4) {
  if (!address) return '';
  return `${address.substring(0, chars + 2)}...${address.substring(42 - chars)}`;
}

// Format Discord username
function formatDiscordUsername(username, discriminator) {
  return discriminator !== '0' ? `${username}#${discriminator}` : username;
}

// Check if user already has role
async function hasDiscordRole(userId, guildId, roleId, discordClient) {
  try {
    console.log(`🔍 [HELPER] Checking role → user:${userId}, guild:${guildId}, role:${roleId}`);
    const guild = await discordClient.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    const hasRole = member.roles.cache.has(roleId);
    console.log(`   ↳ hasRole = ${hasRole}`);
    return hasRole;
  } catch (error) {
    console.error('❌ [HELPER] Error checking role:', error);
    return false;
  }
}

module.exports = {
  isValidEthAddress,
  shortenAddress,
  formatDiscordUsername,
  hasDiscordRole
};