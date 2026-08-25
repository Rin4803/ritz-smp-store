export type RankPresentation = {
  tier: "starter" | "royal" | "legendary" | "template";
  label: string;
  subtitle: string;
  level: number;
};

/**
 * เลือกลักษณะการนำเสนอยศจากราคาเท่านั้น จึงไม่กระทบราคาหรือธุรกรรมจริง
 * และทำให้การ์ดเรียงความพิเศษสม่ำเสมอเมื่อแอดมินเพิ่มยศใหม่
 */
export function getRankPresentation(price: string | number): RankPresentation {
  const amount = Number(price);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { tier: "template", label: "COMING SOON", subtitle: "รอเปิดใช้งาน", level: 0 };
  }

  if (amount > 1500) {
    return { tier: "legendary", label: "LEGENDARY", subtitle: "บัลลังก์แห่งอาณาจักร", level: 3 };
  }

  if (amount > 500) {
    return { tier: "royal", label: "ROYAL", subtitle: "สิทธิ์ของผู้สนับสนุน", level: 2 };
  }

  return { tier: "starter", label: "ADVENTURER", subtitle: "จุดเริ่มต้นของการผจญภัย", level: 1 };
}
