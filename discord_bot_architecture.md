# RitzSMP Discord-Only Store Architecture

To move the entire store experience into Discord as requested, the system will be restructured around a dedicated Discord bot application connected to the RitzSMP server.

## Core Workflow

1. **Store Channel (`#shop` or `#donate`)**:
   - The bot publishes an interactive store panel containing buttons for all 10 ranks.
   - When a user clicks a rank button, a modal opens asking for their Minecraft IGN.

2. **Order Submission & Slip Upload**:
   - After submitting the IGN, the bot generates a private checkout prompt with payment accounts (GSB: `020391511886`, PromptPay: `0930286252`).
   - The user uploads their payment slip directly in the channel or thread.

3. **Admin Verification Panel (`#admin-orders`)**:
   - The bot posts the order card containing the user, IGN, rank, amount, and attached slip image to a staff-only channel.
   - Admins can click **✅ อนุมัติ** (Approve) or **❌ ปฏิเสธ** (Reject).

4. **Fulfillment**:
   - Upon approval, the bot records the status, posts a success notification, and generates the RCON command (`lp user <IGN> parent add <group>`) for the console.
