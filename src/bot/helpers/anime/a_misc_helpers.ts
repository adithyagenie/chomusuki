import { i_ProcessedObjV2 } from '../../../interfaces';
import { InlineKeyboard } from 'grammy';
import { getSinglePending } from '../../../api/pending';

// Makes keyboard for download and mark watched
export async function makeEpKeyboard(
  caption: string,
  callback_data_string: string,
  userid: number,
) {
  const aniname = caption.split('Anime: ')[1].split('\n')[0].trim();
  if (aniname == undefined) throw new Error('Unable to make keyboard.');
  const updateobj = await getSinglePending(userid, aniname);
  if (updateobj == undefined) return undefined;
  const keyboard = new InlineKeyboard();
  for (
    let i = 0;
    i < (updateobj.notwatched.length > 30 ? 30 : updateobj.notwatched.length);
    i += 2
  ) {
    const bruh: { text: string; callback_data: string } = {
      text: `Episode ${updateobj.notwatched[i]}`,
      callback_data: `${callback_data_string}_${updateobj.alid}_${updateobj.notwatched[i]}`,
    };
    const bruh2: { text: string; callback_data: string } = {
      text: `Episode ${updateobj.notwatched[i + 1]}`,
      callback_data: `${callback_data_string}_${updateobj.alid}_${
        updateobj.notwatched[i + 1]
      }`,
    };
    if (updateobj.notwatched[i + 1] === undefined) keyboard.add(bruh).row();
    else keyboard.add(bruh).add(bruh2).row();
  }
  keyboard.text('Go back', 'back');
  return keyboard;
}

export const getUpdaterAnimeIndex = async (
  name: string,
  pending: i_ProcessedObjV2[],
) => pending.map((object) => object.jpname).indexOf(name);

export function getPagination(current: number, maxpage: number, text: string) {
  const keys: { text: string; callback_data: string }[] = [];
  if (current > 1) keys.push({ text: `«1`, callback_data: `${text}_1` });
  if (current > 2)
    keys.push({
      text: `‹${current - 1}`,
      callback_data: `${text}_${(current - 1).toString()}`,
    });
  keys.push({
    text: `-${current}-`,
    callback_data: `${text}_${current.toString()}_current`,
  });
  if (current < maxpage - 1)
    keys.push({
      text: `${current + 1}›`,
      callback_data: `${text}_${(current + 1).toString()}`,
    });
  if (current < maxpage)
    keys.push({
      text: `${maxpage}»`,
      callback_data: `${text}_${maxpage.toString()}`,
    });

  return new InlineKeyboard().add(...keys);
}
