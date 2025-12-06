import { Composer } from "grammy";
import { MyContext } from "../bot";
import { userMiddleware } from "../helpers/user_mgmt";
import { b, fmt } from "@grammyjs/parse-mode";

export function middleware() {
    const middleware = new Composer<MyContext>();
    middleware.use(async (ctx, next) => {
        const oldtime = new Date().getTime();
        await next();
        console.log(`Processed request from ${ctx.from.id}: ${ctx.session.userid}. Took ${new Date().getTime() - oldtime} ms`);
        return;
    });
    middleware.filter(ctx => ctx.session.userid === undefined).on(["::bot_command", "callback_query:data"], userMiddleware);
    middleware.callbackQuery(/^wl_(.+)/,
        async (ctx, next) => {
            if (ctx.session.menudata.activemenuopt === undefined) {
                ctx.session.menudata.activemenuopt = ctx.msg.message_id;
            }
            if (ctx.session.menudata.activemenuopt === ctx.msg.message_id) {
                await next();
            } else {
              const editMessageText = fmt`${b}Menu disabled as a newer one exists.${b}`;
                await ctx.editMessageText(editMessageText.text, { entities: editMessageText.entities });
            }
        });
    middleware.command("mywatchlists",
        async (ctx, next) => {
            if (ctx.session.menudata.activemenuopt !== undefined) {
                try {
                  const editMessageText = fmt`${b}Menu disabled as a newer one exists.${b}`
                    await ctx.api.editMessageText(ctx.from.id, ctx.session.menudata.activemenuopt, editMessageText.text, { entities: editMessageText.entities } );
                } catch {
                    console.error(`Unable to edit old menu message:: ${ctx.from.id}::${JSON.stringify(ctx.session.menudata.activemenuopt)}`);
                }
                ctx.session.menudata.activemenuopt = undefined;
            }
            await next();
        });
    return middleware;
}
