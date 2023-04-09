import { mongoClient } from "../../..";

export interface User {
    ChatID: number,
    Username: string,
    watchlists: string[],
    config: {
        pause_sync: boolean,
        remind_again: boolean
    }
}

export async function getUser(chatid: number, opts: {Username?: boolean, watchlists?: boolean, config?:boolean}) {
    try {
        const db = mongoClient.db("Watchlist");
        const coll = db.collection<User>("Users");
        const res = await coll.find<User>({ChatID: chatid}).toArray();
        if (res.length > 1) 
            throw new Error("More than one user found.");
        const user = res[0];
        delete user["_id"];
        console.log(user)
        var returnobj: Partial<User> = {};
        if (opts.Username) returnobj.Username = user.Username;
        if (opts.watchlists) returnobj.watchlists = user.watchlists;
        if (opts.config) returnobj.config = user.config;
        if (!(opts.Username || opts.watchlists || opts.config)) returnobj = user
        console.log(returnobj);
        return returnobj;
        
    } catch (error) {
        console.error(error)
    }

}

export async function getWL(anime: string) {
    const db = mongoClient.db("Watchlist");
}
