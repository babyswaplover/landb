/**
 * Personal utility for Baby Wonderland
 * 
 * This library is following Web API on 2022-09-19:
 * https://ld-api.babyswap.io/api/v1/land/info
 * 
 * Copyright 2022 babyswaplover
 */
import { DB } from "https://deno.land/x/sqlite@v3.5.0/mod.ts";
import { format } from "https://deno.land/std@0.156.0/datetime/mod.ts";

// Fetch interval (To prevent server overload)
const FETCH_INTERVAL = 60 * 1000; // Skip fetch again within 1 minute

// Key for storing fetch date
const KEY_DATE = "date";

/**
 * Land
 */
export interface Land {
  regionWeight: number; 
  regionId: number;
  x: number;
  y: number;
  imageUrl: string;
  imageStatus: string;
  level: number;
  onMarket: number;
  userAddress: string;
  tokenId: number;
}

// Database file
const filePath = "wonderland.db";
const db = new DB(filePath);

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
export async function fetchLandInfo(option?:HeadersInit):Promise<Land[]|undefined> {
  const lastFetched = Number(getValue(KEY_DATE));
  if (exists() && Date.now() < lastFetched + FETCH_INTERVAL) {
    const nextDate = format(new Date(lastFetched + FETCH_INTERVAL), 'yyyy-MM-dd HH:mm:ss');
    console.debug(`[DEBUG] fetchLandInfo(): skipped. (Call after ${nextDate})`);
    return;
  }
  const response = await fetch(
    "https://ld-api.babyswap.io/api/v1/land/info", {
      method: 'POST',
      headers: Object.assign({
          "accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Path": "/api/v1/land/info",
          "Origin": "https://land.babyswap.finance",
          "Referer": "https://land.babyswap.finance/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36"
      }, option),
      body: JSON.stringify({})
    });
    console.debug(`[DEBUG] fetchLandInfo(): done`);

    const json = await response.json();
  return json.data.items;
}

/**
 * refresh database with fetching from BabySwap
 * @return
 */
export async function refresh():Promise<boolean> {
  const lands = await fetchLandInfo();
  if (!lands) {
    return false;
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
    + "  imageStatus  TEXT,"
    + "  level        INT  NOT NULL,"
    + "  onMarket     INT  NOT NULL,"
    + "  userAddress  TEXT NOT NULL,"
    + "  tokenId      INT  UNIQUE,"
    + "  UNIQUE (x, y)"
    + ");");

  const stmt = db.prepareQuery(
      "INSERT INTO Land ("
      + "  regionWeight, regionId, x, y, imageUrl, imageStatus, level, onMarket, userAddress, tokenId"
      + ") VALUES ("
      + " :regionWeight,:regionId,:x,:y,:imageUrl,:imageStatus,:level,:onMarket,:userAddress,:tokenId"
      + ")");
  for (const land of lands) {
    stmt.execute(land);
  }

  // Store other information
  db.execute("DROP TABLE IF EXISTS Info");
  db.execute(
    "CREATE TABLE Info ("
      + "  name TEXT PRIMARY KEY,"
      + "  value TEXT NOT NULL"
      + ");");

  // Set fetch date
  setValue(KEY_DATE, String(Date.now()));
  db.execute("COMMIT");

  console.debug(`[DEBUG] refresh(): '${filePath}' updated. (${getDate()})`);
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
    const stmt = db.prepareQuery("SELECT * FROM Land WHERE userAddress=:userAddress COLLATE NOCASE ORDER BY x, y");
    return <Land[]><unknown[]>stmt.allEntries({userAddress});
  } else {
    const stmt = db.prepareQuery("SELECT * FROM Land ORDER BY x, y")
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
  const stmt = db.prepareQuery("SELECT * FROM Land WHERE onMarket = 1 ORDER BY x, y");
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
    + "      x >= :startX AND"
    + "      x <= :endX   AND"
    + "      y >= :startY AND"
    + "      y <= :endY   AND"
    + "      regionId != :regionId"
    + "  )"
    + "  ORDER BY x, y");

  return <Land[]><unknown[]>stmt.allEntries({
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
 * @returns 
 */
 export function getCounts():Count[] {
  const stmt = db.prepareQuery(
    "SELECT regionWeight, level, count(*) as count FROM Land"
    + "  GROUP BY regionWeight, level"
    + "  ORDER BY regionWeight, level");
    return <Count[]><unknown[]>stmt.allEntries();
}

// Call refresh() if when database not found
if (!exists()) {
  await refresh();
}

console.debug(`[DEBUG] '${filePath}' loaded. (Fetched at ${getDate()})`);
