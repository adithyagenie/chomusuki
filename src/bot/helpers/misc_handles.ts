import { Bot, BotError, HttpError, InlineKeyboard, InputFile } from 'grammy';
import { bot, MyContext } from '../bot';
import { createReadStream } from 'fs-extra';
import { conversations, createConversation } from '@grammyjs/conversations';
import { deleteUser, newUser } from './user_mgmt';
import { markWatchedRange, unwatchhelper } from './anime/a_watch_unwatch_ep';
import { stopWatching } from './anime/a_watching';
import { addWL } from './watchlist/w_addanime';
import { createWL, renameWL } from './watchlist/w_wlmgmt';
import { redis } from '../../index';

// going back in a menu
export async function back_handle(ctx: MyContext) {
  const backmenu = new InlineKeyboard()
    .text('Mark watched', 'mark_watch')
    .text('Download', 'download');
  await ctx.editMessageReplyMarkup({ reply_markup: backmenu });
  await ctx.answerCallbackQuery();
}

// Handles cancel calls
export async function cancel_handle(ctx: MyContext) {
  const active = ctx.conversation.active();
  if (Object.keys(active).length === 0) {
    await ctx.reply('No running operations.');
    return;
  }
  console.log(`Terminating convo ${JSON.stringify(active)} for ${ctx.from.id}`);
  await ctx.conversation.exitAll();
  await ctx.reply('Cancelling operation...', {
    reply_markup: { remove_keyboard: true },
  });
}

// sends log file
export async function log_command(ctx: MyContext) {
  if (ctx.from.id != parseInt(process.env.AUTHORISED_CHAT)) {
    await ctx.reply('Logs available for admin only! (｡•́︿•̀｡)');
    return;
  }
  const logfile = new InputFile(createReadStream('./log.txt'), 'log.txt');
  await ctx.replyWithDocument(logfile);
}

export function initConvos() {
  bot.use(conversations());
  bot.use(createConversation(unwatchhelper));
  bot.use(createConversation(newUser));
  bot.use(createConversation(deleteUser));
  bot.use(createConversation(stopWatching));
  bot.use(createConversation(markWatchedRange));
  bot.use(createConversation(createWL));
  // bot.use(createConversation(deleteWLold));
  bot.use(createConversation(addWL));
  bot.use(createConversation(renameWL));
}

export function setCommands(bot: Bot<MyContext>) {
  void bot.api.setMyCommands([
    { command: 'start', description: 'Heyo!' },
    { command: 'help', description: 'Help menu.' },
    { command: 'register', description: 'Create a new user!' },
    {
      command: 'startwatching',
      description:
        "Start watching an anime! Use /startwatching 'search query'.",
    },
    {
      command: 'remindme',
      description:
        "Subscribe to updates of an anime! Use /remindme 'search query'.",
    },
    {
      command: 'watching',
      description: 'Get a list of all the anime you are currently watching.',
    },
    {
      command: 'airingupdates',
      description:
        'Get a list of all the anime you have subscribed for updates.',
    },
    {
      command: 'markwatched',
      description: 'Mark a range of episodes of anime as watched.',
    },
    {
      command: 'unwatch',
      description: 'Un-mark an episode of an anime as watched.',
    },
    //{command: "config", description: "Don't worry abt this for now..."}
    { command: 'mywatchlists', description: 'Handle your watchlists.' },
    { command: 'createwl', description: 'Create a watchlist.' },
    {
      command: 'dllist',
      description: 'Get your queued downloads. Under development.',
    },
    {
      command: 'cancel',
      description: 'Cancel any currently going operations.',
    },
    { command: 'deleteaccount', description: 'Delete your account.' },
  ]);
  return;
}

export function selfyeet(chatid: number, mid: number, time: number) {
  setTimeout(async () => {
    try {
      await bot.api.deleteMessage(chatid, mid);
    } catch (e) {
      return;
    }
  }, time);
}

export async function botErrorHandle(err: BotError<MyContext>) {
  if (err.error instanceof TypeError && err.stack.includes('_replayApi')) {
    console.error(
      `Encountered error: ${err.error} at context \n${JSON.stringify(err.ctx.msg)}\nStack trace: ${err.stack}`,
    );
    console.log(
      `Found conversation error. Deleting conversation session data for ${err.ctx.chat.id}`,
    );
    await err.ctx.conversation.exitAll();
    await err.ctx.reply(
      'Error occured and the current operation has been cancelled.' +
        ' Please retry.',
    );
    return;
  }
  console.error(
    `Encountered error: ${err.error} at context \n${JSON.stringify(err.ctx.msg)}\nStack trace: ${err.stack}`,
  );
  if (!(err.error instanceof HttpError))
    await err.ctx.reply('Internal error occured :/');
}
