const { default: http } = require("starless-http");
const { brewBlankExpressFunc } = require("code-alchemy");
const domains = require("../domains.json");
const settings = require("../settings.json");
const fs = require("node:fs");
const { domainsJsonPath, settingsJsonPath } = require("../constants");
const { default: server } = require("starless-server");

module.exports = brewBlankExpressFunc(async (req, res) => {
  const { sharedMemory } = server;
  let { key } = req.params;

  const method = req.method.toLowerCase();

  if (key == "cache" && method == "get") {
    return res.json({
      code: 200,
      message: "Successful",
      data: sharedMemory.getAll(),
    });
  } else if (key == "add-domain" && method == "post") {
    for (const [key, value] of Object.entries(req.body)) {
      domains[key] = value;
    }
    fs.writeFileSync(domainsJsonPath, JSON.stringify(domains, null, 2));
    return res.json({
      code: 200,
      message: "Domain added successful",
      data: domains,
    });
  } else if (key == "add-setting" && method == "post") {
    const { key, options } = req.body;

    settings[key] = { ...settings[key], ...options };
    fs.writeFileSync(settingsJsonPath, JSON.stringify(settings, null, 2));
    return res.json({
      code: 200,
      message: "Setting added successful",
      data: settings[key],
    });
  }
  const io = server.getIO();

  if (!(key in domains)) {
    const error = new Error("Not found!");
    error.status = 404;
    error.body = {
      code: 404,
      message: error.message,
    };
    throw error;
  }
  const baseUrl = domains[key];

  delete req.headers["postman-token"];
  const cacheKeyData = {
    query: req.query,
    body: req.body,
    headers: req.headers,
    method: req.method,
    url: `${baseUrl}${req.url}`,
  };

  const cacheKey = JSON.stringify(cacheKeyData);

  if (sharedMemory.get(cacheKey)) {
    for (const [key, value] of Object.entries(
      sharedMemory.get(cacheKey).headers
    )) {
      if (key.toLowerCase() != "transfer-encoding") {
        res.setHeader(key, value);
      }
    }
    if (typeof sharedMemory.get(cacheKey).data == "object") {
      res.setHeader("Content-Type", "application/json");
    }

    res.send(sharedMemory.get(cacheKey).data);
  }

  let response = null;
  let err = null;
  const options = {
    // params: req.query,
    headers: req.headers,
  };
  if (method == "get" || method == "delete") {
    [response, err] = await http[method](`${baseUrl}${req.url}`, options);
  } else {
    [response, err] = await http[method](
      `${baseUrl}${req.url}`,
      req.body,
      options
    );
  }

  if (err) {
    if ("response" in err) {
      response = err.response;
    } else {
      throw err;
    }
  }
  console.log(response.data);
  if (!sharedMemory.get(cacheKey)) {
    if ("headers" in response) {
      for (const [key, value] of Object.entries(response.headers)) {
        if (key.toLowerCase() != "transfer-encoding") {
          res.setHeader(key, value);
        }
      }
    }
    if (typeof response.data == "object") {
      res.setHeader("Content-Type", "application/json");
    }
  }

  if (!sharedMemory.get(cacheKey)) {
    res.send(response.data);
  }
  let skipCache = false;
  if (key in settings && "excludes" in settings[key]) {
    for (const item of settings[key].excludes) {
      if (
        cacheKeyData.url.match(new RegExp(item.url)) &&
        method == item.method
      ) {
        skipCache = true;
        break;
      }
    }
  }
  if (response.status < 400 && !skipCache) {
    const newCacheData = {
      data: response.data,
      headers: "headers" in response ? response.headers : {},
    };
    sharedMemory.set(cacheKey, newCacheData);
    if (
      cacheKeyData &&
      JSON.stringify(newCacheData) != JSON.stringify(cacheKeyData)
    ) {
      io.emit("cache:update", req.query.cachesession);
    }
  }
  if (skipCache) {
    sharedMemory.set(cacheKey, null);
  }
});
