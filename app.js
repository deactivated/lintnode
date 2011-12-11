/*jslint
    node: true, plusplus: true
*/

/* HTTP interface to JSLint.

   Takes roughly half the time to jslint something with this than to
   start up a new rhino instance on every invocation.
   
   Invoke from bash script like:
     curl --form source="<${1}" ${JSLINT_URL}
*/

'use strict';

var
  sys = require('sys'),
  http = require('http'),
  multipart = require('./multipart'),
  JSLINT = require('./jslint');

var jslint_options = {
  bitwise: true,
  eqeqeq: true,
  immed: true,
  newcap: true,
  nomen: true,
  onevar: true,
  plusplus: true,
  regexp: true,
  rhino: true,
  undef: true,
  white: true,

  browser: true,
  devel: true,

  maxerr: 500,
  indent: 2,
  predef: ['$', 'jQuery']
};

function formatErrors(errors) {
  var output = [], i, e;
  function write(s) {
    output.push(s + '\n');
  }

  for (i = 0; errors[i]; i++) {
    e = errors[i];
    write(e.line + ":" + e.character + ":" + e.reason);
  }
  return output.join('');
}


function parse_multipart(req) {
  var parser = multipart.parser();
  parser.headers = req.headers;
  req.addListener("data", function (chunk) {
    parser.write(chunk);
  });
  req.addListener("end", function () {
    parser.close();
  });
  return parser;
}


var server = http.createServer(function (req, res) {
  function malformed() {
    res.writeHead(400, {"content-type": "text/plain"});
    res.close();
  }

  var 
    mp = parse_multipart(req),
    buf = [];

  if (req.headers.expect &&
      req.headers.expect.indexOf("100-continue") >= 0) {
    req.connection.write("HTTP/1.1 100 Continue\r\n\r\n");
  }

  mp.onError = function (err) {
    malformed();
  };
  mp.onPartBegin = function (part) {
    if (part.name !== "source") {
      malformed();
    }
  };
  mp.onData = function (chunk) {
    buf.push(chunk);
  };
  mp.onEnd = function () {
    var data = buf.join(""), lint;

    JSLINT.JSLINT(data, jslint_options);
    lint = formatErrors(JSLINT.JSLINT.errors);
    res.writeHead(200, {"Content-Type": "text/plain",
                        "Content-Length": lint.length});
    res.write(lint);
    res.end();
  };
});

var port = (process.argv.length >= 4 &&
            process.argv[2] === "--port" &&
            /^\d+$/.test(process.argv[3])) ?
  parseInt(process.argv[3], 10) : 8000;

server.listen(port);
sys.puts("listening");
