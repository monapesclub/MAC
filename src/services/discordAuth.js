// src/services/discordAuth.js
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const config = require('../utils/config');
const User = require("../models/User");

const router = express.Router();


// Discord OAuth2 login endpoint
router.get('/discord', (req, res) => {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(config.discord.redirectUri)}&response_type=code&scope=identify guilds guilds.members.read`;
  res.redirect(discordAuthUrl);
});

// Discord OAuth2 callback endpoint
router.get('/discord/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('No code provided. Authentication failed.');
    }

    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.discord.redirectUri,
        scope: 'identify guilds guilds.members.read'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, token_type } = tokenResponse.data;
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { authorization: `${token_type} ${access_token}` }
    });
    const userData = userResponse.data;

    // MongoDB မှာ user info ကို ရှာပြီး update ဒါမှမဟုတ် create လုပ်ပါ။
    let user = await User.findOneAndUpdate(
      { discordId: userData.id },
      {
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${userData.discriminator % 5}.png`,
      },
      { upsert: true, new: true } // upsert: true က user မရှိရင် အသစ်ဖန်တီးပေးမယ်
    );

    req.session.userId = user._id; // MongoDB object ID ကို session မှာ သိမ်းမယ်
    req.session.discordId = user.discordId; // Discord ID ကိုလဲ သိမ်းထားမယ်
    req.session.isAuthenticated = true;

    console.log('User authenticated. Redirecting to dashboard.');
    res.redirect('/dashboard.html');

  } catch (error) {
    console.error('Discord auth error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// Get current user endpoint
router.get('/user', async (req, res) => {
  try {
    if (!req.session || !req.session.isAuthenticated) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.discordId,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      walletAddress: user.walletAddress
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // session ထဲက discordId ကို req.user မှာထည့်ပေးမယ်
  req.user = {
    discordId: req.session.discordId,
    id: req.session.userId
  };

  next();
}

module.exports = { router, User, requireAuth };