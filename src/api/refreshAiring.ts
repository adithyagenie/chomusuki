import * as cron from 'node-schedule';
import { bot } from '../bot/bot';
import { checkAnimeTable, getNumber } from '../database/animeDB';
import { db } from '../index';
import { b, fmt } from '@grammyjs/parse-mode';

async function cronn(
  alid: number,
  aniname: string,
  next_ep_air: number,
  next_ep_num: number,
) {
  console.log(
    `Scheduling job for ${aniname} - ${next_ep_num} at ${new Date(
      next_ep_air * 1000,
    ).toLocaleString()}`,
  );
  if (next_ep_air * 1000 < Date.now()) {
    console.error('Time to schedule in past.');
    const res2 = await checkAnimeTable(alid, true);
    if (res2 == 'err' || res2 == 'invalid')
      throw new Error('Unable to fetch anime table.');
    await cronn(
      alid,
      res2.pull.jpname,
      res2.pull.next_ep_air,
      getNumber(res2.pull.next_ep_num) as number,
    );
    return;
  }
  const job = cron.scheduleJob(
    `${alid}`,
    new Date(next_ep_air * 1000),
    async function (alid: number, aniname: string, next_ep_num: number) {
      await airhandle(alid, aniname, next_ep_num);
    }.bind(null, alid, aniname, next_ep_num),
  );
  if (job !== null) job.on('error', (err) => console.log(err));
}

async function airhandle(alid: number, aniname: string, next_ep_num: number) {
  console.log(`Processing job for ${aniname} - ${next_ep_num}.`);
  await db.anime.update({ where: { alid }, data: { last_ep: next_ep_num } });
  const sususers = await db.airingupdates.findUnique({
    where: { alid },
    select: { userid: true },
  });
  const imglink = await db.anime.findUnique({
    where: { alid },
    select: { fileid: true },
  });
  if (sususers === null) throw new Error('Unable to find airing ppl');
  const chatid = await db.users.findMany({
    where: { userid: { in: sususers.userid } },
    select: { chatid: true },
  });
  for (const o of chatid) {
    const message = fmt`Episode ${next_ep_num} of ${b}${aniname}${b} is airing now.\nDownload links will be available soon.`;
    await bot.api.sendPhoto(Number(o.chatid), imglink.fileid, {
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  }
  console.log(
    `CRON: I will check anilist for updates of ${alid} at ${new Date(
      Date.now() + 20 * 60 * 1000,
    ).toLocaleString()}`,
  );
  cron.scheduleJob(
    `AL_${alid}`,
    new Date(Date.now() + 20 * 60 * 1000),
    async function (alid: number) {
      console.log(`Refreshing cron for ${alid}...`);
      const res = await checkAnimeTable(alid, true);
      if (res === 'invalid' || res === 'err')
        throw new Error("Can't fetch anime details.");
      if (res.airing === true) {
        res.pull.next_ep_air = Math.floor(Date.now() / 1000) + 25;
        await cronn(
          alid,
          res.pull.jpname,
          res.pull.next_ep_air,
          getNumber(res.pull.next_ep_num) as number,
        );
      }
    }.bind(null, alid),
  );
}

async function reInitCron() {
  console.log('Refreshing all cron!');
  const data = await db.anime.findMany({
    where: {
      next_ep_air: {
        not: null,
      },
      status: 'RELEASING',
    },
    select: { jpname: true, next_ep_air: true, alid: true, next_ep_num: true },
  });
  const oldtasks = cron.scheduledJobs;
  Object.keys(oldtasks).forEach((i) => {
    if (!(oldtasks[i].name == 'main' || oldtasks[i].triggeredJobs() != 0))
      oldtasks[i].cancel();
  });
  for (const o of data) {
    await cronn(o.alid, o.jpname, o.next_ep_air, o.next_ep_num.toNumber());
  }
}

export function terminateCron(callback: () => void) {
  Object.keys(cron.scheduledJobs).forEach((o) => {
    cron.scheduledJobs[o].cancel();
  });
  callback();
}

export async function initCron() {
  await reInitCron();
  cron.scheduleJob('main', '0 * * * *', () => reInitCron());
}
