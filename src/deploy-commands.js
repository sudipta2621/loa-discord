const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, './.env') });

const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

const commands = [
  new SlashCommandBuilder()
    .setName('loa')
    .setDescription('LOA management commands')
    // Subcommand: configure – sets the global confirmation channel.
    .addSubcommand(sub =>
      sub.setName('configure')
        .setDescription('Configure the global confirmation channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The text channel for confirmation messages')
            .setRequired(true)))
    // Subcommand: request-admin – submit a LOA request (confirmation channel not an option)
    .addSubcommand(sub =>
      sub.setName('request-admin')
        .setDescription('Submit a LOA request for a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to request LOA for')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('start_date')
            .setDescription('Start date (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('end_date')
            .setDescription('End date (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for the LOA')
            .setRequired(true)))
    // Subcommand: active – list all active LOAs.
    .addSubcommand(sub =>
      sub.setName('active')
        .setDescription('List all active LOAs'))
    // Subcommand: manage – manage LOAs for a specified user.
    .addSubcommand(sub =>
      sub.setName('manage')
        .setDescription('Manage LOAs for a specified user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User whose LOAs you want to manage')
            .setRequired(true)))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error while updating slash commands:', error);
  }
})();
