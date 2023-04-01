import anilist from "anilist-node"

const al = new anilist(process.env.ANILIST_TOKEN)

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
