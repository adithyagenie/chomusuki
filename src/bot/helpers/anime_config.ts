/** Rewrite this shit.*/

import { db } from "../..";
import { changeConfig } from "../../database/animeDB";
import { MyContext } from "../bot";
import { config, Config } from "../../database/schema";
import { eq } from "drizzle-orm";

async function getConfig(ctx: MyContext) {
    try {
        if (ctx.session.config !== undefined) return ctx.session.config;
        const data = await db.select({ pause_airing_updates: config.pause_airing_updates })
            .from(config)
            .where(eq(config.userid, ctx.session.userid));
        
        if (data.length === 0) return undefined;
        ctx.session.config = data[0];
        return data[0];
    } catch (err) {
        console.error(err);
        return undefined;
    }
}

export async function anime_config(ctx: MyContext) {
    const argarray = ctx.msg.text.split(" ");
    argarray.splice(0, 1);
    console.log(argarray);
    const userid = ctx.session.userid;
    const oldconfig = await getConfig(ctx);

    const newconfig: Config = {
        userid: userid,
        pause_airing_updates: oldconfig.pause_airing_updates
    };
    if (argarray.length > 0) {
        if (argarray[0] == "pause_airing_updates") {
            if (argarray[1] == "true" || argarray[1] == "false") {
                newconfig.pause_airing_updates = argarray[1] == "true";
                await changeConfig(newconfig);
                await ctx.reply(`Set pause_sync to ${newconfig.pause_airing_updates}.`);
            } else await ctx.reply("Invalid value for pause_sync. Accepted values: \"true/false\"");
            return;
        } else
            await ctx.reply("Invalid config option. Accepted config option: \"remind_again/pause_sync\"");
        return;
    } else await ctx.reply("Provide a config option. Accepted config option: \"remind_again/pause_sync\"");
}
