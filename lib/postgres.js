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

    async ensureSchema() {
        // TODO: Implement proper migration
        await this.pool.query(`CREATE TABLE IF NOT EXISTS items (
            ms bigint  NOT NULL,
            a  bigint  NOT NULL,
            d  bigint  NOT NULL,
            paintseed smallint NOT NULL,
            paintwear integer NOT NULL,
            defindex  smallint NOT NULL,
            paintindex smallint NOT NULL,
            stattrak   boolean NOT NULL,
            souvenir   boolean NOT NULL,
            origin    smallint NOT NULL,
            stickers jsonb,
            updated     timestamp NOT NULL,
            PRIMARY KEY (a, ms, d)
        )`);

        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_stickers ON items USING gin (stickers jsonb_path_ops) WHERE stickers IS NOT NULL`);
        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_paintwear ON items (paintwear)`);
        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_paintseed ON items (paintseed)`);
        await this.pool.query(`CREATE INDEX IF NOT EXISTS i_def_paint ON items (defindex, paintindex)`);
    }

    async insertItemData(itemdata) {
        itemdata = Object.assign({}, itemdata);

        // Store float as int32 to prevent float rounding errors
        // Postgres doesn't support unsigned types, so we use signed here
        const buf = Buffer.alloc(4);
        buf.writeFloatBE(itemdata.floatvalue, 0);
        itemdata.paintwear = buf.readInt32BE(0);

        if (itemdata.floatvalue <= 0) {
            // Only insert weapons, naive check
            return;
        }

        // Postgres doesn't support unsigned 64 bit ints, so we convert them to signed
        itemdata.s = utils.unsigned64ToSigned(itemdata.s).toString();
        itemdata.a = utils.unsigned64ToSigned(itemdata.a).toString();
        itemdata.d = utils.unsigned64ToSigned(itemdata.d).toString();
        itemdata.m = utils.unsigned64ToSigned(itemdata.m).toString();

        const stickers = itemdata.stickers.length > 0 ? itemdata.stickers.map((s) => {
            const res = {s: s.slot, i: s.stickerId};
            if (s.wear) {
                res.w = s.wear;
            }
            return res;
        }) : null;

        if (stickers) {
            // Add a property on stickers with duplicates that signifies how many dupes there are
            // Only add this property to one of the stickers in the array
            for (const sticker of stickers) {
                const matching = stickers.filter((s) => s.i === sticker.i);
                if (matching.length > 1 && !matching.find((s) => s.d > 1)) {
                    sticker.d = matching.length;
                }
            }
        }

        try {
            // Check if an item with this skin, float, and paintseed already exists
            // If so, save the history
            const existing = this.pool.query(
                'SELECT * FROM items WHERE defindex=$1 AND paintindex=$2 AND paintseed=$3 AND paintwear=$4',
                [itemdata.defindex, itemdata.paintindex, itemdata.paintseed, itemdata.paintwear]);

            if (existing.rows && existing.rows.length > 0) {
                // move the row to the history table
                if (existing.s !== '0') {
                    // only store history changes that
                }


            }
            await this.pool.query('INSERT INTO items VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())',
                [itemdata.s !== '0' ? itemdata.s : itemdata.m, itemdata.a, itemdata.d, itemdata.paintseed,
                    itemdata.paintwear, itemdata.defindex, itemdata.paintindex, itemdata.killeatervalue !== null, itemdata.quality === 12, itemdata.origin, JSON.stringify(stickers)]);
        } catch (e) {
            winston.warn(e);
        }
    }

    getItemData(params) {
        if (!params.minimal) {
            return Promise.resolve();
        }

        // Shallow copy
        params = Object.assign({}, params);
        params.s = utils.unsigned64ToSigned(params.s).toString();
        params.a = utils.unsigned64ToSigned(params.a).toString();
        params.d = utils.unsigned64ToSigned(params.d).toString();
        params.m = utils.unsigned64ToSigned(params.m).toString();

        return this.pool.query('SELECT * FROM items WHERE a=$1 AND ms=$2 AND d=$3',
            [params.a, params.s !== '0' ? params.s : params.m, params.d]).then((res) => {
            if (res.rows.length > 0) {
                const item = res.rows[0];
                delete item.updated;

                // Correspond to existing API
                if (item.souvenir) {
                    item.quality = 12;
                }
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

                console.log(item);

                return item;
            }
        }).catch((err) => {
            winston.warn(err);
        });
    }
}

module.exports = Postgres;