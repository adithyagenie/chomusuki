// telegram bot endpoint

import { config } from "dotenv";
import { Bot, BotError, Context, GrammyError, HttpError, InlineKeyboard, Keyboard } from "grammy";
import { type InlineKeyboardButton } from "@grammyjs/types";
import { CheckUpdates, ResObj } from "../api/UpdRelease"
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { SPSearch } from "../api/subsplease-xdcc";
import { MongoClient } from "mongodb";
import { getMalId } from "../api/mal_api";
import {
    type Conversation,
    type ConversationFlavor,
    conversations,
    createConversation,
  } from "@grammyjs/conversations";
  
import { session } from "grammy";
import { addAnimeNames, AnimeNames, markWatchedunWatched, delanime } from "../database/db_connect";
import { messageToHTMLMessage } from "./caption_entity_handler";
  
export class UpdateHold {
    updateobj: ResObj[];
    client: MongoClient;
    constructor(client: MongoClient) {    
        this.updateobj = []
        this.client = client
    }
    async updater () {
        try {
            this.updateobj = await CheckUpdates(this.client)
        } catch (error) {
            console.error(error)
        }
        return this.updateobj
    }
}

export async function botinit(updater:UpdateHold, authchat:number) {
    config()
    //bot.api.setMyCommands([
    //    { command: "start", description: "Start the bot" },
    //    { command: "help", description: "Show help text" },
    //    { command: "settings", description: "Open settings" },
    //  ]);
    type MyContext = Context & ConversationFlavor;
    const bot = new Bot<MyContext>(process.env.BOT_TOKEN);
    const throttler = apiThrottler();
    bot.api.config.use(throttler);
    bot.use(session({ initial: () => ({}) }));
    bot.use(conversations());
    bot.catch((err) => {
        const ctx = err.ctx;
        console.error(`Error while handling update ${ctx.update.update_id}:`);
        const e = err.error;
        if (e instanceof GrammyError) {
          console.error("Error in request:", e.description);
        } else if (e instanceof HttpError) {
          console.error("Could not contact Telegram:", e);
        } else if (e instanceof BotError){
            console.error("Bot error: ", e.error, "caused by", e.cause)
        }
        else {
          console.error("Unknown error:", e);
        }
      });
    botcommands(bot, updater, authchat)
    bot.start();
    console.log("*********************")
    console.log("Cunnime has started!")
    console.log("*********************")
    return bot
}

function botcommands(bot:Bot<Context & ConversationFlavor>, updater:UpdateHold, authchat:number) {
    bot.use(createConversation(animeadd));
    bot.use(createConversation(delanimehelper));
    bot.use(createConversation(unwatchhelper));
    type MyContext = Context & ConversationFlavor;
    type MyConversation = Conversation<MyContext>;
    
    // Start command
    bot.command("start", (ctx) => ctx.reply("Sup ni-", {reply_markup: {remove_keyboard: true}}));
    
    // Help command
    bot.command("help", (ctx) => {
        ctx.reply("Help me onii-chan I'm stuck~")
    })
    
    // Synces anime
    bot.command("async", async (ctx) => {
        await syncresponser(bot, authchat, updater, ctx)
    })
    
    // Add anime command
    bot.command("aadd", async (ctx) => {
        await ctx.conversation.enter("animeadd");
    })
    
    async function animeadd(conversation: MyConversation, ctx: MyContext) {
        let responseobj:AnimeNames;
        await ctx.reply("Please provide data required. Type /cancel at any point to cancel adding.", {reply_markup: {remove_keyboard: true}})
        await ctx.reply("What is the exact Japanese name of the anime? (Refer MAL for name)")
        const jpanimename = await conversation.form.text();
        await ctx.reply("What is the exact English name of the anime? (Refer MAL for name)")
        const enanimename = await conversation.form.text();
        await ctx.reply("Any other optional names you would like to provide? (seperated by commas, NIL for nothing)")
        const optnameres = await conversation.form.text();
        let optnames:string[], excnames:string[];
        if (optnameres != "NIL") {        
            optnames = optnameres.split(',')
            optnames = optnames.map((x:string) => x.trim())
        }
        await ctx.reply("Any similarly named terms which would interfere with search results? (seperated by commas, NIL for nothing)")
        const excnameres = await conversation.form.text()
        if (excnameres != "NIL") {
            excnames = excnameres.split(',')
            excnames = excnames.map((x:string) => x.trim())   
        }
        let malid = await getMalId(jpanimename).catch((err) => console.error("Couldnt get MAL ID."+err))
        if (malid === undefined) {
            await ctx.reply("MyAnimeList ID for the anime?")
            malid = await conversation.form.text();
        }
        responseobj = {
            EnName: enanimename,
            JpName: jpanimename,
            OptionalNames: optnames === undefined ? [] : optnames,
            ExcludeNames: excnames === undefined ? [] : excnames,
            MalId: malid
        }
        await addAnimeNames(updater.client, responseobj)
        await ctx.reply("Anime has been added!")
        return;
    }
    
    // Handles cancel calls
    bot.command("cancel", async (ctx) => {
        await ctx.conversation.exit();
        await ctx.reply("Cancelling operation...", {reply_markup: {remove_keyboard: true}});
      });
      
    // Removing anime
    bot.command("aremove", async (ctx) => {
        await ctx.conversation.enter("delanimehelper");
    })
    
    async function delanimehelper(conversation: MyConversation, ctx:MyContext) {
        let updateobj = updater.updateobj;
        let keyboard = new Keyboard();
        let animelist = [];
        for (let i = 0; i < updateobj.length; i ++) {
            animelist.push(updateobj[i].anime)
            keyboard.text(`Delete: ${updateobj[i].anime}`).row()     
        }
        
        keyboard.resized().persistent().oneTime();
        await ctx.reply("Which one to remove? (/cancel to cancel)", {reply_markup:keyboard})
        const todel = ((await conversation.waitForHears(/Delete: (.+)/)).message.text).slice(8).trim();
        if (!animelist.includes(todel)) {
            ctx.reply("mathafucka")
            return
        }
        let newkeyboard = new Keyboard().text("Yes, I'm sure.").text("No, cancel it.").row().resized().persistent().oneTime();
        await ctx.reply(`Removing ${todel}... Are you sure?`, {reply_markup: newkeyboard})
        const confirmation = await conversation.waitForHears(/(Yes, I'm sure\.)|(No, cancel it\.)/);
        if (confirmation.message.text == "Yes, I'm sure.") {
            await ctx.reply(`Deleted ${todel}`, {reply_markup:{remove_keyboard: true}});
            console.log(`Delete request for ${todel} received!`)
            delanime(updater.client, todel)
            for (let i = 0; i < updater.updateobj.length; i ++) {
                if (updater.updateobj[i].anime == todel) updater.updateobj.splice(i, 1);
                break
            }
            return
        }
        else if (confirmation.message.text == "No, cancel it.") {
            await ctx.reply(`Aight cancelled removal.`, {reply_markup:{remove_keyboard: true}})
            return
        }
    }
    
    // Unwatch anime command
    bot.command("aunwatch", async (ctx) => {
        await ctx.conversation.enter("unwatchhelper");
    })
    
    async function unwatchhelper(conversation:MyConversation, ctx:MyContext) {
        let updateobj = updater.updateobj;
        let keyboard = new Keyboard().resized().persistent().oneTime();
        let animelist = [];
        for (let i = 0; i < updateobj.length; i ++) {
            animelist.push(updateobj[i].anime)
            keyboard.text(`Anime: ${updateobj[i].anime}`).row()
        }
        await ctx.reply("Select the anime: (/cancel to cancel)", {reply_markup:keyboard})
        const animename = ((await conversation.waitForHears(/Anime: (.+)/)).message.text).slice(7).trim();
        let eplist:number[] = []
        let animeindex = 0;
        for (let i = 0; i < updateobj.length; i ++) {
            if (updateobj[i].anime === animename) {
                for (let j = 0; j < updateobj[i].watched.length; j ++){
                    eplist.push(updateobj[i].watched[j].epnum)
                }
                animeindex = i;
                break;
            }
        }
        while (true) {
            let newkey = new Keyboard().persistent().resized();
            for (let i = 0; i < eplist.length; i ++)
                newkey.text(`Unwatch episode: ${eplist[i]}`);
            newkey.text("Finish marking")
            await ctx.reply("Choose the episode: ", {reply_markup: newkey})
            const buttonpress = (await conversation.waitForHears(/(^Unwatch episode: ([0-9]+)$)|(^Finish marking$)/)).message.text
            if (buttonpress == "Finish marking") {
                await ctx.reply("Alright finishing up!")
                break
            }
            const tounwatch = parseInt(buttonpress.slice(17).trim());
            console.log(`Recieved request for unwatch: \nANIME: ${animename}, EP: ${tounwatch}`)
            let watchedAnime:{epnum: number, epname:string}[] = [];
            watchedAnime = updateobj[animeindex].watched;
            watchedAnime = watchedAnime.filter(({epnum, epname}) => epnum != tounwatch);
            const toupdate = {name: animename, watched:watchedAnime}
            const updres = await markWatchedunWatched(updater.client, toupdate)
            if (updres == true) {
                await ctx.reply(`Marked Ep ${tounwatch} of ${animename} as not watched`, {reply_markup: {remove_keyboard: true}})
                updater.updateobj[animeindex].watched = watchedAnime;
            }
            else {
                await ctx.reply(`Error occured while marking episode as unwatched`, {reply_markup: {remove_keyboard: true}})
            }
        }
        return
    }
    
    // Makes keyboard for download and mark watched
    function makeEpKeyboard(ctx:Context, callback_data_string:string) {
        let updateobj = updater.updateobj
        let animename = ctx.callbackQuery.message.caption.split("Anime: ")[1].split("Episodes:")[0].trim()
        let eplist = []
        for (let i = 0; i < updateobj.length; i ++) {
            if (updateobj[i].anime === animename) {
                for (let j = 0; j < updateobj[i].notwatched.length; j ++){
                    eplist.push(updateobj[i].notwatched[j].epnum)
                }
                break
            }
        }
        let keyboard = new InlineKeyboard()
        for (let i = 0; i < eplist.length; i += 2){
            let bruh:InlineKeyboardButton.CallbackButton = {text: `Episode ${eplist[i]}`, callback_data:`${callback_data_string}_${eplist[i]}`}
            let bruh2:InlineKeyboardButton.CallbackButton = {text: `Episode ${eplist[i+1]}`, callback_data:`${callback_data_string}_${eplist[i+1]}`}
            if (eplist[i + 1] === undefined) keyboard.add(bruh).row(); 
            else keyboard.add(bruh).add(bruh2).row();
        }
        keyboard.text("Go back", "back");
        return keyboard
    }
    
    // Handles download Callback query
    bot.callbackQuery(/download/, async (ctx) => {
        // use the class here
        const keyboard = makeEpKeyboard(ctx, "dlep")
        ctx.editMessageReplyMarkup({reply_markup:keyboard})
        ctx.answerCallbackQuery()
    })

    // also a download callback handle
    bot.callbackQuery(/dlep_.*/,async (ctx) => {
        let oldmsg = ctx.callbackQuery.message.caption
        let epnum = ctx.callbackQuery.data.split("_")[1]
        let updateobj = updater.updateobj
        let animename = oldmsg.split("Anime: ")[1].split("Episodes:")[0].trim()
        let links:SPSearch;
        let torrentlinks:string;
        for (let i = 0; i < updateobj.length; i ++) {
            if (updateobj[i].anime === animename) {
                for (let j = 0; j < updateobj[i].notwatched.length; j ++){
                    if (updateobj[i].xdcclink.length > 0) {
                        if (updateobj[i].notwatched[j].epnum == parseInt(epnum))
                            links = (updateobj[i].xdcclink[j])
                    }
                    else {
                        if (updateobj[i].notwatched[j].epnum == parseInt(epnum))
                            torrentlinks = (updateobj[i].torrentlink[j])
                    }
                }
                break
            }
        }
        if (links === undefined)
            console.log("torrentdl triggered", torrentlinks)
            //starttorrentdl(torrclient, torrentlinks)
        else
            console.log("startdl triggered", links.botname, links.packnum)
            //startdl(xdccJS, links.botname, links.packnum.toFixed())
        
        ctx.answerCallbackQuery("Bruh")
    })
    
    // A markwatch handle
    bot.callbackQuery(/mark_watch/,async (ctx) => {
        const keyboard = makeEpKeyboard(ctx, "mkwtch")
        //bot.api.sendMessage(ctx.chat.id, "Which episode to download?", {reply_markup: downloadbutton})
        ctx.editMessageReplyMarkup({reply_markup:keyboard})
        ctx.answerCallbackQuery()
    })
    
    // Also a Mark watch callback handle
    bot.callbackQuery(/mkwtch_.*/,async (ctx) => {
        let epnum = parseInt(ctx.callbackQuery.data.split("_")[1])
        let updateobj = updater.updateobj
        let oldmsg = ctx.callbackQuery.message.caption
        let animename = oldmsg.split("Anime: ")[1].split("Episodes:")[0].trim();
        let oldwatch:{epnum:number, epname:string}[] = [];
        let indexnum:number;
        let toupdateanime:{epnum:number, epname:string};
        for (let i = 0; i < updateobj.length; i ++) {
            if (updateobj[i].anime == animename) {
                for (let j = 0; j < updateobj[i].watched.length; j ++)
                    oldwatch.push(updateobj[i].watched[j])
                for (let j = 0; j < updateobj[i].notwatched.length; j ++) {
                    if (updateobj[i].notwatched[j].epnum == epnum)
                        toupdateanime = updateobj[i].notwatched[j]
                }
                indexnum = i;
                break
            }
        }        
        oldwatch.push(toupdateanime)
        
        var index = updater.updateobj[indexnum].notwatched.indexOf(toupdateanime);
        if (index !== -1) {
            updater.updateobj[indexnum].notwatched.splice(index, 1);
        }
        updater.updateobj[indexnum].watched.push(toupdateanime)
        oldwatch.sort((a, b) => (a.epnum > b.epnum) ? 1: -1);
        const updres = await markWatchedunWatched(updater.client, {name: animename, watched:oldwatch})
        if (updres == true) {
            const newkeyboard = makeEpKeyboard(ctx, "mkwtch");
            const oldformatmsg = messageToHTMLMessage(ctx.callbackQuery.message.caption, ctx.callbackQuery.message.caption_entities)
            var newMsgArray = oldformatmsg.split('\n');
            for (let j = 0; j < newMsgArray.length; j ++) {
                if (newMsgArray[j].startsWith(`Episode ${epnum}:`)) {
                    newMsgArray.splice(j, 1); break;
                }
            }
            const newmsg = newMsgArray.join("\n");
            bot.api.editMessageCaption(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id, {caption:newmsg, parse_mode: "HTML", reply_markup: newkeyboard})
            ctx.answerCallbackQuery(`Marked ${epnum} as watched!`)
        }
        else {
            await ctx.reply(`Error occured while marking episode as watched.`)
            ctx.answerCallbackQuery(`Error occured.`)
        }
    })
    
    // Going back in a menu
    bot.callbackQuery(/back/, async (ctx) => {
        let backmenu = new InlineKeyboard()
        .text("Mark watched", "mark_watch")
        .text("Download", "download");
        ctx.editMessageReplyMarkup({reply_markup: backmenu})
        ctx.answerCallbackQuery()
    })
    
}

// Helps in syncing anime, called by /async and by outer functions when needed.
export async function syncresponser(bot:Bot, authchat:number, updater:UpdateHold, ctx = undefined) {
    let chatid = 0
    if (ctx === undefined) 
        chatid = authchat
    else 
        chatid = ctx.message.chat.id
    let msgid = (await bot.api.sendMessage(chatid, "Syncing anime...", {reply_markup: {remove_keyboard: true}})).message_id  
    bot.api.sendChatAction(chatid, "typing")
    let updateobj:ResObj[] = await updater.updater()
    bot.api.deleteMessage(chatid, msgid)        
    let count = 0;
    for (let i = 0; i < updateobj.length; i ++) {
        if (updateobj[i].notwatched.length > 0)
            count += 1
    }
    if (count == 0)
        bot.api.sendMessage(chatid, "No new episodes have been released!")
    else {
        bot.api.sendMessage(chatid, "New episodes have been released!")
        for (let i = 0; i < updateobj.length; i ++) {
            if (updateobj[i].notwatched.length == 0)
                continue
            let msg = ""
            let imagelink = updateobj[i]["imagelink"]
            msg += `<b><u>Anime:</u></b> ${updateobj[i]["anime"]}\n\n`
            msg += `<b><u>Episodes:</u></b>\n`
            for (let j = 0; j < updateobj[i]["links"].length; j ++) {
                msg += `Episode ${updateobj[i]["notwatched"][j]["epnum"]}: `
                msg += `<a href = "${updateobj[i]["links"][j]}">${updateobj[i]["notwatched"][j]["epname"]}</a>\n`
            }
            let replykeyboard = new InlineKeyboard().text("Mark watched", "mark_watch").text("Download", "download");
            bot.api.sendPhoto(chatid, imagelink, {caption:msg, parse_mode:"HTML", reply_markup:replykeyboard})
        }
    }
}

module.exports = { UpdateHold, botinit, syncresponser }
