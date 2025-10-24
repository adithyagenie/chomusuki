import { deleteWatchlist, newWatchlist, renameWatchlist } from "../../../database/animeDB";
import { MyContext, MyConversation, MyConversationContext } from "../../bot";
import { getWLName } from "./w_helpers";
import { Menu } from "@grammyjs/menu";
import { selfyeet } from "../misc_handles";
import { code, fmt } from "@grammyjs/parse-mode";

/**Creates a new watchlist. Responds to /createwl */
export async function createWL(conversation: MyConversation, ctx: MyConversationContext) {
    await ctx.reply("What is your new watchlist's name?");
    const name = await conversation.form.text();
    if (name === "/cancel") {
        await ctx.reply("Alright, cancelling.");
        return;
    }
    const userid = await conversation.external((ctx) => ctx.session.userid);
    const res = await conversation.external(() => newWatchlist(name, userid));
    if (res === 1) {
        await ctx.reply("Error creating watchlist ;_;");
        return;
    }
    const message = fmt`Watchlist ${code}${name}${code} created successfully. Use /mywatchlists to manage your watchlists.`;
    await ctx.reply(message.text, { entities: message.entities });
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
            const wlname = await getWLName(ctx1);
            const message = fmt`Watchlist ${code}${wlname}${code} chosen.\nWhat do you want to do with it?`;
            await ctx1.editMessageText(message.text, { entities: message.entities });
        });
}

export async function renameWL(convo: MyConversation, ctx: MyConversationContext) {
    // Get watchlist ID and name from session
    const { wlid, wlname: currentName } = await convo.external((ctx) => ({
        wlid: ctx.session.menudata.wlid,
        wlname: ctx.session.menudata.wlname
    }));
    
    // Fetch the current watchlist name if not cached
    const wlname = currentName !== undefined 
        ? currentName 
        : await convo.external(async (ctx) => {
            const name = await getWLName(ctx);
            ctx.session.menudata.wlname = name; // Cache it
            return name;
        });
    
    const message1 = fmt`Enter the new name for watchlist ${code}${wlname}${code}.\n(Or /cancel to cancel renaming.)`;
    await ctx.reply(message1.text, { entities: message1.entities });
    const newname = await convo.waitFor(":text");
    if (newname.hasCommand("cancel")) {
        await ctx.reply("Cancelling rename.");
        return;
    }
    const message2 = fmt`Alright, setting ${code}${newname.msg.text}${code} as the new name.`;
    await ctx.reply(message2.text, { entities: message2.entities });
    await convo.external(() => renameWatchlist(wlid, newname.msg.text));
    await convo.external((ctx) => {
        ctx.session.menudata.wlname = undefined;
    });
    return;
}
