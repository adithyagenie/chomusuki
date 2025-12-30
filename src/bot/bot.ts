// telegram bot endpoint

import {
  type Conversation,
  type ConversationFlavor,
} from '@grammyjs/conversations';
import {
  Bot,
  Context,
  MemorySessionStorage,
  session,
  SessionFlavor,
} from 'grammy';
import { initWLMenu } from './helpers/watchlist/w_menu';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { redis } from '../index';
import { botcommands } from './handlers/commands';
import { middleware } from './handlers/middleware';
import {
  botErrorHandle,
  initConvos,
  setCommands,
} from './helpers/misc_handles';
import { limit } from '@grammyjs/ratelimiter';

interface SessionData {
  userid?: number;
  config?: { pause_airing_updates?: boolean };
  menudata?: {
    activemenuopt?: number;
    wlid?: number;
    wlname?: string;
    alid?: number;
    l_page?: number;
    maxpg?: number;
    listmethod?: 'all' | 'towatch';
  };
}

export type MyContext = ConversationFlavor<Context> &
  SessionFlavor<SessionData>;

export type MyConversationContext = Context;
export type MyConversation = Conversation<MyContext, MyConversationContext>;

export const bot = new Bot<MyContext>(`${process.env.BOT_TOKEN}`);

export function botinit() {
  //const throttler = apiThrottler();
  //bot.api.config.use(throttler);
  const storage = new RedisAdapter<SessionData>({
    instance: redis,
    ttl: 24 * 60 * 60,
  });
  bot.use(
    session({
      type: 'multi',
      userid: {
        storage: new MemorySessionStorage(60 * 60 * 1000),
        initial: () => undefined,
      },
      config: {
        storage: new MemorySessionStorage(60 * 60 * 1000),
        initial: () => ({ pause_airing_updates: undefined }),
      },
      menudata: {
        storage: storage,
        initial: () => ({
          activemenuopt: undefined,
          wlid: undefined,
          wlname: undefined,
          alid: undefined,
          l_page: undefined,
          maxpg: undefined,
          listmethod: undefined,
        }),
      },
    }),
  );
  bot.use(
    limit({
      timeFrame: 30000,
      limit: 20,
      storageClient: 'MEMORY_STORE',
      onLimitExceeded: async (ctx) => {
        await ctx.reply("Don't spam the bot!");
      },
      keyGenerator: (ctx) => {
        return ctx.from?.id.toString();
      },
    }),
  );
  bot.use(middleware());
  initConvos();
  initWLMenu();
  void setCommands(bot);
  botcommands();
  console.log('*********************');
  console.log('Cunnime has started!');
  console.log('*********************');
  if (process.env.RUN_METHOD === 'POLLING') {
    bot.catch((err) => botErrorHandle(err));
    void bot.start();
  }
}
