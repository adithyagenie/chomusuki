// Adding anime to subscriptions

import { authchat, updater } from "../../..";
import { getAlId } from "../../../api/anilist_api";
import { AnimeNames, addAnimeNames } from "../../../database/db_connect";
import { MyContext, MyConversation } from "../../bot";

export async function anime_add(ctx: MyContext) {
    if (ctx.chat.id != authchat) {
        await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
        return;
    }
    await ctx.conversation.enter("animeadd");
}

export async function animeadd(conversation: MyConversation, ctx: MyContext) {
    let responseobj: AnimeNames;
    await ctx.reply(
        "Please provide data required. Type /cancel at any point to cancel adding.",
        { reply_markup: { remove_keyboard: true } }
    );
    await ctx.reply(
        "What is the exact Japanese name of the anime? (Refer Anilist for name)"
    );
    const jpanimename = await conversation.form.text();
    await ctx.reply(
        "What is the exact English name of the anime? (Refer Anilist for name)"
    );
    const enanimename = await conversation.form.text();
    await ctx.reply(
        "Any other optional names you would like to provide? (seperated by commas, NIL for nothing)"
    );
    const optnameres = await conversation.form.text();
    let optnames: string[], excnames: string[];
    if (optnameres != "NIL") {
        optnames = optnameres.split(",");
        optnames = optnames.map((x: string) => x.trim());
    }
    await ctx.reply(
        "Any similarly named terms which would interfere with search results? (seperated by commas, NIL for nothing)"
    );
    const excnameres = await conversation.form.text();
    if (excnameres != "NIL") {
        excnames = excnameres.split(",");
        excnames = excnames.map((x: string) => x.trim());
    }
    let AlID = 0;
    AlID = await getAlId(enanimename, jpanimename);
    if (AlID == 0) {
        await ctx.reply("Anilist ID for the anime?");
        AlID = parseInt(await conversation.form.text());
    }
    responseobj = {
        EnName: enanimename,
        JpName: jpanimename,
        OptionalNames: optnames === undefined ? [] : optnames,
        ExcludeNames: excnames === undefined ? [] : excnames,
        AlID: AlID,
    };
    await addAnimeNames(updater.client, responseobj);
    await ctx.reply("Anime has been added!");
    return;
}
