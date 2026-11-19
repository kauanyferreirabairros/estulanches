export function calculateTotal(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('O pedido precisa conter pelo menos um produto.');
  }

  const totalInCents = items.reduce((total, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new Error('Produto ou quantidade inválida.');
    }
    return total + Math.round(price * 100) * quantity;
  }, 0);

  return totalInCents / 100;
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}
