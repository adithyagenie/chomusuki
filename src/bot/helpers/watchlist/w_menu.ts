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

import {Menu, MenuRange} from "@grammyjs/menu";
import {bot, MyContext} from "../../bot";
import {db} from "../../..";
import {selfyeet} from "../misc_handles";
import {getWatchlistAnime, markDone, markNotDone, removeFromWatchlist} from "../../../database/animeDB";

function WLMainMenu() {
    return new Menu<MyContext>("wlmenu").dynamic(async (ctx) => {
        const range = new MenuRange<MyContext>();
        const wllist = await db.watchlists.findMany({
            where: {generated_by: ctx.session.userid},
            select: {watchlist_name: true, watchlistid: true}
        });
        if (wllist === null || wllist.length === 0) {
            range
                .text("-No watchlists available-", (ctx) =>
                    ctx.menu.update()
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
                    .submenu(TextPayload(wllist.slice(-1)[0].watchlist_name, wllist.slice(-1)[0].watchlistid), `wlopts`, (ctx) => {
                        ctx.editMessageText(
                            `Watchlist ${
                                wllist.slice(-1)[0].watchlist_name
                            } chosen.\nWhat do you want to do with it?`
                        );
                    })
                    .row();
                break;
            }
            range
                .submenu(TextPayload(wllist[i].watchlist_name, wllist[i].watchlistid), `wlopts`, (ctx) => {
                    ctx.editMessageText(
                        `Watchlist ${wllist[i].watchlist_name} chosen.\nWhat do you want to do with it?`
                    );
                })
                .submenu(TextPayload(wllist[i + 1].watchlist_name, wllist[i + 1].watchlistid), `wlopts`, (ctx) => {
                    ctx.editMessageText(
                        `Watchlist ${wllist[i].watchlist_name} chosen.\nWhat do you want to do with it?`
                    );
                })
                .row();
        }
        return range;
    });
}

function getWlAlid(ctx: MyContext, w: boolean, a: boolean) {
    if (ctx.match == undefined) return undefined;
    if (w && !a)
        return {
            wlid: parseInt(ctx.match.toString()
            )
        };
    else if (w && a) {
        const matches = ctx.match.toString().match(/(\d+)_(\d+)/);
        return {wlid: parseInt(matches[1]), alid: parseInt(matches[2])};
    }
}

function TextPayload(text: string, payload: string | number) {
    return {text: text, payload: `${payload}`};
}

async function getWLName(wlid: number) {
    return (await db.watchlists.findUniqueOrThrow({
        where: {watchlistid: wlid},
        select: {watchlist_name: true}
    })).watchlist_name;
}

// function getPaginatedMenu(current: number, maxpg: number, wlid: number, range: MenuRange<MyContext>) {
//     if (current > 1) range.submenu({
//         text: `«1`, payload: `${wlid}_1`
//     }, "allist");
//     if (current > 2)
//         range.submenu({
//             text: `‹${current - 1}`,
//             payload: `${wlid}_${(current - 1).toString()}`
//         }, "allist");
//     range.submenu({
//         text: `-${current}-`,
//         payload: `${wlid}_${current.toString()}_c`
//     }, "allist");
//     if (current < maxpg - 1)
//         range.submenu({
//             text: `${current + 1}›`,
//             payload: `${wlid}_${(current + 1).toString()}`
//         }, "allist");
//     if (current < maxpg)
//         range.submenu({
//             text: `${maxpg}»`,
//             payload: `${wlid}_${maxpg.toString()}`
//         }, "allist");
//     range.row();
// }

function WLOptsMenu() {
    return new Menu<MyContext>("wlopts")
        .text({
            text: "Add anime", payload: ctx => {
                return `${(getWlAlid(ctx, true, false)).wlid}`;
            }
        }, async (ctx) => await ctx.conversation.enter("addWL"))
        .row()

        .submenu({
                text: "List all anime", payload: ctx => {
                    return `${(getWlAlid(ctx, true, false)).wlid}_1`;
                }
            }, "allist"
        )

        .text({
            text: "List to-watch anime", payload: ctx => {
                return `${(getWlAlid(ctx, true, false)).wlid}`;
            }
        }, (ctx) => ctx.reply("Under construction."))
        .row()

        .text({
            text: "Rename watchlist", payload: ctx => {
                return `${(getWlAlid(ctx, true, false)).wlid}`;
            }
        }, (ctx) => ctx.reply("Under construction."))

        .text(
            {
                text: "Delete watchlist", payload: ctx => {
                    return `${(getWlAlid(ctx, true, false)).wlid}`;
                }
            },
            async (ctx) => {
                await ctx.conversation.enter("deleteWL");
            }
        )
        .row()

        .back("Go back", (ctx) => ctx.editMessageText("Choose the watchlist from the menu below:"));
}

function listAnimeMenuStart() {
    return new Menu<MyContext>("allist").dynamic(async (ctx) => {
        const range = new MenuRange<MyContext>();
        console.log(`GEN PAYLOAD::: ${ctx.match}::: ${ctx.callbackQuery.data}`);
        const payload = ctx.match.toString().match(/(\d+)_(\d+)(_c)?/);
        let movepg: number;
        let wlid: number;
        if (payload === null) {
            const payload2 = parseInt(ctx.match.toString());
            if (payload2 === null) return;
            wlid = parseInt(payload2[1]);
            movepg = 1;
        } else {
            movepg = parseInt(payload[2]);
            wlid = parseInt(payload[1]);
            if (payload[3] === "_c") return;
        }
        if (Number.isNaN(wlid) || Number.isNaN(movepg)) return;
        //const wlid = parseInt(ctx.match.toString());
        const wlname = await getWLName(wlid);
        const {wl, maxpg} = await getWatchlistAnime(wlid, movepg, 5, true);
        for (const item of wl) {
            range.submenu({text: item.jpname, payload: `${wlid}_${item.alid}`}, "alopts", (ctx1) => {
                ctx1.editMessageText(`Chosen watchlist: ${wlname}\n` +
                    `Chosen anime: ${item.alid}\n` +
                    `What do you wanna do with it?`);
            }).row();
        }
        // if (maxpg === 1) return range;
        // range.add(...(getPaginatedMenu(movepg, maxpg, wlid)));

        if (movepg > 1) range.submenu({
            text: `«1`, payload: `${wlid}_1`
        }, "allist");
        if (movepg > 2)
            range.submenu({
                text: `‹${movepg - 1}`,
                payload: `${wlid}_${(movepg - 1).toString()}`
            }, "allist");
        range.submenu({
            text: `-${movepg}-`,
            payload: `${wlid}_${movepg.toString()}_c`
        }, "allist");
        if (movepg < maxpg - 1)
            range.submenu({
                text: `${movepg + 1}›`,
                payload: `${wlid}_${(movepg + 1).toString()}`
            }, "allist");
        if (movepg < maxpg)
            range.submenu({
                text: `${maxpg}»`,
                payload: `${wlid}_${maxpg.toString()}`
            }, "allist");
        range.row();

        range.back({
            text: "Go back",
            payload: `${wlid}`
        }, (ctx1) => ctx1.editMessageText(`Watchlist ${wlname} chosen.\nWhat do you want to do with it?`));

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

function animeListMenu() {
    return new Menu<MyContext>("alopts")
        .dynamic(async (ctx) => {
            console.log("building aniopts");
            const range = new MenuRange<MyContext>();
            const {wlid, alid} = getWlAlid(ctx, true, true);
            const name = (await db.anime.findUniqueOrThrow({where: {alid}, select: {jpname: true}})).jpname;
            const is_watched = await db.completedanime.count({
                where: {
                    userid: ctx.session.userid,
                    completed: {has: alid}
                }
            });
            if (is_watched === 0) {
                range.text({text: "Mark as watched", payload: `${alid}`}, async (ctx1) => {
                    await markDone(ctx.session.userid, parseInt(ctx1.match));
                    selfyeet(ctx.from.id, (await ctx.reply(`${name} has been marked as completed.`)).message_id, 5000);
                    ctx1.menu.update();
                });
            } else {
                range.text({text: "Mark as not watched", payload: `${alid}`}, async (ctx1) => {
                    const result = await markNotDone(ctx.session.userid, parseInt(ctx1.match));
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
            range.text({text: "Remove from watchlist", payload: `${wlid}_${alid}`}, async (ctx1) => {
                const {wlid, alid} = getWlAlid(ctx, true, true);
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
        });
}

export function initWLMenu() {
    const wl_main = WLMainMenu();
    wl_main.register(WLOptsMenu());
    wl_main.register(listAnimeMenuStart());
    wl_main.register(animeListMenu());
    bot.use(wl_main);
    bot.command("mywatchlists", (ctx) =>
        ctx.reply("Choose the watchlist from the menu below:", {reply_markup: wl_main})
    );
}
