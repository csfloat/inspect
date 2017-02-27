const EventEmitter = require('events').EventEmitter;

class Queue extends EventEmitter {
    constructor(attempts) {
        super();

        this.queue = [];
        this.attempts = attempts;
        this.running = false;
    }

    process(concurrency, handler) {
        this.handler = handler;
        this.concurrency = concurrency;
        this.processing = 0;

        this.start();
    }

    addJob(data, max_attempts, cb) {
        let job = {
            'data': data,
            'max_attempts': max_attempts,
            'attempts': 0
        };

        this.queue.push(job);

        if (cb) cb();
    }

    start() {
        if (this.running) return;

        this.interval = setInterval(() => {
            if (this.queue.length > 0 && this.processing < this.concurrency) {
                // there is a free bot, process the job
                let job = this.queue.shift();

                this.processing += 1;

                this.handler(job, this.createDone(job));
            }
        }, 5);
    }

    createDone(job) {
        return (success) => {

            this.processing -= 1;

            if (!success) {
                job.attempts++;

                if (job.attempts === job.max_attempts) {
                    // job failed
                    this.emit('job failed', job)
                }
                else {
                    // try again
                    this.queue.unshift(job);
                }
            }
        }
    }

    pause() {
        if (this.running) clearInterval(this.interval);
    }
}

module.exports = Queue;
