const { Pool } = require('pg'),
    utils = require('./utils'),
    winston = require('winston');


class Postgres {
    constructor(url) {
        this.pool = new Pool({
            connectionString: url
        });
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
            PRIMARY KEY (a, ms, d)
        )`);

        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_stickers ON items USING gin (stickers jsonb_path_ops) 
                                WHERE stickers IS NOT NULL`);
        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_paintwear ON items (paintwear)`);
        await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS i_unique_item ON 
                                items (defindex, paintindex, paintseed, paintwear)`);
    }

    async insertItemData(item) {
        item = Object.assign({}, item);

        // Store float as int32 to prevent float rounding errors
        // Postgres doesn't support unsigned types, so we use signed here
        const buf = Buffer.alloc(4);
        buf.writeFloatBE(item.floatvalue, 0);
        item.paintwear = buf.readInt32BE(0);

        if (item.floatvalue <= 0) {
            // Only insert weapons, naive check
            return;
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

        try {
            const sm = item.s !== '0' ? item.s : item.m;
            const isStattrak = item.killeatervalue !== null;
            const isSouvenir = item.quality === 12;

            const props = Postgres.storeProperties(item.origin, item.quality, item.rarity);

            // We define unique items as those that have the same skin, wear, and paint seed
            // Duped items will be represented as one item in this case
            // If the item already exists, update it's link properties and stickers, these are the only attributes
            // that can change
            await this.pool.query(`INSERT INTO items VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
             ON CONFLICT (paintwear, defindex, paintindex, paintseed) DO UPDATE SET ms=$12, a=$13, d=$14, stickers=$15`,
                [sm, item.a, item.d, item.paintseed, item.paintwear, item.defindex, item.paintindex, isStattrak,
                    isSouvenir, props, JSON.stringify(stickers), sm, item.a, item.d, JSON.stringify(stickers)]);
        } catch (e) {
            winston.warn(e);
        }
    }

    getItemData(params) {
        // Shallow copy
        params = Object.assign({}, params);
        params.s = utils.unsigned64ToSigned(params.s).toString();
        params.a = utils.unsigned64ToSigned(params.a).toString();
        params.d = utils.unsigned64ToSigned(params.d).toString();
        params.m = utils.unsigned64ToSigned(params.m).toString();

        return this.pool.query('SELECT * FROM items WHERE a=$1 AND ms=$2 AND d=$3',
            [params.a, params.s !== '0' ? params.s : params.m, params.d]).then((res) => {
            if (res.rows.length > 0) {
                let item = res.rows[0];
                delete item.updated;

                // Correspond to existing API, ensure we can still recreate the full item name
                if (item.souvenir) {
                    item.quality = 12;
                } else {
                    item.quality = 4; // unique
                }

                if (item.stattrak) {
                    item.killeatervalue = 0;
                    item.quality = 9; // strange
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

                delete item.souvenir;
                delete item.stattrak;
                delete item.paintwear;
                delete item.ms;
                delete item.props;

                return item;
            }
        }).catch((err) => {
            winston.warn(err);
        });
    }
}

module.exports = Postgres;