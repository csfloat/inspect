const { Pool } = require('pg'),
    utils = require('./utils'),
    winston = require('winston');


function flatten(arr){
    const newArr = [];
    arr.forEach(v => v.forEach(p => newArr.push(p)));
    return newArr
}

class Postgres {
    constructor(url, enableBulkInserts) {
        this.pool = new Pool({
            connectionString: url
        });

        this.enableBulkInserts = enableBulkInserts || false;

        if (enableBulkInserts) {
            this.queuedInserts = [];

            setInterval(() => {
                if (this.queuedInserts.length > 0) {
                    const copy = [...this.queuedInserts];
                    this.queuedInserts = [];
                    this.handleBulkInsert(copy);
                }
            }, 1000);
        }
    }

    connect() {
        return this.pool.connect().then(() => this.ensureSchema());
    }

    /*
        Returns the following properties in a 32 bit integer
                      rarity     quality    origin
        0000000000   00000000   00000000   00000000
        <future>      8 bits     8 bits     8 bits
     */
    static storeProperties(origin, quality, rarity) {
        return origin | (quality << 8) | (rarity << 16);
    }

    static extractProperties(prop) {
        return {
            origin: prop & ((1 << 8) - 1),
            quality: (prop >> 8) & ((1 << 8) - 1),
            rarity: (prop >> 16) & ((1 << 8) - 1)
        }
    }

    async ensureSchema() {
        await this.pool.query(`CREATE TABLE IF NOT EXISTS items (
            ms          bigint  NOT NULL,
            a           bigint  NOT NULL,
            d           bigint  NOT NULL,
            paintseed   smallint NOT NULL,
            paintwear   integer NOT NULL,
            defindex    smallint NOT NULL,
            paintindex  smallint NOT NULL,
            stattrak    boolean NOT NULL,
            souvenir    boolean NOT NULL,
            props       integer NOT NULL,
            stickers    jsonb,
            updated     timestamp NOT NULL,
            rarity      smallint NOT NULL,
            floatid     bigint  NOT NULL,
            price       integer,
            PRIMARY KEY (a)
        );

        CREATE TABLE IF NOT EXISTS history (
            floatid     bigint  NOT NULL,
            a           bigint  NOT NULL,
            steamid     bigint  NOT NULL,
            created_at  timestamp NOT NULL,
            price       integer,
            PRIMARY KEY (floatid, a)
        );

        ALTER TABLE items ADD COLUMN IF NOT EXISTS floatid BIGINT;
        ALTER TABLE items ADD COLUMN IF NOT EXISTS price INTEGER;
        ALTER TABLE items ADD COLUMN IF NOT EXISTS listed_price INTEGER;
        ALTER TABLE history ADD COLUMN IF NOT EXISTS price INTEGER;

        -- Float ID is defined as the first asset id we've seen for an item

        CREATE OR REPLACE FUNCTION is_steamid(IN val bigint)
            RETURNS boolean
            LANGUAGE 'plpgsql'
            IMMUTABLE
            PARALLEL SAFE
        AS $BODY$BEGIN
            IF val < 76561197960265728 THEN
                RETURN FALSE;
            ELSIF (val >> 56) > 5 THEN
                RETURN FALSE;
            ELSIF ((val >> 32) & ((1 << 20) - 1)) > 32 THEN
                RETURN FALSE;
            END IF;
        
            RETURN TRUE;
        END;$BODY$;
        
        CREATE OR REPLACE FUNCTION extend_history()
        RETURNS TRIGGER
        AS $$
        BEGIN
            -- Handle cases where the floatid isn't there
            IF NEW.floatid IS NULL THEN
                NEW.floatid = OLD.a;
            END IF;

            IF NEW.a = OLD.a THEN
                -- Ignore handling, no new item details, updating existing
                RETURN NEW;
            END IF;

            IF NEW.a < OLD.a THEN
                -- If we find an older asset id than the current, still want to add it to history if not there
                INSERT INTO history VALUES (NEW.floatid, NEW.a, NEW.ms, NEW.updated, NULL) ON CONFLICT DO NOTHING;
                
                -- Prevent update to this row
                RETURN NULL;
            END IF;

            IF (is_steamid(OLD.ms) AND OLD.ms != NEW.ms) OR OLD.price IS NOT NULL THEN
                -- We care about history for inventory changes or market listings that had price data
                INSERT INTO history VALUES (NEW.floatid, OLD.a, OLD.ms, OLD.updated, OLD.price);
            END IF;

            -- Reset the price if it is the same, it is possible that the item was sold for the exact same amount in a row
            -- and we clear it here, but that isn't too much of a concern for the application of the data
            -- This ensures that outdated instances contributing to the same db don't conflict state
            IF NEW.price = OLD.price OR NEW.listed_price = OLD.listed_price OR is_steamid(NEW.ms) THEN
                NEW.price = NULL;
                NEW.listed_price = NULL;
            END IF;

            RETURN NEW;
        END;
        $$
        LANGUAGE 'plpgsql';

        DROP TRIGGER IF EXISTS extend_history_trigger
            ON items;

        CREATE TRIGGER extend_history_trigger
            BEFORE UPDATE ON items
            FOR EACH ROW
            EXECUTE PROCEDURE extend_history();

        CREATE OR REPLACE FUNCTION ensure_floatid()
        RETURNS TRIGGER
        AS $$
        BEGIN
            IF NEW.floatid IS NULL THEN
                NEW.floatid = NEW.a;
            END IF;
            
            RETURN NEW;
        END;
        $$
        LANGUAGE 'plpgsql';

        DROP TRIGGER IF EXISTS ensure_floatid_trigger
            ON items;

        CREATE TRIGGER ensure_floatid_trigger
            BEFORE INSERT ON items
            FOR EACH ROW
            EXECUTE PROCEDURE ensure_floatid();
        `);

        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_stickers ON items USING gin (stickers jsonb_path_ops) 
                                WHERE stickers IS NOT NULL`);
        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_paintwear ON items (paintwear)`);
        await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS i_unique_item ON 
                                items (defindex, paintindex, paintwear, paintseed)`);
        await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS i_unique_fid ON items (floatid)`);
    }

    async insertItemData(item, price) {
        if (this.enableBulkInserts) {
            this.queuedInserts.push([item, price]);
        } else {
            await this.handleBulkInsert([[item, price]]);
        }
    }

    /**
     * Bulk handler to improve insert performance with 300+ rows at once
     * @param data [[item, price]]
     * @returns {Promise<void>}
     */
    async handleBulkInsert(data) {
        const values = [];
        const uniqueItems = new Set();

        for (let [item, price] of data) {
            item = Object.assign({}, item);

            // Store float as int32 to prevent float rounding errors
            // Postgres doesn't support unsigned types, so we use signed here
            const buf = Buffer.alloc(4);
            buf.writeFloatBE(item.floatvalue, 0);
            item.paintwear = buf.readInt32BE(0);

            if (item.floatvalue <= 0 && item.defindex !== 507) {
                // Only insert weapons, naive check
                // Special case for the 0 float Karambit
                continue;
            }

            // Postgres doesn't support unsigned 64 bit ints, so we convert them to signed
            item.s = utils.unsigned64ToSigned(item.s).toString();
            item.a = utils.unsigned64ToSigned(item.a).toString();
            item.d = utils.unsigned64ToSigned(item.d).toString();
            item.m = utils.unsigned64ToSigned(item.m).toString();

            const stickers = item.stickers.length > 0 ? item.stickers.map((s) => {
                const res = {s: s.slot, i: s.stickerId};
                if (s.wear) {
                    res.w = s.wear;
                }
                return res;
            }) : null;

            if (stickers) {
                // Add a property on stickers with duplicates that signifies how many dupes there are
                // Only add this property to one of the dupe stickers in the array
                for (const sticker of stickers) {
                    const matching = stickers.filter((s) => s.i === sticker.i);
                    if (matching.length > 1 && !matching.find((s) => s.d > 1)) {
                        sticker.d = matching.length;
                    }
                }
            }

            const ms = item.s !== '0' ? item.s : item.m;
            const isStattrak = item.killeatervalue !== null;
            const isSouvenir = item.quality === 12;

            const props = Postgres.storeProperties(item.origin, item.quality, item.rarity);

            price = price || null;

            // Prevent two of the same item from being inserted in the same statement (causes postgres to get angry)
            const key = `${item.defindex}_${item.paintindex}_${item.paintwear}_${item.paintseed}`;
            if (uniqueItems.has(key)) {
                continue;
            } else {
                uniqueItems.add(key);
            }

            values.push([ms, item.a, item.d, item.paintseed, item.paintwear, item.defindex, item.paintindex, isStattrak,
                isSouvenir, props, JSON.stringify(stickers), item.rarity, price]);
        }

        if (values.length === 0) {
            return;
        }

        try {
            const query = Postgres.buildQuery(values.length);
            await this.pool.query(query, flatten(values));
            winston.debug(`Inserted/updated ${values.length} items`)
        } catch (e) {
            winston.warn(e);
        }
    }

    static buildQuery(itemCount) {
        const values = [];
        let i = 1;

        // Builds binding pattern such as ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now(), $12, NULL, $13)
        for (let c = 0; c < itemCount; c++) {
            values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}::jsonb, now(), $${i++}, NULL, $${i++})`);
        }

        return `INSERT INTO items (ms, a, d, paintseed, paintwear, defindex, paintindex, stattrak, souvenir, props, stickers, updated, rarity, floatid, price)
                VALUES ${values.join(', ')} ON CONFLICT(defindex, paintindex, paintwear, paintseed) DO UPDATE SET ms=excluded.ms, a=excluded.a, d=excluded.d, stickers=excluded.stickers, updated=now()`;
    }

    updateItemPrice(assetId, price) {
        return this.pool.query(`UPDATE items SET price = $1 WHERE a = $2`, [price, assetId]);
    }

    async getItemData(links) {
        // Chunking into db calls of 100 each is more performant
        const chunked = utils.chunkArray(links, 100);
        const promises = chunked.map(e => this._getItemData(e));
        const results = await Promise.all(promises);

        // Flatten results
        return results.reduce((acc, val) => acc.concat(val), []);
    }

    async _getItemData(links) {
        const aValues = links.map(e => utils.unsigned64ToSigned(e.getParams().a));

        const result = await this.pool.query(`
            SELECT *, 
               (SELECT Count(*)+1 
                FROM   (SELECT * 
                        FROM   items T 
                        WHERE  T.paintwear < S.paintwear 
                               AND T.defindex = S.defindex 
                               AND T.paintindex = S.paintindex 
                               AND T.stattrak = S.stattrak 
                               AND T.souvenir = S.souvenir 
                        ORDER  BY T.paintwear 
                        LIMIT  1000) as a) AS low_rank,
                (SELECT Count(*)+1
                FROM   (SELECT * 
                        FROM   items J 
                        WHERE  J.paintwear > S.paintwear 
                               AND J.defindex = S.defindex 
                               AND J.paintindex = S.paintindex 
                               AND J.stattrak = S.stattrak 
                               AND J.souvenir = S.souvenir 
                        ORDER  BY J.paintwear DESC
                        LIMIT  1000) as b) AS high_rank 
            FROM   items S
            WHERE  a= ANY($1::bigint[])`, [aValues]);

        return result.rows.map((item) => {
            delete item.updated;

            // Correspond to existing API, ensure we can still recreate the full item name
            if (item.stattrak) {
                item.killeatervalue = 0;
            } else {
                item.killeatervalue = null;
            }

            item.stickers = item.stickers || [];
            item.stickers = item.stickers.map((s) => {
                return {
                    stickerId: s.i,
                    slot: s.s,
                    wear: s.w,
                }
            });

            item = Object.assign(Postgres.extractProperties(item.props), item);

            const buf = Buffer.alloc(4);
            buf.writeInt32BE(item.paintwear, 0);
            item.floatvalue = buf.readFloatBE(0);

            item.a = utils.signed64ToUnsigned(item.a).toString();
            item.d = utils.signed64ToUnsigned(item.d).toString();
            item.ms = utils.signed64ToUnsigned(item.ms).toString();

            if (utils.isSteamId64(item.ms)){
                item.s = item.ms;
                item.m = '0';
            } else {
                item.m = item.ms;
                item.s = '0';
            }

            item.high_rank = parseInt(item.high_rank);
            item.low_rank = parseInt(item.low_rank);

            // Delete the rank if above 1000 (we don't get ranking above that)
            if (item.high_rank === 1001) {
                delete item.high_rank;
            }

            if (item.low_rank === 1001) {
                delete item.low_rank;
            }

            delete item.souvenir;
            delete item.stattrak;
            delete item.paintwear;
            delete item.ms;
            delete item.props;
            delete item.price;
            delete item.listed_price;
            delete item.dupe_count;

            return item;
        });
    }

    getItemRank(id) {
        return this.pool.query(`SELECT (SELECT Count(*)+1
                                        FROM   (SELECT * 
                                                FROM   items T 
                                                WHERE  T.paintwear < S.paintwear 
                                                       AND T.defindex = S.defindex 
                                                       AND T.paintindex = S.paintindex 
                                                       AND T.stattrak = S.stattrak 
                                                       AND T.souvenir = S.souvenir 
                                                ORDER  BY T.paintwear 
                                                LIMIT  1000) as a) AS low_rank,
                                        (SELECT Count(*)+1 
                                        FROM   (SELECT * 
                                                FROM   items J 
                                                WHERE  J.paintwear > S.paintwear 
                                                       AND J.defindex = S.defindex 
                                                       AND J.paintindex = S.paintindex 
                                                       AND J.stattrak = S.stattrak 
                                                       AND J.souvenir = S.souvenir 
                                                ORDER  BY J.paintwear DESC
                                                LIMIT  1000) as b) AS high_rank 
                                FROM   items S
                                WHERE  a=$1`,
            [id]).then((res) => {
                if (res.rows.length > 0) {
                    const item = res.rows[0];
                    const result = {};

                    if (item.high_rank != 1001) {
                        result.high_rank = parseInt(item.high_rank);
                    }
                    if (item.low_rank != 1001) {
                        result.low_rank = parseInt(item.low_rank);
                    }

                    return result;
                } else {
                    return {};
                }
            });
    }
}

module.exports = Postgres;
