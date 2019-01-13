const EventEmitter = require('events').EventEmitter;

class Queue extends EventEmitter {
    constructor() {
        super();

        this.queue = [];
        this.users = {};
        this.running = false;
    }

    process(concurrency, handler) {
        this.handler = handler;
        this.concurrency = concurrency;
        this.processing = 0;

        this.start();
    }

    addJob(data, max_attempts) {
        let job = {
            'data': data,
            'max_attempts': max_attempts,
            'attempts': 0
        };

        this.queue.push(job);

        if (!(data.ip in this.users)) {
            this.users[data.ip] = 0;
        }

        this.users[data.ip]++;

        this.checkQueue();

        return job;
    }

    checkQueue() {
        if (!this.running) return;

        if (this.queue.length > 0 && this.processing < this.concurrency) {
            // there is a free bot, process the job
            let job = this.queue.shift();

            this.processing += 1;

            this.handler(job)
            .then((delay) => {
                if (!delay) delay = 0;

                // Allow users to request again before the promise resolve delay
                this.users[job.data.ip]--;

                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve();
                    }, delay);
                });
            })
            .catch(() => {
                job.attempts++;

                if (job.attempts === job.max_attempts) {
                    // job failed
                    this.emit('job failed', job);
                    this.users[job.data.ip]--;
                }
                else {
                    // try again
                    this.queue.unshift(job);
                }
            })
            .then(() => {
                this.processing -= 1;
                this.checkQueue();
            });
        }
    }

    start() {
        if (!this.running) {
            this.running = true;
            this.checkQueue();
        }
    }

    pause() {
        if (this.running) this.running = false;
    }

    /**
     * Returns number of requests the ip currently has queued
     */
    getUserQueuedAmt(ip) {
        return this.users[ip] || 0;
    }
}

module.exports = Queue;
