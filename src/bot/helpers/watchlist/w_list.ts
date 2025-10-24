import { Menu, MenuRange } from "@grammyjs/menu";
import { MyContext } from "../../bot";
import { db } from "../../../index";
import { getWlAlid, getWLName } from "./w_helpers";
import { getWatchlistAnime } from "../../../database/animeDB";
import { watchlists, anime } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { b, code, fmt, i as italic, link } from "@grammyjs/parse-mode";

/**
 * - The main menu builder for /mywatchlists command.
 * - Choose a watchlist from here.
 * - Identifier wl_main.
 */
export function WLMainMenu() {
    return new Menu<MyContext>("wl_main").dynamic(async (ctx) => {
        const range = new MenuRange<MyContext>();
        const wllist = await db.select({
            watchlist_name: watchlists.watchlist_name,
            watchlistid: watchlists.watchlistid
        })
            .from(watchlists)
            .where(eq(watchlists.generated_by, ctx.session.userid));
        if (wllist === null || wllist.length === 0) {
            range
                .text("-No watchlists available-")
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
                        const message = fmt`Watchlist ${code}${wllist.slice(-1)[0].watchlist_name}${code} chosen.\nWhat do you want to do with it?`;
                        await ctx1.editMessageText(message.text, { entities: message.entities });
                        ctx1.session.menudata.wlid = wllist.slice(-1)[0].watchlistid;
                    })
                    .row();
                break;
            }
            range
                .submenu(wllist[i].watchlist_name, `wl_opts`, async (ctx1) => {
                    const message = fmt`Watchlist ${code}${wllist[i].watchlist_name}${code} chosen.\nWhat do you want to do with it?`;
                    await ctx1.editMessageText(message.text, { entities: message.entities });
                    ctx1.session.menudata.wlid = wllist[i].watchlistid;
                })
                .submenu(wllist[i + 1].watchlist_name, `wl_opts`, async (ctx1) => {
                    const message = fmt`Watchlist ${code}${wllist[i].watchlist_name}${code} chosen.\nWhat do you want to do with it?`;
                    await ctx1.editMessageText(message.text, { entities: message.entities });
                    ctx1.session.menudata.wlid = wllist[i + 1].watchlistid;
                })
                .row();
        }
        return range;
    });
}

/**
 * - Third level menu for /mywatchlists.
 * - List all anime present in watchlist.
 * - Identifier wl_allist.
 */
export function animeList() {
    return new Menu<MyContext>("wl_allist").dynamic(async (ctx) => {
        const range = new MenuRange<MyContext>();
        const movepg = ctx.session.menudata.l_page;
        const temp = await getWlAlid(ctx, true, false);
        const towatch = ctx.session.menudata.listmethod === "towatch";
        if (temp === "back") {
            range.text("-Menu too old. Generate a new one.-");
            return range;
        }
        const wlid = temp.wlid;
        const wlname = await getWLName(ctx);
        let maxpg: number;
        let wl: { jpname: string, enname: string, alid: number }[];
        if (ctx.session.menudata.maxpg === undefined) {
            ({ wl, maxpg } = await getWatchlistAnime(wlid, movepg, 5, true, true, {
                towatch,
                userid: towatch === false ? undefined : ctx.session.userid
            }));
            ctx.session.menudata.maxpg = maxpg;
        } else {
            ({ wl, maxpg } = await getWatchlistAnime(wlid, movepg, 5, true, false, {
                towatch,
                userid: towatch === false ? undefined : ctx.session.userid
            }));
            maxpg = ctx.session.menudata.maxpg;
        }
        if (wl.length === 0) {
            range.text("Watchlist is empty").row();
        } else {
            for (const item of wl) {
                range.submenu(item.jpname, "wl_alopts", async (ctx1) => {
                    ctx1.session.menudata.alid = item.alid;
                    const imgResult = await db.select({ imglink: anime.imglink })
                        .from(anime)
                        .where(eq(anime.alid, item.alid));
                    
                    if (imgResult.length === 0) throw new Error("Anime not found");
                    
                    const message = fmt`Chosen watchlist: ${b}${wlname}${b}\n\nChosen anime: \n${b}${item.jpname}${b}\n${italic}(${item.enname})${italic}\n\nWhat do you wanna do with it?${link(imgResult[0].imglink)}​${link(imgResult[0].imglink)}`;
                    await ctx1.editMessageText(message.text, { entities: message.entities });
                }).row();
            }
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
            const message = fmt`Watchlist ${code}${wlname}${code} chosen.\nWhat do you want to do with it?`;
            await ctx1.editMessageText(message.text, { entities: message.entities });
            ctx1.session.menudata.l_page = undefined;
            ctx1.session.menudata.maxpg = undefined;
            ctx1.session.menudata.alid = undefined;
        });
        return range;
    });
}