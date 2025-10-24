import { db } from "../../index";
import { MyContext, MyConversation, MyConversationContext } from "../bot";
import { NextFunction } from "grammy";
import { users, config, watchinganime, completedanime } from "../../database/schema";
import { eq, and } from "drizzle-orm";

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
    const msgid2 = (
        await ctx.reply(`Your username will be set as <code>${username}</code>!`)
    ).message_id;
    const res = await conversation.external(async () => {
        const result = await db.insert(users).values({
            chatid: BigInt(ctx.from.id),
            username: username
        }).returning();
        return result[0];
    });
    await conversation.external(async () => {
        await db.insert(config).values({
            userid: res.userid
        });
        await db.insert(watchinganime).values({
            userid: res.userid,
            alid: []
        });
        await db.insert(completedanime).values({
            userid: res.userid,
            completed: []
        });
    });
    await ctx.api.editMessageText(
        ctx.from.id,
        msgid2,
        `Your username has been set as <code>${username}</code>!\n\nUser created!`
    );
    // Set session via external access to outside context
    await conversation.external((outsideCtx) => {
        outsideCtx.session.userid = res.userid;
    });
    return;
}

export async function userMiddleware(ctx: MyContext, next: NextFunction) {
    const result = await db.select({ userid: users.userid })
        .from(users)
        .where(eq(users.chatid, BigInt(ctx.from.id)));
    
    if (result.length === 0) {
        if (ctx.hasCommand("register")) {
            await next();
        } else {
            await ctx.reply("New user? Register with /register.");
        }
    } else {
        console.log(`adding ${ctx.from.id} to mem cache.`);
        ctx.session.userid = result[0].userid;
        await next();
    }
}

export async function deleteUser(conversation: MyConversation, ctx: MyConversationContext) {
    await ctx.reply(
        `Deleting your account will remove all your data from this data. <b>This cannot be reversed.</b>\n
If you are absolutely sure you want to delete - Please type in <code>Yes, I'm sure.</code>\n
or cancel by typing <code>cancel</code>.`
    );
    while (1) {
        const msg = await conversation.waitFrom(ctx.from.id);
        if (msg.message?.text === "cancel") {
            await ctx.reply("Cancelling deletion...");
            return;
        } else if (msg.message?.text === "Yes, I'm sure.") {
            const userid = await conversation.external((ctx) => ctx.session.userid);
            const res = await conversation.external(async () => {
                const result = await db.delete(users)
                    .where(and(
                        eq(users.userid, userid),
                        eq(users.chatid, BigInt(ctx.from.id))
                    ))
                    .returning();
                return result[0];
            });
            await ctx.reply(
                `Account has been deleted! <code>${res.username}</code> is now dead...\n(っ˘̩╭╮˘̩)っ`
            );
            await conversation.external((ctx) => {
                ctx.session.userid = undefined;
            });
            return;
        }
    }
}
