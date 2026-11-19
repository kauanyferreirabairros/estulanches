export function calculateTotal(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('O pedido precisa conter pelo menos um produto.');
  }

  return items.reduce((total, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Produto ou quantidade inválida.');
    }
    return total + price * quantity;
  }, 0);
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}
