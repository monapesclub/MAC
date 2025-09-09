# Monad NFT Verification Portal

A web application for verifying Monad testnet NFT ownership and assigning Discord roles based on that ownership.

## Features

- Discord OAuth2 authentication
- Monad wallet connection
- NFT ownership verification
- Discord role assignment
- Project configuration for administrators
- User dashboard for NFT management

## Setup Instructions

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your configuration (see `.env.example`)
4. Start the development server: `npm run dev`
5. Open http://localhost:3000 in your browser

## Discord Bot Setup

1. Create a new Discord application at https://discord.com/developers/applications
2. Add a bot to your application
3. Enable the following intents:
   - Server Members Intent
   - Message Content Intent
4. Invite the bot to your server with the following permissions:
   - Manage Roles
   - Read Messages/View Channels
   - Send Messages

## Project Structure
