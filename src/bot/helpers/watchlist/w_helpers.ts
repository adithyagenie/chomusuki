import { MyContext, MyConversation } from "../../bot";
import { db } from "../../../index";

export async function getWLName(c: MyContext | MyConversation) {
  let wlid: number, wlname: string;
  if ("session" in c) {
    // it is MyContext
    wlid = c.session.menudata.wlid;
    wlname = c.session.menudata.wlname;
  } else {
    // MyConversation type
    wlid = await c.external((ctx) => ctx.session.menudata.wlid);
    wlname = await c.external((ctx) => ctx.session.menudata.wlname);
  }
    if (wlname !== undefined) return wlname;
    else {
        try {
            if (wlid === undefined)
                return undefined;

            const wlname = (await db.watchlists.findUniqueOrThrow({
                where: { watchlistid: wlid },
                select: { watchlist_name: true }
            })).watchlist_name;

            if ("session" in c) {
              c.session.menudata.wlname = wlname;
            }
            else {
              await c.external((ctx) => {
                ctx.session.menudata.wlname = wlname;
              });
            }
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
