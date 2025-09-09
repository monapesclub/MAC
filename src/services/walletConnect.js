// src/services/walletConnect.js
const express = require('express');
const { ethers } = require('ethers');
const { User } = require('./discordAuth'); // Import User model
const { isValidEthAddress, shortenAddress } = require('../utils/helpers');

const router = express.Router();

/**
 * Connect wallet
 */
router.post('/connect', async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!req.session?.isAuthenticated) {
      return res.status(401).json({ error: 'Session required. Please log in first.' });
    }

    if (!address || !isValidEthAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    // Verify signature
    const signerAddress = ethers.verifyMessage(message, signature);
    if (signerAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Update user wallet in DB
    await User.findByIdAndUpdate(req.session.userId, { walletAddress: address });

    // Save wallet in session
    req.session.walletAddress = address;

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session.' });
      }

      res.json({
        address,
        shortenedAddress: shortenAddress(address),
        connectedAt: new Date().toISOString(),
        verified: true,
      });
    });
  } catch (error) {
    console.error('Wallet connection error:', error);
    res.status(500).json({ error: `Wallet connection failed: ${error.message}` });
  }
});

/**
 * Get wallet connection status
 */
router.get('/status', (req, res) => {
  if (!req.session?.isAuthenticated) {
    return res.json({ connected: false });
  }

  const walletAddress = req.session.walletAddress;
  if (walletAddress) {
    return res.json({
      connected: true,
      address: walletAddress,
      shortenedAddress: shortenAddress(walletAddress),
    });
  }

  res.json({ connected: false });
});

/**
 * Disconnect wallet
 */
router.post('/disconnect', async (req, res) => {
  try {
    if (!req.session?.isAuthenticated) {
      return res.status(401).json({ error: 'Session required. Please log in first.' });
    }

    await User.findByIdAndUpdate(req.session.userId, { walletAddress: null });

    req.session.walletAddress = null;

    res.json({ success: true });
  } catch (error) {
    console.error('Wallet disconnection error:', error);
    res.status(500).json({ error: 'Failed to disconnect wallet' });
  }
});

module.exports = router;
