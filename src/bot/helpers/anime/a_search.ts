// Adding anime to subscriptions

import { a, b, fmt } from '@grammyjs/parse-mode';
import { db } from '../../..';
import { searchAnime } from '../../../api/anilist_api';
import { MyContext } from '../../bot';
import { getPagination } from './a_misc_helpers';
import { MediaSearchEntry } from 'anilist-node';

// export async function anime_add(ctx: MyContext) {
// 	if (ctx.chat.id != authchat) {
// 		await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
// 		return;
// 	}
// 	await ctx.conversation.enter("animeadd");
// }
//
// export async function animeadd(conversation: MyConversation, ctx: MyConversationContext) {
// 	let responseobj: anime;
// 	await ctx.reply(
// 		"Please provide data required. Type /cancel at any point to cancel adding.",
// 		{ reply_markup: { remove_keyboard: true } }
// 	);
// 	await ctx.reply(
// 		"What is the exact Japanese name of the anime? (Refer Anilist for name)"
// 	);
// 	const jpanimename = await conversation.form.text();
// 	await ctx.reply(
// 		"What is the exact English name of the anime? (Refer Anilist for name)"
// 	);
// 	const enanimename = await conversation.form.text();
// 	await ctx.reply(
// 		"Any other optional names you would like to provide? (seperated by commas, NIL for
// nothing)" ); const optnameres = await conversation.form.text(); let optnames: string[],
// excnames: string[]; if (optnameres != "NIL") { optnames = optnameres.split(","); optnames =
// optnames.map((x: string) => x.trim()); } await ctx.reply( "Any similarly named terms which would
// interfere with search results? (seperated by commas, NIL for nothing)" ); const excnameres =
// await conversation.form.text(); if (excnameres != "NIL") { excnames = excnameres.split(",");
// excnames = excnames.map((x: string) => x.trim()); } let AlID = 0; AlID = await
// getAlId(enanimename, jpanimename); if (AlID == 0) { await ctx.reply("Anilist ID for the
// anime?"); AlID = parseInt(await conversation.form.text()); }

// 	responseobj = {
// 		enname: enanimename,
// 		jpname: jpanimename,
// 		optnames: optnames === undefined ? [] : optnames,
// 		excludenames: excnames === undefined ? [] : excnames,
// 		alid: AlID,
// 	};
// 	const returncode = await addAnimeNames(responseobj);
// 	if (returncode == 0) await ctx.reply("Anime has been added!");
// 	else await ctx.reply("Error occured!");
// 	return;
// }

/**
 ** Universal search starter.
 ** Shows first page alone for search results.
 ** For subsequent pages, animeSearchHandler is called (mostly with callbackQueries).
 ** Call this in bot.command() with appropriate arguments. */
export async function animeSearchStart(
  ctx: MyContext,
  command: 'startwatching' | 'remindme',
) {
  const query = ctx.match as string;
  if (query === '' || query === undefined) {
    await ctx.reply('Please provide a search query!');
    return;
  }
  if (ctx.from?.id === undefined) return;
  const msgid = (await ctx.reply('Searching...')).message_id;
  const { msg, keyboard } = await animeSearchHandler(
    query,
    command,
    1,
    ctx.me.username,
    ['startwatching', 'remindme'].includes(command)
      ? ctx.session.userid
      : undefined,
  );
  if (msg == undefined || keyboard == undefined) {
    await ctx.api.editMessageText(
      ctx.from.id,
      msgid,
      'Unable to find any results.',
    );
    return;
  }
  if (keyboard.inline_keyboard.length == 0)
    await ctx.api.editMessageText(ctx.from.id, msgid, msg.text, {
      entities: msg.entities,
    });
  await ctx.api.editMessageText(ctx.from.id, msgid, msg.text, {
    reply_markup: keyboard,
    entities: msg.entities,
  });
  return;
}

async function getStatusFromDB(table: string, userid?: number, wlid?: number) {
  let alid: number[] = [];
  if (table == 'startwatching') {
    const res = await db.watchinganime.findUnique({
      where: { userid },
      select: { alid: true },
    });
    if (res !== null) alid = res.alid;
  } else if (table == 'remindme') {
    const rec = await db.airingupdates.findMany({
      where: { userid: { has: userid } },
      select: { alid: true },
    });
    alid = rec.map((o) => o.alid);
  } else if (table.startsWith('addwl')) {
    const rec = await db.watchlists.findUnique({
      where: { watchlistid: wlid },
      select: { alid: true },
    });
    if (rec === null) alid = [];
    else alid = rec.alid;
  }
  return alid;
}

/**
 ** Handles the search queries and returns the message and keyboard.
 ** Called interally.*/
export async function animeSearchHandler(
  query: string,
  cmd: 'startwatching' | 'remindme' | 'addwl',
  currentpg = 1,
  username: string,
  userid?: number,
  watchlistid?: number,
) {
  let command = cmd;
  // const page = await searchAnime(query, currentpg, command == "remindme");
  // if (page === undefined) return { msg: undefined, keyboard: undefined };
  const searchArray: Promise<MediaSearchEntry | undefined>[] = [];
  for (let i = currentpg; i <= 5; i++)
    searchArray.push(searchAnime(query, i, command === 'remindme'));
  const t = await Promise.all(searchArray);
  const pages = t.filter((o) => o !== undefined);
  if (pages.find((o) => o.pageInfo.currentPage === currentpg) === undefined)
    return {
      msg: undefined,
      keyboard: undefined,
    };
  const maxpg = Math.max(...pages.map((o) => o.pageInfo.currentPage));
  const page = pages.find((o) => o.pageInfo.currentPage === currentpg);
  if (page === undefined) {
    return { msg: undefined, keyboard: undefined };
  }
  // if (currentpg != 1 && currentpg != 2)
  //     maxpg = pages.pageInfo.lastPage > 5 ? 5 : pages.pageInfo.lastPage;
  // else if (currentpg == 1 || currentpg == 2) {
  //     const temp = await searchAnime(query, 2, command == "remindme");
  //     if (temp == undefined) {
  //         maxpg = 1;
  //     } else {
  //         const temp2 = await searchAnime(query, 3, command == "remindme");
  //         if (temp2 == undefined) {
  //             maxpg = 2;
  //         } else maxpg = temp2.pageInfo.lastPage > 5 ? 5 : temp2.pageInfo.lastPage;
  //     }
  // }

  if (command == 'addwl') command += `_${watchlistid}`;
  const keyboard = getPagination(currentpg, maxpg, command);
  let msg = fmt`${b}Search results for '${query}${b}'\n\n`;
  const dbidlist = await getStatusFromDB(command, userid, watchlistid);
  for (let i = 0; i < page.media.length; i++) {
    msg = msg.concat(
      fmt`${b}${page.media[i].title.romaji}${b}\n${
        page.media[i].title.english === null
          ? page.media[i].title.userPreferred
          : page.media[i].title.english
      }\n`,
    );
    if (command == 'startwatching' && userid !== undefined) {
      // let old = await db.watchinganime.findUnique({
      // 	where: { userid }
      // });
      // if (old.alid === undefined) old.alid = [];
      if (dbidlist.includes(page.media[i].id))
        msg = msg.concat(fmt`${i}(Anime already marked as watching!)${i}\n\n`);
      //else msg += `<i>Start Watching:</i> /startwatching_${pages.media[i].id}\n\n`;
      else
        msg = msg.concat(
          fmt`${i}Start Watching: ${a(`t.me/${username}?start=startwatching_${page.media[i].id}`)}Click here!${a}${i}\n\n`,
        );
    } else if (command == 'remindme' && userid !== undefined) {
      // let old: number[] = [];
      // let _ = await db.airingupdates.findMany({
      // 	where: { userid: { has: userid } },
      // 	select: { alid: true }
      // });
      //if (_ === null) old = [];
      //else old = _.map((o) => o.alid);
      if (dbidlist.includes(page.media[i].id))
        msg = msg.concat(
          fmt`${i}(Already sending airing updates for anime!)${i}\n\n`,
        );
      //else msg += `<i>Send Airing Updates:</i> /remindme_${pages.media[i].id}\n\n`;
      else
        msg = msg.concat(
          fmt`${i}Send Airing Updates: ${a(`t.me/${username}?start=remindme_${page.media[i].id}`)}Click here!${a}${i}\n\n`,
        );
    } else if (command.startsWith('addwl') && watchlistid !== undefined) {
      // let old: number[] = [];
      // let _ = await db.watchlists.findUnique({
      // 	where: { watchlistid },
      // 	select: { alid: true }
      // });
      // old = _ === null ? [] : _.alid;
      if (dbidlist.includes(page.media[i].id))
        msg = msg.concat(fmt`${i}(Already present in watchlist!)${i}\n\n`);
      else
        msg = msg.concat(
          fmt`${i}Add to watchlist: ${a(`t.me/${username}?start=wl_${page.media[i].id}`)}Click here!${a}${i}\n\n`,
        );
    } else msg = msg.concat(fmt`\n`);
  }
  return { msg, keyboard };
}

/**This function helps manage page scrolling for search results.
 Migrate the callbackquery and make this a function later.*/
export async function search_startWatch_remindMe_cb(ctx: MyContext) {
  await ctx.answerCallbackQuery('Searching!');
  const command = ctx.match?.[1];
  if (ctx.match?.[3] === '_current') return;
  if (command !== 'startwatching' && command !== 'remindme') return;
  const movepg = parseInt(ctx.match?.[2] || '');
  if (ctx.msg?.text === undefined) return;
  const query = [
    ...ctx.msg.text.split('\n')[0].matchAll(/^Search results for '(.+)'$/gi),
  ].map((o) => o[1])[0];
  //console.log(`${command}, ${movepg}, ${query}`);
  const { msg, keyboard } = await animeSearchHandler(
    query,
    command,
    movepg,
    ctx.me.username,
    ctx.session.userid,
  );
  if (msg == undefined || keyboard == undefined) {
    await ctx.reply('Unable to find any results.');
    return;
  }
  //console.log(`${msg}, ${JSON.stringify(keyboard)}`);
  await ctx.editMessageText(msg.text, {
    entities: msg.entities,
    reply_markup: keyboard,
  });
}
