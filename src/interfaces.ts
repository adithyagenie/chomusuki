import * as Prisma from "@prisma/client";

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

export interface i_ProcessedObjV2 {
	alid: number;
	jpname: string;
	enname: string;
	watched: number[];
	notwatched: number[];
	shortname: string | undefined;
	image: string;
	status: "RELEASING" | "NOT_YET_RELEASED" | "FINISHED";
}
