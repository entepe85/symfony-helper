import { stopParserProcess } from '../../src/nikic-php-parser';
import { getService, serversConf } from './_utils';
import { promisify } from 'util';
import * as child_process from 'child_process';

let processes: child_process.ChildProcess[] = [];

before(async function () {
    if (process.env.COMMANDS_HELPER_TYPE === 'http') {
        console.log('starting http servers...');

        for (let { folderPath, port } of serversConf) {
            let newProcess = child_process.spawn('php', ['-S', '127.0.0.1' + ':' + port, '-t', folderPath], { stdio: 'ignore' });
            processes.push(newProcess);
        }

        await promisify(setTimeout)(200 /* ms */);
    }

    console.log('initializing service...');
    await getService();
});

after(function () {
    for (let p of processes) {
        p.kill();
    }

    stopParserProcess();
});
