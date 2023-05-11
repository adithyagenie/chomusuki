import { db } from "..";
import { MyContext, MyConversation } from "./bot";

export async function newUser(conversation: MyConversation, ctx: MyContext) {
	const msgid = await ctx.reply("What do you want your username to be?", {
		reply_markup: { force_reply: true }
	});
	const username = (await conversation.waitForReplyTo(msgid.message_id)).message?.text;
	const msgid2 = (
		await ctx.reply(`Your username will be set as <code>${username}</code>!`, {
			parse_mode: "HTML"
		})
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
		await db.airingupdates.create({
			data: { userid: res.userid, alid: [] }
		});
	});
	await ctx.api.editMessageText(
		ctx.from.id,
		msgid2,
		`Your username has been set as <code>${username}</code>!\n\nUser created!`,
		{
			parse_mode: "HTML"
		}
	);
	conversation.session.userid = res.userid;
	return;
}

export async function deleteUser(conversation: MyConversation, ctx: MyContext) {
	await ctx.reply(
		`Deleting your account will remove all your data from this data. <b>This cannot be reversed.</b>\n
If you are absolutely sure you want to delete - Please type in <code>Yes, I'm sure.</code>\n
or cancel by typing <code>cancel</code>.`,
		{ parse_mode: "HTML" }
	);
	while (1) {
		const msg = await conversation.waitFrom(ctx.from.id);
		if (msg.message?.text === "cancel") {
			await ctx.reply("Cancelling deletion...");
			return;
		} else if (msg.message?.text === "Yes, I'm sure.") {
			const res = await conversation.external(() =>
				db.users.delete({
					where: {
						userid_chatid: { userid: ctx.session.userid, chatid: ctx.from.id }
					}
				})
			);
			await ctx.reply(
				`Account has been deleted! <code>${res.username}</code> is now dead...\n(っ˘̩╭╮˘̩)っ`,
				{ parse_mode: "HTML" }
			);
			conversation.session.userid = undefined;
			conversation.session.config = undefined;
			return;
		}
	}
}
