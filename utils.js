// utils.js
const menu = require('./menu');

function getItemPrice(category, itemName) {
  const categoryData = menu[category];
  if (!categoryData) throw new Error(`Category "${category}" does not exist.`);
  const price = categoryData[itemName];
  if (price === undefined) throw new Error(`Item "${itemName}" not found in category "${category}".`);
  return price;
}

function calculateTotal(orderItems) {
  let total = 0;
  for (const item of orderItems) {
    const price = getItemPrice(item.category, item.name);
    total += price * item.quantity;
  }
  return total;
}

module.exports = { getItemPrice, calculateTotal };