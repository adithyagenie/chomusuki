// exposes proper endpoint and handles api calls

import express, { ErrorRequestHandler } from "express";
import { bot } from "../bot/bot";
import { webhookCallback } from "grammy";

export function startserver() {
	const port = process.env.PORT || 4000;
	const app: express.Application = express();
	app.use(express.json());
	const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
		console.error(err.stack);
		res.status(400).send("Error!");
	};
	app.use(`/${process.env.BOT_TOKEN}`, webhookCallback(bot, "express"));
	app.use(errorHandler);
	app.get("/", (req, res) => {
		res.status(200).send("Cunnime bot up and running ^_^");
	});
	app.get("/keepalive", (req, res) => {
		res.status(200).json({ keepalive: true });
	});
	app.listen(port, async () => {
		await bot.api.setWebhook(`${process.env.RENDER_EXTERNAL_URL}/${process.env.BOT_TOKEN}`, {
			drop_pending_updates: true
		});
		console.log(`Cunnime server listening on port ${port}!`);
	});
	return app;
}
