import { deleteWatchlist, newWatchlist, renameWatchlist } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { getWLName } from "./w_helpers";
import { Menu } from "@grammyjs/menu";
import { selfyeet } from "../misc_handles";
import { code, fmt } from "@grammyjs/parse-mode";

/**Creates a new watchlist. Responds to /createwl */
export async function createWL(conversation: MyConversation, ctx: MyContext) {
    await ctx.reply("What is your new watchlist's name?");
    const name = await conversation.form.text();
    if (name === "/cancel") {
        await ctx.reply("Alright, cancelling.");
        return;
    }
    const res = await newWatchlist(name, conversation.session.userid);
    if (res === 1) {
        await ctx.reply("Error creating watchlist ;_;");
        return;
    }
    const wlCreatedReplyMsg = fmt`Watchlist ${code}${name}${code} created successfully. Use /mywatchlists to manage your watchlists.`
  await ctx.reply(wlCreatedReplyMsg.text, { entities: wlCreatedReplyMsg.entities });
    return;
}

export function deleteWL() {
    return new Menu<MyContext>("wl_delete")
        .text("Yes, go ahead.", async (ctx1) => {
            const res = await deleteWatchlist(ctx1.session.menudata.wlid);
            if (res === 0) {
                const yeet = await ctx1.reply(`Deleted watchlist ${ctx1.session.menudata.wlname}.`);
                selfyeet(ctx1.chat.id, yeet.message_id, 10000);
                ctx1.menu.nav("wl_main");
                await ctx1.editMessageText("Choose the watchlist from the menu below:");
            } else if (res === 1) {
                await ctx1.reply("Error deleting watchlist.");
                ctx1.menu.back();
            }
        })
        .back("Nope, get me outta here.", async (ctx1) => {
          const cancelDeleteReplyMsg = fmt`Watchlist ${code}${await getWLName(ctx1)
            }${code} chosen.\nWhat do you want to do with it?`;
          await ctx1.editMessageText(cancelDeleteReplyMsg.text, { entities: cancelDeleteReplyMsg.entities });
        });
}

export async function renameWL(convo: MyConversation, ctx: MyContext) {
    const wlid = convo.session.menudata.wlid;
    const wlname = await getWLName(convo);
  const newNameReqMsg = fmt`Enter the new name for watchlist ${code}${wlname}${code}.\n(Or /cancel to cancel renaming.)`;
    await ctx.reply(newNameReqMsg.text, { entities: newNameReqMsg.entities });
    const newname = await convo.waitFor(":text");
    if (newname.hasCommand("cancel")) {
        await ctx.reply("Cancelling rename.");
        await ctx.conversation.exit("renameWL");
    }
  const renameSuccessMsg = fmt`Alright, setting ${code}${newname.msg.text}${code} as the new name.`;
    await ctx.reply(renameSuccessMsg.text, { entities: renameSuccessMsg.entities });
    await convo.external(() => renameWatchlist(wlid, newname.msg.text));
    convo.session.menudata.wlname = undefined;
    return;
}
