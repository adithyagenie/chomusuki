// export async function makeWLKeyboard(userid: number) {
// 	const { wllist, wl } = await getUserWatchlists(userid);
// 	if (wllist.length === 0) return { wllist, wl, keyboard: undefined };
// 	let keyboard = new InlineKeyboard();
// 	for (let i = 0; i < wllist.length; i += 2) {
// 		keyboard.text(wllist[i], `wl_${wl[i].watchlistid}`);
// 		if (wllist[i + 1] !== undefined) keyboard.text(wllist[i + 1], `wl_${wl[i].watchlistid}`);
// 		keyboard.row();
// 	}
// 	return { wl, wllist, keyboard };
// }
