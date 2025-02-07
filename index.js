require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  ActivityType 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Update PREFIX definition
const config = require('./data/config.json');
let PREFIX = config.prefix || '!';

// Create a new Discord client instance.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Initialize collections for slash and prefix commands.
client.commands = new Collection();
client.prefixCommands = new Collection();

/**
 * Load command files from the 'commands' directory.
 */
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');

  // Ensure the commands directory exists.
  if (!fs.existsSync(commandsPath)) {
    console.error('Commands directory not found!');
    return;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);

      // Separate prefix commands (commands with a "name" property but no "data")
      if (command.name && !command.data) {
        client.prefixCommands.set(command.name, command);
        console.log(`Loaded prefix command: ${command.name}`);
        continue;
      }

      // ...from slash commands (commands with a "data" property containing a name).
      if (command.data && command.data.name) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded slash command: ${command.data.name}`);
      }
    } catch (error) {
      console.error(`[ERROR] Failed to load command file ${file}:`, error);
    }
  }
}

loadCommands();

// When the bot is ready, set up a rotating status.
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Array of Chick-fil-A themed statuses using ActivityType.Playing.
  const statuses = [
    {
      name: "Serving up finger-lickin' Chick-fil-A orders!",
      type: ActivityType.Custom
    },
    {
      name: "Cooking up some Chick-fil-A magic!",
      type: ActivityType.Custom
    },
    {
      name: "Grillin' those chicken nuggets to perfection!",
      type: ActivityType.Custom
    },
    {
      name: "Munching on waffle fries between commands!",
      type: ActivityType.Custom
    },
    {
      name: "Dishing out the secret Chick-fil-A sauce!",
      type: ActivityType.Custom
    }
  ];

  // Rotate the statuses every 15 seconds.
  let i = 0;
  setInterval(() => {
    client.user.setPresence({
      activities: [statuses[i]],
      status: 'online'
    });
    i = (i + 1) % statuses.length;
  }, 5000);
});

// Handle slash command interactions.
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing slash command ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error executing this command!',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'There was an error executing this command!',
        ephemeral: true
      });
    }
  }
});

// Handle messages for prefix commands and bot mentions.
// Update messageCreate event to use dynamic prefix
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.mentions.users.has(client.user.id)) {
    message.reply('Mooooo Moooo');
    return;
  }

  // Reload prefix from config for each command
  const currentConfig = require('./data/config.json');
  PREFIX = currentConfig.prefix || '!';

  if (!message.content.startsWith(PREFIX)) return;

  // Parse command name and arguments.
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Retrieve the command from the prefixCommands collection.
  const command = client.prefixCommands.get(commandName);
  if (!command) return;

  try {
    command.execute(message, args);
  } catch (error) {
    console.error(`Error executing prefix command ${commandName}:`, error);
    message.reply('There was an error executing that command!');
  }
});

// Log in to Discord with your bot token.
client.login(process.env.BOT_TOKEN);
