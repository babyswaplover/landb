/**
 * Personal utility for Baby Wonderland
 * 
 * This library is following Web API on 2022-09-19:
 * https://ld-api.babyswap.io/api/v1/land/info
 * 
 * Copyright 2022 babyswaplover
 */
import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { format } from "https://deno.land/std@0.201.0/datetime/mod.ts";

// Fetch interval (To prevent server overload)
const FETCH_INTERVAL = 60 * 1000; // Skip fetch again within 1 minute

// Key for storing fetch date
const KEY_DATE = "date";
const KEY_DATE_REQUESTED = "dateRequest";

/**
 * Land
 */
export interface Land {
  regionWeight: number; 
  regionId: number;
  x: number;
  y: number;
  imageUrl?: string;
  imageStatus: number;
  level: number;
  onMarket: number;
  userAddress: string;
  tokenId: number;
  marketX: number;
  marketY: number;
  signType: number;
  signImgUrl?: string;
  userTokenId: number;
  landType: number;
  notifyExist:boolean;
  creator?: string;
  skipPP: number;
  notifyId?: string;
}

// In-memory Database for Default
// Check permission of environment variable 'LANDB_PATH'.
const permission = await Deno.permissions.query({name:"env", variable:"LANDB_PATH"});
const filePath = (permission.state == "granted") ? Deno.env.get("LANDB_PATH") : undefined;
const readOnly = filePath && (await Deno.permissions.query({name:"write", path:filePath})).state != "granted";
const db = new DB(filePath, {mode: readOnly ? "read" : undefined});

// Store other information
db.execute("CREATE TABLE IF NOT EXISTS Info ("
    + "  name TEXT PRIMARY KEY,"
    + "  value TEXT NOT NULL"
    + ");");

/**
 * checks if Land data exists in local DB
 * @returns true if exists
 */
export function exists():boolean {
  const [result] = db.query("SELECT COUNT(*) FROM sqlite_master WHERE name='Land'");
  return Number(result) > 0;
}

/**
 * gets Land info from BabySwap.
 * Should not call so many times to prevent server overload.
 * @returns lands (undefined if this function is called within 1 minute)
 */
export async function fetchLandInfo(landType=0, option?:HeadersInit):Promise<Land[]|undefined> {
  const lastRequested = Number(getValue(KEY_DATE_REQUESTED));
  if (landType == 0 && exists() && Date.now() < lastRequested + FETCH_INTERVAL) {
    const nextDate = format(new Date(lastRequested + FETCH_INTERVAL), 'yyyy-MM-dd HH:mm:ss');
    console.debug(`[DEBUG] fetchLandInfo(): skipped. (Call after ${nextDate})`);
    return;
  }

  // Set requested date first
  setValue(KEY_DATE_REQUESTED, String(Date.now()));

  const requestUrl = "https://ld-api.babyswap.io/api/v1/land/info";
  const response = await fetch(
    requestUrl, {
      method: 'POST',
      headers: Object.assign({
          "accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Path": "/api/v1/land/info",
          "Origin": "https://land.babyswap.finance",
          "Referer": "https://land.babyswap.finance/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
      }, option),
      body: JSON.stringify({landType})
    });
    console.debug(`[DEBUG] fetchLandInfo(landType:${landType}): requestUrl=${requestUrl} done`);

  const json = await response.json();
  return json.data.items;
}

/**
 * 
 * @param object including land
 * @returns land
 */
function extract({
 regionWeight, regionId, x, y, imageUrl, imageStatus, level, onMarket, userAddress, tokenId, marketX, marketY,
  signType, signImgUrl, userTokenId, landType,
  notifyExist, creator, skipPP, notifyId
}:any):Land {
  return {
    regionWeight, regionId, x, y, imageUrl, imageStatus, level, onMarket, userAddress, tokenId, marketX, marketY,
    signType, signImgUrl, userTokenId, landType,
    notifyExist: (notifyExist == 0), creator, skipPP, notifyId
  }
}

/**
 * refresh database with fetching from BabySwap
 * @return
 */
export async function refresh():Promise<boolean> {
  const islands = [];
  for (const landType of [
    0, // Main Land
    1, // Divinity Land (2023/03/10)
    2, // Wizard Land (2023/06/02)
    3, // Scorpiton Land (2023/08/18)
    4, // Ghost Land (2023/10/16)
  ]) {
    const lands = await fetchLandInfo(landType);
    if (!lands) {
      return false;
    }
  
    // Check new field found
    if (lands.length > 0) {
      const newKeys = Object.keys(lands[0]);
      const currentKeys = Object.keys(extract(lands[0]));
      if (newKeys.length != currentKeys.length) {
        for (const key of newKeys) {
          if (!currentKeys.includes(key)) {
            console.warn(`[WARN] new field found. (${key})`);
          }
        }
      }
    }
    islands.push(lands);
  }

  db.execute("BEGIN TRANSACTION");
  db.execute("DROP TABLE IF EXISTS Land");
  db.execute(
    "CREATE TABLE Land ("
    + "  regionWeight INT  NOT NULL,"
    + "  regionId     PRIMARY KEY,"
    + "  x            INT NOT NULL,"
    + "  y            INT NOT NULL,"
    + "  imageUrl     TEXT,"
    + "  imageStatus  INT,"
    + "  level        INT  NOT NULL,"
    + "  onMarket     INT  NOT NULL,"
    + "  userAddress  TEXT NOT NULL,"
    + "  tokenId      INT  UNIQUE,"
    + "  marketX      INT," // NOT NULL (null in tokenId 3922 on 12/18/2022)
    + "  marketY      INT," // NOT NULL (null in tokenId 3922 on 12/18/2022)
    + "  signType     INT NOT NULL,"
    + "  signImgUrl   TEXT,"
    + "  userTokenId  INT," // NOT NULL (null in tokenId 3922 on 12/18/2022)
    + "  landType     INT NOT NULL,"
    + "  notifyExist  INT NOT NULL," // boolean
    + "  creator      TEXT,"
    + "  skipPP       INT NOT NULL,"
    + "  notifyId     TEXT,"
    + "  UNIQUE (x, y)"
    + ");");

  const stmt = db.prepareQuery(
      "INSERT INTO Land ("
      + "  regionWeight, regionId, x, y, imageUrl, imageStatus, level, onMarket, userAddress, tokenId, marketX, marketY, signType, signImgUrl, userTokenId, landType, notifyExist, creator, skipPP, notifyId"
      + ") VALUES ("
      + " :regionWeight,:regionId,:x,:y,:imageUrl,:imageStatus,:level,:onMarket,:userAddress,:tokenId,:marketX,:marketY,:signType,:signImgUrl,:userTokenId,:landType,:notifyExist,:creator,:skipPP,:notifyId"
      + ")");
  for (const lands of islands) {
    for (const land of lands) {
      stmt.execute(<any>extract(land));
    }
  }

  // Set fetch date
  const lastRequested = getValue(KEY_DATE_REQUESTED);
  setValue(KEY_DATE, lastRequested!);
  db.execute("COMMIT");

  console.debug(`[DEBUG] refresh(): Database updated. (${getDate()})`);
  return true;
}

/**
 * gets value of the specified name
 * @param name
 * @param value
 */
function setValue(name:string, value:string) {
  db.query(
    "INSERT OR REPLACE INTO Info ("
    + "  name, value"
    + ") VALUES ("
    + " :name,:value"
    + ")", {
      name,
      value
    });
}

/**
 * gets value of the specified name
 * @param name 
 * @returns value related with the name
 */
function getValue(name:string):string|undefined {
  try {
    const stmt = db.prepareQuery("SELECT name, value FROM Info WHERE name = :name");
    const result = stmt.firstEntry({name});
    return <string>result?.value;
  } catch (e) {
    return e;
  }
}

/**
 * gets last fetch date
 * @returns 
 */
export function getDate(): string|undefined {
  const date = getValue(KEY_DATE);
  if (date) {
    return format(new Date(Number(date)), 'yyyy-MM-dd HH:mm:ss');
  }
}


/**
 * gets land
 * @param userAddress wallet address (optional)
 * @returns lands
 */
export function getLands(userAddress?:string):Land[] {
  if (userAddress) {
    const stmt = db.prepareQuery("SELECT * FROM Land WHERE userAddress=:userAddress COLLATE NOCASE ORDER BY landType, x, y");
    return <Land[]><unknown[]>stmt.allEntries({userAddress});
  } else {
    const stmt = db.prepareQuery("SELECT * FROM Land ORDER BY landType, x, y")
    return <Land[]><unknown[]>stmt.allEntries();
  }
}

/**
 * gets land by locattion
 * @param x 
 * @param y
 * @returns land
 */
 export function getLandByLocation(x:number, y:number):Land|undefined {
  const stmt = db.prepareQuery(
    "SELECT * FROM Land"
    + "  WHERE"
    + "    x <= :x AND"
    + "    x + regionWeight > :x AND"
    + "    y - regionWeight < :y AND"
    + "    y >= :y");
  return <Land><unknown>stmt.firstEntry({x, y});
}

/**
 * gets land by tokenId
 * @param tokenId 
 * @returns land
 */
export function getLandByTokenId(tokenId:number):Land|undefined {
  const stmt = db.prepareQuery("SELECT * FROM Land WHERE tokenId = :tokenId");
  return <Land><unknown>stmt.firstEntry({tokenId});
}


export function getLandByRegionId(regionId:number):Land {
  const stmt = db.prepareQuery("SELECT * FROM Land WHERE regionId = :regionId");
  return <Land><unknown>stmt.firstEntry({regionId});
}


export function getOnMarketLands():Land[] {
  const stmt = db.prepareQuery("SELECT * FROM Land WHERE onMarket = 1 ORDER BY landType, x, y");
  return <Land[]><unknown[]>stmt.allEntries();
}


/**
 * gets adjacent Lands
 * @param land 
 * @param padding 
 * @returns 
 */
export function getAdjacentLands(land:Land, padding=1):Land[] {
  const stmt = db.prepareQuery(
    "SELECT * FROM Land"
    + "  WHERE regionId IN ("
    + "    SELECT regionId FROM Land"
    + "    WHERE"
    + "      landType = :landType AND"
    + "      x + regionWeight - 1 >= :startX AND"
    + "      x <= :endX   AND"
    + "      y >= :startY AND"
    + "      y - regionWeight + 1 <= :endY   AND"
    + "      regionId != :regionId"
    + "  )"
    + "  ORDER BY landType, x, y");

  return <Land[]><unknown[]>stmt.allEntries({
    landType:   land.landType,
    startX:   land.x - padding,
    startY:   land.y - land.regionWeight - padding + 1,
    endX:     land.x + land.regionWeight + padding - 1,
    endY:     land.y + padding,
    regionId: land.regionId
  });
}

export interface Count {
  regionWeight:number;
  level:number;
  count:number;
}

/**
 * gets number of lands group by size and level
 * @param userAddress wallet address (optional)
 * @param groupByIsland group by island (optional)
 * @returns 
 */
 export function getCounts(userAddress?:string, groupByIsland=false):Count[] {
  if (groupByIsland) {
    if (userAddress) {
      return <Count[]><unknown[]>db.prepareQuery(
        "SELECT landType, regionWeight, level, count(*) as count FROM Land"
        + "  WHERE userAddress=:userAddress COLLATE NOCASE"
        + "  GROUP BY landType, regionWeight, level"
        + "  ORDER BY landType, regionWeight, level").allEntries({userAddress});
    } else {
      return <Count[]><unknown[]>db.prepareQuery(
        "SELECT landType, regionWeight, level, count(*) as count FROM Land"
        + "  GROUP BY landType, regionWeight, level"
        + "  ORDER BY landType, regionWeight, level").allEntries();
    }
  } else {
    if (userAddress) {
      return <Count[]><unknown[]>db.prepareQuery(
        "SELECT regionWeight, level, count(*) as count FROM Land"
        + "  WHERE userAddress=:userAddress COLLATE NOCASE"
        + "  GROUP BY regionWeight, level"
        + "  ORDER BY regionWeight, level").allEntries({userAddress});
    } else {
      return <Count[]><unknown[]>db.prepareQuery(
        "SELECT regionWeight, level, count(*) as count FROM Land"
        + "  GROUP BY regionWeight, level"
        + "  ORDER BY regionWeight, level").allEntries();
    }
  }
}

/**
 * 
 */
export interface OwnerInfo {
  /** Address of Owner */
  userAddress:string;

  /** land (order by locations) */
  lands:Land[];

  /** counts of lands (0:total NFTs, 1:1x1 lands, 2:2x2 land, ...) */
  counts: number[];
}

/**
 * 
 * @returns 
 */
export function getOwnerInfoMap(descending=true):Map<string,OwnerInfo> {
  // Create map
  const ownerInfoMap = getLands().reduce((map, land)=>{
    const userAddress = land.userAddress;
    let info = map.get(userAddress);
    if (!info) {
      info = {
        userAddress,
        lands: [],
        counts: [0]
      };
      map.set(userAddress, info);
    }

    info.lands.push(land);
    info.counts[0] += land.regionWeight ** 2;
    info.counts[land.regionWeight] = (info.counts[land.regionWeight] ?? 0) + 1;
    return map;
  }, new Map<string, OwnerInfo>());

  // Sort by number of lands and alphabetic order
  return new Map([...ownerInfoMap].sort((a,b)=>{
    const sign = descending ? -1 : 0;
    const acounts = a[1].counts;
    const bcounts = b[1].counts;
    let value;

    // sort by number of land NFT, larger land
    if ((value = acounts[0] - bcounts[0])) {
      return sign * value;
    }
    const maxlength = Math.max(acounts.length, bcounts.length);
    for (let i = maxlength -1; i>=1; i--) {
      if ((value = acounts[i] - bcounts[i])) {
        return sign * value;
      }
    }

    // order by address if same
    return a[0].localeCompare(b[0]);
  }));
}

/**
 * gets neighbor address, lands map
 * @param userAddress wallet address
 * @param descending 
 * @returns map of (address, lands)
 */
export function getNeighbors(userAddress:string, descending=true):Map<string,Land[]> {
  const neighborMap = new Map<string,Land[]>();
  for (const myLand of getLands(userAddress)) {
    for (const adjacent of getAdjacentLands(myLand)) {
      if (adjacent.userAddress == userAddress) {
        // Ignore owned address
        continue;
      }

      const lands = neighborMap.get(adjacent.userAddress);
      if (lands) {
        // Skip same tokenId
        if (!lands.find(land=>adjacent.tokenId == land.tokenId)) {
          lands.push(adjacent);
        }
      } else {
        neighborMap.set(adjacent.userAddress, [adjacent]);
      }
    }
  }

  // sort lands by location x, y
  const sorted:Land[][] = [];
  for (const lands of neighborMap.values()) {
    sorted.push(lands.sort((a,b)=>{
      return (a.x - b.x) || (a.y - b.y);
    }));
  }

  // sort by length of lands, address
  const sign = descending ? -1 : 0;
  return sorted.sort((a, b)=>{
    return sign * (a.length - b.length) || a[0].userAddress.localeCompare(b[0].userAddress); 
  }).reduce((map, lands)=>{
    map.set(lands[0].userAddress, lands);
    return map;
  }, new Map<string,Land[]>);
}

const EXCEPTION_TOKEN_IDS = [
  // Main landd
  183,    // ( -16,   5): 30x30 for BabySwap
  1044,   // (  38, -71): 12x12 for
  1123,   // (  34,   3): 12x12 for Binance
  1332,   // (  28, -30): 12x12 for CoinMarketCap
  1334,   // (  57,  45): 12x12 for
  1574,   // (  44,  64): 12x12 for
  1714,   // (  27,  38): 12x12 for apolloX
  1878,   // (  -2, -42): 12x12 for
  1933,   // ( -18,  39): 12x12 for BNB Chain
  2190,   // ( -52,  -9): 12x12 for
  2336,   // ( -68,  45): 12x12 for Baby Wealthy Club

  // Divinity land
  15001,  // (-139,-118): 10x10 for BabySwap
  15137,  // (-216, -89): 6x6
  15497,  // (-206,-150): 6x6
  15173,  // (-206, -56): 6x6
  15353,  // (-195,-114): 6x6
  15317,  // (-180, -68): 6x6
  15677,  // (-179,-144): 6x6
  15785,  // (-177,-164): 6x6
  15461,  // (-177,-101): 6x6
  15245,  // (-176,-192): 6x6
  15749,  // (-174, -12): 6x6
  15605,  // (-156,-136): 6x6
  15713,  // (-145, -89): 6x6
  15389,  // (-142, -60): 6x6
  15281,  // (-122,-175): 6x6
  15101,  // (-106,-150): 6x6
  15641,  // (-105,-107): 6x6
  15209,  // ( -99, -56): 6x6
  15533,  // ( -82,-163): 6x6
  15569,  // ( -81, -72): 6x6
  15425,  // ( -66,-123): 6x6

  // Wizard Land
  32001,  // (  64,-164): 10x10 for BabySwap
  32137,  // ( -59,-175): 6x6
  32173,  // ( -41,-104): 6x6
  32533,  // ( -36,-193): 6x6
  32497,  // ( -20,-101): 6x6
  32713,  // ( -12,-140): 6x6
  32209,  // (  -7,-182): 6x6
  32389,  // (  -4,-117): 6x6
  32569,  // (  14,-140): 6x6
  32605,  // (  20,-198): 6x6
  32245,  // (  36,-167): 6x6
  32461,  // (  53,-191): 6x6
  32281,  // (  79, -71): 6x6
  32749,  // (  90,-190): 6x6
  32425,  // ( 102,-104): 6x6
  32785,  // ( 117,-203): 6x6
  32101,  // ( 118, -83): 6x6
  32317,  // ( 133,-173): 6x6
  32677,  // ( 135,-155): 6x6
  32353,  // ( 170,-145): 6x6
  32641,  // ( 192,-195): 6x6

  // Scorpion Land
  49001,  // (-101, 138): 10x10 for BabySwap
  49101,  // (-220, 102): 6x6
  49389,  // (-218, 133): 6x6
  49173,  // (-215, 174): 6x6
  49677,  // (-205,  48): 6x6
  49425,  // (-197, 150): 6x6
  49209,  // (-189,  90): 6x6
  49569,  // (-180,  29): 6x6
  49749,  // (-169, 177): 6x6
  49245,  // (-133,  45): 6x6
  49641,  // (-132, 110): 6x6
  49497,  // (-132, 179): 6x6
  49605,  // (-131,  82): 6x6
  49353,  // (-129, 140): 6x6
  49317,  // (-114,  16): 6x6
  49533,  // (-109, 161): 6x6
  49785,  // ( -95, 169): 6x6
  49281,  // ( -84, 116): 6x6
  49137,  // ( -74, 172): 6x6
  49461,  // ( -57, 100): 6x6
  49713,  // ( -43, 164): 6x6

  // Ghost Land
  66001,  // ( 122, 157): 10x10 for BabySwap
  66641,  // ( -16, 188): 6x6
  66605,  // (  10, 201): 6x6
  66497,  // (  19, 122): 6x6
  66245,  // (  33, 156): 6x6
  66461,  // (  45, 133): 6x6
  66209,  // (  63, 205): 6x6
  66677,  // (  69, 151): 6x6
  66317,  // (  82, 115): 6x6
  66569,  // (  83, 202): 6x6
  66353,  // ( 104, 103): 6x6
  66173,  // ( 105, 183): 6x6
  66281,  // ( 107, 137): 6x6
  66749,  // ( 137, 189): 6x6
  66101,  // ( 154, 142): 6x6
  66425,  // ( 172, 179): 6x6
  66389,  // ( 176, 123): 6x6
  66785,  // ( 188, 190): 6x6
  66137,  // ( 192, 162): 6x6
  66713,  // ( 217, 128): 6x6
  66533,  // ( 225, 183): 6x6
];
const SIGNTYPE_MULTIPLIER = [1, 1.5, 1.3, 1.1, 1.5];
const LAND_BASE_POINT:{[key:number]: number}[] = [
  {1:100, 2:120}, // 0: Main land
  {1: 50, 2: 60}, // 1: Divinity Land
  {1: 50, 2: 60}, // 2: Wizard Land
  {1: 50, 2: 60}, // 3: Scorpion Land
  {1: 50, 2: 60}, // 4: Ghost Land
];

export function calcProsperityPoints(address?:string): number {
 return getLands(address).reduce((total, land)=>total + calcProsperityPoint(land), 0);
}

export function calcProsperityPoint(land:Land): number {
  if (EXCEPTION_TOKEN_IDS.includes(land.tokenId)) {
    return 0;
  }
  const sizeMultiplier = land.regionWeight == 1 ? 1 : land.regionWeight - 0.5;
  const landlordMultiplier = SIGNTYPE_MULTIPLIER[land.signType];
  const basePoint = LAND_BASE_POINT[land.landType][land.level];
  return basePoint * (land.regionWeight**2) * sizeMultiplier * landlordMultiplier;
}

// Call refresh() if when database not found
if (!exists()) {
  await refresh();
}

if (filePath) {
  console.debug(`[DEBUG] '${filePath}' loaded. (Last fetched:${getDate()})`);
}
