// src/index.js (or server.js)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');

// ==== Database Connection ====
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // exit process if DB fails
  }
})();

// ==== Discord Bot Setup ====
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

discordClient.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('🤖 Discord bot is online!'))
  .catch(err => {
    console.error('❌ Discord bot login failed:', err);
    process.exit(1);
  });

// ==== Express App ====
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (important for Vercel / reverse proxies)
app.set('trust proxy', 1);

// ==== Middleware ====
app.use(cors({
  origin: [
    'http://localhost:3000',
    process.env.VERCEL_URL
  ].filter(Boolean), // remove falsy values
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// ==== Session ====
app.use(session({
  secret: process.env.SESSION_SECRET || 'monad-nft-verify-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 24 * 60 * 60, // 1 day
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // only secure in prod
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  },
}));

// ==== Static Files ====
app.use(express.static(path.join(__dirname, '../public')));

// ==== Routes ====
const adminRoutes = require('./routes/admin');
const discordAuth = require('./services/discordAuth');
const walletConnect = require('./services/walletConnect');
const nftVerification = require('./services/nftVerification');

app.use('/api/auth', discordAuth.router);
app.use('/api/wallet', walletConnect);
app.use('/api/nft', nftVerification);
app.use('/api/admin', adminRoutes(discordClient));
app.use('/api/project', adminRoutes(discordClient)); // avoid duplication? check if needed

// ==== Config Endpoint ====
app.get('/api/config/bot-client-id', (req, res) => {
  const BOT_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  if (!BOT_CLIENT_ID) {
    return res.status(500).json({ error: 'Bot Client ID not configured.' });
  }

  const BOT_INVITE_URL = `https://discord.com/api/oauth2/authorize?client_id=${BOT_CLIENT_ID}&permissions=268437504&scope=bot%20applications.commands`;
  res.json({
    clientId: BOT_CLIENT_ID,
    inviteUrl: BOT_INVITE_URL,
  });
});

// ==== Start Server ====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
