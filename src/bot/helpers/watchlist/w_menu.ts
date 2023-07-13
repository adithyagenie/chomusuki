/**
 - Watchlists
 -- Add anime
 -- List all
 --- remove
 --- mark as watched,
 --- not watched
 -- List not watched
 -- Rename watchlist
 -- Delete watchlist
 -- Back
 */

import { Menu, MenuRange } from "@grammyjs/menu";
import { bot, MyContext } from "../../bot";
import { db } from "../../..";
import { selfyeet } from "../misc_handles";
import { markDone, markNotDone, removeFromWatchlist } from "../../../database/animeDB";
import { getWlAlid, getWLName } from "./w_helpers";
import { animeList, WLMainMenu } from "./w_list";
import { deleteWL } from "./w_wlmgmt";
import { animeStartWatch } from "../anime/a_watching";


/**
 * - The second level menu for /mywatchlists.
 * - Consists of buttons to do add, list, rename and delete operations on chosen watchlist.
 * - Identifier wl_opts.
 */
function WLOptsMenu() {
    return new Menu<MyContext>("wl_opts")
        .text("Add anime", async (ctx1) => {
            await ctx1.conversation.enter("addWL");
        })
        .row()

        .submenu("List all anime", "wl_allist", async (ctx1) => {
            ctx1.session.menudata.listmethod = "all";
            ctx1.session.menudata.l_page = 1;
            await ctx1.editMessageText(`Displaying all anime from watchlist: <b>${await getWLName(ctx1)}</b>`);
        })

        .submenu("List to-watch anime", "wl_allist", async (ctx1) => {
            ctx1.session.menudata.listmethod = "towatch";
            ctx1.session.menudata.l_page = 1;
            await ctx1.editMessageText(`Displaying to-watch anime from watchlist: <b>${await getWLName(ctx1)}</b>`);
        })
        .row()

        .text("Rename watchlist", async (ctx1) => {
            await ctx1.conversation.enter("renameWL");
        })

        .submenu("Delete watchlist", "wl_delete", async (ctx1) => {
                // await ctx1.conversation.enter("deleteWL");
                const itemlen = Number((await db.$queryRaw<{
                    len: bigint
                }[]>`SELECT array_length(alid, 1) as len FROM watchlists WHERE watchlistid = ${ctx1.session.menudata.wlid}`)[0].len);
                if (itemlen === 0)
                    await ctx1.editMessageText(`Your watchlist is empty. Do you want to delete it?`);
                else
                    await ctx1.editMessageText(`You have ${itemlen} items in your watchlist <code>${await getWLName(ctx1)}</code>.\nDeleting will remove all the items as well.\n\nProceed?`);
            }
        )
        .row()

        .back("Go back", async (ctx) => {
            await ctx.editMessageText("Choose the watchlist from the menu below:");
            // noinspection AssignmentResultUsedJS
            Object.keys(ctx.session.menudata).forEach(o => ctx.session.menudata[o] = undefined);
        });
}

function stopWatching() {
    return new Menu<MyContext>("wl_stopwatch")
        .text("Yes.", async (ctx) => {
            const alid = ctx.session.menudata.alid;
            const watching = (await db.watchinganime.findUniqueOrThrow({
                where: { userid: ctx.session.userid },
                select: { alid: true }
            })).alid;
            watching.splice(watching.findIndex(o => o === alid), 1);
            await db.watchinganime.update({
                where: { userid: ctx.session.userid },
                data: { alid: watching }
            });
            const yeet = await ctx.reply("Removed from watching.");
            selfyeet(ctx.chat?.id, yeet.message_id, 5000);

            const item = await db.anime.findUniqueOrThrow({
                where: { alid },
                select: { jpname: true, enname: true }
            });
            ctx.menu.back();
            await ctx.editMessageText(
                `Chosen watchlist: <b>${await getWLName(ctx)}</b>\n\n` +
                `Chosen anime: \n<b>${item.jpname}</b>\n<i>(${item.enname})</i>\n\n` +
                `What do you wanna do with it?` +
                `<a href = "${(await db.anime.findUniqueOrThrow({
                    where: { alid },
                    select: { imglink: true }
                })).imglink}">​</a>`
            );
        })
        .back("No.", async (ctx) => {
            const alid = ctx.session.menudata.alid;
            const item = await db.anime.findUniqueOrThrow({
                where: { alid },
                select: { jpname: true, enname: true }
            });
            await ctx.editMessageText(
                `Chosen watchlist: <b>${await getWLName(ctx)}</b>\n\n` +
                `Chosen anime: \n<b>${item.jpname}</b>\n<i>(${item.enname})</i>\n\n` +
                `What do you wanna do with it?` +
                `<a href = "${(await db.anime.findUniqueOrThrow({
                    where: { alid },
                    select: { imglink: true }
                })).imglink}">​</a>`
            );
        });
}

/**
 * - Foruth level menu for /mywatchlists.
 * - Has buttons to do operations on anime in watchlist such as remove and mark as watched.
 * - Identifier wl_alopts.
 */
function animeListOpts() {
    return new Menu<MyContext>("wl_alopts")
        .dynamic(async (ctx) => {
            const range = new MenuRange<MyContext>();
            const temp = await getWlAlid(ctx, true, true);
            if (temp === "back") {
                range.text("-Menu too old. Generate a new one.-");
                return range;
            }
            const { wlid, alid } = temp;
            const name = (await db.anime.findUniqueOrThrow({
                where: { alid },
                select: { jpname: true }
            })).jpname;
            const is_watched = await db.completedanime.count({
                where: {
                    userid: ctx.session.userid,
                    completed: { has: alid }
                }
            });
            const is_watching = await db.watchinganime.count({
                where: {
                    userid: ctx.session.userid,
                    alid: { has: alid }
                }
            });
            if (is_watching === 0)
                range.text("Start watching", async (ctx1) => {
                    await animeStartWatch(ctx1, true);
                    try {ctx1.menu.update();} catch {}
                });
            else
                range.submenu("Stop watching", "wl_stopwatch", async (ctx1) => {
                    await ctx1.editMessageText(`You will lose all the progress in the anime. Proceed?`);
                });
            if (is_watched === 0) {
                range.text("Mark as watched", async (ctx1) => {
                    await markDone(ctx.session.userid, alid);
                    selfyeet(ctx.from.id, (await ctx.reply(`${name} has been marked as completed.`)).message_id, 5000);
                    try {ctx1.menu.update();} catch {}
                });
            } else {
                range.text("Mark as not watched", async (ctx1) => {
                    const result = await markNotDone(ctx.session.userid, alid);
                    if (result === "missing") {
                        await ctx1.reply("Outdated menu.");
                        await ctx1.menu.update();
                        return;
                    }
                    if (result === 1) {
                        await ctx1.reply("Error occured :/");
                        return;
                    } else {
                        const yeet = await ctx1.reply(`${name} has been marked as 'not watched'.`);
                        selfyeet(ctx1.chat.id, yeet.message_id, 10000);
                        try {ctx1.menu.update();} catch {}
                        return;
                    }

                });
            }
            range.text({
                text: "Remove from watchlist",
                payload: `${wlid}_${alid}`
            }, async (ctx1) => {
                const temp = await getWlAlid(ctx, true, true);
                if (temp === "back") {
                    range.text("-Menu too old. Generate a new one.-");
                    return range;
                }
                const { wlid, alid } = temp;
                const result = await removeFromWatchlist(wlid, alid);
                if (result === "wlmissing") {
                    await ctx1.reply("Watchlist missing?");
                    return;
                } else if (result === "alidmissing") {
                    await ctx1.reply("Anime already not present in watchlist.");
                    return;
                } else if (result === 1) {
                    await ctx1.reply("Some error occured while performing deletion.");
                    return;
                } else {
                    ctx1.menu.back();
                    await ctx1.editMessageText(
                        `Displaying anime from watchlist: <b>${await getWLName(ctx1)}</b>`);
                    const yeet = await ctx1.reply(`${name} removed from watchlist.`);
                    selfyeet(ctx1.chat.id, yeet.message_id, 10000);
                    ctx1.session.menudata.l_page = 1;
                    ctx1.session.menudata.maxpg = undefined;
                }
            });
            range.back("Go back", async (ctx1) => {
                ctx1.session.menudata.alid = undefined;
                await ctx1.editMessageText(
                    `Displaying anime from watchlist: <b>${await getWLName(ctx1)}</b>`);
            });
            return range;
        });
}


/**
 * Initialises menus and registers sub-menus.
 * Has command handler for /mywatchlists.
 */
export function initWLMenu() {
    const wl_main = WLMainMenu();
    wl_main.register(WLOptsMenu());
    wl_main.register(animeList(), "wl_opts");
    wl_main.register(animeListOpts(), "wl_allist");
    wl_main.register(deleteWL(), "wl_opts");
    wl_main.register(stopWatching(), "wl_alopts");
    bot.use(wl_main);
    bot.command("mywatchlists", async (ctx) => {
            Object.keys(ctx.session.menudata).forEach(o => { ctx.session.menudata[o] = undefined; });
            ctx.session.menudata.activemenuopt = (await ctx.reply("Choose the watchlist from the" +
                " menu below:", { reply_markup: wl_main })).message_id;
        }
    );
}


