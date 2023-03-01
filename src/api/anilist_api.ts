import anilist from "anilist-node"
const token = require("../../anilist_token.json").token;
const al = new anilist(token)

export async function imageget(id:number) {
    let url = "";
    try {
        url = ((await al.media.anime(id)).coverImage.large)
    } catch {
        console.log(`ANILIST: Incorrect Anilist ID ${id}`)
        url = "https://upload.wikimedia.org/wikipedia/commons/d/d1/Image_not_available.png"
    }
    return url
}

export async function getAlId(enname:string, jpname:string) {
    var alid = 0;
    try {
        const res = await al.searchEntry.anime(enname)
        if (res.media[0].title.english == enname || res.media[0].title.romaji == jpname) {
            alid = res.media[0].id;
        }
        return alid
    }
    catch {
        console.log(`ANILIST: Error fetching ${enname}`)
        return alid
    }
}


//getAlId("Endo and Kobayashi Live! The Latest on Tsundere Villainess Lieselotte", "Tsundere Akuyaku Reijou Liselotte to Jikkyou no Endou-kun to Kaisetsu no Kobayashi-san").then(a => {console.log(a);imageget(a)})
