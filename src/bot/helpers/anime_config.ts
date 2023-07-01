/** Rewrite this shit.*/

import { config } from "@prisma/client";
import { db } from "../..";
import { changeConfig } from "../../database/animeDB";
import { MyContext } from "../bot";

async function getConfig(ctx: MyContext) {
    try {
        if (ctx.session.config !== undefined) return ctx.session.config;
        const data = await db.config.findUnique({
            where: { userid: ctx.session.userid },
            select: { pause_airing_updates: true }
        });
        ctx.session.config = data;
        return data;
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

    const newconfig: config = {
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
