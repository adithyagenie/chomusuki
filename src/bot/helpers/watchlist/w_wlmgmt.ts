import { deleteWatchlist, newWatchlist, renameWatchlist } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { getWLName } from "./w_helpers";
import { Menu } from "@grammyjs/menu";
import { selfyeet } from "../misc_handles";

/**Creates a new watchlist. Responds to /createwl */
export async function createWL(conversation: MyConversation, ctx: MyContext) {
    await ctx.reply("What is your new watchlist's name?");
    const name = await conversation.form.text();
    if (name === "/cancel") {
        await ctx.reply("Alright, cancelling.");
        return;
    }
    const res = await newWatchlist(name, ctx.session.userid);
    if (res === 1) {
        await ctx.reply("Error creating watchlist ;_;");
        return;
    }
    await ctx.reply(
        `Watchlist <code>${name}</code> created successfully. Use /mywatchlists to manage your watchlists.`
    );
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
            await ctx1.editMessageText(
                `Watchlist <code>${
                    await getWLName(ctx1)
                }</code> chosen.\nWhat do you want to do with it?`
            );
        });
}

export async function renameWL(convo: MyConversation, ctx: MyContext) {
    const wlid = ctx.session.menudata.wlid;
    const wlname = await getWLName(ctx);
    await ctx.reply(`Enter the new name for watchlist <code>${wlname}</code>.\n(Or /cancel to cancel renaming.)`);
    const newname = await convo.waitFor(":text");
    if (newname.hasCommand("cancel")) {
        await ctx.reply("Cancelling rename.");
        await ctx.conversation.exit("renameWL");
    }
    await ctx.reply(`Alright, setting <code>${newname.msg.text}</code> as the new name.`);
    await convo.external(() => renameWatchlist(wlid, newname.msg.text));
    ctx.session.menudata.wlname = undefined;
    return;
}
