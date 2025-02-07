I'll create a comprehensive README.md file for your Chick-fil-A Order Bot:

```markdown:/Users/angelmarquezchavarria/BCFA Order Bot /README.md
# Chick-fil-A Order Bot

A Discord bot designed to streamline order management for Chick-fil-A restaurants, supporting both indoor and outdoor dining experiences.

## Features

### Order Management
- Create and manage orders with unique IDs
- Support for both indoor and outdoor orders
- Vehicle details collection for outdoor orders
- Real-time order status tracking
- Special instructions support
- Promo code integration

### Staff Controls
- Order claiming system
- Order completion tracking
- Order cancellation with reason logging
- Comprehensive order history

### Configuration
- Customizable command prefix
- Configurable channels for orders and logs
- Easy-to-use admin dashboard

## Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Create a `.env` file with your Discord bot token:
```env
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id
```

3. Configure your channels in `data/config.json`:
```json
{
  "prefix": "!",
  "channels": {
    "kitchen": "your_kitchen_channel_id",
    "log": "your_log_channel_id"
  }
}
```

4. Deploy slash commands:
```bash
npm run deploy
```

5. Start the bot:
```bash
npm start
```

## Commands

### `/order create`
Create a new order with:
- Customer name
- Location (indoor/outdoor)
- Optional promo code
- Menu item selection
- Special instructions

### `/order update`
Update an existing order (one-time only)

### `!config`
Admin-only configuration dashboard for:
- Service prefix
- Kitchen channel
- Log channel

## Requirements

- Node.js 16.9.0 or higher
- Discord.js v14
- Discord server with appropriate permissions

## Project Structure

```plaintext
├── commands/          # Command handlers
├── data/             # Configuration files
├── utils/            # Utility functions
├── index.js          # Main bot file
├── deploy-commands.js # Command deployment
└── menu.js           # Menu configuration
```

## License

This project is proprietary software. All rights reserved.

## Support

For issues and feature requests, please contact the development team.
```

This README provides a clear overview of your bot's features, setup instructions, and usage guidelines while maintaining the project's structure and functionality.
