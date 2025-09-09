// src/models/Project.js
const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
    contractAddress: { 
        type: String, 
        required: true 
    },
    roleId: { 
        type: String, 
        required: true 
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    tokenType: { 
        type: String, 
        default: 'ERC721' 
    },
    tokenId: { 
        type: String, 
        default: '' 
    }
});

const projectSchema = new mongoose.Schema({
    projectName: { 
        type: String, 
        required: true 
    },
    guildId: { 
        type: String, 
        required: true 
    },
    network: { 
        type: String, 
        required: true 
    },
    rules: [ruleSchema],
    teamMembers: [String],
    createdBy: { 
        type: String, // Changed to String to store Discord User ID
        required: true 
    },
    discordUserId: { // Added this field for easier querying
        type: String,
        required: true
    }
}, { 
    timestamps: true 
});

// Add indexes for better performance
projectSchema.index({ discordUserId: 1 }); // For owner queries
projectSchema.index({ teamMembers: 1 });   // For team member queries
projectSchema.index({ guildId: 1 });       // For guild queries
projectSchema.index({ 
    discordUserId: 1, 
    guildId: 1 
}, { 
    unique: true 
}); // One project per guild per owner

module.exports = mongoose.model('Project', projectSchema);
