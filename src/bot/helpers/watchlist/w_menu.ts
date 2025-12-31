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

import { Menu, MenuRange } from '@grammyjs/menu';
import { bot, MyContext } from '../../bot';
import { db } from '../../..';
import { selfyeet } from '../misc_handles';
import {
  markDone,
  markNotDone,
  removeFromWatchlist,
} from '../../../database/animeDB';
import { getWlAlid, getWLName } from './w_helpers';
import { animeList, WLMainMenu } from './w_list';
import { deleteWL } from './w_wlmgmt';
import { animeStartWatch } from '../anime/a_watching';
import { a, b, code, fmt, i } from '@grammyjs/parse-mode';

/**
 * - The second level menu for /mywatchlists.
 * - Consists of buttons to do add, list, rename and delete operations on chosen watchlist.
 * - Identifier wl_opts.
 */
function WLOptsMenu() {
  return new Menu<MyContext>('wl_opts')
    .text('Add anime', async (ctx1) => {
      await ctx1.conversation.enter('addWL');
    })
    .row()

    .submenu('List all anime', 'wl_allist', async (ctx1) => {
      if (ctx1.session.menudata === undefined) return;
      ctx1.session.menudata.listmethod = 'all';
      ctx1.session.menudata.l_page = 1;
      const wlname = await getWLName(ctx1);
      const listAllAnimeReply = fmt`Displaying all anime from watchlist: ${b}${wlname ?? ''}${b}`;
      await ctx1.editMessageText(listAllAnimeReply.text, {
        entities: listAllAnimeReply.entities,
      });
    })

    .submenu('List to-watch anime', 'wl_allist', async (ctx1) => {
      if (ctx1.session.menudata === undefined) return;
      ctx1.session.menudata.listmethod = 'towatch';
      ctx1.session.menudata.l_page = 1;
      const wlname = await getWLName(ctx1);
      const listToWatchAnimeReply = fmt`Displaying to-watch anime from watchlist: ${b}${wlname ?? ''}${b}`;
      await ctx1.editMessageText(listToWatchAnimeReply.text, {
        entities: listToWatchAnimeReply.entities,
      });
    })
    .row()

    .text('Rename watchlist', async (ctx1) => {
      await ctx1.conversation.enter('renameWL');
    })

    .submenu('Delete watchlist', 'wl_delete', async (ctx1) => {
      // await ctx1.conversation.enter("deleteWL");
      if (ctx1.session.menudata?.wlid === undefined) return;
      const itemlen = Number(
        (
          await db.$queryRaw<
            {
              len: bigint;
            }[]
          >`SELECT array_length(alid, 1) as len FROM watchlists WHERE watchlistid = ${ctx1.session.menudata.wlid}`
        )[0].len,
      );
      if (itemlen === 0)
        await ctx1.editMessageText(
          `Your watchlist is empty. Do you want to delete it?`,
        );
      else {
        const wlname = await getWLName(ctx1);
        const deleteConfirmMsg = fmt`You have ${itemlen} items in your watchlist ${code}${wlname ?? ''}${code}.\nDeleting will remove all the items as well.\n\nProceed?`;
        await ctx1.editMessageText(deleteConfirmMsg.text, {
          entities: deleteConfirmMsg.entities,
        });
      }
    })
    .row()

    .back('Go back', async (ctx) => {
      await ctx.editMessageText('Choose the watchlist from the menu below:');
      // noinspection AssignmentResultUsedJS
      if (ctx.session.menudata !== undefined) {
        (
          Object.keys(
            ctx.session.menudata,
          ) as (keyof typeof ctx.session.menudata)[]
        ).forEach((o) => (ctx.session.menudata![o] = undefined as any));
      }
    });
}

function stopWatching() {
  return new Menu<MyContext>('wl_stopwatch')
    .text('Yes.', async (ctx) => {
      if (
        ctx.session.menudata === undefined ||
        ctx.session.userid === undefined
      )
        return;
      const alid = ctx.session.menudata.alid;
      if (alid === undefined) return;
      const watching = (
        await db.watchinganime.findUniqueOrThrow({
          where: { userid: ctx.session.userid },
          select: { alid: true },
        })
      ).alid;
      watching.splice(
        watching.findIndex((o) => o === alid),
        1,
      );
      await db.watchinganime.update({
        where: { userid: ctx.session.userid },
        data: { alid: watching },
      });
      const yeet = await ctx.reply('Removed from watching.');
      if (ctx.chat?.id !== undefined)
        selfyeet(ctx.chat.id, yeet.message_id, 5000);

      const item = await db.anime.findUniqueOrThrow({
        where: { alid },
        select: { jpname: true, enname: true, imglink: true },
      });
      ctx.menu.back();
      const wlname = await getWLName(ctx);
      const yesChoiceEditMessage = item.imglink
        ? fmt`Chosen watchlist: ${b}${wlname ?? ''}${b}\n
Chosen anime: \n${b}${item.jpname}${b}\n${i}(${item.enname})${i}\n
What do you wanna do with it? ${a(item.imglink)}​${a}`
        : fmt`Chosen watchlist: ${b}${wlname ?? ''}${b}\n
Chosen anime: \n${b}${item.jpname}${b}\n${i}(${item.enname})${i}\n
What do you wanna do with it?`;
      await ctx.editMessageText(yesChoiceEditMessage.text, {
        entities: yesChoiceEditMessage.entities,
      });
    })
    .back('No.', async (ctx) => {
      if (ctx.session.menudata === undefined) return;
      const alid = ctx.session.menudata.alid;
      if (alid === undefined) return;
      const item = await db.anime.findUniqueOrThrow({
        where: { alid },
        select: { jpname: true, enname: true, imglink: true },
      });
      const wlname = await getWLName(ctx);
      const noChoiceEditMessage = item.imglink
        ? fmt`Chosen watchlist: ${b}${wlname ?? ''}${b}\n
Chosen anime: \n${b}${item.jpname}${b}\n${i}(${item.enname})${i}\n
What do you wanna do with it? ${a(item.imglink)}​${a}`
        : fmt`Chosen watchlist: ${b}${wlname ?? ''}${b}\n
Chosen anime: \n${b}${item.jpname}${b}\n${i}(${item.enname})${i}\n
What do you wanna do with it?`;
      await ctx.editMessageText(noChoiceEditMessage.text, {
        entities: noChoiceEditMessage.entities,
      });
    });
}

/**
 * - Foruth level menu for /mywatchlists.
 * - Has buttons to do operations on anime in watchlist such as remove and mark as watched.
 * - Identifier wl_alopts.
 */
function animeListOpts() {
  return new Menu<MyContext>('wl_alopts').dynamic(async (ctx) => {
    const range = new MenuRange<MyContext>();
    const temp = await getWlAlid(ctx, true, true);
    if (temp === 'back') {
      range.text('-Menu too old. Generate a new one.-');
      return range;
    }
    const wlid = temp?.wlid;
    const alid = temp?.alid;
    if (wlid === undefined || alid === undefined) {
      range.text('-Error: Missing IDs.-');
      return range;
    }
    const name = (
      await db.anime.findUniqueOrThrow({
        where: { alid },
        select: { jpname: true },
      })
    ).jpname;
    const is_watched = await db.completedanime.count({
      where: {
        userid: ctx.session.userid,
        completed: { has: alid },
      },
    });
    const is_watching = await db.watchinganime.count({
      where: {
        userid: ctx.session.userid,
        alid: { has: alid },
      },
    });
    if (is_watching === 0)
      range.text('Start watching', async (ctx1) => {
        await animeStartWatch(ctx1, true);
        try {
          ctx1.menu.update();
        } catch {
          console.log('unable to update menu after starting watch');
        }
      });
    else
      range.submenu('Stop watching', 'wl_stopwatch', async (ctx1) => {
        await ctx1.editMessageText(
          `You will lose all the progress in the anime. Proceed?`,
        );
      });
    if (is_watched === 0) {
      range.text('Mark as watched', async (ctx1) => {
        if (ctx.session.userid === undefined) return;
        await markDone(ctx.session.userid, alid);
        if (ctx.from?.id !== undefined) {
          selfyeet(
            ctx.from.id,
            (await ctx.reply(`${name} has been marked as completed.`))
              .message_id,
            5000,
          );
        }
        try {
          ctx1.menu.update();
        } catch {
          console.log(`unable to update menu after marking done`);
        }
      });
    } else {
      range.text('Mark as not watched', async (ctx1) => {
        if (ctx.session.userid === undefined) return;
        const result = await markNotDone(ctx.session.userid, alid);
        if (result === 'missing') {
          await ctx1.reply('Outdated menu.');
          ctx1.menu.update();
          return;
        }
        if (result === 1) {
          await ctx1.reply('Error occured :/');
          return;
        } else {
          const yeet = await ctx1.reply(
            `${name} has been marked as 'not watched'.`,
          );
          if (ctx1.chat?.id !== undefined)
            selfyeet(ctx1.chat.id, yeet.message_id, 10000);
          try {
            ctx1.menu.update();
          } catch {
            console.log(`unable to update menu after marking not done`);
          }
          return;
        }
      });
    }
    range.text(
      {
        text: 'Remove from watchlist',
        payload: `${wlid}_${alid}`,
      },
      async (ctx1) => {
        const temp = await getWlAlid(ctx, true, true);
        if (temp === 'back') {
          range.text('-Menu too old. Generate a new one.-');
          return range;
        }
        const wlid = temp?.wlid;
        const alid = temp?.alid;
        if (wlid === undefined || alid === undefined) {
          await ctx1.reply('Error: Missing IDs.');
          return;
        }
        const result = await removeFromWatchlist(wlid, alid);
        if (result === 'wlmissing') {
          await ctx1.reply('Watchlist missing?');
          return;
        } else if (result === 'alidmissing') {
          await ctx1.reply('Anime already not present in watchlist.');
          return;
        } else if (result === 1) {
          await ctx1.reply('Some error occured while performing deletion.');
          return;
        } else {
          ctx1.menu.back();
          const wlname = await getWLName(ctx1);
          const removeEditMessage = fmt`Displaying anime from watchlist: ${b}${wlname ?? ''}${b}`;
          await ctx1.editMessageText(removeEditMessage.text, {
            entities: removeEditMessage.entities,
          });
          const yeet = await ctx1.reply(`${name} removed from watchlist.`);
          if (ctx1.chat?.id !== undefined)
            selfyeet(ctx1.chat.id, yeet.message_id, 10000);
          if (ctx1.session.menudata !== undefined) {
            ctx1.session.menudata.l_page = 1;
            ctx1.session.menudata.maxpg = undefined;
          }
        }
      },
    );
    range.back('Go back', async (ctx1) => {
      if (ctx1.session.menudata !== undefined)
        ctx1.session.menudata.alid = undefined;
      const wlname = await getWLName(ctx1);
      const backEditMessage = fmt`Displaying anime from watchlist: ${b}${wlname ?? ''}${b}`;
      await ctx1.editMessageText(backEditMessage.text, {
        entities: backEditMessage.entities,
      });
    });
    return range;
  });
}

/**
 * Initialises menus and registers sub-menus.
 * Has command handler for /mywatchlists.
 */
export function initWLMenu() {
  const wl_main = WLMainMenu();
  wl_main.register(WLOptsMenu());
  wl_main.register(animeList(), 'wl_opts');
  wl_main.register(animeListOpts(), 'wl_allist');
  wl_main.register(deleteWL(), 'wl_opts');
  wl_main.register(stopWatching(), 'wl_alopts');
  bot.use(wl_main);
  bot.command('mywatchlists', async (ctx) => {
    if (ctx.session.menudata !== undefined) {
      (
        Object.keys(
          ctx.session.menudata,
        ) as (keyof typeof ctx.session.menudata)[]
      ).forEach((o) => {
        ctx.session.menudata![o] = undefined as any;
      });
      ctx.session.menudata.activemenuopt = (
        await ctx.reply('Choose the watchlist from the' + ' menu below:', {
          reply_markup: wl_main,
        })
      ).message_id;
    }
  });
}
