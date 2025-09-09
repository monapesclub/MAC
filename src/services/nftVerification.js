const express = require('express');
const router = express.Router();
const { Network, Alchemy } = require("alchemy-sdk");

// Alchemy Configuration
const settings = {
    apiKey: "obqcfQFQQMex23ALSZQEf",
    network: Network.MONAD_TESTNET, // ❌ ဒီနေရာမှာ Monad မရှိရင် အမှားထွက်မယ်
};

// Create the Alchemy object
const alchemy = new Alchemy(settings);

// API Endpoint to get all NFTs for a connected wallet
router.get('/nfts', async (req, res) => {
    console.log('[NFT API] Checking session...');
    console.log('[NFT API] Session ID:', req.sessionID);
    console.log('[NFT API] Session walletAddress:', req.session.walletAddress);
    try {
        const walletAddress = req.session.walletAddress;
        console.log("📌 [NFT API] Session wallet address:", walletAddress);

        if (!walletAddress) {
            console.warn("⚠️ No wallet address found in session");
            return res.status(400).json({ error: 'Wallet address is required in session.' });
        }

        console.log("⏳ Fetching NFTs for wallet:", walletAddress);

        // Try fetching NFTs from Alchemy
        let nftsResponse;
        try {
            nftsResponse = await alchemy.nft.getNftsForOwner(walletAddress);
            console.log("✅ Raw NFT response received:", JSON.stringify(nftsResponse, null, 2));
        } catch (alchemyError) {
            console.error("❌ Error calling Alchemy NFT API:", alchemyError.message || alchemyError);
            return res.status(500).json({ error: 'Alchemy NFT API call failed', details: alchemyError.message });
        }

        if (!nftsResponse || !Array.isArray(nftsResponse.ownedNfts)) {
            console.warn("⚠️ NFT response invalid or empty:", nftsResponse);
            return res.json([]);
        }

        // Filter the data to match the frontend's expected format
        const filteredNfts = nftsResponse.ownedNfts.map(nft => {
    // 🚨 FIX 2: Check for different fields for the collection name
    const collectionName = nft.contract.name || nft.raw.metadata.collection?.name || nft.raw.metadata.symbol || 'Unknown Collection';

    return {
        name: nft.name,
        // Make sure to use nft.image.cachedUrl as it's a more reliable HTTPS URL
        image: nft.image.cachedUrl || nft.raw.metadata.image,
        collection: collectionName,
        attributes: nft.raw.metadata.attributes,
        contractAddress: nft.contract.address,
        tokenId: nft.tokenId
    };
});

        console.log("🎯 Filtered NFTs to return:", filteredNfts.length);
        res.json(filteredNfts);
    } catch (error) {
        console.error('🔥 Unexpected error in /nfts endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch NFTs from backend.' });
    }
});

module.exports = router;