import { stopParserProcess } from '../../src/nikic-php-parser';
import { getService } from './_utils';

before(async function () {
    console.log('initializing service...');
    await getService();
});

after(function () {
    stopParserProcess();
});
