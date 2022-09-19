# Personal utility for Baby Wonderland

## Description

This module is for users who want to analyze land data of [Baby Wonderland](https://land.babyswap.finance/land).

This is **unofficial** and for personal use, so please use this on own responsibility.

Also, please note that this module may not work properly if the server API change.

## Usage

This module is for [Deno](https://deno.land/).  Pleasae make sure that Deno is installed on your PC.

Once the land data is fetched from BabySwap Server, it will be stored into local file 'wonderland.db' ([SQLite](https://www.sqlite.org/)) and the file will not be updated until `refresh()` is called or the file is deleted.

To prevent server overload, `refresh()` will be skipped within 1 minute.

Please make sure this module is for personal use only.

I always appreciate great work of [BabySwap](https://babyswap.finance/) and its innovation.

Baby is the future.  Let's nurture the future together❣️

##### example.ts

```typescript
import { getLandByLocation, refresh } from "https://raw.githubusercontent.com/babyswaplover/landb/0.1.0/mod.ts";


// Refresh database (if you want; fetch will skip within 1 minute to prevent server overload)
// await refresh();

// get Land of City Center
const cityCenterLand = getLandByLocation(0, 0);
console.log(cityCenterLand);
```

##### Execution

```bash
$ deno run --allow-net=ld-api.babyswap.io --allow-read=. --allow-write=. example.ts
```

The result will be like:

```
{
  regionWeight: 30,
  regionId: 10199,
  x: -16,
  y: 5,
  imageUrl: "https://s3.ap-southeast-1.amazonaws.com/baby-upload/land/Land_Main01.png",
  imageStatus: "2",
  level: 1,
  onMarket: 0,
  userAddress: "0x3a952c1a235fe9ac5dc4baa2c0c73595ec5a70e8",
  tokenId: 183
}
```
