const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ethers } = require("ethers");
const User = require('../models/User');
const { requireAuth } = require('../services/discordAuth');
require('dotenv').config();

// --- Project Schema ---
const projectSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  projectName: { type: String, required: true },
  network: { type: String, required: true },
  rules: [{
    contractAddress: { type: String, required: true },
    roleId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    tokenType: { type: String, enum: ["ERC721", "ERC1155"], required: true },
    tokenId: { type: String, required: function () { return this.tokenType === "ERC1155"; } }
  }],
  teamMembers: [String],
  ownerId: { type: String, required: true }
}, { timestamps: true });

// Add indexes for better performance
projectSchema.index({ ownerId: 1 });
projectSchema.index({ teamMembers: 1 });
projectSchema.index({ guildId: 1 });

const Project = mongoose.model('Project', projectSchema);

// --- Minimal ABIs ---
const ERC721_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const ERC1155_ABI = ["function balanceOf(address account, uint256 id) view returns (uint256)"];

// --- Helper: select provider by network ---
function getProvider(network) {
  let rpcUrl = process.env.RPC_URL;
  if (network === 'monad-testnet') {
    rpcUrl = 'https://rpc.ankr.com/monad_testnet';
  } else if (network === 'monad-mainnet') {
    rpcUrl = 'https://mainnet-rpc.monad.xyz';
  }
  console.log(`🌐 Using RPC URL: ${rpcUrl}`);
  return new ethers.JsonRpcProvider(rpcUrl);
}

// --- Check NFT ownership ---
async function checkNFTOwnership(rule, walletAddress, network) {
  try {
    const provider = getProvider(network);
    console.log(`🔍 Checking NFT ownership for wallet ${walletAddress} on contract ${rule.contractAddress} (type: ${rule.tokenType})`);

    if (rule.tokenType === "ERC721") {
      const contract = new ethers.Contract(rule.contractAddress, ERC721_ABI, provider);
      const balance = await contract.balanceOf(walletAddress).catch(() => BigInt(0));
      console.log(`✅ ERC721 balance: ${balance}`);
      return balance >= BigInt(rule.quantity);
    }

    if (rule.tokenType === "ERC1155") {
      if (!rule.tokenId) {
        console.log("⚠️ ERC1155 tokenId missing");
        return false;
      }
      const contract = new ethers.Contract(rule.contractAddress, ERC1155_ABI, provider);
      const balance = await contract.balanceOf(walletAddress, BigInt(rule.tokenId)).catch(() => BigInt(0));
      console.log(`✅ ERC1155 balance for tokenId ${rule.tokenId}: ${balance}`);
      return balance >= BigInt(rule.quantity);
    }

    return false;
  } catch (err) {
    console.error("❌ NFT check failed:", err);
    return false;
  }
}

// --- Routes ---
module.exports = (discordClient) => {

  // GET roles from Discord guild
  router.get('/roles', async (req, res) => {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'Guild ID is required.' });

    try {
      const guild = await discordClient.guilds.fetch(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found or bot not in guild.' });
      console.log(`✅ Fetched guild: ${guild.name}`);

      const roles = guild.roles.cache
        .filter(role => role.id !== guild.id)
        .map(role => ({ id: role.id, name: role.name }));
      console.log(`📋 Roles count: ${roles.length}`);

      res.json(roles);
    } catch (err) {
      console.error('❌ Error fetching roles:', err);
      res.status(500).json({ error: 'Failed to fetch roles from Discord.' });
    }
  });

  // GET projects (owner's + team members')
  router.get('/projects', requireAuth, async (req, res) => {
    try {
        const currentUserId = req.user.discordId;
        console.log(`📂 Fetching projects for user: ${currentUserId}`);

        // Find projects where user is owner OR team member
        const projects = await Project.find({
            $or: [
                { ownerId: currentUserId },
                { teamMembers: currentUserId }
            ]
        });

        console.log(`✅ Found ${projects.length} projects for user ${currentUserId}`);
        res.json(projects);
    } catch (err) {
        console.error('❌ Error fetching projects:', err);
        res.status(500).json({ error: 'Failed to retrieve projects.' });
    }
  });

  // GET project details
  router.get('/project-details', requireAuth, async (req, res) => {
    const { guildId } = req.query;
    const currentUserId = req.user.discordId;
    
    if (!guildId) return res.status(400).json({ error: 'Missing guildId parameter.' });

    try {
        // Find project where user is owner OR team member
        const project = await Project.findOne({
            guildId,
            $or: [
                { ownerId: currentUserId },
                { teamMembers: currentUserId }
            ]
        });

        if (!project) {
            console.log(`❌ Project not found or no access: ${guildId}`);
            return res.status(404).json({ error: 'Project not found or no access.' });
        }

        console.log(`✅ Project details fetched: ${project.projectName}`);
        res.json(project);
    } catch (err) {
        console.error('❌ Error fetching project details:', err);
        res.status(500).json({ error: 'Server error fetching project details.' });
    }
  });

  // POST save project (Owner only can save)
  router.post('/save-project', requireAuth, async (req, res) => {
    try {
        const { guildId, projectName, network, rules, teamMembers } = req.body;
        const ownerId = req.user.discordId;

        console.log(`💾 Saving project: ${projectName} (${guildId}) by ${ownerId}`);

        // Only owner can save/update the project
        const result = await Project.findOneAndUpdate(
            { guildId, ownerId },
            { 
                projectName, 
                network, 
                rules, 
                teamMembers, 
                ownerId 
            },
            { new: true, upsert: true }
        );

        console.log(`✅ Project saved: ${result.projectName}`);
        res.json({ message: 'Project saved successfully.', project: result });
    } catch (err) {
        console.error('❌ Error saving project:', err);
        res.status(500).json({ error: 'Failed to save project.' });
    }
  });

  // GET first project config (for verification)
  router.get('/config', async (req, res) => {
    try {
        // This is for public verification, so we return the first project
        const project = await Project.findOne({});
        if (!project) {
            console.log("❌ No project config found");
            return res.status(404).json({ error: 'No project configuration found.' });
        }
        console.log(`📂 Loaded project config: ${project.projectName}`);
        res.json(project);
    } catch (err) {
        console.error('❌ Error fetching project config:', err);
        res.status(500).json({ error: 'Server error fetching project config.' });
    }
  });

  // POST verify and assign Discord roles
  router.post('/verify-and-assign', async (req, res) => {
    const { guildId, walletAddress, discordUserId } = req.body;
    if (!guildId || !walletAddress || !discordUserId) {
      console.log('❌ Missing parameters for verify-and-assign:', { guildId, walletAddress, discordUserId });
      return res.status(400).json({ error: 'Missing parameters.' });
    }

    try {
      console.log(`🔎 Verifying roles for wallet ${walletAddress} in guild ${guildId}`);

      const project = await Project.findOne({ guildId });
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      console.log(`📂 Project fetched: ${project.projectName}`);

      const guild = await discordClient.guilds.fetch(guildId);
      console.log(`✅ Guild fetched: ${guild.name}`);

      const member = await guild.members.fetch(discordUserId);
      console.log(`✅ Member fetched: ${member.user.username}`);

      const assignedRoles = [];
      const removedRoles = [];

      for (const rule of project.rules) {
        const role = guild.roles.cache.get(rule.roleId);
        if (!role) {
          console.log(`⚠️ Role not found: ${rule.roleId}`);
          continue;
        }

        const hasNFT = await checkNFTOwnership(rule, walletAddress, project.network);

        if (hasNFT) {
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            assignedRoles.push(role.name);
            console.log(`🟢 Assigned role: ${role.name}`);
          }
        } else {
          if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            removedRoles.push(role.name);
            console.log(`🔴 Removed role: ${role.name}`);
          }
        }
      }

      console.log(`🎯 Verification complete for wallet ${walletAddress}`);
      console.log(`Assigned Roles: ${assignedRoles.join(', ')}`);
      console.log(`Removed Roles: ${removedRoles.join(', ')}`);

      res.json({ message: "Role sync complete", assignedRoles, removedRoles });
    } catch (err) {
      console.error("❌ Error in verify-and-assign:", err);
      res.status(500).json({ error: "Failed to update roles." });
    }
  });

 // --- Auto-sync roles every 5 mins ---
async function autoSyncRoles() {
    // Prevent multiple simultaneous runs
    if (autoSyncRoles.isRunning) {
        console.log("⏭️ Auto-sync already running, skipping...");
        return;
    }
    
    autoSyncRoles.isRunning = true;
    console.log("🔄 Auto-sync roles started");

    try {
        const projects = await Project.find({});
        console.log(`📂 Found ${projects.length} projects for auto-sync`);

        for (const project of projects) {
            // Guild fetch
            const guild = await discordClient.guilds.fetch(project.guildId).catch(() => null);
            if (!guild) {
                console.log(`⚠️ Guild not found for auto-sync: ${project.guildId}`);
                continue;
            }
            console.log(`✅ Guild ready: ${guild.name}`);

            // ✅ ONLY get users from database who have both walletAddress and discordId
            const verifiedUsers = await User.find({
                walletAddress: { $exists: true, $ne: null, $ne: "" },
                discordId: { $exists: true, $ne: null, $ne: "" }
            }).select('discordId walletAddress');

            console.log(`👥 Checking ${verifiedUsers.length} verified users from database for ${guild.name}`);

            for (const dbUser of verifiedUsers) {
                try {
                    // Check if user is still in the guild
                    const member = await guild.members.fetch(dbUser.discordId).catch(() => null);
                    if (!member) {
                        console.log(`⏭️ Skip: user ${dbUser.discordId} not in guild ${guild.name}`);
                        continue;
                    }

                    const walletAddress = dbUser.walletAddress;
                    console.log(`🔎 Checking ${member.user.username} (${walletAddress})`);

                    // Loop through all rules in the project
                    for (const rule of project.rules) {
                        const role = guild.roles.cache.get(rule.roleId);
                        if (!role) {
                            console.log(`⚠️ Role not found: ${rule.roleId}`);
                            continue;
                        }

                        let hasNFT = false;
                        try {
                            hasNFT = await checkNFTOwnership(rule, walletAddress, project.network);
                        } catch (err) {
                            console.error(`❌ NFT check failed for ${walletAddress}:`, err.message);
                            continue;
                        }

                        // Assign or Remove role based on NFT ownership
                        if (hasNFT) {
                            if (!member.roles.cache.has(role.id)) {
                                await member.roles.add(role);
                                console.log(`🟢 Assigned "${role.name}" to ${member.user.username}`);
                            } else {
                                console.log(`✅ "${role.name}" already assigned to ${member.user.username}`);
                            }
                        } else {
                            if (member.roles.cache.has(role.id)) {
                                await member.roles.remove(role);
                                console.log(`🔴 Removed "${role.name}" from ${member.user.username}`);
                            } else {
                                console.log(`✅ "${role.name}" already removed from ${member.user.username}`);
                            }
                        }
                    }
                } catch (userError) {
                    console.error(`❌ Error processing user ${dbUser.discordId}:`, userError.message);
                    continue;
                }
            }
        }

        console.log("✅ Auto-sync roles completed");
    } catch (err) {
        console.error("❌ Auto-sync general error:", err);
    } finally {
        autoSyncRoles.isRunning = false;
    }
}

// Initialize the flag
autoSyncRoles.isRunning = false;

// ✅ Start auto-sync with singleton pattern
let autoSyncInterval = null;

function startAutoSync() {
    if (!autoSyncInterval) {
        console.log("⏰ Starting auto-sync interval (5 minutes)");
        autoSyncInterval = setInterval(autoSyncRoles, 5 * 60 * 1000);
        
        // Also run immediately on server start after 5 seconds
        setTimeout(() => {
            console.log("🚀 Running initial auto-sync");
            autoSyncRoles();
        }, 5000);
    }
}

// Start the auto-sync
startAutoSync();
  return router;
};
