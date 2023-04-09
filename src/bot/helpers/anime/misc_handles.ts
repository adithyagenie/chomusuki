import { InlineKeyboard, InputFile } from "grammy";
import { MyContext, authchatEval } from "../../bot";
import { authchat } from "../../..";
import { createReadStream } from "fs-extra";

// going back in a menu
export async function back_handle(ctx: MyContext) {
	let backmenu = new InlineKeyboard()
		.text("Mark watched", "mark_watch")
		.text("Download", "download");
	ctx.editMessageReplyMarkup({ reply_markup: backmenu });
	ctx.answerCallbackQuery();
}

// Handles cancel calls
export async function cancel_handle(ctx: MyContext) {
	if (ctx.chat.id != authchat) {
		await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
		return;
	}
	await ctx.conversation.exit();
	await ctx.reply("Cancelling operation...", {
		reply_markup: { remove_keyboard: true },
	});
}

// sends log file
export async function log_command(ctx: MyContext) {
    if (!authchatEval) return;
    const logfile = new InputFile(
        createReadStream("./debug.log"),
        "log.txt"
    );
    ctx.replyWithDocument(logfile);
}
