import { db } from '../../..';
import { addToWatchlist } from '../../../database/animeDB';
import { MyConversation, MyConversationContext } from '../../bot';
import { animeSearchHandler } from '../anime/a_search';
import { getWLName } from './w_helpers';
import { selfyeet } from '../misc_handles';
import { b, fmt } from '@grammyjs/parse-mode';

/**
 * Conversation for adding anime in watchlist.
 * @param convo - Conversation
 * @param ctx - Context
 */
export async function addWL(convo: MyConversation, ctx: MyConversationContext) {
  const watchlistid = await convo.external(
    (ctx2) => ctx2.session.menudata?.wlid,
  );
  if (watchlistid === undefined) {
    await ctx.reply('Watchlist not selected.');
    return;
  }
  const item = await convo.external(() =>
    db.watchlists.count({ where: { watchlistid: watchlistid } }),
  );
  if (item === 0) {
    await ctx.reply('Watchlist missing.');
    return;
  }
  const wlname = await getWLName(convo);
  await ctx.reply('Send the name of anime or /done to stop adding.');
  let msgid = 0;
  while (true) {
    const name = await convo.waitUntil(
      (ctx1) =>
        ctx1.hasCallbackQuery(/^addwl_(\d+)_(\d+)(_current)?/) ||
        (ctx1.hasText(/.+/) && !ctx1.hasCallbackQuery(/.+/)),
    );
    if (name.hasCallbackQuery(/addwl_(\d+)_(\d+)(_current)?/)) {
      await searchCB(convo, name);
    } else if (name.message != undefined) {
      if (name.hasCommand('done')) {
        await ctx.reply('Alright wrapping up.');
        try {
          if (msgid !== 0 && msgid !== undefined && ctx.chat?.id !== undefined)
            await ctx.api.deleteMessage(ctx.chat.id, msgid);
        } catch {
          console.log(`unable to delete message ${msgid}`);
        }
        return;
      } else if (
        name.message?.text !== undefined &&
        name.message.text.match(/\/start wl_(\d+)/) !== null
      ) {
        convo.log(`Adding ${name.message.text}`);
        await name.deleteMessage();
        const matchResult = name.message.text.match(/\/start wl_(\d+)/);
        if (matchResult === null) continue;
        const result = await convo.external(() =>
          addToWatchlist(watchlistid, parseInt(matchResult[1])),
        );
        if (result === 'present') {
          const todel = await ctx.reply('Anime already added to watchlist.');
          if (ctx.chat?.id !== undefined)
            selfyeet(ctx.chat.id, todel.message_id, 5000);
        } else if (result === 'err') {
          await ctx.reply(
            `Error adding to watchlist. Try again after some time.`,
          );
          return;
        } else if (result === 'invalid') {
          await ctx.reply('Anime not found.');
        } else {
          const replyString = fmt`${b}${result ?? ''}${b} has been added to ${wlname ?? ''}.\nTo add another, simply send the anime name to search or /done to finish adding.`;
          const todel = await ctx.reply(replyString.text, {
            entities: replyString.entities,
          });
          if (ctx.chat?.id !== undefined)
            selfyeet(ctx.chat.id, todel.message_id, 5000);
        }
      } else {
        if (msgid !== undefined && msgid !== 0 && ctx.chat?.id !== undefined) {
          try {
            await ctx.api.deleteMessage(ctx.chat.id, msgid);
          } catch {
            console.log(`unable to delete message ${msgid}`);
          }
        }
        const messageText = name.message?.text;
        if (messageText !== undefined) {
          const result = await startSearchWL(
            convo,
            ctx,
            messageText,
            watchlistid,
          );
          if (result !== undefined) msgid = result;
        }
      }
    }
  }
}

/**
 * Gives/edits message to give required page of anime search for watchlist adding.
 * @param convo Conversation object
 * @param ctx Context object
 */
async function searchCB(convo: MyConversation, ctx: MyConversationContext) {
  const userid = await convo.external((ctx2) => ctx2.session.userid);
  await ctx.answerCallbackQuery('Searching!');
  if (ctx.match?.[3] === '_current') return;
  const movepg = parseInt(ctx.match?.[2] || '');
  const wlid = parseInt(ctx.match?.[1] || '');
  if (Number.isNaN(movepg) || Number.isNaN(wlid)) return;
  if (ctx.msg?.text === undefined) return;
  const query = [
    ...ctx.msg.text.split('\n')[0].matchAll(/^Search results for '(.+)'$/gi),
  ].map((o) => o[1])[0];
  //console.log(`${command}, ${movepg}, ${query}`);
  const { msg, keyboard } = await animeSearchHandler(
    query,
    'addwl',
    movepg,
    ctx.me.username,
    userid,
    wlid,
  );
  if (msg == undefined || keyboard == undefined) {
    await ctx.reply('Unable to find any results.');
    return;
  }
  //console.log(`${msg}, ${JSON.stringify(keyboard)}`);
  await ctx.editMessageText(msg.text, {
    reply_markup: keyboard,
    entities: msg.entities,
  });
}

async function startSearchWL(
  convo: MyConversation,
  ctx: MyConversationContext,
  name: string,
  wlid: number,
): Promise<number | undefined> {
  const userid = await convo.external((ctx2) => ctx2.session.userid);
  if (name === '') {
    await ctx.reply('Please provide a search query!');
    return undefined;
  }
  const msgid = (await ctx.reply('Searching...')).message_id;
  const { msg, keyboard } = await convo.external(() =>
    animeSearchHandler(name, 'addwl', 1, ctx.me.username, userid, wlid),
  );
  if (msg == undefined || keyboard == undefined) {
    if (ctx.from?.id !== undefined) {
      await ctx.api.editMessageText(
        ctx.from.id,
        msgid,
        'Unable to find any results.',
      );
    }
    return undefined;
  }
  if (ctx.from?.id === undefined) return;
  if (keyboard.inline_keyboard.length == 0)
    await ctx.api.editMessageText(ctx.from.id, msgid, msg.text, {
      entities: msg.entities,
    });
  await ctx.api.editMessageText(ctx.from.id, msgid, msg.text, {
    reply_markup: keyboard,
    entities: msg.entities,
  });
  return msgid;
}
