import { MongoClient } from "mongodb";
import { config } from "dotenv";

export interface AnimeNames {
    EnName: string,
    JpName: string,
    OptionalNames: Array<string>,
    ExcludeNames: Array<string>,
    MalId: string
}    

export interface WatchedAnime {
	name:string,
	watched: {
	    epnum: number,
	    epname: string
    }[]
}

export async function initMongo() {
    config()
    const uri = process.env.DATABASE_URL;
    const client = new MongoClient(uri);
    return client
}

export async function getData(client:MongoClient, tablename:string) {
    let animenames = [];
	try {
        const db = client.db('cunnime');
		const res = db.collection(tablename).find()
		let reslist = await res.toArray()
		for (let i = 0; i < reslist.length; i ++ )
		    delete reslist[i]._id
        animenames = Array.from(reslist.values())
	}
	catch (err){
		console.error(err);
	}
	return animenames
}

export async function addAnimeNames(client:MongoClient, obj:AnimeNames) {
	try {
        const db = client.db('cunnime');
		const animenames = db.collection("AnimeNames")
		let insertres = await animenames.insertOne(obj)
		console.log(`MONGO: Documents inserted: ${insertres.acknowledged}`);
	}
	catch (err){
		console.error(err);
	}
}

export async function markWatchedunWatched(client:MongoClient, obj:WatchedAnime) {
    try {
        const db = client.db('cunnime');
        const query = {name:obj.name}
        const animenames = db.collection("WatchedAnime")
        let updres = await animenames.replaceOne(query, obj, {upsert: true})
        console.log(`MONGO: Documents updated: ${updres.acknowledged}; Update count: ${updres.modifiedCount}; Add count: ${updres.upsertedCount}`)
        return updres.acknowledged
    } catch (err) {
        console.error(err);
    }
}

export async function delanime(client:MongoClient, delname:string) {
    try {
        const db = client.db('cunnime');
        const collection1 = db.collection("AnimeNames")
        const collection2 = db.collection("WatchedAnime")
        let del1 = await collection1.deleteOne({JpName:delname})
        let del2 = await collection2.deleteOne({name:delname})
        if (del1 && del2)
            console.log(`MONGO: ${delname} deletion success!`)
        else
            console.log(`Deletion failed. AnimeNames: ${del1.acknowledged}, WatchedAnime: ${del2.acknowledged}`)
    } catch (err) {
        console.error(err);
    }
}

module.exports = { initMongo, getData, addAnimeNames, markWatchedunWatched, delanime }
//addAnimeNames(database).then(() => client.close()).catch(console.dir);
//get(database).then(() => client.close()).catch(console.dir);
