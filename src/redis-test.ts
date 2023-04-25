// import { createClient } from "redis";
// require("dotenv").config();

// async function startRedis() {
// 	const client = createClient({
// 		url: process.env.REDIS_URL,
// 	});
// 	client.on("error", (err) => console.log("Redis Error: ", err));
// 	await client.connect();
// 	console.log("connected!");
// 	await client.del("143064");
// 	await client.hSet("143064", {
// 		name: "Tsundere Akuyaku Reijou Liselotte to Jikkyou no Endou-kun to Kaisetsu no Kobayashi-san",
// 		genre: "Comedy,Fantasy,Romance",
// 	});
// 	console.log("added!");
// 	const res = await client.hGetAll("143064");
// 	console.log(res.name, res.genre);
// 	await client.disconnect();
// }

// startRedis();
