'use strict';

const express = require('express');
const httpProxy = require('http-proxy-middleware');
const request = require('supertest');
const testServer = require('../helpers/test-server');
const config = require('../fixtures/client-config/webpack.config');
const runBrowser = require('../helpers/run-browser');
const [port1, port2, port3] = require('../ports-map').ClientOptions;
const { beforeBrowserCloseDelay } = require('../helpers/puppeteer-constants');

describe('Client code', () => {
  function startProxy(port, cb) {
    const proxy = express();
    proxy.use(
      '/',
      httpProxy({
        target: `http://localhost:${port1}`,
        ws: true,
        changeOrigin: true,
      })
    );
    return proxy.listen(port, cb);
  }

  beforeAll((done) => {
    const options = {
      compress: true,
      port: port1,
      host: '0.0.0.0',
      disableHostCheck: true,
      inline: true,
      hot: true,
      watchOptions: {
        poll: true,
      },
      quiet: true,
    };
    testServer.startAwaitingCompilation(config, options, done);
  });

  afterAll(testServer.close);

  // [HPM] Proxy created: /  ->  http://localhost:{port1}
  describe('behind a proxy', () => {
    let proxy;

    beforeAll((done) => {
      proxy = startProxy(port2, done);
    });

    afterAll((done) => {
      proxy.close(done);
    });

    it('responds with a 200', async () => {
      {
        const req = request(`http://localhost:${port2}`);
        await req.get('/sockjs-node').expect(200, 'Welcome to SockJS!\n');
      }
      {
        const req = request(`http://localhost:${port1}`);
        await req.get('/sockjs-node').expect(200, 'Welcome to SockJS!\n');
      }
    });

    it('requests websocket through the proxy with proper port number', (done) => {
      runBrowser().then(({ page, browser }) => {
        page
          .waitForRequest((requestObj) => requestObj.url().match(/sockjs-node/))
          .then((requestObj) => {
            page.waitFor(beforeBrowserCloseDelay).then(() => {
              browser.close().then(() => {
                expect(requestObj.url()).toContain(
                  `http://localhost:${port1}/sockjs-node`
                );
                done();
              });
            });
          });
        page.goto(`http://localhost:${port2}/main`);
      });
    });
  });
});

describe('Client complex inline script path', () => {
  beforeAll((done) => {
    const options = {
      port: port2,
      host: '0.0.0.0',
      inline: true,
      watchOptions: {
        poll: true,
      },
      public: 'myhost.test',
      sockPath: '/foo/test/bar/',
      quiet: true,
    };
    testServer.startAwaitingCompilation(config, options, done);
  });

  afterAll(testServer.close);

  describe('browser client', () => {
    it('uses the correct public hostname and sockPath', (done) => {
      runBrowser().then(({ page, browser }) => {
        page
          .waitForRequest((requestObj) =>
            requestObj.url().match(/foo\/test\/bar/)
          )
          .then((requestObj) => {
            page.waitFor(beforeBrowserCloseDelay).then(() => {
              browser.close().then(() => {
                expect(requestObj.url()).toContain(
                  `http://myhost.test:${port2}/foo/test/bar/`
                );
                done();
              });
            });
          });
        page.goto(`http://localhost:${port2}/main`);
      });
    });
  });
});

describe('Client complex inline script path with sockPort', () => {
  beforeAll((done) => {
    const options = {
      port: port2,
      host: '0.0.0.0',
      inline: true,
      watchOptions: {
        poll: true,
      },
      sockPath: '/foo/test/bar/',
      sockPort: port3,
      quiet: true,
    };
    testServer.startAwaitingCompilation(config, options, done);
  });

  afterAll(testServer.close);

  describe('browser client', () => {
    it('uses the correct sockPort', (done) => {
      runBrowser().then(({ page, browser }) => {
        page
          .waitForRequest((requestObj) =>
            requestObj.url().match(/foo\/test\/bar/)
          )
          .then((requestObj) => {
            page.waitFor(beforeBrowserCloseDelay).then(() => {
              browser.close().then(() => {
                expect(requestObj.url()).toContain(
                  `http://localhost:${port3}/foo/test/bar`
                );
                done();
              });
            });
          });

        page.goto(`http://localhost:${port2}/main`);
      });
    });
  });
});

// previously, using sockPort without sockPath had the ability
// to alter the sockPath (based on a bug in client-src/default/index.js)
// so we need to make sure sockPath is not altered in this case
describe('Client complex inline script path with sockPort, no sockPath', () => {
  beforeAll((done) => {
    const options = {
      port: port2,
      host: '0.0.0.0',
      inline: true,
      watchOptions: {
        poll: true,
      },
      sockPort: port3,
      quiet: true,
    };
    testServer.startAwaitingCompilation(config, options, done);
  });

  afterAll(testServer.close);

  describe('browser client', () => {
    it('uses the correct sockPort and sockPath', (done) => {
      runBrowser().then(({ page, browser }) => {
        page
          .waitForRequest((requestObj) => requestObj.url().match(/sockjs-node/))
          .then((requestObj) => {
            page.waitFor(beforeBrowserCloseDelay).then(() => {
              browser.close().then(() => {
                expect(requestObj.url()).toContain(
                  `http://localhost:${port3}/sockjs-node`
                );
                done();
              });
            });
          });
        page.goto(`http://localhost:${port2}/main`);
      });
    });
  });
});

describe('Client complex inline script path with sockHost', () => {
  beforeAll((done) => {
    const options = {
      port: port2,
      host: '0.0.0.0',
      inline: true,
      watchOptions: {
        poll: true,
      },
      sockHost: 'myhost.test',
      quiet: true,
    };
    testServer.startAwaitingCompilation(config, options, done);
  });

  afterAll(testServer.close);

  describe('browser client', () => {
    it('uses the correct sockHost', (done) => {
      runBrowser().then(({ page, browser }) => {
        page
          .waitForRequest((requestObj) => requestObj.url().match(/sockjs-node/))
          .then((requestObj) => {
            page.waitFor(beforeBrowserCloseDelay).then(() => {
              browser.close().then(() => {
                expect(requestObj.url()).toContain(
                  `http://myhost.test:${port2}/sockjs-node`
                );
                done();
              });
            });
          });
        page.goto(`http://localhost:${port2}/main`);
      });
    });
  });
});

describe('Client console.log', () => {
  const baseOptions = {
    port: port2,
    host: '0.0.0.0',
    quiet: true,
  };
  const cases = [
    {
      title: 'hot disabled',
      options: {
        hot: false,
      },
    },
    {
      title: 'hot enabled',
      options: {
        hot: true,
      },
    },
    {
      title: 'liveReload disabled',
      options: {
        liveReload: false,
      },
    },
    {
      title: 'liveReload enabled',
      options: {
        liveReload: true,
      },
    },
    {
      title: 'clientLogLevel is silent',
      options: {
        clientLogLevel: 'silent',
      },
    },
  ];

  for (const { title, options } of cases) {
    it(title, async () => {
      const res = [];
      const testOptions = Object.assign({}, baseOptions, options);

      await new Promise((resolve) => {
        testServer.startAwaitingCompilation(config, testOptions, resolve);
      });

      const { page, browser } = await runBrowser();

      page.goto(`http://localhost:${port2}/main`);
      page.on('console', ({ _text }) => {
        res.push(_text);
      });

      // wait for load before closing the browser
      await page.waitForNavigation({ waitUntil: 'load' });
      await page.waitFor(beforeBrowserCloseDelay);
      await browser.close();

      // Order doesn't matter, maybe we should improve that in future
      expect(res.sort()).toMatchSnapshot();

      await new Promise((resolve) => {
        testServer.close(resolve);
      });
    });
  }
});
