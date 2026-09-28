export const ranks = [
  { id: 'vip', name: 'VIP', price: 39, benefits: ['Prefix VIP', '/hat', '/craft', '3 Homes', 'Common Key ×3', 'เงิน 10,000', 'Kit VIP — 7 วัน'] },
  { id: 'vip_plus', name: 'VIP+', price: 79, benefits: ['สิทธิ์จาก VIP', '/enderchest', '/feed', '5 Homes', 'Common Key ×5', 'Rare Key ×1', 'เงิน 25,000'] },
  { id: 'knight', name: 'Knight', price: 149, benefits: ['สิทธิ์จาก VIP+', '/ptime', '/pweather', '8 Homes', 'Common Key ×8', 'Rare Key ×3', 'เงิน 50,000'] },
  { id: 'elite', name: 'Elite', price: 249, benefits: ['สิทธิ์จาก Knight', '/repair', '/anvil', '10 Homes', 'Rare Key ×5', 'Epic Key ×2', 'เงิน 80,000'] },
  { id: 'noble', name: 'Noble', price: 399, benefits: ['สิทธิ์จาก Elite', '/back', 'Backpack Lv.1', '15 Homes', 'Rare Key ×8', 'Epic Key ×5', 'เงิน 120,000'] },
  { id: 'lord', name: 'Lord', price: 599, benefits: ['สิทธิ์จาก Noble', 'Fly ที่ Spawn', 'Chat Color'] },
  { id: 'overlord', name: 'Overlord', price: 899, benefits: [] },
  { id: 'mythic', name: 'Mythic', price: 1299, benefits: [] },
  { id: 'celestial', name: 'Celestial', price: 1799, benefits: [] },
  { id: 'emperor', name: 'Emperor', price: 2499, benefits: [] }
];

export const platformValues = new Set(['java', 'bedrock', 'unknown']);
