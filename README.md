# Personal utility for Baby Wonderland

## Description

This module is for users who want to analyze land data of [Baby Wonderland](https://land.babyswap.finance/land).

This is **unofficial** and for personal use, so please use this on own responsibility.

Also, please note that this module may not work properly if the server API change.

## Usage

This module is for [Deno](https://deno.land/).  Pleasae make sure that Deno is installed on your PC.

Once the land data is fetched from BabySwap Server, it will be stored into in-memory database ([SQLite](https://www.sqlite.org/)) and the database will not be updated until `refresh()` is called.

To prevent server overload, `refresh()` will be skipped within 1 minute.

Please make sure this module is for personal use only.

I always appreciate great work of [BabySwap](https://babyswap.finance/) and its innovation.

Baby is the future.  Let's nurture the future together❣️

##### example.ts

```typescript
import { getLandByLocation, refresh } from "https://raw.githubusercontent.com/babyswaplover/landb/0.2.7/mod.ts";


// Refresh database (if you want; fetch will be skipped within 1 minute from last fetch to prevent server overload)
// await refresh();

// get Land of City Center
const cityCenterLand = getLandByLocation(0, 0);
console.log(cityCenterLand);
```

##### Execution

```bash
$ deno run --allow-net=ld-api.babyswap.io example.ts
```

The result will be like:

```
{
  regionWeight: 30,
  regionId: 10199,
  x: -16,
  y: 5,
  imageUrl: "https://s3.ap-southeast-1.amazonaws.com/baby-upload/land/0310Mainland_Pic.png",
  imageStatus: "2",
  level: 1,
  onMarket: 0,
  userAddress: "0x3872455d74befdebee37da608b262b01a16f5045",
  tokenId: 183,
  marketX: -16,
  marketY: 5,
  signType: 0,
  signImgUrl: null,
  userTokenId: 0,
  landType: 0
}
```

## Tips

### Database file

You can save fetched data into SQLite database file.

Specify Environment variable 'LANDB_PATH'

```
$ LANDB_PATH=./wonderland.db --allow-env=LANDB_PATH --allow-net=ld-api.babyswap.io --allow-write=. --allow-read=. test.ts
```

The fetch will be executed when file doesn't exist or invoke refresh()

Also, if the file specified in 'LAND_PATH' does not have write permissions by '--allow-write', the file will be open in readonly mode.

## Analysis tool for Baby Wonderland

Here is a simple analysis tool using landb.

https://landanalyzer.deno.dev/

##### Source

https://github.com/babyswaplover/landanalyzer
