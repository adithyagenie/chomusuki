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
	pause_sync: boolean;
	remind_again: boolean;
}

export interface i_remindedepanime {
	anime: string;
	reminded: number[];
}

export interface i_DlSync
	extends Omit<Prisma.syncupd, "queuenum" | "xdccdata" | "torrentdata"> {
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
	epnum?: number | null;
	disname?: string | null;
}

export interface i_ProcessedObj {
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
