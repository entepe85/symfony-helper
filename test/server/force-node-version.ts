import * as assert from 'assert';

describe('node version', function () {
    it('must be 8.9', function () {
        if (process.env.FORCE_NODE_8_9 === 'true') {
            if (!process.version.startsWith('v8.9.')) {
                assert.fail('unexpected "node" version');
            }
        } else {
            this.skip();
        }
    });
});
