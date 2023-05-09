import Axios from "axios";
import { setupCache } from "axios-cache-interceptor";

const axios = setupCache(Axios);

async function yo() {
	var time = new Date().getTime();
	const res1 = await axios.get("https://reqres.in/api/users/2", { id: "yo" });
	console.log(`TIME 1: ${new Date().getTime() - time} ms`);
	time = new Date().getTime();
	const res2 = await axios.get("https://reqres.in/api/users/2", { id: "yo" });
	console.log(`TIME 2: ${new Date().getTime() - time} ms`);
	await axios.storage.remove("yo");
	time = new Date().getTime();
	const res3 = await axios.get("https://reqres.in/api/users/2", { id: "yo" });
	console.log(`TIME 3: ${new Date().getTime() - time} ms`);

	console.log(res1.data, res2.data);
	console.log(res1.cached, res2.cached, res3.cached);
}

yo().catch(console.error);
