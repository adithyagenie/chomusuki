import { InlineKeyboardButton, MessageEntity } from "@grammyjs/types";
import { InlineKeyboard } from "grammy";
import { i_ProcessedObjV2 } from "../../../interfaces";
import { authchat } from "../../..";
import { MyContext } from "../../bot";
import { getSinglePending } from "../../../api/pending";

// Makes keyboard for download and mark watched
export async function makeEpKeyboard(
	caption: string,
	callback_data_string: string,
	userid: number
) {
	caption = caption.split("Anime: ")[1].split("\n")[0].trim();
	var updateobj = await getSinglePending(userid, caption);
	if (updateobj == undefined) return undefined;
	let keyboard = new InlineKeyboard();
	for (
		let i = 0;
		i < (updateobj.notwatched.length > 30 ? 30 : updateobj.notwatched.length);
		i += 2
	) {
		let bruh: InlineKeyboardButton.CallbackButton = {
			text: `Episode ${updateobj.notwatched[i]}`,
			callback_data: `${callback_data_string}_${updateobj.notwatched[i]}`
		};
		let bruh2: InlineKeyboardButton.CallbackButton = {
			text: `Episode ${updateobj.notwatched[i + 1]}`,
			callback_data: `${callback_data_string}_${updateobj.notwatched[i + 1]}`
		};
		if (updateobj.notwatched[i + 1] === undefined) keyboard.add(bruh).row();
		else keyboard.add(bruh).add(bruh2).row();
	}
	keyboard.text("Go back", "back");
	return keyboard;
}

export const authchatEval = (ctx: MyContext) => {
	if (ctx.from.id != authchat) {
		ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
		return false;
	}
	return true;
};

export const getUpdaterAnimeIndex = async (name: string, pending: i_ProcessedObjV2[]) =>
	pending.map((object) => object.jpname).indexOf(name);

export function getPagination(current: number, maxpage: number, text: string) {
	var keys: InlineKeyboardButton[] = [];
	if (current > 1) keys.push({ text: `«1`, callback_data: `${text}_1` });
	if (current > 2)
		keys.push({
			text: `‹${current - 1}`,
			callback_data: `${text}_${(current - 1).toString()}`
		});
	keys.push({
		text: `-${current}-`,
		callback_data: `${text}_${current.toString()}_current`
	});
	if (current < maxpage - 1)
		keys.push({
			text: `${current + 1}›`,
			callback_data: `${text}_${(current + 1).toString()}`
		});
	if (current < maxpage)
		keys.push({
			text: `${maxpage}»`,
			callback_data: `${text}_${maxpage.toString()}`
		});

	return new InlineKeyboard().add(...keys);
}
export const messageToHTMLMessage = (text: string, entities: MessageEntity[]) => {
	if (!entities || !text) {
		return text;
	}
	let tags: { index: number; tag: string | undefined }[] = [];
	entities.forEach((entity) => {
		const startTag = getTag(entity, text);
		if (startTag == undefined) return;
		let searchTag = tags.filter((tag) => tag.index === entity.offset);
		if (searchTag.length > 0 && startTag) searchTag[0].tag += startTag;
		else
			tags.push({
				index: entity.offset,
				tag: startTag
			});
		const closeTag = startTag?.indexOf("<a ") === 0 ? "</a>" : "</" + startTag?.slice(1);
		searchTag = tags.filter((tag) => tag.index === entity.offset + entity.length);
		if (searchTag.length > 0) searchTag[0].tag = closeTag + searchTag[0].tag;
		else
			tags.push({
				index: entity.offset + entity.length,
				tag: closeTag
			});
	});
	let html = "";
	for (let i = 0; i < text.length; i++) {
		const tag = tags.filter((tag) => tag.index === i);
		tags = tags.filter((tag) => tag.index !== i);
		if (tag.length > 0) html += tag[0].tag;
		html += text[i];
	}
	if (tags.length > 0) html += tags[0].tag;
	return html;
};
const getTag = (entity: MessageEntity, text: string) => {
	const entityText = text.slice(entity.offset, entity.offset + entity.length);
	switch (entity.type) {
		case "bold":
			return `<b>`;
		case "text_link":
			return `<a href="${entity.url}">`;
		case "url":
			return `<a href="${entityText}">`;
		case "italic":
			return `<i>`;
		case "strikethrough":
			return `<s>`;
		case "underline":
			return `<u>`;
	}
};

export function HTMLMessageToMessage(msg: string) {
	return msg
		.replace(/<\/?i>/gi, ``)
		.replace(/<\/?b>/gi, ``)
		.replace(/<\/?u>/gi, ``);
}
