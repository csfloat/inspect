const errors = require('./../errors');

// A Job encapsulates fetching multiple links for a single request
class Job {
    get ip() {
        return this.req.ip;
    }

    constructor(req, res, isBulk) {
        this.req = req;
        this.res = res;
        this.isBulk = isBulk;
        this.remainingLinks = [];

        this.index = 0;

        this.responses = {};
    }

    add(link, price) {
        this.remainingLinks.push({
            link,
            price,
            job: this,
        });
    }

    getRemainingLinks() {
        return this.remainingLinks;
    }

    remainingSize() {
        return this.remainingLinks.length;
    }

    getLink(aParam) {
        return this.remainingLinks.find(e => e.link.getParams().a == aParam);
    }

    setResponseRemaining(response) {
        for (const link of this.remainingLinks) {
            this.setResponse(link.link.getParams().a, response);
        }
    }

    setResponse(assetId, response) {
        const index = this.remainingLinks.findIndex(e => e.link.getParams().a == assetId);
        if (index === -1) {
            return;
        }

        if (response instanceof errors.Error) {
            response = response.getJSON();
        }

        this.responses[assetId.toString()] = response;
        this.remainingLinks.splice(index, 1);

        if (this.remainingLinks.length === 0) {
            this._reply();
        }
    }

    _reply() {
        const keys = Object.keys(this.responses);

        if (keys.length === 0) {
            return;
        }

        if (this.isBulk || keys.length > 1) {
            this.res.json(this.responses);
        } else {
            const response = this.responses[keys[0]];
            if (response.error) {
                this.res.status(response.status).json(response);
            } else {
                this.res.json({iteminfo: response});
            }
        }
    }
}

module.exports = Job;
