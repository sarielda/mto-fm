# Monitoring Dashboard Web UI

This Web UI is intended to provide a dashboard for monitoring real-time state of fleets. The UI is optimized for iPad and PC.

## Developer note
TENTATIVE

This monitoring UI is implemented using Angular2 with typescript. It requires build process to work with browser.
To support various scenario describes in the section below, the Web UI is provided as an npm package named `iota-driving-analyzer-webclient`.


### development scenarios

NOTE: **Windows** developers are recommended to install the following packages to avoid `PATH` issues.
- `npm install typescript -g`
- `npm install typings -g`


### Deployment patterns

#### Local - light-server (for client development)

- Prepare development tools
  - `cd webclient && npm install` - install typescript, definitions, and dependencies
- Start local server
  - `npm start`
    - transpile `*.ts` files
    - start server at http://localhost:3123/
    - open http://localhost:3123/webclient in Web browser
  - Note that all the REST APIs from the pages loaded from this server are redirected to port 3000. So that you can test the client with your local server.
  - The resource hosted by the local-server
    - The `./webclient` is mapped to `/webclient`
    - All the changes to \*.ts files are tracked and transpiled and they automatically refreshes browser
    - NOTE that when the client is hosted at port 3123, all the REST API invocations are redirected to port 3000.
- Start express server
  - Prepare your NodeJS launch file as follow (`myapp.js` here), then
  - `iota-starter-server-fleetmanagement$ node myapp` to start server
    - The server starts at http://localhost:3000/ by default

```
// process.env.DEBUG = ''; // add as you like
process.env.NODE_ENV = 'development'; // set nodejs to development mode
process.env.PORT = '3000'; // set PORT to 3000

process.env.APP_USER = 'none'; // remove authentication
process.env.APP_PASSWORD = 'none';

// VCAP_SERVICES
process.env.VCAP_SERVICES = JSON.stringify(
  // PUT YOUR BLUEMIX VCAP_SERVICES ENVIRONMENT VARIABLE HERE
  // { ... }
);
// delegate to the original app
require('./app.js');
```

#### Local - Express (for server development)

- Transpile WebClient
  - `cd webclient && npm install` - install typescript and type definitions
  - `npm run tsc` - transpile \*.ts files
- Run the Express server as usual
  - NOTE: here expects `NODE_ENV=development` environment variable is set (when you use Eclipse, it's automatically set).
- Runtime
  - The `./webclient` is mapped to `/webclient`
  - The `./webclient/npm_modules` is mapped to `/webclient/npm_modules`

#### Bluemix

- Build process (at the DevOps services)
  - Builds the WebClient by `cd ./webclient && npm run tsc && npm run gulp`
    - `*.ts` files are transpiled to `*.js` files.
    - `*.js` files are bundled and copied to `dist/js` directory
- Deploy process (at DevOps service)
  - `cf push`
    - Note that all files under `node_modules` are excluded
- CF build (in the NodeJS runtime)
  - `npm install`
    - Builds the `./npm_modules` directory
      - NOTE: the content of the directory is cached and never been updated.
- Runtime
  - The `./webclient/index.html` is mapped to `/webclient/dist/index.html`
  - The `./webclient/js` is mapped to `/webclient/dist/js`
  - Other files under `./webclient` is mapped to `/webclient`
  - The `./node_modules/[pkg-name]/npm_modules` is not required because we're using `dist/js/bundle.js`, which contains all the JS files.
