// exposes proper endpoint and handles api calls

import { bot } from "../bot/bot";
import { BotError, webhookCallback } from "grammy";
import fastify from "fastify";
import { pendingEndpoint } from "../bot/helpers/anime/a_pending";
import { botErrorHandle } from "../bot/helpers/misc_handles";

export async function startserver() {
    const port = parseInt(process.env.PORT) || 4000;
    const server = fastify({ logger: false });
    if (process.env.RUN_METHOD === "WEBHOOK") {
        server.post(`/${process.env.BOT_TOKEN}`, webhookCallback(bot, "fastify"));
        server.setErrorHandler(async (err, req, res) => {
            if (err instanceof BotError) {
                await botErrorHandle(err);
                await res.status(200).send({});
            } else await res.status(500).send({});
        });
    }
    server.get("/", async () => {
        return "Cunnime bot up and running ^_^";
    });
    server.get("/keepalive", async () => {
        return { keepalive: true };
    });
    server.post("/sync", async (req, res) => {
        if (req.headers.calledby == "manualcall") {
            console.log("Got manual sync request.");
            await res.send("Syncing anime...");
            //await syncresponser(false, undefined);
        } else if (req.headers.calledby == "croncall") {
            console.log("Got automatic sync request.");
            await res.send("Syncing anime...");
            //await syncresponser(true, undefined);
        } else await res.status(401);
    });
    pendingEndpoint(server);
    await server.listen({ port: port });
    if (process.env.RUN_METHOD === "WEBHOOK")
        await bot.api.setWebhook(`${process.env.RENDER_EXTERNAL_URL}/${process.env.BOT_TOKEN}`);
    console.log(`Cunnime server listening on port ${port}!`);

    return server;
}
