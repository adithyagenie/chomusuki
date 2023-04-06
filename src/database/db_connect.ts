import { MongoClient } from "mongodb";

export interface AnimeNames {
	EnName: string;
	JpName: string;
	OptionalNames: Array<string>;
	ExcludeNames: Array<string>;
	AlID: number;
}

export interface WatchedAnime {
	name: string;
	watched: {
		epnum: number;
		epname: string;
	}[];
}

export interface configuration {
	pause_sync: boolean;
	remind_again: boolean;
}

export interface synced {
	anime: string;
	reminded: number[];
}

export interface DLSync {
	queuenum: number;
	synctype: string;
	anime: string;
	epnum: number;
	dltype: string;
	torrentData?: { links: string };
	xdccData?: { botname: string; packnum: number };
}

export function initMongo() {
	const uri = process.env.DATABASE_URL;
	const client = new MongoClient(uri);
	return client;
}

export async function getData(client: MongoClient, tablename: string) {
	let animenames = [];
	try {
		const db = client.db("cunnime");
		const res = db.collection(tablename).find();
		let reslist = await res.toArray();
		for (let i = 0; i < reslist.length; i++) delete reslist[i]._id;
		animenames = Array.from(reslist.values());
	} catch (err) {
		console.error(err);
	}
	return animenames;
}

export async function addAnimeNames(client: MongoClient, obj: AnimeNames) {
	try {
		const db = client.db("cunnime");
		const animenames = db.collection("AnimeNames");
		let insertres = await animenames.insertOne(obj);
		console.log(`MONGO: Documents inserted: ${insertres.acknowledged}`);
	} catch (err) {
		console.error(err);
	}
}

export async function markWatchedunWatched(
	client: MongoClient,
	obj: WatchedAnime
) {
	try {
		const db = client.db("cunnime");
		const query = { name: obj.name };
		const animenames = db.collection("WatchedAnime");
		let updres = await animenames.replaceOne(query, obj, { upsert: true });
		console.log(
			`MONGO: Documents updated: ${updres.acknowledged}; Update count: ${updres.modifiedCount}; Add count: ${updres.upsertedCount}`
		);
		return updres.acknowledged;
	} catch (err) {
		console.error(err);
	}
}

export async function delanime(client: MongoClient, delname: string) {
	try {
		const db = client.db("cunnime");
		const collection1 = db.collection("AnimeNames");
		const collection2 = db.collection("WatchedAnime");
		let del1 = await collection1.deleteOne({ JpName: delname });
		let del2 = await collection2.deleteOne({ name: delname });
		if (del1 && del2) console.log(`MONGO: ${delname} deletion success!`);
		else
			console.log(
				`Deletion failed. AnimeNames: ${del1.acknowledged}, WatchedAnime: ${del2.acknowledged}`
			);
	} catch (err) {
		console.error(err);
	}
}

export async function DlSync(client: MongoClient, obj: DLSync) {
	try {
		const db = client.db("cunnime");
		const collection = db.collection("SyncPC");
		let insertres = await collection.insertOne(obj);
		console.log(`MONGO: Documents inserted: ${insertres.acknowledged}`);
		return insertres.acknowledged;
	} catch (error) {
		console.error(error);
	}
}

export async function getPendingDL(client: MongoClient) {
	let pendingdl = [];
	try {
		const db = client.db("cunnime");
		let res = db.collection("SyncPC").find();
		let reslist = await res.toArray();
		if (reslist.length == 0) {
			return [];
		}
		for (let i = 0; i < reslist.length; i++) delete reslist[i]._id;
		pendingdl = Array.from(reslist.values());
	} catch (error) {
		console.error(error);
	}
	return pendingdl;
}

export async function configure(client: MongoClient) {
	try {
		const db = client.db("cunnime");
		let res = db
			.collection<configuration>("config")
			.find<configuration>({});
		let reslist = await res.toArray();
		if (reslist.length == 0 || reslist.length > 1) {
			return { pause_sync: false, remind_again: true };
		} else {
			return reslist[0];
		}
	} catch (error) {
		console.error(error);
	}
}

export async function changeconfig(
	client: MongoClient,
	newconfig: { pause_sync: boolean; remind_again: boolean }
) {
	try {
		const db = client.db("cunnime");
		const coll = db.collection("config");
		const old = await coll.deleteMany();
		if (old.acknowledged) {
			console.log(`MONGO: Remove old config: ${old.acknowledged}`);
			const newconf = await coll.insertOne(newconfig);
			if (newconf.acknowledged) {
				console.log(`MONGO: Update config: ${newconf.acknowledged}`);
			}
		}
	} catch (error) {
		console.error(error);
	}
}

export async function getSynced(client: MongoClient) {
	try {
		const db = client.db("cunnime");
		const coll = await db
			.collection<synced>("Synced")
			.find<synced>({})
			.toArray();
		return coll;
	} catch (error) {
		console.error(error);
	}
}

export async function addSynced(client: MongoClient, obj: synced) {
	try {
		const db = client.db("cunnime");
		const query = { anime: obj.anime };
		const coll = db.collection("Synced");
		let updres = await coll.replaceOne(query, obj, { upsert: true });
		console.log(
			`MONGO: Documents updated: ${updres.acknowledged}; Update count: ${updres.modifiedCount}; Add count: ${updres.upsertedCount}`
		);
		return updres.acknowledged;
	} catch (error) {
		console.error(error);
	}
}
