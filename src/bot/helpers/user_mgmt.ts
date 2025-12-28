import { b, code, fmt } from "@grammyjs/parse-mode";
import { db } from "../../index";
import { MyContext, MyConversation, MyConversationContext } from "../bot";
import { NextFunction } from "grammy";

export async function registerUser(ctx: MyContext) {
    if (ctx.session.userid !== undefined) {
        await ctx.reply("You have already created an account!");
        return;
    }
    await ctx.conversation.enter("newUser");
}

export async function newUser(conversation: MyConversation, ctx: MyConversationContext) {
    const msgid = await ctx.reply("What do you want your username to be?", {
        reply_markup: { force_reply: true }
    });
    const username = (await conversation.waitForReplyTo(msgid.message_id)).message?.text;
  const usernameSetReplyMsg = fmt`Your username will be set as ${code}${username}${code}!`;
  const msgid2 = (
      await ctx.reply(usernameSetReplyMsg.text, { entities: usernameSetReplyMsg.entities })
    ).message_id;
    const res = await conversation.external(() =>
        db.users.create({
            data: { chatid: ctx.from.id, userid: undefined, username: username }
        })
    );
    await conversation.external(async () => {
        await db.config.create({
            data: { userid: res.userid }
        });
        await db.watchinganime.create({
            data: { userid: res.userid, alid: [] }
        });
        await db.completedanime.create({
            data: { userid: res.userid, completed: [] }
        });
    });
  const userCreatedReplyMsg = fmt`Your username has been set as ${code}${username}${code}!\n\nUser created!`;
    await ctx.api.editMessageText(
        ctx.from.id,
        msgid2,
        userCreatedReplyMsg.text,
        { entities: userCreatedReplyMsg.entities }
    );
    conversation.external((ctx2) => ctx2.session.userid = res.userid);
    return;
}

export async function userMiddleware(ctx: MyContext, next: NextFunction) {
    const userid = await db.users.findUnique({
        where: { chatid: ctx.from.id },
        select: { userid: true }
    });
    if (userid === null) {
        if (ctx.hasCommand("register")) {
            await next();
        } else {
            await ctx.reply("New user? Register with /register.");
        }
    } else {
        console.log(`adding ${ctx.from.id} to mem cache.`);
        ctx.session.userid = userid.userid;
        await next();
    }
}

export async function deleteUser(conversation: MyConversation, ctx: MyConversationContext) {
  const replyString = fmt`Deleting your account will remove all your data from this data. ${b}This cannot be reversed.${b}\n
If you are absolutely sure you want to delete - Please type in ${code}Yes, I'm sure.${code}\n
or cancel by typing ${code}cancel${code}.`
  await ctx.reply(replyString.text, { entities: replyString.entities });
    while (1) {
        const msg = await conversation.waitFrom(ctx.from.id);
        if (msg.message?.text === "cancel") {
            await ctx.reply("Cancelling deletion...");
            return;
        } else if (msg.message?.text === "Yes, I'm sure.") {
            const res = await conversation.external((ctx2) => {
                const userid = ctx2.session.userid;
                const res = db.users.delete({
                    where: {
                        userid_chatid: { userid: userid, chatid: ctx.from.id }
                    }
                });
                return res;
            });
          const deleteReplyMsg = fmt`Account has been deleted! ${code}${res.username}${code} is now dead...\n(っ˘̩╭╮˘̩)っ`;
          await ctx.reply(deleteReplyMsg.text, { entities: deleteReplyMsg.entities });
            conversation.external((ctx2) => ctx2.session = undefined);
            return;
        }
    }
}
