const path = require('path');
const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  Events, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const dotenv = require('dotenv');

// Load environment variables from project root (.env)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Define path to LOA data file (data.json in project root)
const dataFilePath = path.resolve(__dirname, '../data.json');
// Load LOA data – if file doesn't exist or is empty, default to an empty array.
let loas;
if (fs.existsSync(dataFilePath)) {
  const fileContent = fs.readFileSync(dataFilePath, 'utf-8');
  try {
    loas = fileContent.trim() ? JSON.parse(fileContent) : [];
  } catch (err) {
    console.error('Error parsing data.json:', err);
    loas = [];
  }
} else {
  loas = [];
  fs.writeFileSync(dataFilePath, JSON.stringify(loas, null, 2));
}
function saveLOAs() {
  fs.writeFileSync(dataFilePath, JSON.stringify(loas, null, 2));
}

// Define path to global config file (config.json in project root)
const configFilePath = path.resolve(__dirname, '../config.json');
let config;
if (fs.existsSync(configFilePath)) {
  const fileContent = fs.readFileSync(configFilePath, 'utf-8');
  try {
    config = fileContent.trim() ? JSON.parse(fileContent) : {};
  } catch(err) {
    console.error('Error parsing config.json:', err);
    config = {};
  }
} else {
  config = {};
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}
function saveConfig() {
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}

// Create the Discord client with only Guilds intent (sufficient for slash commands).
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Handle slash command interactions.
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    if (commandName === 'loa') {
      const subcommand = interaction.options.getSubcommand();
      
      // /loa configure – sets the global confirmation channel.
      if (subcommand === 'configure') {
        const channel = interaction.options.getChannel('channel');
        if (!channel.isTextBased()) {
          return interaction.reply({ content: 'Please select a text channel.', ephemeral: true });
        }
        config.confirmationChannel = channel.id;
        saveConfig();
        return interaction.reply({ content: `Confirmation channel set to <#${channel.id}>.`, ephemeral: true });
      
      // /loa request-admin – submits a LOA request.
      } else if (subcommand === 'request-admin') {
        const user = interaction.options.getUser('user');
        const startDate = interaction.options.getString('start_date');
        const endDate = interaction.options.getString('end_date');
        const reason = interaction.options.getString('reason');
        
        loas.push({
          userId: user.id,
          startDate,
          endDate,
          reason,
          status: 'active'
        });
        saveLOAs();
        
        let confirmationMsg = `✅ LOA added for ${user.username} from ${startDate} to ${endDate}.`;
        // Send confirmation in the globally configured channel (if set).
        if (config.confirmationChannel) {
          try {
            const confChannel = await client.channels.fetch(config.confirmationChannel);
            if (confChannel && confChannel.isTextBased()) {
              confChannel.send(confirmationMsg);
            }
          } catch (err) {
            console.error('Error sending confirmation message:', err);
          }
        }
        return interaction.reply({ content: 'LOA request processed.', ephemeral: true });
      
      // /loa active – lists all active LOAs.
      } else if (subcommand === 'active') {
        const activeLoas = loas.filter(l => l.status === 'active');
        if (activeLoas.length === 0) {
          return interaction.reply("There are no active LOAs.");
        }
        const list = activeLoas
          .map(l => `- <@${l.userId}>: ${l.startDate} → ${l.endDate} (${l.reason})`)
          .join('\n');
        return interaction.reply(list);
      
      // /loa manage – manages LOAs for a specified user.
      } else if (subcommand === 'manage') {
        const user = interaction.options.getUser('user');
        const userLoas = loas.filter(l => l.userId === user.id && l.status === 'active');
        if (userLoas.length === 0) {
          return interaction.reply(`No active LOAs for ${user.username}.`);
        }
        const options = userLoas.map((loa, index) => ({
          label: `LOA ${index + 1}`,
          description: `${loa.startDate} → ${loa.endDate}`,
          value: index.toString()
        }));
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_loa_${user.id}`)
          .setPlaceholder('Select the LOA to manage')
          .addOptions(options);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return interaction.reply({
          content: 'Select the LOA you want to manage:',
          components: [row],
          ephemeral: true
        });
      }
    }
  }
  // Handle select menu interactions for LOA management.
  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('select_loa_')) {
      const userId = interaction.customId.split('_')[2]; // Extract user id from customId.
      const selectedIndex = parseInt(interaction.values[0]);
      const userLoas = loas.filter(l => l.userId === userId && l.status === 'active');
      if (selectedIndex < 0 || selectedIndex >= userLoas.length) {
        return interaction.reply({ content: 'Invalid selection.', ephemeral: true });
      }
      // Build action buttons for the selected LOA.
      const editButton = new ButtonBuilder()
        .setCustomId(`edit_${userId}_${selectedIndex}`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary);
      const deleteButton = new ButtonBuilder()
        .setCustomId(`delete_${userId}_${selectedIndex}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);
      const extendButton = new ButtonBuilder()
        .setCustomId(`extend_${userId}_${selectedIndex}`)
        .setLabel('Extend')
        .setStyle(ButtonStyle.Success);
      const buttonRow = new ActionRowBuilder().addComponents(editButton, deleteButton, extendButton);
      return interaction.update({
        content: `Manage LOA for <@${userId}>: ${userLoas[selectedIndex].startDate} → ${userLoas[selectedIndex].endDate} (${userLoas[selectedIndex].reason}). Choose an action:`,
        components: [buttonRow]
      });
    }
  }
  // Handle button interactions for edit, delete, or extend actions.
  else if (interaction.isButton()) {
    const parts = interaction.customId.split('_');
    const action = parts[0]; // "edit", "delete", or "extend"
    const userId = parts[1];
    const index = parseInt(parts[2]);
    const userLoas = loas.filter(l => l.userId === userId && l.status === 'active');
    if (index < 0 || index >= userLoas.length) {
      return interaction.reply({ content: 'Invalid LOA selection.', ephemeral: true });
    }
    const selectedLOA = userLoas[index];
    
    if (action === 'delete') {
      selectedLOA.status = 'deleted';
      saveLOAs();
      let msg = `LOA for <@${userId}> has been deleted.`;
      if (config.confirmationChannel) {
        try {
          const confChannel = await client.channels.fetch(config.confirmationChannel);
          if (confChannel && confChannel.isTextBased()) {
            confChannel.send(msg);
          }
        } catch (err) {
          console.error('Error sending delete confirmation:', err);
        }
      }
      return interaction.reply({ content: msg, ephemeral: true });
    } else if (action === 'extend') {
      // For demo purposes, extend the end date by one day.
      const currentEnd = new Date(selectedLOA.endDate);
      currentEnd.setDate(currentEnd.getDate() + 1);
      selectedLOA.endDate = currentEnd.toISOString().split('T')[0];
      saveLOAs();
      let msg = `LOA for <@${userId}> has been extended to ${selectedLOA.endDate}.`;
      if (config.confirmationChannel) {
        try {
          const confChannel = await client.channels.fetch(config.confirmationChannel);
          if (confChannel && confChannel.isTextBased()) {
            confChannel.send(msg);
          }
        } catch (err) {
          console.error('Error sending extend confirmation:', err);
        }
      }
      return interaction.reply({ content: msg, ephemeral: true });
    } else if (action === 'edit') {
      // For demo purposes, simulate editing by updating the reason.
      selectedLOA.reason = 'Edited Reason';
      saveLOAs();
      let msg = `LOA for <@${userId}> has been edited. New reason: ${selectedLOA.reason}.`;
      if (config.confirmationChannel) {
        try {
          const confChannel = await client.channels.fetch(config.confirmationChannel);
          if (confChannel && confChannel.isTextBased()) {
            confChannel.send(msg);
          }
        } catch (err) {
          console.error('Error sending edit confirmation:', err);
        }
      }
      return interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// Background job: Check every minute for expired LOAs and notify in the configured channel.
setInterval(async () => {
  const now = new Date();
  let updated = false;
  for (const loa of loas) {
    if (loa.status === 'active') {
      const end = new Date(loa.endDate);
      if (now >= end) {
        loa.status = 'expired';
        updated = true;
        const msg = `⏰ Reminder: The LOA for <@${loa.userId}> expired on ${loa.endDate}.`;
        if (config.confirmationChannel) {
          try {
            const confChannel = await client.channels.fetch(config.confirmationChannel);
            if (confChannel && confChannel.isTextBased()) {
              confChannel.send(msg);
            }
          } catch (err) {
            console.error(`Error sending reminder for LOA of ${loa.userId}:`, err);
          }
        }
      }
    }
  }
  if (updated) saveLOAs();
}, 60000);

client.login(process.env.DISCORD_TOKEN);
