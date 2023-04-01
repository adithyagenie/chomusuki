import type { MessageEntity } from 'grammy/out/types.node';

export const messageToHTMLMessage = (text: string, entities:MessageEntity[]) => {

	if (!entities || !text) {
		return text;
	}

	let tags: { index: number; tag: string | undefined }[] = [];

	entities.forEach((entity) => {
		const startTag = getTag(entity, text);
		let searchTag = tags.filter((tag) => tag.index === entity.offset);
		if (searchTag.length > 0 && startTag) searchTag[0].tag += startTag;
		else
			tags.push({
				index: entity.offset,
				tag: startTag
			});

		const closeTag = startTag?.indexOf('<a ') === 0 ? '</a>' : '</' + startTag?.slice(1);
		searchTag = tags.filter((tag) => tag.index === entity.offset + entity.length);
		if (searchTag.length > 0) searchTag[0].tag = closeTag + searchTag[0].tag;
		else
			tags.push({
				index: entity.offset + entity.length,
				tag: closeTag
			});
	});
	let html = '';
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
		case 'bold':
			return `<b>`;
		case 'text_link':
			return `<a href="${entity.url}">`;
		case 'url':
			return `<a href="${entityText}">`;
		case 'italic':
			return `<i>`;
		case 'strikethrough':
			return `<s>`;
		case 'underline':
			return `<u>`;
	}
};
