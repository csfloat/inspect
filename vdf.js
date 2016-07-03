/*
VDF (de)serialization
Copyright (c) 2010-2013, Anthony Garcia <anthony@lagg.me>
Distributed under the ISC License (see LICENSE)

Ported to node.js by Rob Jackson - rjackson.me.
*/

var util = require("util"),
    absorb = require('absorb');

var STRING = '"',
    NODE_OPEN = '{',
    NODE_CLOSE = '}',
    BR_OPEN = '[',
    BR_CLOSE = ']',
    COMMENT = '/',
    CR = '\r',
    LF = '\n',
    SPACE = ' ',
    TAB = '\t',
    WHITESPACE = [SPACE, "\t", "\r", "\n"];

function _symtostr(line, i, token) {
    token = token || STRING;

    var opening = i + 1,
        closing = opening;

    ci = line.indexOf(token, opening);
    while (ci !== -1) {
        if (line.substring(ci - 1, ci) !== "\\") {
            closing = ci;
            break;
        }
        ci = line.indexOf(token, ci + 1);
    }

    finalstr = line.substring(opening, closing);
    return [finalstr, i + finalstr.length + 1];
}

function _unquotedtostr(line, i) {
    var ci = i;
    while (ci < line.length) {
        if (WHITESPACE.indexOf(line.substring(ci, ci + 1)) > -1) {
            break;
        }
        ci += 1;
    }
    return [line.substring(i, ci), ci];
}

function _parse(stream, ptr) {
    ptr = ptr || 0;

    var laststr,
        lasttok,
        lastbrk,
        i = ptr,
        next_is_value = false,
        deserialized = {};

    while (i < stream.length) {
        var c = stream.substring(i, i + 1);

        if (c === NODE_OPEN) {
            next_is_value = false;  // Make sure the next string is interpreted as a key.

            var parsed = _parse(stream, i + 1);

            if (laststr in deserialized) {
                //if (!Array.isArray(deserialized[laststr])) deserialized[laststr] = [deserialized[laststr]];
                deserialized[laststr] = absorb(deserialized[laststr], parsed[0]);
                //deserialized[laststr].push(parsed[0]);
            }
            else {
                deserialized[laststr] = parsed[0];
            }
            i = parsed[1];
        }
        else if (c === NODE_CLOSE) {
            return [deserialized, i];
        }
        else if (c === BR_OPEN) {
            var _string = _symtostr(stream, i, BR_CLOSE);
            lastbrk = _string[0];
            i = _string[1];
        }
        else if (c === COMMENT) {
            if ((i + 1) < stream.length && stream.substring(i + 1, i + 2) === "/") {
                i = stream.indexOf("\n", i);
            }
        }
        else if (c === CR || c === LF) {
            var ni = i + 1;
            if (ni < stream.length && stream.substring(ni, ni + 1) === LF) {
                i = ni;
            }
            if (lasttok != LF) {
                c = LF;
            }
        }
        else if (c !== SPACE && c !== TAB) {
            var _string = (c === STRING ? _symtostr : _unquotedtostr)(stream, i);
            string = _string[0];
            i = _string[1];

            if (lasttok === STRING && next_is_value) {
                if (deserialized[laststr] && lastbrk !== undefined) {
                    lastbrk = undefined;  // Ignore this sentry if it's the second bracketed expression
                }
                else {
                    deserialized[laststr] = string;
                }
            }
            c = STRING;  // Force c == string so lasttok will be set properly.
            laststr = string;
            next_is_value = !next_is_value;
        }
        else {
            c = lasttok;
        }

        lasttok = c;
        i += 1;
    }

    return [deserialized, i];
}

function _dump(obj, indent, mult) {
    indent = indent || 0,
    mult = mult || 2;

    function _i() {
        return Array(indent * mult + 1).join(" ");
    }

    var nodefmt = '\n' + _i() + '"%s"\n' + _i() + '{\n%s' + _i() + '}\n\n',
        podfmt = _i() + '"%s" "%s"\n',
        lstfmt = _i() + (Array(mult + 1).join(" ")) + '"%s" "1"';

    indent += 1;

    var nodes = [];

    for (var k in obj) {
        var v = obj[k];
        if (typeof v === 'object' && !(v instanceof Array)) {
            nodes.push(util.format(nodefmt, k, _dump(v, indent, mult)));
        }
        else if (v instanceof Array) {
            lst = v.map(function(more_v){ return util.format(lstfmt, more_v); });
            nodes.push(util.format(nodefmt, k, lst.join("\n") + '\n'));
        }
        else {
            nodes.push(util.format(podfmt, k, v));
        }
    }

    indent -= 1;
    return nodes.join("");
}
exports.parse = function parse(string) {
    var _parsed = _parse(string);
    res = _parsed[0];
    ptr = _parsed[1];
    return res;
};

exports.dump = function dump(obj) {
    return _dump(obj);
};
