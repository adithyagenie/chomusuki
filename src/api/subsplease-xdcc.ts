import axios from 'axios';

//import { xdccInit } from "../downloader/xdcc-down"

interface NIBLQuery {
  botId: number;
  number: number;
  name: string;
  size: string;
  sizekbits: number;
  episodeNumber: number;
  lastModified: string;
}

export interface SPSearch {
  packnum: number;
  botname: string;
}

export async function getxdcc(name: string) {
  let packnum: number | undefined;
  let botnum: number | undefined;
  let returnobj: SPSearch = {
    packnum: 0,
    botname: '',
  };
  const botnames: Record<number, string> = {
    989: 'CR-ARUTHA|NEW',
    696: 'CR-HOLLAND|NEW',
    21: 'Ginpachi-Sensei',
  };
  const baseURL = 'https://api.nibl.co.uk/nibl';
  const encodename = encodeURI(name);
  const res = await axios.get(`${baseURL}/search/?query=${encodename}`);
  if (res.status == 200) {
    const resobj: NIBLQuery[] = res.data.content;

    if (resobj.length > 0) {
      for (let i = 0; i < resobj.length; i++) {
        if (resobj[i].botId == 989) packnum = resobj[i].number;
        botnum = 989;
      }
      if (packnum === undefined) {
        for (let i = 0; i < resobj.length; i++) {
          if (resobj[i].botId == 696) packnum = resobj[i].number;
          botnum = 696;
        }
      }
      if (packnum === undefined) {
        packnum = resobj[0].number;
        botnum = resobj[0].botId;
      }
    } else console.log('No packs found');
  } else {
    console.error('axios err');
    return {
      packnum: 0,
      botname: '',
    };
  }
  if (packnum === undefined || botnum === undefined) return returnobj;
  else {
    returnobj = {
      packnum: packnum,
      botname: botnames[botnum],
    };
    return returnobj;
  }
}

/* export async function startspxdcc()
 {
 const xdccJS = await xdccInit()
 xdccJS.on('ready', async () => {
 //let todl = await getxdcc("[SubsPlease] Revenger - 02 (1080p) [41CCBF88].mkv")
 //if (todl === undefined) {
 //    todl = {
 //        packnum:0,botname:""
 //    }
 //}
 //startdl(xdccJS, todl.botname, todl.packnum.toFixed())
 })
 // process.on('SIGINT', function() {
 //     console.log("Quitting...");
 //     terminator(xdccJS)
 //   });
 } */

//startspxdcc()

/* process.on('SIGINT', function() {
 console.log("Quitting...");
 terminator()
 }); */
