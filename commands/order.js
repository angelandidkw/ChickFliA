const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType,
    SlashCommandBuilder,
  } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  const menu = require('../menu.js');
  const OrderLogger = require('../utils/orderLogger.js');
  const config = require('../data/config.json');
  const orderLogger = new OrderLogger(config.channels.log);
  const PROMOCODES_PATH = path.join(__dirname, '../data/promocodes.json');
  const orders = new Map();
  let orderCounter = 100; // Global order counter starting at 100
  
  /**
   * Helper: Capitalize text
   */
  function capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  
  /**
   * Helper: Get emoji for a given order status
   */
  function getStatusEmoji(status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return '<:pending:1336561857254785124>'; // Yellow status emoji
      case 'completed':
        return '<:online:1336561855912480819>'; // Green status emoji
      case 'cancelled':
        return '<:ended:1336561854780280853>'; // Red status emoji
      default:
        return '';
    }
  }
  
  /**
   * Helper: Load promo codes from JSON file
   */
  function loadPromoCodes() {
    try {
      return JSON.parse(fs.readFileSync(PROMOCODES_PATH, 'utf8'));
    } catch (error) {
      console.error('Failed to load promo codes:', error);
      return { codes: {} };
    }
  }
  
  /**
   * Build the order embed with the new format.
   */
  function createOrderEmbed(order) {
    const statusEmoji = getStatusEmoji(order.status);
    const embed = new EmbedBuilder()
      .setTitle(`<:ChickFilA:1336562218036101171> | Order: ${order.customer} - #**${order.id}**`)
      .setColor('#E51636');
  
    // Basic order info fields.
    embed.addFields(
      { name: 'Customer Name', value: order.customer, inline: true },
      { name: 'Status', value: `${statusEmoji} ${capitalize(order.status)}`, inline: true },
      { name: 'Location', value: capitalize(order.location), inline: true }
    );
  
    // If outdoor and vehicle info exists, include just the car model.
    if (order.location === 'outdoor' && order.carDescription) {
      embed.addFields({ name: 'Car Model', value: order.carDescription.model, inline: true });
    }
  
    // Organize and list ordered items.
    let totalPrice = 0;
    const categorySections = [];
    const categorizedItems = {};
  
    for (const item of order.items) {
      if (!categorizedItems[item.category]) {
        categorizedItems[item.category] = [];
      }
      categorizedItems[item.category].push(item);
    }
  
    for (const [category, items] of Object.entries(categorizedItems)) {
      const categoryItems = items.map((item) => {
        const price = menu[category][item.name];
        totalPrice += price * item.quantity;
        return `${item.quantity}x ${item.name} - $${(price * item.quantity).toFixed(2)}`;
      });
      categorySections.push(`**${capitalize(category)}**\n${categoryItems.join('\n')}`);
    }
  
    // Add the items list (if any) and the subtotal field.
    embed.setDescription(
      categorySections.length > 0 ? categorySections.join('\n\n') : 'No Chick-fil-A items in this order yet!'
    );
    embed.addFields({ name: 'Subtotal', value: `$${totalPrice.toFixed(2)}`, inline: true });
  
    // If a promo code discount was applied, calculate and display discount and final total.
    if (order.discount) {
      const discountAmount = totalPrice * (order.discount / 100);
      const finalTotal = totalPrice - discountAmount;
      embed.addFields(
        { name: 'Promo Code', value: order.promo, inline: true },
        { name: 'Discount', value: `${order.discount}% (-$${discountAmount.toFixed(2)})`, inline: true },
        { name: 'Final Total', value: `$${finalTotal.toFixed(2)}`, inline: true }
      );
    }
  
    // Include any special instructions.
    if (order.notes && Array.isArray(order.notes) && order.notes.length > 0) {
      const notesText = order.notes.map((note, index) => `${index + 1}. ${note}`).join('\n');
      embed.addFields({ name: 'Special Instructions', value: notesText });
    } else if (typeof order.notes === 'string' && order.notes.trim() !== '') {
      embed.addFields({ name: 'Special Instructions', value: order.notes });
    }
  
    // Show the cashier (order creator) so everyone knows who submitted the order.
    embed.addFields({ name: 'Cashier', value: `<@${order.createdBy}>`, inline: true });
    embed.setTimestamp().setFooter({ text: 'Chick-fil-A Order Bot – We’re always ready to serve!' });
  
    return embed;
  }
  
  /**
   * Format current order items for display during selection.
   */
  function formatCurrentOrder(order) {
    if (order.items.length === 0) return 'No Chick-fil-A items added yet.';
    const itemList = order.items
      .map((item) => {
        const price = menu[item.category][item.name];
        return `${item.quantity}x ${item.name} ($${(price * item.quantity).toFixed(2)})`;
      })
      .join('\n');
    return `Current Order Items:\n${itemList}`;
  }
  
  /**
   * Add order controls (Claim, Complete, Cancel) with Chick-fil-A flair.
   */
  async function addOrderControls(message, order) {
    if (order.status === 'completed' || order.status === 'cancelled') {
      console.log(`Order ${order.id} is ${order.status}. No need to update controls.`);
      return;
    }
  
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim_${order.id}`)
        .setLabel('Claim Order')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(order.claimed),
      new ButtonBuilder()
        .setCustomId(`complete_${order.id}`)
        .setLabel('Complete Order')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!order.claimed),
      new ButtonBuilder()
        .setCustomId(`cancel_${order.id}`)
        .setLabel('Cancel Order')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(order.claimed)
    );
  
    try {
      const fetchedMessage = await message.channel.messages.fetch(message.id);
      if (fetchedMessage) {
        await fetchedMessage.edit({ components: [controlRow] });
      }
    } catch (error) {
      if (error.code === 10008) {
        console.log(`Message for order ${order.id} no longer exists. Skipping update.`);
      } else {
        console.error('Failed to update order controls:', error);
      }
    }
  }
  
  /**
   * Create order and start Chick-fil-A item selection flow.
   */
  async function handleCreateOrder(interaction) {
    await interaction.deferReply({ ephemeral: true });
  
    const customer = interaction.options.getString('customer');
    const promoInput = interaction.options.getString('promo');
    const location = interaction.options.getString('location'); // "indoor" or "outdoor"
  
    // Generate a three-digit order number using the counter.
    const orderId = orderCounter.toString().padStart(3, '0');
    orderCounter++;
  
    const newOrder = {
      id: orderId,
      customer,
      items: [],
      notes: [],
      status: 'pending',
      claimed: false,
      createdAt: new Date(),
      createdBy: interaction.user.id, // This is our cashier.
      updated: false,
      location, // "indoor" or "outdoor"
      carDescription: null,
    };
  
    // Validate promo code if provided.
    if (promoInput) {
      const promoData = loadPromoCodes();
      const promoCode = promoInput.toUpperCase();
      if (promoData.codes[promoCode]) {
        newOrder.promo = promoCode;
        newOrder.discount = promoData.codes[promoCode];
      } else {
        return interaction.editReply({
          content: `That promo code "${promoInput}" ain't finger-lickin' good. Please try a valid Chick-fil-A promo code.`,
        });
      }
    }
  
    orders.set(orderId, newOrder);
  
    // Log order creation.
    await orderLogger.logOrderUpdate(interaction.client, newOrder, 'Created', interaction.user);
  
    // If the order is outdoor, collect car details via a button and modal.
    if (location === 'outdoor') {
      const carButtonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`car_details_${orderId}`)
          .setLabel('Add Car Details')
          .setStyle(ButtonStyle.Primary)
      );
  
      await interaction.followUp({
        content: '🚗 **Outdoor Order** - Please provide your vehicle details:',
        components: [carButtonRow],
        ephemeral: true,
      });
  
      try {
        const buttonInteraction = await interaction.channel.awaitMessageComponent({
          filter: (i) =>
            i.user.id === interaction.user.id && i.customId === `car_details_${orderId}`,
          time: 120000,
        });
  
        // Create the car modal with a custom ID "car_modal_{orderId}".
        const modal = new ModalBuilder()
          .setCustomId(`car_modal_${orderId}`)
          .setTitle('Vehicle Information');
  
        const inputs = [
          new TextInputBuilder()
            .setCustomId('make')
            .setLabel('Vehicle Make (e.g., Ford)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
          new TextInputBuilder()
            .setCustomId('model')
            .setLabel('Vehicle Model (e.g., F-150)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Vehicle Color')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
          new TextInputBuilder()
            .setCustomId('license')
            .setLabel('License Plate')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ];
  
        // Add each input as a separate action row.
        modal.addComponents(inputs.map((input) => new ActionRowBuilder().addComponents(input)));
  
        // Show the modal to the user.
        await buttonInteraction.showModal(modal);
  
        // Capture the order ID locally for use in the modal filter.
        const currentOrderId = newOrder.id;
  
        // Wait for the car modal submission using the correct customId.
        const modalSubmit = await interaction.awaitModalSubmit({
          filter: (i) =>
            i.user.id === interaction.user.id &&
            i.customId === `car_modal_${currentOrderId}`,
          time: 60000,
        });
  
        // Retrieve the vehicle details from the modal fields.
        const make = modalSubmit.fields.getTextInputValue('make');
        const model = modalSubmit.fields.getTextInputValue('model');
        const color = modalSubmit.fields.getTextInputValue('color');
        const license = modalSubmit.fields.getTextInputValue('license');
  
        // Save the car details in the order.
        newOrder.carDescription = { make, model, color, license };
  
        // Acknowledge the modal submission.
        await modalSubmit.reply({ content: 'Vehicle information saved!', ephemeral: true });
        await orderLogger.logOrderUpdate(interaction.client, newOrder, 'Added Vehicle Details', interaction.user);
      } catch (error) {
        await interaction.followUp({ content: 'No modal submission received. Continuing order creation.', ephemeral: true });
      }
    }
  
    // Proceed to item selection flow.
    await handleItemSelection(interaction, newOrder);
  }
  
  /**
   * Item selection flow with Chick-fil-A flavor.
   */
  async function handleItemSelection(interaction, order) {
    let awaitingContinue = false;
    let addingItems = true;
  
    while (addingItems) {
      if (!awaitingContinue) {
        // 1. Select Category with current order summary
        const currentSummary = formatCurrentOrder(order);
        const categoryRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_category')
            .setPlaceholder('Pick a Chick-fil-A category')
            .addOptions(
              Object.keys(menu).map((category) => ({
                label: capitalize(category),
                value: category,
              }))
            )
        );
  
        try {
          await interaction.followUp({
            content: `${currentSummary}\n\nSelect a category to start building your meal:`,
            components: [categoryRow],
            ephemeral: true,
          });
  
          const categorySelection = await interaction.channel.awaitMessageComponent({
            filter: (i) =>
              i.user.id === interaction.user.id && i.customId === 'select_category',
            time: 300000,
          });
  
          const selectedCategory = categorySelection.values[0];
          await categorySelection.update({ content: `You've chosen the **${capitalize(selectedCategory)}** menu.`, components: [] });
  
          // 2. Select an Item.
          const itemsInCategory = menu[selectedCategory];
          const itemSelectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_item')
              .setPlaceholder(`Select a Chick-fil-A ${capitalize(selectedCategory)} item`)
              .addOptions(
                Object.entries(itemsInCategory).map(([itemName, price]) => ({
                  label: `${itemName} ($${price.toFixed(2)})`,
                  value: itemName,
                }))
              )
          );
  
          await interaction.followUp({
            content: `Select an item from the **${capitalize(selectedCategory)}** menu:`,
            components: [itemSelectRow],
            ephemeral: true,
          });
  
          const itemSelection = await interaction.channel.awaitMessageComponent({
            filter: (i) =>
              i.user.id === interaction.user.id && i.customId === 'select_item',
            time: 60000,
          });
  
          const selectedItem = itemSelection.values[0];
          await itemSelection.update({ content: `Great choice! **${selectedItem}** has been selected.`, components: [] });
  
          // 3. Select Quantity.
          const quantityRow = new ActionRowBuilder().addComponents(
            [1, 2, 3, 4, 5].map((num) =>
              new ButtonBuilder()
                .setCustomId(`quantity_${num}`)
                .setLabel(num.toString())
                .setStyle(ButtonStyle.Secondary)
            )
          );
  
          await interaction.followUp({
            content: `How many **${selectedItem}** would you like?`,
            components: [quantityRow],
            ephemeral: true,
          });
  
          const quantitySelection = await interaction.channel.awaitMessageComponent({
            filter: (i) =>
              i.user.id === interaction.user.id && i.customId.startsWith('quantity_'),
            time: 60000,
          });
  
          const quantity = parseInt(quantitySelection.customId.split('_')[1]);
          await quantitySelection.update({ content: `Added **${quantity}x ${selectedItem}** to your Chick-fil-A order.`, components: [] });
  
          order.items.push({
            category: selectedCategory,
            name: selectedItem,
            quantity,
          });
        } catch (error) {
          await interaction.followUp({ content: 'Selection timed out. Finishing your order.', ephemeral: true });
          break;
        }
      }
  
      // 4. Present Continue Options with order summary
      const currentOrderSummary = formatCurrentOrder(order);
      const continueRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('add_more')
          .setLabel('Add More Items')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('finish_order')
          .setLabel('Finish Order')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('add_notes')
          .setLabel('Add Special Instructions')
          .setStyle(ButtonStyle.Secondary)
      );
  
      let continueResponse;
      try {
        await interaction.followUp({
          content: `${currentOrderSummary}\n\nWould you like to add another tasty item or add/update special instructions?`,
          components: [continueRow],
          ephemeral: true,
        });
  
        continueResponse = await interaction.channel.awaitMessageComponent({
          filter: (i) =>
            i.user.id === interaction.user.id && ['add_more', 'finish_order', 'add_notes'].includes(i.customId),
          time: 60000,
        });
      } catch (error) {
        await interaction.followUp({ content: 'No response received. Finishing your order.', ephemeral: true });
        break;
      }
  
      if (continueResponse.customId === 'finish_order') {
        await continueResponse.update({ content: 'Alright! Finishing up your order.', components: [] });
        break;
      } else if (continueResponse.customId === 'add_more') {
        awaitingContinue = false;
        await continueResponse.update({ content: 'Great! Let’s add another tasty item.', components: [] });
      } else if (continueResponse.customId === 'add_notes') {
        // Capture the order ID for the modal.
        const currentOrderId = order.id;
  
        const modal = new ModalBuilder()
          .setCustomId(`notes_modal_${currentOrderId}`)
          .setTitle('Add Special Instructions');
  
        const notesInput = new TextInputBuilder()
          .setCustomId('notes_input')
          .setLabel('Enter your special instructions')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);
  
        const modalActionRow = new ActionRowBuilder().addComponents(notesInput);
        modal.addComponents(modalActionRow);
  
        await continueResponse.showModal(modal);
  
        try {
          const modalSubmit = await interaction.awaitModalSubmit({
            filter: (i) =>
              i.user.id === interaction.user.id && i.customId === `notes_modal_${currentOrderId}`,
            time: 60000,
          });
  
          const note = modalSubmit.fields.getTextInputValue('notes_input');
          if (!order.notes || !Array.isArray(order.notes)) {
            order.notes = [];
          }
          order.notes.push(note);
  
          await modalSubmit.reply({ content: 'Special instructions added!', ephemeral: true });
          await orderLogger.logOrderUpdate(interaction.client, order, 'Added Special Instructions', interaction.user);
        } catch (error) {
          await interaction.followUp({ content: 'No modal submission received. Continuing order creation.', ephemeral: true });
        }
  
        awaitingContinue = true;
      }
    }
  
    // Finalize order: send embed to the kitchen channel.
    const orderEmbed = createOrderEmbed(order);
    const kitchenChannel = interaction.guild.channels.cache.get(config.channels.kitchen);
  
    if (kitchenChannel) {
      const orderMessage = await kitchenChannel.send({ embeds: [orderEmbed] });
      await addOrderControls(orderMessage, order);
  
      // Capture order ID locally for collector filter usage.
      const currentOrderId = order.id;
      const collector = orderMessage.createMessageComponentCollector({
        filter: (i) => i.customId.includes(currentOrderId),
        time: 24 * 60 * 60 * 1000,
      });
  
      collector.on('collect', async (i) => {
        // The custom ID is in the format: action_orderId, so we split to get the action.
        const [action] = i.customId.split('_');
        switch (action) {
          case 'claim':
            if (!order.claimed) {
              order.claimed = true;
              order.claimedBy = i.user.id;
              await i.reply({ content: `Order ${order.id} has been claimed by <@${i.user.id}>! Let's get it cooking!`, ephemeral: false });
              await orderLogger.logOrderUpdate(i.client, order, 'Claimed', i.user);
            } else {
              await i.reply({ content: 'This order has already been claimed! Looks like someone else is on it!', ephemeral: true });
              return;
            }
            break;
  
          case 'complete':
            if (order.claimed && order.claimedBy === i.user.id) {
              order.status = 'completed';
              await i.reply({ content: `Order ${order.id} has been completed!`, ephemeral: false });
              await orderLogger.logOrderUpdate(i.client, order, 'Completed', i.user);
  
              try {
                await orderMessage.edit({ components: [] });
              } catch (error) {
                console.log(`Message ${orderMessage.id} could not be updated:`, error.code);
              }
  
              setTimeout(() => orderMessage.delete().catch(console.error), 300000);
            } else {
              await i.reply({ content: 'You must claim the order before marking it complete!', ephemeral: true });
              return;
            }
            break;
  
          case 'cancel':
            if (!order.claimed) {
              // Capture the order ID locally for the cancellation modal.
              const currentOrderId = order.id;
              const cancelModal = new ModalBuilder()
                .setCustomId(`cancel_modal_${currentOrderId}`)
                .setTitle('Cancel Order - Reason');
  
              const reasonInput = new TextInputBuilder()
                .setCustomId('cancel_reason')
                .setLabel('Please provide a reason for cancellation')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
  
              const modalActionRow = new ActionRowBuilder().addComponents(reasonInput);
              cancelModal.addComponents(modalActionRow);
  
              await i.showModal(cancelModal);
  
              try {
                const modalSubmit = await i.awaitModalSubmit({
                  filter: (modal) =>
                    modal.customId === `cancel_modal_${currentOrderId}` && modal.user.id === i.user.id,
                  time: 60000,
                });
  
                const reason = modalSubmit.fields.getTextInputValue('cancel_reason');
                order.status = 'cancelled';
  
                await modalSubmit.reply({ content: `Order ${order.id} has been cancelled for reason:\n\n**${reason}**`, ephemeral: true });
                await orderLogger.logOrderUpdate(i.client, order, 'Cancelled', i.user);
              } catch (error) {
                await i.reply({ content: 'Cancellation timed out. Order not cancelled.', ephemeral: true });
                return;
              }
  
              collector.stop();
              try {
                await orderMessage.delete();
              } catch (error) {
                console.log(`Message ${orderMessage.id} could not be deleted:`, error.code);
              }
              return;
            } else {
              await i.reply({ content: 'Cannot cancel an order that has already been claimed!', ephemeral: true });
              return;
            }
        }
  
        if (!i.deferred && !i.replied) {
          await i.deferUpdate();
        }
  
        const updatedEmbed = createOrderEmbed(order);
        try {
          await orderMessage.edit({ embeds: [updatedEmbed] });
        } catch (error) {
          console.log(`Failed to update embed for order ${order.id}:`, error.code);
        }
  
        await addOrderControls(orderMessage, order);
      });
  
      await interaction.followUp({ content: `Your Chick-fil-A order ${order.id} has been created successfully!`, ephemeral: true });
    } else {
      await interaction.followUp({ content: 'Uh oh, the kitchen channel couldn’t be found. Order not sent.', ephemeral: true });
    }
  }
  
  /**
   * Exports for the slash command.
   */
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('order')
      .setDescription('Manage your Chick-fil-A order')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Place a new Chick-fil-A order')
          .addStringOption((option) =>
            option.setName('customer').setDescription('Customer name').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('location')
              .setDescription('Order location (indoor or outdoor)')
              .setRequired(true)
              .addChoices(
                { name: 'Indoor', value: 'indoor' },
                { name: 'Outdoor', value: 'outdoor' }
              )
          )
          .addStringOption((option) =>
            option.setName('promo').setDescription('Enter your Chick-fil-A promo code for a discount').setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('update')
          .setDescription('Perform a one-time update to your Chick-fil-A order (add items/special instructions)')
          .addStringOption((option) =>
            option.setName('order_id').setDescription('The ID of the order to update').setRequired(true)
          )
      ),
  
    execute: async (interaction) => {
      const subcommand = interaction.options.getSubcommand();
  
      if (subcommand === 'create') {
        await handleCreateOrder(interaction);
      } else if (subcommand === 'update') {
        await interaction.deferReply({ ephemeral: true });
        const orderId = interaction.options.getString('order_id');
        const order = orders.get(orderId);
  
        if (!order) {
          return interaction.editReply({ content: `Order ${orderId} not found!` });
        }
  
        if (order.claimed) {
          return interaction.editReply({ content: `Order ${orderId} has been claimed and cannot be updated.` });
        }
  
        if (order.updated) {
          return interaction.editReply({ content: `Order ${orderId} has already been updated once and cannot be updated further.` });
        }
  
        await handleItemSelection(interaction, order);
        order.updated = true;
      }
    },
  
    // Exporting helper functions if needed elsewhere.
    createOrderEmbed,
    formatCurrentOrder,
    addOrderControls,
    orders,
  };
  