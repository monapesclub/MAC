module.exports = {
  // Discord OAuth2 Configuration
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    botToken: process.env.DISCORD_BOT_TOKEN
  },

  // Monad Blockchain Configuration
  monad: {
    rpcUrl: process.env.MONAD_RPC_URL || "https://testnet.monad.xyz",
    chainId: parseInt(process.env.MONAD_CHAIN_ID) || 1234
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || "monad-nft-verify-secret",
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};