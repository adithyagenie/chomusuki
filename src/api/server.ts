// exposes proper endpoint and handles api calls

import express from "express";
import { bot } from "../bot/bot";
import { webhookCallback } from "grammy";

export function startserver() {
	const port = process.env.PORT || 3000;
	const app: express.Application = express();
	app.use(express.json());
	app.use((err, req, res, next) => {
		console.error(err.stack);
		res.status(500).send("Something broke!");
	});
	app.use(
		`/${process.env.BOT_TOKEN}`,
		webhookCallback(bot, "express", "throw", 20000)
	);
	app.get("/", (req, res) => {
		res.status(200).send("Cunnime bot up and running ^_^");
	});
	app.get("/keepalive", (req, res) => {
		res.status(200).json({ keepalive: true });
	});
	app.listen(port, async () => {
		await bot.api.setWebhook(
			`${process.env.RENDER_EXTERNAL_URL}/${process.env.BOT_TOKEN}`
		);
		console.log(`Cunnime server listening on port ${port}!`);
	});
	return app;
}
