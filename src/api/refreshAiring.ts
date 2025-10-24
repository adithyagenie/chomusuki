import * as cron from "node-schedule";
import { bot } from "../bot/bot";
import { checkAnimeTable, getNumber } from "../database/animeDB";
import { db } from "../index";
import { anime, airingupdates, users } from "../database/schema";
import { eq, inArray } from "drizzle-orm";

async function cronn(alid: number, aniname: string, next_ep_air: number, next_ep_num: number) {
    console.log(
        `Scheduling job for ${aniname} - ${next_ep_num} at ${new Date(
            next_ep_air * 1000
        ).toLocaleString()}`
    );
    if (next_ep_air * 1000 < Date.now()) {
        console.error("Time to schedule in past.");
        const res2 = await checkAnimeTable(alid, true);
        if (res2 == "err" || res2 == "invalid") throw new Error("Unable to fetch anime table.");
        await cronn(
            alid,
            res2.pull.jpname,
            res2.pull.next_ep_air,
            getNumber(res2.pull.next_ep_num) as number
        );
        return;
    }
    const job = cron.scheduleJob(
        `${alid}`,
        new Date(next_ep_air * 1000),
        async function (alid: number, aniname: string, next_ep_num: number) {
            await airhandle(alid, aniname, next_ep_num);
        }.bind(null, alid, aniname, next_ep_num)
    );
    if (job !== null) job.on("error", (err) => console.log(err));
}

async function airhandle(alid: number, aniname: string, next_ep_num: number) {
    console.log(`Processing job for ${aniname} - ${next_ep_num}.`);
    await db.update(anime)
        .set({ last_ep: next_ep_num })
        .where(eq(anime.alid, alid));
    
    const sususersResult = await db.select({ userid: airingupdates.userid })
        .from(airingupdates)
        .where(eq(airingupdates.alid, alid));
    
    if (sususersResult.length === 0) throw new Error("Unable to find airing ppl");
    const sususers = sususersResult[0];
    
    const imglinkResult = await db.select({ fileid: anime.fileid })
        .from(anime)
        .where(eq(anime.alid, alid));
    
    const imglink = imglinkResult[0];
    
    const chatid = await db.select({ chatid: users.chatid })
        .from(users)
        .where(inArray(users.userid, sususers.userid));
    
    for (const o of chatid) {
        await bot.api.sendPhoto(Number(o.chatid), imglink.fileid, {
            caption: `Episode ${next_ep_num} of <b>${aniname}</b> is airing now.\nDownload links will be available soon.`
        });
    }
    console.log(
        `CRON: I will check anilist for updates of ${alid} at ${new Date(
            Date.now() + 20 * 60 * 1000
        ).toLocaleString()}`
    );
    cron.scheduleJob(
        `AL_${alid}`,
        new Date(Date.now() + 20 * 60 * 1000),
        async function (alid: number) {
            console.log(`Refreshing cron for ${alid}...`);
            const res = await checkAnimeTable(alid, true);
            if (res === "invalid" || res === "err") throw new Error("Can't fetch anime details.");
            if (res.airing === true) {
                res.pull.next_ep_air = Math.floor(Date.now() / 1000) + 25;
                await cronn(
                    alid,
                    res.pull.jpname,
                    res.pull.next_ep_air,
                    getNumber(res.pull.next_ep_num) as number
                );
            }
        }.bind(null, alid)
    );
}

async function reInitCron() {
    console.log("Refreshing all cron!");
    const data = await db.select({
        jpname: anime.jpname,
        next_ep_air: anime.next_ep_air,
        alid: anime.alid,
        next_ep_num: anime.next_ep_num
    })
        .from(anime)
        .where(eq(anime.status, "RELEASING"));
    
    const oldtasks = cron.scheduledJobs;
    Object.keys(oldtasks).forEach((i) => {
        if (!(oldtasks[i].name == "main" || oldtasks[i].triggeredJobs() != 0)) oldtasks[i].cancel();
    });
    for (const o of data) {
        if (o.next_ep_air !== null && o.next_ep_num !== null) {
            await cronn(o.alid, o.jpname, o.next_ep_air, Number(o.next_ep_num));
        }
    }
}

export function terminateCron(callback: () => void) {
    Object.keys(cron.scheduledJobs).forEach(o => {
        cron.scheduledJobs[o].cancel();
    });
    callback();
}

export async function initCron() {
    await reInitCron();
    cron.scheduleJob("main", "0 * * * *", () => reInitCron());
}
