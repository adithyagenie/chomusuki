import { InlineKeyboard } from "grammy";
import { deleteWatchlist, newWatchlist } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { db } from "../../..";

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
    await ctx.reply(
        `Watchlist <code>${name}</code> created successfully. Use /mywatchlists to manage your watchlists.`,
        {
            parse_mode: "HTML"
        }
    );
    return;
}

/**Deletes a watchlist. Responds to /deletewl. */
export async function deleteWL(convo: MyConversation, ctx: MyContext) {
    // const { wllist, wl, keyboard } = await conversation.external(() =>
    // 	makeWLKeyboard(conversation.session.userid)
    // );
    // if (wllist.length === 0) {
    // 	await ctx.reply("You currently do not have any watchlists.");
    // 	return;
    // }
    // const msg = (
    // 	await ctx.reply("Which watchlist do you want to remove?", { reply_markup: keyboard })
    // ).message_id;
    // const chosenwl = parseInt((await conversation.waitForCallbackQuery(/wl_(\d+)/)).match[1]);
    // if (Number.isNaN(chosenwl)) throw new Error("Invalid callback data");
    // const item = wl.find((o) => o.watchlistid === chosenwl);
    // if (item === undefined) throw new Error("?????");
    const item = await convo.external(() =>
        db.watchlists.findUnique({
            where: { watchlistid: convo.session.menudata.wlid },
            select: { watchlist_name: true, watchlistid: true, alid: true }
        })
    );
    if (item === null) {
        await ctx.reply("Watchlist missing.");
        return;
    }
    if (item.alid.length != 0) {
        const msg = (
            await ctx.reply(
                `You have ${item.alid.length} items in your watchlist. Deleting will remove all the items as well.\n\nProceed?`,
                {
                    reply_markup: new InlineKeyboard()
                        .text("Yes. Go ahead.", "y")
                        .text("Nope. Get me outta here.", "n")
                }
            )
        ).message_id;
        const ch = (await convo.waitForCallbackQuery(/[yn]/)).match[0];
        if (ch === "n") {
            await ctx.api.editMessageText(ctx.from.id, msg, "Cancelling operation...");
            return;
        } else if (ch === "y") await ctx.api.deleteMessage(ctx.from.id, msg);
    }
    const _ = await convo.external(() => deleteWatchlist(item.watchlistid));
    if (_ === 1) {
        await ctx.reply("Error deleting watchlist ;_;");
        return;
    }
    await ctx.reply(`Deleted watchlist ${item.watchlist_name}.`);
    return;
}
