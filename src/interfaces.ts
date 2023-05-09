import * as Prisma from "@prisma/client";

export interface i_AnimeNames {
	alid: number;
	enname: string;
	jpname: string;
	optnames: string[];
	excludenames: string[];
}

export interface i_WatchedAnime {
	alid: number;
	ep: number[];
}

export interface i_configuration {
	pause_airing_updates: boolean;
}

export interface i_remindedepanime {
	anime: string;
	reminded: number[];
}

export interface i_DlSync
	extends Omit<Prisma.syncupd, "queuenum" | "xdccdata" | "torrentdata" | "epnum"> {
	epnum: number;
	queuenum?: number;
	xdccdata?: string[];
	torrentdata?: string;
}

export interface i_NyaaResponse {
	id: number;
	title: string;
	link: string;
	file: string;
	category: string;
	size: string;
	uploaded: string;
	seeders: number;
	leechers: number;
	completed: number;
	magnet: string;
	epnum?: number;
	disname?: string | null;
}

export interface i_ProcessedObj {
	alid: number;
	anime: string;
	shortname: string | undefined;
	notwatched: {
		epnum: number;
		epname: string;
	}[];
	watched: {
		epnum: number;
		epname: string;
	}[];
	links: string[];
	notwatchedepnames: string[];
	torrentlink: string[];
	imagelink: string;
}

export interface i_ProcessedObjV2 {
	alid: number;
	jpname: string;
	enname: string;
	watched: number[];
	notwatched: number[];
	shortname: string | undefined;
	imagelink: string;
}
