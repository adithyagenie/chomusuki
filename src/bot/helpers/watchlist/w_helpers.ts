import { MyContext, MyConversation, MyConversationContext } from "../../bot";
import { db } from "../../../index";
import { watchlists } from "../../../database/schema";
import { eq } from "drizzle-orm";

export async function getWLName(ctx: MyContext) {
    if (ctx.session.menudata.wlname !== undefined) return ctx.session.menudata.wlname;
    else {
        try {
            if (ctx.session.menudata.wlid === undefined)
                return undefined;

            const result = await db.select({ watchlist_name: watchlists.watchlist_name })
                .from(watchlists)
                .where(eq(watchlists.watchlistid, ctx.session.menudata.wlid));
            
            if (result.length === 0) throw new Error("Watchlist not found");
            
            const wlname = result[0].watchlist_name;
            ctx.session.menudata.wlname = wlname;
            return wlname;
        } catch (e) {
            console.error(e);
            return undefined;
        }

    }
}

/**
 * Get watchlist and anime id from session.
 * @param ctx - Context
 * @param w - Set to true if you want watchlist id, else false.
 * @param a - Set to true if you want anime id, else false.
 */
export async function getWlAlid(ctx: MyContext, w: boolean, a: boolean) {
    if (w && !a) {
        if (ctx.session.menudata.wlid === undefined) return "back";
        return { wlid: ctx.session.menudata.wlid, alid: undefined };
    } else if (!w && a) {
        if (ctx.session.menudata.alid === undefined) {
            await new Promise(r => setTimeout(r, 1000));
            if (ctx.session.menudata.alid === undefined) return "back";
            return { wlid: undefined, alid: ctx.session.menudata.alid };
        } else return { wlid: undefined, alid: ctx.session.menudata.alid };
    } else if (w && a) {
        if (ctx.session.menudata.wlid === undefined || ctx.session.menudata.alid === undefined) {
            await new Promise(r => setTimeout(r, 2000));
            if (ctx.session.menudata.wlid === undefined || ctx.session.menudata.alid === undefined) return "back";
            return { wlid: ctx.session.menudata.wlid, alid: ctx.session.menudata.alid };
        } else return { wlid: ctx.session.menudata.wlid, alid: ctx.session.menudata.alid };
    }
}