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
import {
    getWatchlistAnime,
    markDone,
    markNotDone,
    removeFromWatchlist
} from "../../../database/animeDB";

function getWlAlid(ctx: MyContext, w: boolean, a: boolean) {
    if (w && !a) {
        if (ctx.session.menudata.wlid === undefined) return "back";
        return { wlid: ctx.session.menudata.wlid, alid: undefined };
    } else if (!w && a) {
        if (ctx.session.menudata.alid === undefined) return "back";
        return { wlid: undefined, alid: ctx.session.menudata.alid };
    } else if (w && a) {
        if (ctx.session.menudata.wlid === undefined || ctx.session.menudata.alid === undefined) return "back";
        return { wlid: ctx.session.menudata.wlid, alid: ctx.session.menudata.alid };
    }
}

async function getWLName(ctx: MyContext, wlid: number) {
    if (ctx.session.menudata.wlname !== undefined) return ctx.session.menudata.wlname;
    else {
        const wlname = (await db.watchlists.findUniqueOrThrow({
            where: { watchlistid: wlid },
            select: { watchlist_name: true }
        })).watchlist_name;
        ctx.session.menudata.wlname = wlname;
        return wlname;
    }
}

function WLMainMenu() {
    return new Menu<MyContext>("wl_main").dynamic(async (ctx) => {
        const range = new MenuRange<MyContext>();
        const wllist = await db.watchlists.findMany({
            where: { generated_by: ctx.session.userid },
            select: { watchlist_name: true, watchlistid: true }
        });
        if (wllist === null || wllist.length === 0) {
            range
                .text("-No watchlists available-", (ctx1) =>
                    ctx1.menu.update()
                )
                .row();
            return range;
        }
        // length : 5 - index: 4.
        // 0 -> 2 -> 4
        // i + 1 out of bounds

        //length : 6 = index: 5
        // 0 -> 2 -> 4
        // i +1 points to 5 so all good
        for (let i = 0; i < wllist.length; i += 2) {
            if (i === wllist.length - 1 && wllist.length % 2 !== 0) {
                range
                    .submenu(wllist.slice(-1)[0].watchlist_name, `wl_opts`, async (ctx1) => {
                        await ctx1.editMessageText(
                            `Watchlist ${
                                wllist.slice(-1)[0].watchlist_name
                            } chosen.\nWhat do you want to do with it?`
                        );
                        ctx1.session.menudata.wlid = wllist.slice(-1)[0].watchlistid;
                    })
                    .row();
                break;
            }
            range
                .submenu(wllist[i].watchlist_name, `wl_opts`, async (ctx1) => {
                    await ctx1.editMessageText(
                        `Watchlist ${wllist[i].watchlist_name} chosen.\nWhat do you want to do with it?`
                    );
                    ctx1.session.menudata.wlid = wllist[i].watchlistid;
                })
                .submenu(wllist[i + 1].watchlist_name, `wl_opts`, async (ctx1) => {
                    await ctx1.editMessageText(
                        `Watchlist ${wllist[i].watchlist_name} chosen.\nWhat do you want to do with it?`
                    );
                    ctx1.session.menudata.wlid = wllist[i + 1].watchlistid;
                })
                .row();
        }
        return range;
    });
}


function WLOptsMenu() {
    return new Menu<MyContext>("wl_opts")
        .text("Add anime", async (ctx) => await ctx.conversation.enter("addWL"))
        .row()

        .submenu("List all anime", "wl_allist", async (ctx1) => {
            ctx1.session.menudata.l_page = 1;
            await ctx1.editMessageText(`Chosen watchlist: ${await getWLName(ctx1, ctx1.session.menudata.wlid)}`);
        })

        .text("List to-watch anime", (ctx) => ctx.reply("Under construction."))
        .row()

        .text("Rename watchlist", (ctx) => ctx.reply("Under construction."))

        .text("Delete watchlist", async (ctx) => {
                await ctx.conversation.enter("deleteWL");
            }
        )
        .row()

        .back("Go back", async (ctx) => {
            await ctx.editMessageText("Choose the watchlist from the menu below:");
            // noinspection AssignmentResultUsedJS
            Object.keys(ctx.session.menudata).forEach(o => ctx.session.menudata[o] = undefined);
        });
}

function animeList() {
    return new Menu<MyContext>("wl_allist").dynamic(async (ctx) => {
        const range = new MenuRange<MyContext>();
        //const payload = ctx.match.toString().match(/(\d+)_(\d+)(_c)?/);
        const movepg = ctx.session.menudata.l_page;
        const temp = getWlAlid(ctx, true, false);
        if (temp === "back") {
            range.text("-Menu too old. Generate a new one.-");
            return range;
        }
        const wlid = temp.wlid;
        const wlname = await getWLName(ctx, wlid);
        let maxpg: number;
        let wl: { jpname: string, alid: number }[];
        if (ctx.session.menudata.maxpg === undefined) {
            ({ wl, maxpg } = await getWatchlistAnime(wlid, movepg, 5, true));
            ctx.session.menudata.maxpg = maxpg;
        } else {
            ({ wl, maxpg } = await getWatchlistAnime(wlid, movepg, 5, true, false));
            maxpg = ctx.session.menudata.maxpg;
        }
        if (wl.length === 0) {
            range.text("Watchlist is empty").row();
        } else {
            for (const item of wl) {
                range.submenu(item.jpname, "wl_alopts", async (ctx1) => {
                    await ctx1.editMessageText(`Chosen watchlist: <b>${wlname}</b>\n` +
                        `Chosen anime: <b>${(await db.anime.findUniqueOrThrow({
                            where: { alid: item.alid },
                            select: { jpname: true }
                        })).jpname}</b>\n` +
                        `What do you wanna do with it?`, { parse_mode: "HTML" });
                    ctx1.session.menudata.alid = item.alid;
                }).row();
            }
            // if (maxpg === 1) return range;
            // range.add(...(getPaginatedMenu(movepg, maxpg, wlid)));
            if (maxpg !== 1) {
                if (movepg > 1) range.submenu(`«1`, "wl_allist", (ctx1) => {
                    ctx1.session.menudata.l_page = 1;
                });
                if (movepg > 2) range.submenu(`‹${movepg - 1}`, "wl_allist", (ctx1) => {
                    ctx1.session.menudata.l_page = movepg - 1;
                });
                range.text(`-${movepg}-`);
                if (movepg < maxpg - 1) range.submenu(`${movepg + 1}›`, "wl_allist", (ctx1) => {
                    ctx1.session.menudata.l_page = movepg + 1;
                });
                if (movepg < maxpg) range.submenu(`${maxpg}»`, "wl_allist", (ctx1) => {
                    ctx1.session.menudata.l_page = maxpg;
                });
                range.row();
            }
        }
        range.back("Go back", async (ctx1) => {
            await ctx1.editMessageText(`Watchlist ${wlname} chosen.\nWhat do you want to do with it?`);
            ctx1.session.menudata.l_page = undefined;
            ctx1.session.menudata.maxpg = undefined;
            ctx1.session.menudata.alid = undefined;
        });
        return range;
    });
}

// async function listAnimeMenu(ctx: MyContext) {
// 	await ctx.reply("Under construction.");
// 	const payload = ctx.match.toString().match(/(\d+)_(\d+)(_c)?/);
// 	if (payload[3] === "_c") return;
// 	const movepg = parseInt(payload[2]);
// 	const wlid = parseInt(payload[1]);
// 	const { wl, maxpg } = await getWatchlistAnime(wlid, movepg, 5, true);
// 	await;
// }

function animeListOpts() {
    return new Menu<MyContext>("wl_alopts")
        .dynamic(async (ctx) => {
            console.log("building aniopts");
            const range = new MenuRange<MyContext>();
            const temp = getWlAlid(ctx, true, true);
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
            if (is_watched === 0) {
                range.text("Mark as watched", async (ctx1) => {
                    await markDone(ctx.session.userid, alid);
                    selfyeet(ctx.from.id, (await ctx.reply(`${name} has been marked as completed.`)).message_id, 5000);
                    ctx1.menu.update();
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
                        await ctx1.reply(`${name} has been marked as 'not watched'.`);
                        await ctx1.menu.update();
                        return;
                    }

                });
            }
            range.text({
                text: "Remove from watchlist",
                payload: `${wlid}_${alid}`
            }, async (ctx1) => {
                const temp = getWlAlid(ctx, true, true);
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
                    await ctx1.reply(`${name} removed from watchlist.`);
                }
            });
            return range;
        });
}


export function initWLMenu() {
    const wl_main = WLMainMenu();
    wl_main.register(WLOptsMenu());
    wl_main.register(animeList(), "wl_opts");
    wl_main.register(animeListOpts(), "wl_allist");
    bot.use(wl_main);
    bot.command("mywatchlists", (ctx) =>
        ctx.reply("Choose the watchlist from the menu below:", { reply_markup: wl_main })
    );
}


