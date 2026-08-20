import { ENV } from "./server/_core/env.ts";
import { getAllUsers } from "./server/db.ts";

const users = await getAllUsers();
const owner = users.find(user => user.email?.toLowerCase() === "optun2264@gmail.com");
console.log(JSON.stringify({
  ownerFound: Boolean(owner),
  configuredOwner: Boolean(ENV.ownerOpenId),
  ownerMatchesConfig: Boolean(owner && ENV.ownerOpenId && owner.openId === ENV.ownerOpenId),
  ownerRole: owner?.role ?? null,
}, null, 2));
