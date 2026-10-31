// \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
// node_modules/hono/dist/http-exception.js
/**
* `HTTPException` must be used when a fatal error such as authentication failure occurs.
*
* @see {@link https://hono.dev/docs/api/exception}
*
* @param {StatusCode} status - status code of HTTPException
* @param {HTTPExceptionOptions} options - options of HTTPException
* @param {HTTPExceptionOptions["res"]} options.res - response of options of HTTPException
* @param {HTTPExceptionOptions["message"]} options.message - message of options of HTTPException
* @param {HTTPExceptionOptions["cause"]} options.cause - cause of options of HTTPException
*
* @example
* ```ts
* import { HTTPException } from 'hono/http-exception'
*
* // ...
*
* app.post('/auth', async (c, next) => {
*   // authentication
*   if (authorized === false) {
*     throw new HTTPException(401, { message: 'Custom error message' })
*   }
*   await next()
* })
* ```
*/
var HTTPException = class extends Error {
	res;
	status;
	/**
	* Creates an instance of `HTTPException`.
	* @param status - HTTP status code for the exception. Defaults to 500.
	* @param options - Additional options for the exception.
	*/
	constructor(status = 500, options) {
		super(options?.message, { cause: options?.cause });
		this.res = options?.res;
		this.status = status;
	}
	/**
	* Returns the response object associated with the exception.
	* If a response object is not provided, a new response is created with the error message and status code.
	* @returns The response object.
	*/
	getResponse() {
		if (this.res) return new Response(this.res.body, {
			status: this.status,
			headers: this.res.headers
		});
		return new Response(this.message, { status: this.status });
	}
};
// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = Symbol();
// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
	return new Response(arrayBuffer, { headers: { "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase()) } }).formData();
};
// node_modules/hono/dist/utils/body.js
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = Object.create(null)) => {
	const { all = false, dot = false } = options;
	const mediaType = (isRawRequest(request) ? request.headers : request.raw.headers).get("Content-Type")?.split(";")[0].trim().toLowerCase();
	if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") return parseFormData(request, {
		all,
		dot
	});
	return {};
};
/**
* Parses form data from a request.
*
* @template T - The type of the parsed body data.
* @param {HonoRequest | Request} request - The request object containing form data.
* @param {ParseBodyOptions} options - Options for parsing the form data.
* @returns {Promise<T>} The parsed body data.
*/
async function parseFormData(request, options) {
	if (!isRawRequest(request) && request.bodyCache.formData) return convertFormDataToBodyData(await request.bodyCache.formData, options);
	const headers = isRawRequest(request) ? request.headers : request.raw.headers;
	const formDataPromise = bufferToFormData(await request.arrayBuffer(), headers.get("Content-Type") || "");
	if (!isRawRequest(request)) request.bodyCache.formData = formDataPromise;
	const formData = await formDataPromise;
	if (formData) return convertFormDataToBodyData(formData, options);
	return {};
}
/**
* Converts form data to body data based on the provided options.
*
* @template T - The type of the parsed body data.
* @param {FormData} formData - The form data to convert.
* @param {ParseBodyOptions} options - Options for parsing the form data.
* @returns {T} The converted body data.
*/
function convertFormDataToBodyData(formData, options) {
	const form = Object.create(null);
	const nestingState = { count: 0 };
	formData.forEach((value, key) => {
		if (!(options.all || key.endsWith("[]"))) form[key] = value;
		else handleParsingAllValues(form, key, value);
	});
	if (options.dot) Object.entries(form).forEach(([key, value]) => {
		if (key.includes(".")) {
			handleParsingNestedValues(form, key, value, nestingState);
			delete form[key];
		}
	});
	return form;
}
/**
* Handles parsing all values for a given key, supporting multiple values as arrays.
*
* @param {BodyData} form - The form data object.
* @param {string} key - The key to parse.
* @param {FormDataEntryValue} value - The value to assign.
*/
var handleParsingAllValues = (form, key, value) => {
	if (form[key] !== void 0) {
		if (Array.isArray(form[key])) form[key].push(value);
		else form[key] = [form[key], value];
	} else if (!key.endsWith("[]")) form[key] = value;
	else form[key] = [value];
};
/**
* Handles parsing nested values using dot notation keys.
*
* @param {BodyData} form - The form data object.
* @param {string} key - The dot notation key.
* @param {BodyDataValue} value - The value to assign.
*/
var handleParsingNestedValues = (form, key, value, state) => {
	if (/(?:^|\.)__proto__\./.test(key)) return;
	let nestedForm = form;
	const keys = key.split(".", 34);
	if (keys.length > 33) throwNestingLimitExceeded();
	keys.forEach((key, index) => {
		if (index === keys.length - 1) nestedForm[key] = value;
		else {
			if (!nestedForm[key] || typeof nestedForm[key] !== "object" || Array.isArray(nestedForm[key]) || nestedForm[key] instanceof File) {
				if (state.count++ >= MAX_NESTED_OBJECTS) throwNestingLimitExceeded();
				nestedForm[key] = Object.create(null);
			}
			nestedForm = nestedForm[key];
		}
	});
};
var throwNestingLimitExceeded = () => {
	throw new Error("Nesting limit exceeded");
};
// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
	const paths = path.split("/");
	if (paths[0] === "") paths.shift();
	return paths;
};
var splitRoutingPath = (routePath) => {
	const { groups, path } = extractGroupsFromPath(routePath);
	return replaceGroupMarks(splitPath(path), groups);
};
var extractGroupsFromPath = (path) => {
	const groups = [];
	path = path.replace(/\{[^}]+\}/g, (match, index) => {
		const mark = `@${index}`;
		groups.push([mark, match]);
		return mark;
	});
	return {
		groups,
		path
	};
};
var replaceGroupMarks = (paths, groups) => {
	for (let i = groups.length - 1; i >= 0; i--) {
		const [mark] = groups[i];
		for (let j = paths.length - 1; j >= 0; j--) if (paths[j].includes(mark)) {
			paths[j] = paths[j].replace(mark, groups[i][1]);
			break;
		}
	}
	return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
	if (label === "*") return "*";
	const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
	if (match) {
		const cacheKey = `${label}#${next}`;
		if (!patternCache[cacheKey]) {
			if (match[2]) patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [
				cacheKey,
				match[1],
				new RegExp(`^${match[2]}(?=/${next})`)
			] : [
				label,
				match[1],
				new RegExp(`^${match[2]}$`)
			];
			else patternCache[cacheKey] = [
				label,
				match[1],
				true
			];
		}
		return patternCache[cacheKey];
	}
	return null;
};
var tryDecode = (str, decoder) => {
	try {
		return decoder(str);
	} catch {
		return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
			try {
				return decoder(match);
			} catch {
				return match;
			}
		});
	}
};
/**
* Try to apply decodeURI() to given string.
* If it fails, skip invalid percent encoding or invalid UTF-8 sequences, and apply decodeURI() to the rest as much as possible.
* @param str The string to decode.
* @returns The decoded string that sometimes contains undecodable percent encoding.
* @example
* tryDecodeURI('Hello%20World') // 'Hello World'
* tryDecodeURI('Hello%20World/%A4%A2') // 'Hello World/%A4%A2'
*/
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
	const url = request.url;
	const start = url.indexOf("/", url.indexOf(":") + 4);
	let i = start;
	for (; i < url.length; i++) {
		const charCode = url.charCodeAt(i);
		if (charCode === 37) {
			const queryIndex = url.indexOf("?", i);
			const hashIndex = url.indexOf("#", i);
			const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
			const path = url.slice(start, end);
			return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
		} else if (charCode === 63 || charCode === 35) break;
	}
	return url.slice(start, i);
};
var getPathNoStrict = (request) => {
	const result = getPath(request);
	return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
/**
* Merge paths.
* @param {string[]} ...paths - The paths to merge.
* @returns {string} The merged path.
* @example
* mergePath('/api', '/users') // '/api/users'
* mergePath('/api/', '/users') // '/api/users'
* mergePath('/api', '/') // '/api'
* mergePath('/api/', '/') // '/api/'
*/
var mergePath = (base, sub, ...rest) => {
	if (rest.length) sub = mergePath(sub, ...rest);
	return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
	if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) return null;
	const segments = path.split("/");
	const results = [];
	let basePath = "";
	segments.forEach((segment) => {
		if (segment !== "" && !/\:/.test(segment)) basePath += "/" + segment;
		else if (/\:/.test(segment)) {
			if (segment.charCodeAt(segment.length - 1) === 63) {
				if (results.length === 0 && basePath === "") results.push("/");
				else results.push(basePath);
				const optionalSegment = segment.slice(0, -1);
				basePath += "/" + optionalSegment;
				results.push(basePath);
			} else basePath += "/" + segment;
		}
	});
	return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
	if (value.indexOf("+") !== -1) value = value.replace(/\+/g, " ");
	return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
	const hashIndex = url.indexOf("#", 8);
	if (hashIndex !== -1) url = url.slice(0, hashIndex);
	let encoded;
	if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
		const queryIndex = url.indexOf("?", 8);
		let keyIndex = queryIndex;
		if (keyIndex === -1) return;
		if (!url.startsWith(key, keyIndex + 1)) keyIndex = url.indexOf(`&${key}`, keyIndex + 1);
		while (keyIndex !== -1) {
			const trailingKeyCode = url.charCodeAt(keyIndex + key.length + 1);
			if (trailingKeyCode === 61 || trailingKeyCode === 38 || isNaN(trailingKeyCode)) {
				if (keyIndex > queryIndex && /(?:^|&)[^=&]*[%+]/.test(url.slice(queryIndex + 1, keyIndex))) break;
				if (trailingKeyCode === 61) {
					const valueIndex = keyIndex + key.length + 2;
					const endIndex = url.indexOf("&", valueIndex);
					return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
				}
				return "";
			}
			keyIndex = url.indexOf(`&${key}`, keyIndex + 1);
		}
		encoded = /[%+]/.test(url);
		if (!encoded) return;
	}
	const results = Object.create(null);
	encoded ??= /[%+]/.test(url);
	let keyIndex = url.indexOf("?", 8);
	while (keyIndex !== -1) {
		const nextKeyIndex = url.indexOf("&", keyIndex + 1);
		let valueIndex = url.indexOf("=", keyIndex);
		if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) valueIndex = -1;
		let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex);
		if (encoded) name = _decodeURI(name);
		keyIndex = nextKeyIndex;
		if (name === "") continue;
		let value;
		if (valueIndex === -1) value = "";
		else {
			value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
			if (encoded) value = _decodeURI(value);
		}
		if (multiple) {
			if (!(results[name] && Array.isArray(results[name]))) results[name] = [];
			results[name].push(value);
		} else results[name] ??= value;
	}
	return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
	return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;
// node_modules/hono/dist/request.js
var HonoRequest = class {
	/**
	* `.raw` can get the raw Request object.
	*
	* @see {@link https://hono.dev/docs/api/request#raw}
	*
	* @example
	* ```ts
	* // For Cloudflare Workers
	* app.post('/', async (c) => {
	*   const metadata = c.req.raw.cf?.hostMetadata?
	*   ...
	* })
	* ```
	*/
	raw;
	#validatedData;
	#matchResult;
	routeIndex = 0;
	/**
	* `.path` can get the pathname of the request.
	*
	* @see {@link https://hono.dev/docs/api/request#path}
	*
	* @example
	* ```ts
	* app.get('/about/me', (c) => {
	*   const pathname = c.req.path // `/about/me`
	* })
	* ```
	*/
	path;
	bodyCache = {};
	constructor(request, path = "/", matchResult = [[]]) {
		this.raw = request;
		this.path = path;
		this.#matchResult = matchResult;
	}
	param(key) {
		return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
	}
	#getDecodedParam(key) {
		const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
		const param = this.#getParamValue(paramKey);
		return param && tryDecodeURIComponent(param);
	}
	#getAllDecodedParams() {
		const decoded = {};
		const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
		for (const key of keys) {
			const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
			if (value !== void 0) decoded[key] = tryDecodeURIComponent(value);
		}
		return decoded;
	}
	#getParamValue(paramKey) {
		return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
	}
	query(key) {
		return getQueryParam(this.url, key);
	}
	queries(key) {
		return getQueryParams(this.url, key);
	}
	header(name) {
		if (name) return this.raw.headers.get(name) ?? void 0;
		const headerData = Object.create(null);
		this.raw.headers.forEach((value, key) => {
			headerData[key] = value;
		});
		return headerData;
	}
	async parseBody(options) {
		return parseBody(this, options);
	}
	#cachedBody = (key) => {
		const { bodyCache, raw } = this;
		const cachedBody = bodyCache[key];
		if (cachedBody) return cachedBody;
		for (const anyCachedKey in bodyCache) return bodyCache[anyCachedKey].then((body) => {
			if (anyCachedKey === "json") body = JSON.stringify(body);
			const contentType = anyCachedKey === "formData" ? void 0 : raw.headers.get("content-type");
			return new Response(body, { headers: contentType ? { "Content-Type": contentType } : void 0 })[key]();
		});
		return bodyCache[key] = raw[key]();
	};
	/**
	* `.json()` can parse Request body of type `application/json`
	*
	* @see {@link https://hono.dev/docs/api/request#json}
	*
	* @example
	* ```ts
	* app.post('/entry', async (c) => {
	*   const body = await c.req.json()
	* })
	* ```
	*/
	json() {
		return this.#cachedBody("text").then((text) => JSON.parse(text));
	}
	/**
	* `.text()` can parse Request body of type `text/plain`
	*
	* @see {@link https://hono.dev/docs/api/request#text}
	*
	* @example
	* ```ts
	* app.post('/entry', async (c) => {
	*   const body = await c.req.text()
	* })
	* ```
	*/
	text() {
		return this.#cachedBody("text");
	}
	/**
	* `.arrayBuffer()` parse Request body as an `ArrayBuffer`
	*
	* @see {@link https://hono.dev/docs/api/request#arraybuffer}
	*
	* @example
	* ```ts
	* app.post('/entry', async (c) => {
	*   const body = await c.req.arrayBuffer()
	* })
	* ```
	*/
	arrayBuffer() {
		return this.#cachedBody("arrayBuffer");
	}
	/**
	* `.bytes()` parses the request body as a `Uint8Array`.
	*
	* @see {@link https://hono.dev/docs/api/request#bytes}
	*
	* @example
	* ```ts
	* app.post('/entry', async (c) => {
	*   const body = await c.req.bytes()
	* })
	* ```
	*/
	bytes() {
		return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
	}
	/**
	* Parses the request body as a `Blob`.
	* @example
	* ```ts
	* app.post('/entry', async (c) => {
	*   const body = await c.req.blob();
	* });
	* ```
	* @see https://hono.dev/docs/api/request#blob
	*/
	blob() {
		return this.#cachedBody("blob");
	}
	/**
	* Parses the request body as `FormData`.
	* @example
	* ```ts
	* app.post('/entry', async (c) => {
	*   const body = await c.req.formData();
	* });
	* ```
	* @see https://hono.dev/docs/api/request#formdata
	*/
	formData() {
		return this.#cachedBody("formData");
	}
	/**
	* Adds validated data to the request.
	*
	* @param target - The target of the validation.
	* @param data - The validated data to add.
	*/
	addValidatedData(target, data) {
		(this.#validatedData ??= {})[target] = data;
	}
	valid(target) {
		return this.#validatedData?.[target];
	}
	/**
	* `.url` can get the request url strings.
	*
	* @see {@link https://hono.dev/docs/api/request#url}
	*
	* @example
	* ```ts
	* app.get('/about/me', (c) => {
	*   const url = c.req.url // `http://localhost:8787/about/me`
	*   ...
	* })
	* ```
	*/
	get url() {
		return this.raw.url;
	}
	/**
	* `.method` can get the method name of the request.
	*
	* @see {@link https://hono.dev/docs/api/request#method}
	*
	* @example
	* ```ts
	* app.get('/about/me', (c) => {
	*   const method = c.req.method // `GET`
	* })
	* ```
	*/
	get method() {
		return this.raw.method;
	}
	get [GET_MATCH_RESULT]() {
		return this.#matchResult;
	}
	/**
	* `.matchedRoutes` can return a matched route in the handler
	*
	* @deprecated
	*
	* Use matchedRoutes helper defined in "hono/route" instead.
	*
	* @see {@link https://hono.dev/docs/api/request#matchedroutes}
	*
	* @example
	* ```ts
	* app.use('*', async function logger(c, next) {
	*   await next()
	*   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
	*     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
	*     console.log(
	*       method,
	*       ' ',
	*       path,
	*       ' '.repeat(Math.max(10 - path.length, 0)),
	*       name,
	*       i === c.req.routeIndex ? '<- respond from here' : ''
	*     )
	*   })
	* })
	* ```
	*/
	get matchedRoutes() {
		return this.#matchResult[0].map(([[, route]]) => route);
	}
	/**
	* `.routePath` can retrieve the path registered within the handler
	*
	* @deprecated
	*
	* Use routePath helper defined in "hono/route" instead.
	*
	* @see {@link https://hono.dev/docs/api/request#routepath}
	*
	* @example
	* ```ts
	* app.get('/posts/:id', (c) => {
	*   return c.json({ path: c.req.routePath })
	* })
	* ```
	*/
	get routePath() {
		return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
	}
};
// node_modules/hono/dist/utils/html.js
/**
* @module
* HTML utility.
*/
var HtmlEscapedCallbackPhase = {
	Stringify: 1,
	BeforeStream: 2,
	Stream: 3
};
var raw = (value, callbacks) => {
	const escapedString = new String(value);
	escapedString.isEscaped = true;
	escapedString.callbacks = callbacks;
	return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
	if (typeof str === "object" && !(str instanceof String)) {
		if (!(str instanceof Promise)) str = str.toString();
		if (str instanceof Promise) str = await str;
	}
	const callbacks = str.callbacks;
	if (!callbacks?.length) return Promise.resolve(str);
	if (buffer) buffer[0] += str;
	else buffer = [str];
	const resStr = Promise.all(callbacks.map((c) => c({
		phase,
		buffer,
		context
	}))).then((res) => Promise.all(res.filter(Boolean).map((str) => resolveCallback(str, phase, false, context, buffer))).then(() => buffer[0]));
	if (preserveCallbacks) return raw(await resStr, callbacks);
	else return resStr;
};
// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
	return {
		"Content-Type": contentType,
		...headers
	};
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
	#rawRequest;
	#req;
	/**
	* `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
	*
	* @see {@link https://hono.dev/docs/api/context#env}
	*
	* @example
	* ```ts
	* // Environment object for Cloudflare Workers
	* app.get('*', async c => {
	*   const counter = c.env.COUNTER
	* })
	* ```
	*/
	env = {};
	#var;
	finalized = false;
	/**
	* `.error` can get the error object from the middleware if the Handler throws an error.
	*
	* @see {@link https://hono.dev/docs/api/context#error}
	*
	* @example
	* ```ts
	* app.use('*', async (c, next) => {
	*   await next()
	*   if (c.error) {
	*     // do something...
	*   }
	* })
	* ```
	*/
	error;
	#status;
	#executionCtx;
	#res;
	#layout;
	#renderer;
	#notFoundHandler;
	#preparedHeaders;
	#matchResult;
	#path;
	/**
	* Creates an instance of the Context class.
	*
	* @param req - The Request object.
	* @param options - Optional configuration options for the context.
	*/
	constructor(req, options) {
		this.#rawRequest = req;
		if (options) {
			this.#executionCtx = options.executionCtx;
			this.env = options.env;
			this.#notFoundHandler = options.notFoundHandler;
			this.#path = options.path;
			this.#matchResult = options.matchResult;
		}
	}
	/**
	* `.req` is the instance of {@link HonoRequest}.
	*/
	get req() {
		this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
		return this.#req;
	}
	/**
	* @see {@link https://hono.dev/docs/api/context#event}
	* The FetchEvent associated with the current request.
	*
	* @throws Will throw an error if the context does not have a FetchEvent.
	*/
	get event() {
		if (this.#executionCtx && "respondWith" in this.#executionCtx) return this.#executionCtx;
		else throw Error("This context has no FetchEvent");
	}
	/**
	* @see {@link https://hono.dev/docs/api/context#executionctx}
	* The ExecutionContext associated with the current request.
	*
	* @throws Will throw an error if the context does not have an ExecutionContext.
	*/
	get executionCtx() {
		if (this.#executionCtx) return this.#executionCtx;
		else throw Error("This context has no ExecutionContext");
	}
	/**
	* @see {@link https://hono.dev/docs/api/context#res}
	* The Response object for the current request.
	*/
	get res() {
		return this.#res ||= createResponseInstance(null, { headers: this.#preparedHeaders ??= new Headers() });
	}
	/**
	* Sets the Response object for the current request.
	*
	* @param _res - The Response object to set.
	*/
	set res(_res) {
		if (this.#res && _res) {
			_res = createResponseInstance(_res.body, _res);
			for (const [k, v] of this.#res.headers.entries()) {
				if (k === "content-type") continue;
				if (k === "set-cookie") {
					const cookies = this.#res.headers.getSetCookie();
					_res.headers.delete("set-cookie");
					for (const cookie of cookies) _res.headers.append("set-cookie", cookie);
				} else _res.headers.set(k, v);
			}
		}
		this.#res = _res;
		this.finalized = true;
	}
	/**
	* `.render()` can create a response within a layout.
	*
	* @see {@link https://hono.dev/docs/api/context#render-setrenderer}
	*
	* @example
	* ```ts
	* app.get('/', (c) => {
	*   return c.render('Hello!')
	* })
	* ```
	*/
	render = (...args) => {
		this.#renderer ??= (content) => this.html(content);
		return this.#renderer(...args);
	};
	/**
	* Sets the layout for the response.
	*
	* @param layout - The layout to set.
	* @returns The layout function.
	*/
	setLayout = (layout) => this.#layout = layout;
	/**
	* Gets the current layout for the response.
	*
	* @returns The current layout function.
	*/
	getLayout = () => this.#layout;
	/**
	* `.setRenderer()` can set the layout in the custom middleware.
	*
	* @see {@link https://hono.dev/docs/api/context#render-setrenderer}
	*
	* @example
	* ```tsx
	* app.use('*', async (c, next) => {
	*   c.setRenderer((content) => {
	*     return c.html(
	*       <html>
	*         <body>
	*           <p>{content}</p>
	*         </body>
	*       </html>
	*     )
	*   })
	*   await next()
	* })
	* ```
	*/
	setRenderer = (renderer) => {
		this.#renderer = renderer;
	};
	/**
	* `.header()` can set headers.
	*
	* @see {@link https://hono.dev/docs/api/context#header}
	*
	* @example
	* ```ts
	* app.get('/welcome', (c) => {
	*   // Set headers
	*   c.header('X-Message', 'Hello!')
	*   c.header('Content-Type', 'text/plain')
	*
	*   // Append multiple headers using the append option (e.g. Vary)
	*   c.header('Vary', 'Accept-Encoding', { append: true })
	*   c.header('Vary', 'User-Agent', { append: true })
	*
	*   return c.body('Thank you for coming')
	* })
	* ```
	*/
	header = (name, value, options) => {
		if (this.finalized) this.#res = createResponseInstance(this.#res.body, this.#res);
		const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
		if (value === void 0) headers.delete(name);
		else if (options?.append) headers.append(name, value);
		else headers.set(name, value);
	};
	status = (status) => {
		this.#status = status;
	};
	/**
	* `.set()` can set the value specified by the key.
	*
	* @see {@link https://hono.dev/docs/api/context#set-get}
	*
	* @example
	* ```ts
	* app.use('*', async (c, next) => {
	*   c.set('message', 'Hono is hot!!')
	*   await next()
	* })
	* ```
	*/
	set = (key, value) => {
		this.#var ??= /* @__PURE__ */ new Map();
		this.#var.set(key, value);
	};
	/**
	* `.get()` can use the value specified by the key.
	*
	* @see {@link https://hono.dev/docs/api/context#set-get}
	*
	* @example
	* ```ts
	* app.get('/', (c) => {
	*   const message = c.get('message')
	*   return c.text(`The message is "${message}"`)
	* })
	* ```
	*/
	get = (key) => {
		return this.#var ? this.#var.get(key) : void 0;
	};
	/**
	* `.var` can access the value of a variable.
	*
	* @see {@link https://hono.dev/docs/api/context#var}
	*
	* @example
	* ```ts
	* const result = c.var.client.oneMethod()
	* ```
	*/
	get var() {
		if (!this.#var) return {};
		return Object.fromEntries(this.#var);
	}
	#newResponse(data, arg, headers) {
		let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
		if (typeof arg === "object" && arg.headers) {
			responseHeaders ??= new Headers();
			for (const [key, value] of new Headers(arg.headers)) if (key === "set-cookie") responseHeaders.append(key, value);
			else responseHeaders.set(key, value);
		}
		if (headers) {
			if (!responseHeaders) {
				let count = 0;
				for (const k in headers) if (++count > 1 || typeof headers[k] !== "string") {
					responseHeaders = new Headers();
					break;
				}
			}
			if (responseHeaders) for (const k in headers) {
				const v = headers[k];
				if (typeof v === "string") responseHeaders.set(k, v);
				else {
					responseHeaders.delete(k);
					for (const v2 of v) responseHeaders.append(k, v2);
				}
			}
		}
		return createResponseInstance(data, {
			status: typeof arg === "number" ? arg : arg?.status ?? this.#status,
			headers: responseHeaders ?? headers
		});
	}
	newResponse = (...args) => this.#newResponse(...args);
	/**
	* `.body()` can return the HTTP response.
	* You can set headers with `.header()` and set HTTP status code with `.status`.
	* This can also be set in `.text()`, `.json()` and so on.
	*
	* @see {@link https://hono.dev/docs/api/context#body}
	*
	* @example
	* ```ts
	* app.get('/welcome', (c) => {
	*   // Set headers
	*   c.header('X-Message', 'Hello!')
	*   c.header('Content-Type', 'text/plain')
	*   // Set HTTP status code
	*   c.status(201)
	*
	*   // Return the response body
	*   return c.body('Thank you for coming')
	* })
	* ```
	*/
	body = (data, arg, headers) => this.#newResponse(data, arg, headers);
	/**
	* `.text()` can render text as `Content-Type:text/plain`.
	*
	* @see {@link https://hono.dev/docs/api/context#text}
	*
	* @example
	* ```ts
	* app.get('/say', (c) => {
	*   return c.text('Hello!')
	* })
	* ```
	*/
	text = (text, arg, headers) => {
		return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
	};
	/**
	* `.json()` can render JSON as `Content-Type:application/json`.
	*
	* @see {@link https://hono.dev/docs/api/context#json}
	*
	* @example
	* ```ts
	* app.get('/api', (c) => {
	*   return c.json({ message: 'Hello!' })
	* })
	* ```
	*/
	json = (object, arg, headers) => {
		return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
	};
	html = (html, arg, headers) => {
		const res = (html) => this.#newResponse(html, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
		return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
	};
	/**
	* `.redirect()` can Redirect, default status code is 302.
	*
	* @see {@link https://hono.dev/docs/api/context#redirect}
	*
	* @example
	* ```ts
	* app.get('/redirect', (c) => {
	*   return c.redirect('/')
	* })
	* app.get('/redirect-permanently', (c) => {
	*   return c.redirect('/', 301)
	* })
	* ```
	*/
	redirect = (location, status) => {
		const locationString = String(location);
		this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
		return this.newResponse(null, status ?? 302);
	};
	/**
	* `.notFound()` can return the Not Found Response.
	*
	* @see {@link https://hono.dev/docs/api/context#notfound}
	*
	* @example
	* ```ts
	* app.get('/notfound', (c) => {
	*   return c.notFound()
	* })
	* ```
	*/
	notFound = () => {
		this.#notFoundHandler ??= () => createResponseInstance();
		return this.#notFoundHandler(this);
	};
};
// node_modules/hono/dist/compose.js
/**
* Compose middleware functions into a single function based on `koa-compose` package.
*
* @template E - The environment type.
*
* @param {[[Function, unknown], unknown][] | [[Function]][]} middleware - An array of middleware functions and their corresponding parameters.
* @param {ErrorHandler<E>} [onError] - An optional error handler function.
* @param {NotFoundHandler<E>} [onNotFound] - An optional not-found handler function.
*
* @returns {(context: Context, next?: Next) => Promise<Context>} - A composed middleware function.
*/
var compose = (middleware, onError, onNotFound) => {
	return (context, next) => {
		let index = -1;
		return dispatch(0);
		/**
		* Dispatch the middleware functions.
		*
		* @param {number} i - The current index in the middleware array.
		*
		* @returns {Promise<Context>} - A promise that resolves to the context.
		*/
		async function dispatch(i) {
			if (i <= index) throw new Error("next() called multiple times");
			index = i;
			let res;
			let isError = false;
			let handler;
			if (middleware[i]) {
				handler = middleware[i][0][0];
				context.req.routeIndex = i;
			} else handler = i === middleware.length && next || void 0;
			if (handler) try {
				res = await handler(context, () => dispatch(i + 1));
			} catch (err) {
				if (err instanceof Error && onError) {
					context.error = err;
					res = await onError(err, context);
					isError = true;
				} else throw err;
			}
			else if (context.finalized === false && onNotFound) res = await onNotFound(context);
			if (res && (context.finalized === false || isError)) context.res = res;
			return context;
		}
	};
};
// node_modules/hono/dist/router.js
/**
* Array of supported HTTP methods.
*/
var METHODS = [
	"get",
	"post",
	"put",
	"delete",
	"options",
	"patch",
	"query"
];
/**
* Error message indicating that a route cannot be added because the matcher is already built.
*/
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
/**
* Error class representing an unsupported path error.
*/
var UnsupportedPathError = class extends Error {};
// node_modules/hono/dist/utils/constants.js
/**
* Constant used to mark a composed handler.
*/
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";
// node_modules/hono/dist/hono-base.js
/**
* @module
* This module is the base module for the Hono object.
*/
var notFoundHandler = (c) => {
	return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
	if ("getResponse" in err) {
		const res = err.getResponse();
		return c.newResponse(res.body, res);
	}
	console.error(err);
	return c.text("Internal Server Error", 500);
};
var Hono$1 = class Hono {
	get;
	post;
	put;
	delete;
	options;
	patch;
	query;
	all;
	on;
	use;
	router;
	getPath;
	_basePath = "/";
	#path = "/";
	routes = [];
	constructor(options = {}) {
		[...METHODS, "all"].forEach((method) => {
			this[method] = (args1, ...args) => {
				const methodName = method.toUpperCase();
				if (typeof args1 === "string") this.#path = args1;
				else this.#addRoute(methodName, this.#path, args1);
				args.forEach((handler) => {
					this.#addRoute(methodName, this.#path, handler);
				});
				return this;
			};
		});
		this.on = (method, path, ...handlers) => {
			for (const p of [path].flat()) {
				this.#path = p;
				for (const m of [method].flat()) {
					const methodName = m.toUpperCase();
					for (const handler of handlers) this.#addRoute(methodName, this.#path, handler);
				}
			}
			return this;
		};
		this.use = (arg1, ...handlers) => {
			if (typeof arg1 === "string") this.#path = arg1;
			else {
				this.#path = "*";
				handlers.unshift(arg1);
			}
			handlers.forEach((handler) => {
				this.#addRoute("ALL", this.#path, handler);
			});
			return this;
		};
		const { strict, ...optionsWithoutStrict } = options;
		Object.assign(this, optionsWithoutStrict);
		this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
	}
	#clone() {
		const clone = new Hono({
			router: this.router,
			getPath: this.getPath
		});
		clone.errorHandler = this.errorHandler;
		clone.#notFoundHandler = this.#notFoundHandler;
		clone.routes = this.routes;
		return clone;
	}
	#notFoundHandler = notFoundHandler;
	errorHandler = errorHandler;
	/**
	* `.route()` allows grouping other Hono instance in routes.
	*
	* @see {@link https://hono.dev/docs/api/routing#grouping}
	*
	* @param {string} path - base Path
	* @param {Hono} app - other Hono instance
	* @returns {Hono} routed Hono instance
	*
	* @example
	* ```ts
	* const app = new Hono()
	* const app2 = new Hono()
	*
	* app2.get("/user", (c) => c.text("user"))
	* app.route("/api", app2) // GET /api/user
	* ```
	*/
	route(path, app) {
		const subApp = this.basePath(path);
		app.routes.map((r) => {
			let handler;
			if (app.errorHandler === errorHandler) handler = r.handler;
			else {
				handler = async (c, next) => (await compose([], app.errorHandler)(c, () => r.handler(c, next))).res;
				handler[COMPOSED_HANDLER] = r.handler;
			}
			subApp.#addRoute(r.method, r.path, handler, r.basePath);
		});
		return this;
	}
	/**
	* `.basePath()` allows base paths to be specified.
	*
	* @see {@link https://hono.dev/docs/api/routing#base-path}
	*
	* @param {string} path - base Path
	* @returns {Hono} changed Hono instance
	*
	* @example
	* ```ts
	* const api = new Hono().basePath('/api')
	* ```
	*/
	basePath(path) {
		const subApp = this.#clone();
		subApp._basePath = mergePath(this._basePath, path);
		return subApp;
	}
	/**
	* `.onError()` handles an error and returns a customized Response.
	*
	* @see {@link https://hono.dev/docs/api/hono#error-handling}
	*
	* @param {ErrorHandler} handler - request Handler for error
	* @returns {Hono} changed Hono instance
	*
	* @example
	* ```ts
	* app.onError((err, c) => {
	*   console.error(`${err}`)
	*   return c.text('Custom Error Message', 500)
	* })
	* ```
	*/
	onError = (handler) => {
		this.errorHandler = handler;
		return this;
	};
	/**
	* `.notFound()` allows you to customize a Not Found Response.
	*
	* @see {@link https://hono.dev/docs/api/hono#not-found}
	*
	* @param {NotFoundHandler} handler - request handler for not-found
	* @returns {Hono} changed Hono instance
	*
	* @example
	* ```ts
	* app.notFound((c) => {
	*   return c.text('Custom 404 Message', 404)
	* })
	* ```
	*/
	notFound = (handler) => {
		this.#notFoundHandler = handler;
		return this;
	};
	/**
	* `.mount()` allows you to mount applications built with other frameworks into your Hono application.
	*
	* @deprecated Use `mount()` from `hono/mount` instead. `.mount()` will be removed in v5.
	*
	* @see {@link https://hono.dev/docs/api/hono#mount}
	*
	* @param {string} path - base Path
	* @param {Function} applicationHandler - other Request Handler
	* @param {MountOptions} [options] - options of `.mount()`
	* @returns {Hono} mounted Hono instance
	*
	* @example
	* ```ts
	* import { Router as IttyRouter } from 'itty-router'
	* import { Hono } from 'hono'
	* // Create itty-router application
	* const ittyRouter = IttyRouter()
	* // GET /itty-router/hello
	* ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
	*
	* const app = new Hono()
	* app.mount('/itty-router', ittyRouter.handle)
	* ```
	*
	* @example
	* ```ts
	* const app = new Hono()
	* // Send the request to another application without modification.
	* app.mount('/app', anotherApp, {
	*   replaceRequest: (req) => req,
	* })
	* ```
	*/
	mount(path, applicationHandler, options) {
		let replaceRequest;
		let optionHandler;
		if (options) {
			if (typeof options === "function") optionHandler = options;
			else {
				optionHandler = options.optionHandler;
				if (options.replaceRequest === false) replaceRequest = (request) => request;
				else replaceRequest = options.replaceRequest;
			}
		}
		const getOptions = optionHandler ? (c) => {
			const options = optionHandler(c);
			return Array.isArray(options) ? options : [options];
		} : (c) => {
			let executionContext = void 0;
			try {
				executionContext = c.executionCtx;
			} catch {}
			return [c.env, executionContext];
		};
		replaceRequest ||= (() => {
			const mergedPath = mergePath(this._basePath, path);
			const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
			return (request) => {
				const url = new URL(request.url);
				url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
				return new Request(url, request);
			};
		})();
		const handler = async (c, next) => {
			const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
			if (res) return res;
			await next();
		};
		this.#addRoute("ALL", mergePath(path, "*"), handler);
		return this;
	}
	#addRoute(method, path, handler, baseRoutePath) {
		path = mergePath(this._basePath, path);
		const r = {
			basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
			path,
			method,
			handler
		};
		this.router.add(method, path, [handler, r]);
		this.routes.push(r);
	}
	#handleError(err, c) {
		if (err instanceof Error) return this.errorHandler(err, c);
		throw err;
	}
	#dispatch(request, executionCtx, env, method) {
		if (method === "HEAD") return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
		const path = this.getPath(request, { env });
		const matchResult = this.router.match(method, path);
		const c = new Context(request, {
			path,
			matchResult,
			env,
			executionCtx,
			notFoundHandler: this.#notFoundHandler
		});
		if (matchResult[0].length === 1) {
			let res;
			try {
				res = matchResult[0][0][0][0](c, async () => {
					c.res = await this.#notFoundHandler(c);
				});
			} catch (err) {
				return this.#handleError(err, c);
			}
			return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
		}
		const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
		return (async () => {
			try {
				const context = await composed(c);
				if (!context.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
				return context.res;
			} catch (err) {
				return this.#handleError(err, c);
			}
		})();
	}
	/**
	* `.fetch()` will be entry point of your app.
	*
	* @see {@link https://hono.dev/docs/api/hono#fetch}
	*
	* @param {Request} request - request Object of request
	* @param {Env} env - env Object
	* @param {ExecutionContext} executionCtx - context of execution
	* @returns {Response | Promise<Response>} response of request
	*
	*/
	fetch = (request, ...rest) => {
		return this.#dispatch(request, rest[1], rest[0], request.method);
	};
	/**
	* `.request()` is a useful method for testing.
	* You can pass a URL or pathname to send a GET request.
	* app will return a Response object.
	* ```ts
	* test('GET /hello is ok', async () => {
	*   const res = await app.request('/hello')
	*   expect(res.status).toBe(200)
	* })
	* ```
	* @see https://hono.dev/docs/api/hono#request
	*/
	request = (input, requestInit, Env, executionCtx) => {
		if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
		input = input.toString();
		return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
	};
	/**
	* `.fire()` automatically adds a global fetch event listener.
	* This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
	* @deprecated
	* Use `fire` from `hono/service-worker` instead.
	* ```ts
	* import { Hono } from 'hono'
	* import { fire } from 'hono/service-worker'
	*
	* const app = new Hono()
	* // ...
	* fire(app)
	* ```
	* @see https://hono.dev/docs/api/hono#fire
	* @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
	* @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
	*/
	fire = () => {
		addEventListener("fetch", (event) => {
			event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
		});
	};
};
// node_modules/hono/dist/router/utils.js
var createNullObject = () => Object.create(null);
// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
	const matchers = this.buildAllMatchers();
	const match = ((method, path) => {
		const matcher = matchers[method] || matchers["ALL"];
		const staticMatch = matcher[2][path];
		if (staticMatch) return staticMatch;
		const match = path.match(matcher[0]);
		if (!match) return [[], emptyParam];
		const index = match.indexOf("", 1);
		return [matcher[1][index], match];
	});
	this.match = match;
	return match(method, path);
}
// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
var regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
/**
* Sort order:
* 1. literal
* 2. special pattern (e.g. :label{[0-9]+})
* 3. common label pattern (e.g. :label)
* 4. wildcard
*/
function compareKey(a, b) {
	if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
	if (b.length === 1) return 1;
	if (a === ".*" || a === "(?:|/.*)") return b === "(?:|/.*)" ? -1 : 1;
	else if (b === ".*" || b === "(?:|/.*)") return -1;
	if (a === "[^/]+") return 1;
	else if (b === "[^/]+") return -1;
	return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node$1 = class Node {
	#index;
	#varIndex;
	#children = createNullObject();
	insert(tokens, index, paramMap, context, isStatic) {
		let node = this;
		for (let i = 0, len = tokens.length; i < len; i++) {
			const token = tokens[i];
			const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? [
				"",
				"",
				".*"
			] : [
				"",
				"",
				LABEL_REG_EXP_STR
			] : null : token === "/*" ? [
				"",
				"",
				TAIL_WILDCARD_REG_EXP_STR
			] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
			let nextNode;
			if (pattern) {
				const name = pattern[1];
				let regexpStr = pattern[2] || "[^/]+";
				if (name && pattern[2]) {
					if (regexpStr === ".*") throw PATH_ERROR;
					regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
					if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
					if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) throw PATH_ERROR;
				}
				nextNode = node.#children[regexpStr];
				if (!nextNode) {
					if (regexpStr !== ".*" && regexpStr !== "(?:|/.*)") {
						for (const k in node.#children) if ((regexpStr.length > 1 || k.length > 1) && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
					}
					nextNode = node.#children[regexpStr] = new Node();
				}
				if (name !== "") {
					nextNode.#varIndex ??= context.varIndex++;
					paramMap.push([name, nextNode.#varIndex]);
				}
			} else {
				nextNode = node.#children[token];
				if (!nextNode) {
					for (const k in node.#children) if (k.length > 1 && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
					nextNode = node.#children[token] = new Node();
				}
			}
			node = nextNode;
		}
		if (node.#index !== void 0) throw PATH_ERROR;
		node.#index = isStatic ? -1 : index;
	}
	buildRegExpStr() {
		const strList = Object.keys(this.#children).sort(compareKey).map((k) => {
			const c = this.#children[k];
			const childStr = c.buildRegExpStr();
			return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
		}).filter(Boolean);
		if (typeof this.#index === "number" && this.#index !== -1) strList.unshift(`#${this.#index}`);
		if (strList.length === 0) return "";
		if (strList.length === 1) return strList[0];
		return "(?:" + strList.join("|") + ")";
	}
};
// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
	#context = { varIndex: 0 };
	#root = new Node$1();
	#index = 0;
	paths = createNullObject();
	insert(path, isStatic) {
		if (isStatic) {
			this.#root.insert(path.split(""), 0, [], this.#context, true);
			return;
		}
		const paramAssoc = [];
		const groups = [];
		let markedPath = path;
		for (let i = 0;;) {
			let replaced = false;
			markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
				const mark = `@\\${i}`;
				groups[i] = [mark, m];
				i++;
				replaced = true;
				return mark;
			});
			if (!replaced) break;
		}
		/**
		*  - pattern (:label, :label{0-9]+}, ...)
		*  - /* wildcard
		*  - character
		*/
		const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
		for (let i = groups.length - 1; i >= 0; i--) {
			const [mark] = groups[i];
			for (let j = tokens.length - 1; j >= 0; j--) if (tokens[j].indexOf(mark) !== -1) {
				tokens[j] = tokens[j].replace(mark, groups[i][1]);
				break;
			}
		}
		this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
		this.paths[path] = [this.#index++, paramAssoc];
	}
	buildRegExp() {
		let regexp = this.#root.buildRegExpStr();
		if (regexp === "") return [
			/^$/,
			[],
			[]
		];
		let captureIndex = 0;
		const indexReplacementMap = [];
		const paramReplacementMap = [];
		regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
			if (handlerIndex !== void 0) {
				indexReplacementMap[++captureIndex] = Number(handlerIndex);
				return "$()";
			}
			if (paramIndex !== void 0) {
				paramReplacementMap[Number(paramIndex)] = ++captureIndex;
				return "";
			}
			return "";
		});
		return [
			new RegExp(`^${regexp}`),
			indexReplacementMap,
			paramReplacementMap
		];
	}
};
// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
	return wildcardRegExpCache[path] ??= new RegExp(`^${path.replace(/\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g, (match, metaChar) => metaChar ? `\\${metaChar}` : match === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match === "*" ? ".*" : `/:${LABEL_REG_EXP_STR}`)}$`);
}
function findMiddleware(middleware, path) {
	for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) if (buildWildcardRegExp(k).test(path)) return [...middleware[k]];
}
var RegExpRouter = class {
	name = "RegExpRouter";
	#middleware;
	#routes;
	#tries;
	constructor() {
		this.#middleware = { ["ALL"]: createNullObject() };
		this.#routes = { ["ALL"]: createNullObject() };
		this.#tries = { ["ALL"]: new Trie() };
	}
	#insertPath(method, path) {
		try {
			this.#tries[method].insert(path, !/\*|\/:/.test(path));
		} catch (e) {
			throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
		}
	}
	add(method, path, handler) {
		const middleware = this.#middleware;
		const routes = this.#routes;
		if (!middleware) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
		if (!middleware[method]) {
			this.#tries[method] = new Trie();
			for (const handlerMap of [middleware, routes]) {
				handlerMap[method] = createNullObject();
				for (const p in handlerMap["ALL"]) {
					handlerMap[method][p] = [...handlerMap["ALL"][p]];
					this.#insertPath(method, p);
				}
			}
		}
		if (path === "/*") path = "*";
		const methods = method === "ALL" ? Object.keys(middleware) : [method];
		if (/\*$/.test(path)) {
			const re = buildWildcardRegExp(path);
			for (const m of methods) if (!middleware[m][path]) {
				this.#insertPath(m, path);
				middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware["ALL"], path) || [];
			}
			for (const handlerMap of [middleware, routes]) for (const m of methods) for (const p in handlerMap[m]) re.test(p) && handlerMap[m][p].push([handler, path]);
			return;
		}
		const paths = checkOptionalParameter(path) || [path];
		for (const path of paths) for (const m of methods) {
			if (!routes[m][path]) {
				this.#insertPath(m, path);
				routes[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware["ALL"], path) || [];
			}
			routes[m][path].push([handler, path]);
		}
	}
	match = match;
	buildAllMatchers() {
		const matchers = createNullObject();
		for (const method of Object.keys(this.#routes)) matchers[method] = this.#buildMatcher(method);
		this.#middleware = this.#routes = this.#tries = void 0;
		wildcardRegExpCache = createNullObject();
		return matchers;
	}
	#buildMatcher(method) {
		const middleware = this.#middleware[method];
		const routes = this.#routes[method];
		const trie = this.#tries[method];
		const staticMap = createNullObject();
		const handlerData = [];
		const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
		for (const r of [middleware, routes]) for (const path in r) {
			const handlers = r[path];
			const pathData = trie.paths[path];
			if (!pathData) {
				staticMap[path] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
				continue;
			}
			handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [h, trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
				map[key] = paramReplacementMap[pathData[1][i][1]];
				return map;
			}, createNullObject())]);
		}
		return [
			regexp,
			indexReplacementMap.map((i) => handlerData[i]),
			staticMap
		];
	}
};
// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
	name = "SmartRouter";
	#routers = [];
	#routes = [];
	constructor(init) {
		this.#routers = init.routers;
	}
	add(method, path, handler) {
		if (!this.#routes) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
		this.#routes.push([
			method,
			path,
			handler
		]);
	}
	match(method, path) {
		if (!this.#routes) throw new Error("Fatal error");
		const routers = this.#routers;
		const routes = this.#routes;
		const len = routers.length;
		let i = 0;
		let res;
		for (; i < len; i++) {
			const router = routers[i];
			try {
				for (let i = 0, len = routes.length; i < len; i++) router.add(...routes[i]);
				res = router.match(method, path);
			} catch (e) {
				if (e instanceof UnsupportedPathError) continue;
				throw e;
			}
			this.match = router.match.bind(router);
			this.#routers = [router];
			this.#routes = void 0;
			break;
		}
		if (i === len) throw new Error("Fatal error");
		this.name = `SmartRouter + ${this.activeRouter.name}`;
		return res;
	}
	get activeRouter() {
		if (this.#routes || this.#routers.length !== 1) throw new Error("No active router has been determined yet.");
		return this.#routers[0];
	}
};
// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node = class Node {
	#methods = [];
	#children = createNullObject();
	#patterns = [];
	#pattern;
	#params = emptyParams;
	insert(method, path, handler) {
		let curNode = this;
		const parts = splitRoutingPath(path);
		const possibleKeys = /* @__PURE__ */ new Set();
		let i = 0;
		for (const p of parts) {
			const nextP = parts[++i];
			const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
			const isParam = Array.isArray(pattern);
			const key = isParam ? pattern[0] : pattern || p;
			const child = curNode.#children[key] ||= new Node();
			if (pattern && !child.#pattern) {
				child.#pattern = pattern;
				curNode.#patterns.push(child);
			}
			curNode = child;
			if (isParam) possibleKeys.add(pattern[1]);
		}
		curNode.#methods.push({ [method]: {
			handler,
			possibleKeys: [...possibleKeys],
			score: ++order
		} });
	}
	#pushHandlerSets(handlerSets, node, method, nodeParams, params) {
		for (let i = 0, len = node.#methods.length; i < len; i++) {
			const m = node.#methods[i];
			const handlerSet = m[method] || m["ALL"];
			if (handlerSet) {
				handlerSet.params = createNullObject();
				handlerSets.push(handlerSet);
				for (let i = 0, len = handlerSet.possibleKeys.length; i < len; i++) {
					const key = handlerSet.possibleKeys[i];
					handlerSet.params[key] = params?.[key] && !i ? params[key] : nodeParams[key] ?? params?.[key];
				}
			}
		}
	}
	search(method, path) {
		const handlerSets = [];
		this.#params = emptyParams;
		let curNodes = [this];
		const parts = splitPath(path);
		const curNodesQueue = [];
		const len = parts.length;
		let partOffsets = null;
		for (let i = 0; i < len; i++) {
			const part = parts[i];
			const isLast = i === len - 1;
			const tempNodes = [];
			for (let j = 0, len2 = curNodes.length; j < len2; j++) {
				const node = curNodes[j];
				const nextNode = node.#children[part];
				if (nextNode) {
					nextNode.#params = node.#params;
					if (isLast) {
						if (nextNode.#children["*"]) this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
						this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
					} else tempNodes.push(nextNode);
				}
				for (const child of node.#patterns) {
					const pattern = child.#pattern;
					const params = node.#params === emptyParams ? {} : { ...node.#params };
					if (typeof pattern === "string") {
						if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
							this.#pushHandlerSets(handlerSets, child, method, node.#params);
							if (pattern === "*") {
								child.#params = params;
								tempNodes.push(child);
							}
						}
						continue;
					}
					const [, name, matcher] = pattern;
					if (!part && matcher === true) continue;
					if (matcher !== true) {
						if (!partOffsets) {
							partOffsets = [];
							let offset = path[0] === "/" ? 1 : 0;
							for (let p = 0; p < len; p++) {
								partOffsets[p] = offset;
								offset += parts[p].length + 1;
							}
						}
						const restPathString = path.slice(partOffsets[i]);
						const m = matcher.exec(restPathString);
						if (m) {
							if (!Object.hasOwn(params, name)) params[name] = m[0];
							this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
							if (m[0].length === restPathString.length && child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, node.#params, params);
							for (const _ in child.#children) {
								child.#params = params;
								const componentCount = m[0].match(/\//g)?.length ?? 0;
								(curNodesQueue[componentCount] ||= []).push(child);
								break;
							}
							continue;
						}
					}
					if (matcher === true || matcher.test(part)) {
						if (!Object.hasOwn(params, name)) params[name] = part;
						if (isLast) {
							this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
							if (child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
						} else {
							child.#params = params;
							tempNodes.push(child);
						}
					}
				}
			}
			const shifted = curNodesQueue.shift();
			curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
		}
		if (handlerSets[1]) handlerSets.sort((a, b) => {
			return a.score - b.score;
		});
		return [handlerSets.map(({ handler, params }) => [handler, params])];
	}
};
// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
	name = "TrieRouter";
	#node = new Node();
	add(method, path, handler) {
		for (const result of checkOptionalParameter(path) || [path]) this.#node.insert(method, result, handler);
	}
	match(method, path) {
		return this.#node.search(method, path);
	}
};
// node_modules/hono/dist/hono.js
/**
* The Hono class extends the functionality of the HonoBase class.
* It sets up routing and allows for custom options to be passed.
*
* @template E - The environment type.
* @template S - The schema type.
* @template BasePath - The base path type.
*/
var Hono = class extends Hono$1 {
	/**
	* Creates an instance of the Hono class.
	*
	* @param options - Optional configuration options for the Hono instance.
	*/
	constructor(options = {}) {
		super(options);
		this.router = options.router ?? new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] });
	}
};
// node_modules/hono/dist/middleware/secure-headers/secure-headers.js
var HEADERS_MAP = {
	crossOriginEmbedderPolicy: ["Cross-Origin-Embedder-Policy", "require-corp"],
	crossOriginResourcePolicy: ["Cross-Origin-Resource-Policy", "same-origin"],
	crossOriginOpenerPolicy: ["Cross-Origin-Opener-Policy", "same-origin"],
	originAgentCluster: ["Origin-Agent-Cluster", "?1"],
	referrerPolicy: ["Referrer-Policy", "no-referrer"],
	strictTransportSecurity: ["Strict-Transport-Security", "max-age=15552000; includeSubDomains"],
	xContentTypeOptions: ["X-Content-Type-Options", "nosniff"],
	xDnsPrefetchControl: ["X-DNS-Prefetch-Control", "off"],
	xDownloadOptions: ["X-Download-Options", "noopen"],
	xFrameOptions: ["X-Frame-Options", "SAMEORIGIN"],
	xPermittedCrossDomainPolicies: ["X-Permitted-Cross-Domain-Policies", "none"],
	xXssProtection: ["X-XSS-Protection", "0"]
};
var DEFAULT_OPTIONS = {
	crossOriginEmbedderPolicy: false,
	crossOriginResourcePolicy: true,
	crossOriginOpenerPolicy: true,
	originAgentCluster: true,
	referrerPolicy: true,
	strictTransportSecurity: true,
	xContentTypeOptions: true,
	xDnsPrefetchControl: true,
	xDownloadOptions: true,
	xFrameOptions: true,
	xPermittedCrossDomainPolicies: true,
	xXssProtection: true,
	removePoweredBy: true,
	permissionsPolicy: {}
};
/**
* Secure Headers Middleware for Hono.
*
* @see {@link https://hono.dev/docs/middleware/builtin/secure-headers}
*
* @param {Partial<SecureHeadersOptions>} [customOptions] - The options for the secure headers middleware.
* @param {ContentSecurityPolicyOptions} [customOptions.contentSecurityPolicy] - Settings for the Content-Security-Policy header.
* @param {ContentSecurityPolicyOptions} [customOptions.contentSecurityPolicyReportOnly] - Settings for the Content-Security-Policy-Report-Only header.
* @param {overridableHeader} [customOptions.crossOriginEmbedderPolicy=false] - Settings for the Cross-Origin-Embedder-Policy header.
* @param {overridableHeader} [customOptions.crossOriginResourcePolicy=true] - Settings for the Cross-Origin-Resource-Policy header.
* @param {overridableHeader} [customOptions.crossOriginOpenerPolicy=true] - Settings for the Cross-Origin-Opener-Policy header.
* @param {overridableHeader} [customOptions.originAgentCluster=true] - Settings for the Origin-Agent-Cluster header.
* @param {overridableHeader} [customOptions.referrerPolicy=true] - Settings for the Referrer-Policy header.
* @param {ReportingEndpointOptions[]} [customOptions.reportingEndpoints] - Settings for the Reporting-Endpoints header.
* @param {ReportToOptions[]} [customOptions.reportTo] - Settings for the Report-To header.
* @param {overridableHeader} [customOptions.strictTransportSecurity=true] - Settings for the Strict-Transport-Security header.
* @param {overridableHeader} [customOptions.xContentTypeOptions=true] - Settings for the X-Content-Type-Options header.
* @param {overridableHeader} [customOptions.xDnsPrefetchControl=true] - Settings for the X-DNS-Prefetch-Control header.
* @param {overridableHeader} [customOptions.xDownloadOptions=true] - Settings for the X-Download-Options header.
* @param {overridableHeader} [customOptions.xFrameOptions=true] - Settings for the X-Frame-Options header.
* @param {overridableHeader} [customOptions.xPermittedCrossDomainPolicies=true] - Settings for the X-Permitted-Cross-Domain-Policies header.
* @param {overridableHeader} [customOptions.xXssProtection=true] - Settings for the X-XSS-Protection header.
* @param {boolean} [customOptions.removePoweredBy=true] - Settings for remove X-Powered-By header.
* @param {PermissionsPolicyOptions} [customOptions.permissionsPolicy] - Settings for the Permissions-Policy header.
* @returns {MiddlewareHandler} The middleware handler function.
*
* @example
* ```ts
* const app = new Hono()
* app.use(secureHeaders())
* ```
*/
var secureHeaders = (customOptions) => {
	const options = {
		...DEFAULT_OPTIONS,
		...customOptions
	};
	const headersToSet = getFilteredHeaders(options);
	const callbacks = [];
	if (options.contentSecurityPolicy) {
		const [callback, value] = getCSPDirectives(options.contentSecurityPolicy, "Content-Security-Policy");
		if (callback) callbacks.push(callback);
		headersToSet.push(["Content-Security-Policy", value]);
	}
	if (options.contentSecurityPolicyReportOnly) {
		const [callback, value] = getCSPDirectives(options.contentSecurityPolicyReportOnly, "Content-Security-Policy-Report-Only");
		if (callback) callbacks.push(callback);
		headersToSet.push(["Content-Security-Policy-Report-Only", value]);
	}
	if (options.permissionsPolicy && Object.keys(options.permissionsPolicy).length > 0) headersToSet.push(["Permissions-Policy", getPermissionsPolicyDirectives(options.permissionsPolicy)]);
	if (options.reportingEndpoints) headersToSet.push(["Reporting-Endpoints", getReportingEndpoints(options.reportingEndpoints)]);
	if (options.reportTo) headersToSet.push(["Report-To", getReportToOptions(options.reportTo)]);
	return async function secureHeaders(ctx, next) {
		const headersToSetForReq = callbacks.length === 0 ? headersToSet : callbacks.reduce((acc, cb) => cb(ctx, acc), headersToSet);
		await next();
		setHeaders(ctx, headersToSetForReq);
		if (options?.removePoweredBy) ctx.res.headers.delete("X-Powered-By");
	};
};
function getFilteredHeaders(options) {
	return Object.entries(HEADERS_MAP).filter(([key]) => options[key]).map(([key, defaultValue]) => {
		const overrideValue = options[key];
		return typeof overrideValue === "string" ? [defaultValue[0], overrideValue] : defaultValue;
	});
}
function getCSPDirectives(contentSecurityPolicy, headerName) {
	const callbacks = [];
	const resultValues = [];
	for (const [directive, value] of Object.entries(contentSecurityPolicy)) {
		const valueArray = Array.isArray(value) ? value : [value];
		valueArray.forEach((value, i) => {
			if (typeof value === "function") {
				const index = i * 2 + 2 + resultValues.length;
				callbacks.push((ctx, values) => {
					values[index] = value(ctx, directive);
				});
			}
		});
		resultValues.push(directive.replace(/[A-Z]+(?![a-z])|[A-Z]/g, (match, offset) => offset ? "-" + match.toLowerCase() : match.toLowerCase()), ...valueArray.flatMap((value) => [" ", value]), "; ");
	}
	resultValues.pop();
	return callbacks.length === 0 ? [void 0, resultValues.join("")] : [(ctx, headersToSet) => headersToSet.map((values) => {
		if (values[0] === headerName) {
			const clone = values[1].slice();
			callbacks.forEach((cb) => {
				cb(ctx, clone);
			});
			return [values[0], clone.join("")];
		} else return values;
	}), resultValues];
}
function getPermissionsPolicyDirectives(policy) {
	return Object.entries(policy).map(([directive, value]) => {
		const kebabDirective = camelToKebab(directive);
		if (typeof value === "boolean") return `${kebabDirective}=${value ? "*" : "()"}`;
		if (Array.isArray(value)) {
			if (value.length === 0) return `${kebabDirective}=()`;
			if (value.length === 1 && value[0] === "*") return `${kebabDirective}=*`;
			if (value.length === 1 && value[0] === "none") return `${kebabDirective}=()`;
			return `${kebabDirective}=(${value.map((item) => ["self", "src"].includes(item) ? item : `"${item}"`).join(" ")})`;
		}
		return "";
	}).filter(Boolean).join(", ");
}
function camelToKebab(str) {
	return str.replace(/([a-z\d])([A-Z])/g, "$1-$2").toLowerCase();
}
function getReportingEndpoints(reportingEndpoints = []) {
	return reportingEndpoints.map((endpoint) => `${endpoint.name}="${endpoint.url}"`).join(", ");
}
function getReportToOptions(reportTo = []) {
	return reportTo.map((option) => JSON.stringify(option)).join(", ");
}
function setHeaders(ctx, headersToSet) {
	headersToSet.forEach(([header, value]) => {
		ctx.res.headers.set(header, value);
	});
}
// node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function joinValues(array, separator = "|") {
	return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
var Cached = class {
	constructor(getter) {
		this._getter = getter;
		this._value = void 0;
	}
	get value() {
		const getter = this._getter;
		if (getter !== void 0) {
			this._value = getter();
			this._getter = void 0;
		}
		return this._value;
	}
};
function cached(getter) {
	return new Cached(getter);
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
/**
* Whichever object a def's `shape` currently answers from: the one the caller passed until the first read, the frozen copy after it.
*
* Its keys and descriptors read without invoking anything, which is what lets a discriminated union check its discriminator, and the cycle walk read a shape, without resolving a getter that references the schema being constructed. A def that answers `shape` from an accessor of its own has none.
*/
function rawShape(def) {
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
	return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
	Object.defineProperty(target, key, {
		get() {
			const value = getter();
			assignProp(this, key, value);
			return value;
		},
		enumerable: true,
		configurable: true
	});
}
function putProp(target, key, value) {
	if (key in target) assignProp(target, key, value);
	else target[key] = value;
}
/**
* Copies `keys` of `source`'s shape onto `target`, each value passed through `wrap`.
*
* A key the source has resolved is copied through now, so the derived shape states it outright and nothing has to resolve it to learn what it holds. A key the source still defers stays deferred, and reads back through the source's own `shape`, so it resolves once and both shapes get that one schema.
*/
function mirrorShape(target, source, keys, wrap) {
	const raw = sourceShape(source);
	for (const key of keys) {
		const desc = Object.getOwnPropertyDescriptor(raw, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => {
			const value = source._zod.def.shape[key];
			return wrap ? wrap(value, key) : value;
		});
		else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
	}
}
function mirrorProps(target, source) {
	for (const key of Reflect.ownKeys(source)) {
		const desc = Object.getOwnPropertyDescriptor(source, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => source[key]);
		else putProp(target, key, desc.value);
	}
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) {
		const descriptors = Object.getOwnPropertyDescriptors(def);
		Object.assign(mergedDescriptors, descriptors);
	}
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__*/ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
var propertyKeyTypes = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function stringifyPrimitive(value) {
	if (typeof value === "bigint") return value.toString() + "n";
	if (typeof value === "string") return `"${value}"`;
	return `${value}`;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
	});
}
var NUMBER_FORMAT_RANGES = /*@__PURE__*/ (() => ({
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
var BIGINT_FORMAT_RANGES = {
	int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
	uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	const newShape = {};
	mirrorShape(newShape, schema, maskedKeys(schema, mask));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function maskedKeys(schema, mask) {
	const raw = sourceShape(schema);
	const keys = [];
	for (const key of Reflect.ownKeys(mask)) {
		if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
		if (mask[key]) keys.push(key);
	}
	return keys;
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	const omitted = new Set(maskedKeys(schema, mask));
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = sourceShape(schema);
		for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
	mirrorProps(newShape, shape);
	return newShape;
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
	if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	const newShape = {};
	mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
	mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
	return clone(a, mergeDefs(a._zod.def, {
		shape: newShape,
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask, name = "partial") {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
		type: "optional",
		innerType: value
	})));
	return clone(schema, mergeDefs(schema._zod.def, {
		shape: newShape,
		checks: []
	}));
}
function required(Class, schema, mask) {
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
		type: "nonoptional",
		innerType: value
	}));
	return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
/** The leading size checks of `defChecks` that set an upper bound, each paired with it. */
function sizeCaps(defChecks) {
	const caps = [];
	for (const ch of defChecks ?? []) {
		const d = ch._zod.def;
		if (!/_(length|size)$|_equals$/.test(d.check)) break;
		const max = d.maximum ?? d.length ?? d.size;
		if (max >= 0) caps.push([max, ch]);
	}
	return caps;
}
function attachSchema(issues, start, inst) {
	var _a;
	for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
}
function finalizeIssue(iss, ctx, config) {
	var _a;
	const traits = iss.inst?._zod?.traits;
	if (traits?.has("$ZodType")) {
		if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
		else iss.schema = iss.inst;
	}
	const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const full = {};
	for (const k of Object.keys(iss)) {
		if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
		full[k] = iss[k];
	}
	full.path ?? (full.path = []);
	full.message = message;
	if (ctx?.reportInput) full.input = iss.input;
	return full;
}
var highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
	const units = str.length;
	if (!highSurrogate.test(str)) return units;
	let count = units;
	for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
		count--;
		i++;
	}
	return count;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function parsedType(data) {
	const t = typeof data;
	switch (t) {
		case "number": return Number.isNaN(data) ? "nan" : "number";
		case "object": {
			if (data === null) return "null";
			if (Array.isArray(data)) return "array";
			const obj = data;
			if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
		}
	}
	return t;
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
/**
* Installs a trait's members on its prototype. Each value builds that member for the instance on first read; the built value shadows the accessor as an own property, so a detached `const { parse } = schema` keeps working.
*
* Call this from a `proto` initializer, which runs once per prototype — never per instance.
*/
function members(proto, table) {
	for (const key in table) {
		const desc = Object.getOwnPropertyDescriptor(table, key);
		if (desc.get) Object.defineProperty(proto, key, {
			...desc,
			enumerable: false
		});
		else defineBound(proto, key, desc.value);
	}
}
/** Shadows a prototype member with an own value, so a getter that builds from the instance runs once. */
function own(inst, key, value, enumerable = true) {
	Object.defineProperty(inst, key, {
		configurable: true,
		writable: true,
		enumerable,
		value
	});
	return value;
}
/** Like {@link own}, for a member that was never an own data property and has to stay out of `Object.keys`. */
function hide(inst, key, value) {
	return own(inst, key, value, false);
}
/** Adds members a table derives from the instance: each builds on first read and shadows as own data, and assignment shadows the same way, as when these were own properties. */
/* @__NO_SIDE_EFFECTS__ */
function derived(computes, table) {
	for (const key in computes) {
		const compute = computes[key];
		Object.defineProperty(table, key, {
			configurable: true,
			enumerable: true,
			get() {
				return own(this, key, compute(this));
			},
			set(value) {
				own(this, key, value);
			}
		});
	}
	return table;
}
function defineBound(proto, key, fn) {
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			return this == null ? fn : own(this, key, fn.bind(this));
		},
		set(value) {
			own(this, key, value);
		}
	});
}
/** Returns the prototype to install on, or `undefined` if this group is already installed on it. */
function claim(inst, sentinel) {
	const proto = Object.getPrototypeOf(inst);
	return sentinel in proto ? void 0 : proto;
}
var installing;
var broke = false;
var breaker = {
	configurable: true,
	get() {
		broke = true;
	}
};
/**
* Installs a lazily-derived internal on the `_zod` prototype of `inst`'s
* constructor, computed from the internals object itself and cached there on
* first read. One accessor per constructor rather than one per instance.
*/
function defineLazyInternal(inst, key, compute) {
	const proto = Object.getPrototypeOf(inst._zod);
	if (key in proto && installing !== inst._zod) {
		installing = void 0;
		return;
	}
	installing = inst._zod;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			Object.defineProperty(this, key, breaker);
			const outer = broke;
			broke = false;
			try {
				const value = compute(this);
				if (broke) delete this[key];
				else Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					value
				});
				broke = broke || outer;
				return value;
			} catch (err) {
				delete this[key];
				broke = broke || outer;
				throw err;
			}
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value
			});
		}
	});
}
/**
* Installs `key` on `inst`'s prototype, computed by `make` on first read and cached there as an own
* data property. One accessor per constructor rather than one per instance, because an own accessor
* puts every instance after the first into v8 dictionary mode. The key doubles as the sentinel.
*/
function installLazyProp(inst, key, make, enumerable) {
	const proto = claim(inst, key);
	if (!proto) return;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			const desc = {
				configurable: true,
				writable: true,
				enumerable,
				value: void 0
			};
			Object.defineProperty(this, key, desc);
			desc.value = make(this);
			Object.defineProperty(this, key, desc);
			return desc.value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				enumerable,
				value
			});
		}
	});
}
/** Marks the thunk `_catch` synthesises for a constant catch value. `Function.length` cannot tell that thunk from a user callback — rest and defaulted parameters both report arity 0 — and a user callback reads `ctx.error`, whose issues only finalize correctly against the caller's per-parse error map. Provenance can say what arity cannot. A plain string key rather than `Symbol.for`, whose call at module scope no bundler can prove pure — the same shape that anchored `urlCanParse` into every build. */
var CONSTANT_CATCH = "~constantCatch";
/** Wraps a constant catch value in a thunk tagged with {@link CONSTANT_CATCH}. */
function constantCatch(value) {
	const fn = () => value;
	fn[CONSTANT_CATCH] = true;
	return fn;
}
// node_modules/zod/v4/core/core.js
var _a$1;
var _zodDesc = {
	value: void 0,
	enumerable: false
};
var _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
	const E = _E;
	if (E) {
		const saved = E.stackTraceLimit;
		if (typeof saved === "number") {
			try {
				E.stackTraceLimit = 0;
			} catch {
				_E = null;
				return new Definition();
			}
			try {
				return new Definition();
			} finally {
				E.stackTraceLimit = saved;
			}
		}
	}
	return new Definition();
}
/* @__NO_SIDE_EFFECTS__ */
function $constructor(name, initializer, proto, params) {
	const zodProto = {};
	function Internals(def) {
		this.def = def;
		this.constr = _;
		this.traits = /* @__PURE__ */ new Set();
	}
	Internals.prototype = zodProto;
	const protoMembers = proto;
	const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
	function init(inst, def) {
		if (!inst._zod) {
			_zodDesc.value = new Internals(def);
			try {
				Object.defineProperty(inst, "_zod", _zodDesc);
			} finally {
				_zodDesc.value = void 0;
			}
		} else if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		if (initialized) {
			const own = Object.getPrototypeOf(inst);
			const ctorProto = inst._zod.constr.prototype;
			let up = own;
			while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
			const target = up ?? own;
			if (!initialized.has(target)) {
				initialized.add(target);
				members(target, protoMembers);
			}
		}
		const proto = _.prototype;
		for (const k in proto) {
			if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		const inst = params?.Parent ? newError(Definition) : this;
		init(inst, def);
		const deferred = inst._zod.deferred;
		if (deferred) {
			for (const fn of deferred) fn();
			inst._zod.deferred = void 0;
		}
		const pp = globalThis.__zod_globalConfig?.postProcessor;
		if (pp) pp(inst);
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}
// node_modules/zod/v4/core/errors.js
function _getMessage() {
	const internals = this._zod;
	internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
	return internals.message;
}
function _setMessage(value) {
	this._zod.message = value;
}
var _messageDesc = {
	get: _getMessage,
	set: _setMessage,
	enumerable: true,
	configurable: true
};
var _issuesDesc = {
	value: void 0,
	enumerable: false
};
var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
var initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	_issuesDesc.value = def;
	Object.defineProperty(inst, "issues", _issuesDesc);
	_issuesDesc.value = void 0;
	Object.defineProperty(inst, "message", _messageDesc);
	const proto = Object.getPrototypeOf(inst);
	if (!_installedToString.has(proto)) {
		_installedToString.add(proto);
		Object.defineProperty(proto, "toString", {
			configurable: true,
			enumerable: false,
			get() {
				const value = () => this.message;
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
				return value;
			},
			set(value) {
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
			}
		});
	}
};
var $ZodError = /* @__PURE__ */ $constructor("$ZodError", initializer$1);
/** Get-or-create `obj[key]` as an own data property. A path segment naming an inherited member
* ("toString", "constructor") would otherwise read through to the prototype, and assigning
* "__proto__" would hit the setter instead of creating a key. */
function node(obj, key, make) {
	if (!Object.prototype.hasOwnProperty.call(obj, key)) {
		if (key === "__proto__") Object.defineProperty(obj, key, {
			value: make(),
			writable: true,
			enumerable: true,
			configurable: true
		});
		else obj[key] = make();
	}
	return obj[key];
}
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
	else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					const terminal = i === fullpath.length - 1;
					if (el === "_errors") {
						if (terminal) curr._errors.push(mapper(issue));
						i++;
						continue;
					}
					if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
						value: { _errors: [] },
						enumerable: true,
						writable: true,
						configurable: true
					});
					const node = curr[el];
					if (terminal) node._errors.push(mapper(issue));
					curr = node;
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}
// node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
	return {
		callee: params?.callee ?? callee,
		Err: params?.Err
	};
}
var _parse = (_Err) => {
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		if (result.issues.length) {
			const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, _params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
var _parseAsync = (_Err) => {
	const fn = async (schema, value, _ctx, params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		if (result.issues.length) {
			const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
function failure(Err, issues, ctx) {
	let error;
	return {
		success: false,
		get error() {
			if (!error) {
				error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
				issues = void 0;
				ctx = void 0;
			}
			return error;
		},
		set error(e) {
			error = e;
			issues = void 0;
			ctx = void 0;
		}
	};
}
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
var COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
var COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
var validate$1 = ((schema, value, _ctx) => {
	const validator = schema._zod.bag.validator;
	if (validator !== void 0) {
		if (validator(value) !== COMPILE_INVALID) return true;
		if (validator.definite === true && _ctx === void 0) return false;
	}
	return validateFallback(schema, value, _ctx);
});
function validateFallback(schema, value, _ctx) {
	const ctx = _ctx ? {
		..._ctx,
		async: false,
		abortEarly: true
	} : {
		async: false,
		abortEarly: true
	};
	const fallbackRun = schema._zod.bag.fallbackRun;
	let result;
	if (fallbackRun) {
		ctx[COMPILE_FALLBACK] = true;
		result = fallbackRun({
			value,
			issues: []
		}, ctx);
	} else result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length === 0;
}
var validateAsync$1 = async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true,
		abortEarly: true
	} : {
		async: true,
		abortEarly: true
	};
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length === 0;
};
var _encode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return parse(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _decode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		return parse(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _encodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _decodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};
// node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
	return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
var uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
/** Anchors a pattern source. The interpolation lives here rather than at the call site because
* esbuild will not drop a `@__PURE__` call whose own argument interpolates a variable, but it
* will drop `anchor(dateSource)`. Keeping it inline pinned `date` into every bundle. */
function anchor(source) {
	return new RegExp(`^${source}$`);
}
var date = /*@__PURE__*/ anchor(dateSource);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
	const opts = ["Z"];
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const qualified = `${timeSource({
		precision: args.precision,
		seconds: true
	})}(?:${opts.join("|")})`;
	const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var anyString = /^[\s\S]{0,}$/;
var number$1 = /^-?\d+(?:\.\d+)?$/;
var boolean$1 = /^(?:true|false)$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;
// node_modules/zod/v4/core/checks.js
var $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
/** Default `when` for length-based checks: run only on non-nullish values with a `length`. */
var _whenHasLength = (payload) => {
	const val = payload.value;
	return !nullish(val) && val.length !== void 0;
};
var numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
var $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
var $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});
// node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = [], closed = {}) {
		this.content = [];
		this.indent = 0;
		this.args = args;
		this.closed = closed;
	}
	indented(fn) {
		this.indent += 1;
		try {
			fn(this);
		} finally {
			this.indent -= 1;
		}
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const content = this?.content ?? [``];
		return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
	}
};
// node_modules/zod/v4/core/versions.js
var version = {
	major: 4,
	minor: 6,
	patch: 7
};
// node_modules/zod/v4/core/schemas.js
var $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const defChecks = inst._zod.def.checks;
	const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			if (payload.memo) return payload;
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
}, {
	get "~standard"() {
		return hide(this, "~standard", standardProps(this));
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	}
});
/** The Standard Schema surface for `inst`. Shared so wrappers can extend it without forcing it. */
var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync(inst, value) {
	const ctx = { async: true };
	return toStandardResult(await inst._zod.run({
		value,
		issues: []
	}, ctx), ctx);
}
function standardProps(inst) {
	return {
		validate: (value) => {
			const ctx = { async: false };
			try {
				const r = inst._zod.run({
					value,
					issues: []
				}, ctx);
				if (!(r instanceof Promise)) return toStandardResult(r, ctx);
			} catch (_) {}
			return validateAsync(inst, value);
		},
		vendor: "zod",
		version: 1
	};
}
var $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = def.pattern ?? anyString;
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
var $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
var $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
var $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
var $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
function canParseURL(input) {
	try {
		if (typeof URL !== "undefined" && typeof URL.canParse === "function") return URL.canParse(input);
		new URL(input);
		return true;
	} catch {
		return false;
	}
}
function validateURL(trimmed, def) {
	if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) return canParseURL(trimmed) || 2;
	return parseURLObject(trimmed, def);
}
/** Parses a URL while preserving the non-normalizing HTTP guard. */
function parseURLObject(trimmed, def) {
	if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
	try {
		if (typeof URL !== "undefined") {
			const URLStatic = URL;
			if (typeof URLStatic.parse === "function") return URLStatic.parse(trimmed) ?? 2;
		}
		return new URL(trimmed);
	} catch {
		return 2;
	}
}
var asciiTabOrNewline = /[\t\n\r]/g;
/** The URL parser deletes every ASCII tab, LF and CR from its input before it parses, so `new URL("https://exa\nmple.com")` reports on `example.com`. Applying the same deletion to the returned value closes the half of that divergence which can move the host; the parser's other rewrite, stripping C0 controls at the edges, cannot. */
function stripTabAndNewline(value) {
	return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
	hostname.lastIndex = 0;
	return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
	protocol.lastIndex = 0;
	return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
var $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			const url = validateURL(trimmed, def);
			if (url === 1) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid URL format",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === 2) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === true) {
				payload.value = stripTabAndNewline(trimmed);
				return;
			}
			if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid hostname",
				pattern: def.hostname.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid protocol",
				pattern: def.protocol.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
var $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
	if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
	def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
var $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
var $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date);
	$ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration);
	$ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
});
/** An IPv6 address is written with hex digits, colons and dots, and nothing else. The guard is what makes the check below an IPv6 check: `new URL("http://[...]")` parses an authority, not an address, so `@` and `\` re-delimit it and `"::@1\\"` validates against the host `0.0.0.1`. The URL parser also deletes ASCII tab, LF and CR rather than failing, which is how `"::1\n"` validated as `::1`. */
var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
	if (!ipv6Alphabet.test(value)) return false;
	return canParseURL(`http://[${value}]`);
}
var $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidIPv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "ipv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
	const parts = value.split("/");
	if (parts.length !== 2) return false;
	const [address, prefix] = parts;
	if (!prefix) return false;
	const prefixNum = Number(prefix);
	if (`${prefixNum}` !== prefix) return false;
	if (prefixNum < 0 || prefixNum > 128) return false;
	return isValidIPv6(address);
}
var $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidCIDRv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "cidrv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
var $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64Charset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
	if (!base64urlCharset.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
var $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64urlCharset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
var $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = number$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
var $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
var $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
var $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
var $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function capSize(inst, size) {
	const caps = sizeCaps(inst._zod.def.checks);
	if (!caps.length) return;
	const cap = Math.min(...caps.map((c) => c[0]));
	const parse = inst._zod.parse;
	inst._zod.parse = (payload, ctx) => {
		const n = size(payload.value);
		if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
			for (const [max, ch] of sizeCaps(inst._zod.def.checks)) if (n > max && ch._zod.def.when(payload)) {
				const start = payload.issues.length;
				ch._zod.check(payload);
				payload.issues[start].continue = false;
				attachSchema(payload.issues, start, inst);
				return payload;
			}
		}
		return parse(payload, ctx);
	};
}
var arraySize = (input) => Array.isArray(input) ? input.length : -1;
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
var $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
		const proms = [];
		const abortEarly = ctx?.abortEarly;
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else {
				handleArrayResult(result, payload, i);
				if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
	capSize(inst, arraySize);
});
function handlePropertyResult(result, final, key, input, optin, optout) {
	const isPresent = key in input;
	const isOptionalOut = optout === "optional";
	if (!isPresent && isOptionalOut && optin === "optional") return;
	if (result.issues.length) {
		if (optin !== void 0 && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && optin === void 0) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
var NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	const ownSymbols = Object.getOwnPropertySymbols(def.shape);
	const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
	const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
	for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		allKeys,
		symbolKeys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const optin = _catchall.optin;
	const optout = _catchall.optout;
	let seen = 0;
	for (const key in input) {
		if (abortEarly && payload.issues.length !== seen) {
			if (aborted(payload, seen)) break;
			seen = payload.issues.length;
		}
		if (keySet.has(key)) continue;
		if (key === "__proto__") {
			if (t === "never") unrecognized.push(key);
			continue;
		}
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
		else handlePropertyResult(r, payload, key, input, optin, optout);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst,
		continue: true
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
var $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	const sh = desc?.get ? desc.get.raw : def.shape ?? {};
	if (sh) {
		const get = () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			get.raw = newSh;
			return newSh;
		};
		get.raw = sh;
		Object.defineProperty(def, "shape", { get });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazyInternal(inst, "propValues", (zod) => {
		const shape = zod.def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
				if (field.optin !== void 0) propValues[key].add(void 0);
			}
		}
		return propValues;
	});
	const isObject$1 = isObject;
	const catchall = def.catchall;
	let value;
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
		const proms = [];
		const shape = value.shape;
		const abortEarly = ctx?.abortEarly;
		let seen = payload.issues.length;
		for (const key of value.allKeys) {
			if (abortEarly && payload.issues.length !== seen) {
				if (aborted(payload, seen)) break;
				seen = payload.issues.length;
			}
			if (key === "__proto__") continue;
			const el = shape[key];
			const optin = el._zod.optin;
			const optout = el._zod.optout;
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
			else handlePropertyResult(r, payload, key, input, optin, optout);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
	};
});
var $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const memo = globalConfig.memoizer;
	const generateFastpass = (shape) => {
		const normalized = _normalized.value;
		const syms = normalized.symbolKeys;
		const doc = new Doc(["payload", "ctx"], {
			shape,
			inst,
			memo,
			syms
		});
		const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
		doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
		for (const key of normalized.allKeys) {
			if (key === "__proto__") continue;
			const id = ids[key];
			const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
			const isPresent = `${k} in input`;
			const schema = shape[key];
			const optin = schema?._zod?.optin;
			const isOptionalIn = optin !== void 0;
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(k)};`);
			if (isOptionalIn && isOptionalOut) {
				const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
				doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
			else {
				doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
				if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
				else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
			}
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		return doc.compile();
	};
	let fastpass;
	const isObject$2 = isObject;
	const jit = !globalConfig.jitless;
	const fastEnabled = jit && allowsEval.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
var $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
	defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazyInternal(inst, "values", (zod) => {
		if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		if (zod.def.options.every((o) => o._zod.pattern)) {
			const patterns = zod.def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
var $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
		for (const key of sharedKeys) {
			if (key === "__proto__") continue;
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	const keyIssues = /* @__PURE__ */ new Map();
	const collect = (iss, side) => {
		let keys;
		if (iss.code === "unrecognized_keys" && !iss.path?.length) {
			unrecIssue ?? (unrecIssue = iss);
			keys = iss.keys;
		} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
			const k = String(iss.path[0]);
			if (!keyIssues.has(k)) keyIssues.set(k, iss);
			keys = [k];
		} else return false;
		for (const k of keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k)[side] = true;
		}
		return true;
	};
	for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
	for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length) {
		const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
		if (aggregated.length) result.issues.push({
			...unrecIssue,
			keys: aggregated
		});
		for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
	}
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) {
		if (aborted(result)) return result;
		throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	}
	result.value = merged.data;
	return result;
}
var $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	defineLazyInternal(inst, "pattern", (zod) => {
		const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
		return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
var $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	globalConfig.memoizer?.guard(inst);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		return payload;
	};
});
function handleOptionalResult(payload, result) {
	payload.value = result.issues.length ? void 0 : result.value;
	return payload;
}
var $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	inst._zod.optout = "optional";
	defineLazyInternal(inst, "values", (zod) => {
		const values = zod.def.innerType._zod.values;
		return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === void 0) {
			if (def.innerType._zod.optin !== "defaulted") return payload;
			const result = def.innerType._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
			return handleOptionalResult(payload, result);
		}
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazyInternal(inst, "values", (zod) => {
		return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
var $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => {
		const v = zod.def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
function handleCatchResult(payload, result, def, ctx) {
	if (!result.issues.length) {
		payload.value = result.value;
		if (result.memo) payload.memo = true;
		return payload;
	}
	payload.value = def.catchValue({
		...result,
		value: payload.value,
		error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
		input: payload.value
	});
	return payload;
}
var $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run({
			value: payload.value,
			issues: []
		}, ctx);
		if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
		return handleCatchResult(payload, result, def, ctx);
	};
});
var $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues
	}, ctx);
}
var $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	if (!payload.memo) payload.value = Object.freeze(payload.value);
	return payload;
}
var $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}
// node_modules/zod/v4/core/memoizer.js
var $ZodCyclicError = class extends Error {
	constructor() {
		super(`Cannot parse a reference cycle that closes through a transform`);
		this.name = "ZodCyclicError";
	}
};
/** Keyed off the context object every schema in one parse call already shares. */
var STATE = "~memo";
var NO_ISSUES = [];
function isRef(value) {
	return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
	return issues.map((iss) => iss.path ? {
		...iss,
		path: iss.path.slice()
	} : { ...iss });
}
var recursive = /*@__PURE__*/ new WeakMap();
/** What the walk established, in order of certainty: ordered so the strongest answer among children wins. */
var NONE = 0;
var ASSUMED = 1;
var PROVEN = 2;
/** Whether this schema's subtree contains a cycle, so one parse can re-enter it. */
function isRecursive(inst, stack, resolve) {
	const cached = recursive.get(inst);
	if (cached !== void 0) return cached ? PROVEN : NONE;
	if (stack.has(inst)) return PROVEN;
	stack.add(inst);
	let result = NONE;
	const check = (child) => {
		if (result !== PROVEN && child?._zod) {
			const answer = isRecursive(child, stack, resolve);
			if (answer > result) result = answer;
		}
	};
	const shape = (sh, spread) => {
		let answer = NONE;
		for (const key of Reflect.ownKeys(sh)) {
			const desc = Object.getOwnPropertyDescriptor(sh, key);
			if (spread && !desc.enumerable) continue;
			const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
			if (child > answer) answer = child;
		}
		return answer;
	};
	const merge = (answer) => {
		if (answer > result) result = answer;
	};
	const def = inst._zod.def;
	switch (def.type) {
		case "object": {
			const raw = rawShape(def);
			merge(raw ? shape(raw, true) : ASSUMED);
			check(def.catchall);
			break;
		}
		case "array":
			check(def.element);
			break;
		case "tuple":
			for (const el of def.items) check(el);
			check(def.rest);
			break;
		case "record":
		case "map":
			check(def.keyType);
			check(def.valueType);
			break;
		case "set":
			check(def.valueType);
			break;
		case "union":
			for (const el of def.options) check(el);
			break;
		case "intersection":
			check(def.left);
			check(def.right);
			break;
		case "optional":
		case "nullable":
		case "default":
		case "prefault":
		case "catch":
		case "readonly":
		case "nonoptional":
		case "promise":
		case "success":
			check(def.innerType);
			break;
		case "pipe":
			check(def.in);
			check(def.out);
			break;
		case "function":
			check(def.input);
			check(def.output);
			break;
		case "lazy": {
			const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
			merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
			break;
		}
		case "template_literal":
		case "string":
		case "number":
		case "int":
		case "boolean":
		case "bigint":
		case "symbol":
		case "undefined":
		case "null":
		case "void":
		case "never":
		case "any":
		case "unknown":
		case "date":
		case "nan":
		case "enum":
		case "literal":
		case "file":
		case "transform":
		case "custom": break;
		default: for (const key in def) {
			const desc = Object.getOwnPropertyDescriptor(def, key);
			if (!desc || desc.get) continue;
			const value = desc.value;
			if (!value || typeof value !== "object") continue;
			if (value._zod) check(value);
			else if (Array.isArray(value)) for (const el of value) check(el);
		}
	}
	stack.delete(inst);
	return settle(inst, result);
}
/** An assumed answer must not outlive the resolution that settles it, so only a certain one is cached. */
function settle(inst, answer) {
	if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
	return answer;
}
function bucketFor(state, inst) {
	let bucket = state.buckets.get(inst);
	if (!bucket) {
		bucket = /* @__PURE__ */ new WeakMap();
		state.buckets.set(inst, bucket);
	}
	return bucket;
}
var handoff;
var open = [];
var memo = {
	alloc(_inst, payload, empty) {
		const bucket = handoff;
		if (!bucket) return empty;
		handoff = void 0;
		const entry = {
			value: empty,
			issues: null
		};
		bucket.set(payload.value, entry);
		open.push(entry);
		return empty;
	},
	guard(inst) {
		var _a;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
				return base(payload, ctx);
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	},
	attach(inst) {
		var _a;
		let isRecursiveInst;
		let rechecked = false;
		let lastCtx;
		let lastBucket;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (isRecursiveInst === void 0) {
					const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
					if (walked === NONE) {
						inst._zod.parse = base;
						if (inst._zod.run === wrapped) inst._zod.run = base;
						return base(payload, ctx);
					}
					if (walked === PROVEN || rechecked) isRecursiveInst = true;
					else rechecked = true;
				}
				const input = payload.value;
				if (!isRef(input)) return base(payload, ctx);
				let state = ctx[STATE];
				if (!state) {
					state = {
						buckets: /* @__PURE__ */ new WeakMap(),
						backEdges: void 0
					};
					ctx[STATE] = state;
				}
				let bucket;
				if (lastCtx === ctx) bucket = lastBucket;
				else {
					bucket = bucketFor(state, inst);
					lastCtx = ctx;
					lastBucket = bucket;
				}
				const hit = bucket.get(input);
				if (hit) {
					payload.value = hit.value;
					if (hit.issues) {
						if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
					} else {
						payload.memo = true;
						state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
						state.backEdges.add(hit.value);
					}
					return payload;
				}
				handoff = bucket;
				const depth = open.length;
				const result = base(payload, ctx);
				handoff = void 0;
				const entry = open.length > depth ? open.pop() : void 0;
				if (result instanceof Promise) return result.then((r) => {
					if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
					return r;
				});
				if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
				return result;
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	}
};
/** The memoizer that gives containers cycle support. `zod` installs it by default; `zod/mini` opts in with `config({ memoizer: memoizer() })`. */
function memoizer() {
	return memo;
}
/** Whether this value is a node a back-edge resolved to before it finished. */
function isBackEdge(ctx, value) {
	const backEdges = ctx[STATE]?.backEdges;
	return backEdges !== void 0 && isRef(value) && backEdges.has(value);
}
// node_modules/zod/v4/locales/en.js
var error = () => {
	const Sizable = {
		string: {
			unit: "characters",
			verb: "to have"
		},
		file: {
			unit: "bytes",
			verb: "to have"
		},
		array: {
			unit: "items",
			verb: "to have"
		},
		set: {
			unit: "items",
			verb: "to have"
		},
		map: {
			unit: "entries",
			verb: "to have"
		}
	};
	function getSizing(origin) {
		return Sizable[origin] ?? null;
	}
	const FormatDictionary = {
		regex: "input",
		email: "email address",
		url: "URL",
		emoji: "emoji",
		uuid: "UUID",
		uuidv4: "UUIDv4",
		uuidv6: "UUIDv6",
		nanoid: "nanoid",
		guid: "GUID",
		cuid: "cuid",
		cuid2: "cuid2",
		ulid: "ULID",
		xid: "XID",
		ksuid: "KSUID",
		datetime: "ISO datetime",
		date: "ISO date",
		time: "ISO time",
		duration: "ISO duration",
		ipv4: "IPv4 address",
		ipv6: "IPv6 address",
		mac: "MAC address",
		cidrv4: "IPv4 range",
		cidrv6: "IPv6 range",
		base64: "base64-encoded string",
		base64url: "base64url-encoded string",
		json_string: "JSON string",
		e164: "E.164 number",
		currency_code: "currency code",
		credit_card: "credit card number",
		iban: "IBAN",
		jwt: "JWT",
		template_literal: "input"
	};
	const TypeDictionary = { nan: "NaN" };
	function getTypeName(type, input) {
		if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
		return TypeDictionary[type] ?? type;
	}
	return (issue) => {
		switch (issue.code) {
			case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
			case "invalid_value":
				if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
				return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
			case "too_big": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
				return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
			}
			case "too_small": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
				return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
			}
			case "invalid_format": {
				const _issue = issue;
				if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
				if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
				if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
				if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
				return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
			}
			case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
			case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
			case "invalid_key": return `Invalid key in ${issue.origin}`;
			case "invalid_union":
				if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
				if (issue.inclusive === false) return "Invalid input: more than one option matched";
				return "Invalid input";
			case "invalid_element": return `Invalid value in ${issue.origin}`;
			default: return `Invalid input`;
		}
	};
};
function en_default() {
	return { localeError: error() };
}
// node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;
// node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
	if (def.checks) def.checks = [...def.checks];
	return def;
}
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
	return new Class(snapshotChecks({
		type: "string",
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _coercedNumber(Class, params) {
	return new Class(snapshotChecks({
		type: "number",
		coerce: true,
		checks: [],
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}
// node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
	for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
	return target;
}
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		sharedDefsExtractedFor: void 0,
		sharedEmitDoneFor: void 0,
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		intersections: [],
		deferred: [],
		external: params?.external ?? void 0
	};
}
/**
* Applies the `unrepresentable` setting at a site that has no JSON Schema equivalent. Throws
* `message` unless the setting (or the handler's return value) says otherwise. Returns `true` if a
* custom JSON Schema was written into `json`, in which case the caller must not write its own.
*/
function handleUnrepresentable(schema, ctx, json, params, message) {
	const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
		zodSchema: schema,
		path: params.path,
		message
	}) : ctx.unrepresentable;
	if (result === "any") return false;
	if (result === void 0 || result === "throw") throw new Error(message);
	Object.assign(json, result);
	return true;
}
function processSchema(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	ctx.sharedDefsExtractedFor = void 0;
	ctx.sharedEmitDoneFor = void 0;
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			processSchema(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) assignProps(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function encodeJSONPointerSegment(segment) {
	return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
			};
		}
		const uriPrefix = `#`;
		const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
		if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + encodeJSONPointerSegment(defId)
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") extractToDef(entry);
		}
	}
	if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
}
/** Rewrites `anyOf: [{type: "a"}, {type: "b"}]` to `type: ["a", "b"]`, which every JSON Schema draft treats as equivalent and most consumers render far better for the nullable case. Only branches that are a bare type assertion qualify — anything carrying a constraint, `$ref`, `const` or metadata is left alone. Runs after `flattenRef`, so a branch an override decorated or `$defs` extraction turned into a `$ref` is no longer bare and correctly stays in `anyOf`. `oneOf` is excluded: `integer` and `number` overlap, so "exactly one" and "at least one" are not the same there. OpenAPI 3.0 is excluded: its `type` must be a single string. */
function compactTypeUnion(schema) {
	const options = schema.anyOf;
	if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
	const types = [];
	for (const option of options) {
		if (!option || typeof option !== "object") return;
		compactTypeUnion(option);
		const keys = Object.keys(option);
		if (keys.length !== 1 || keys[0] !== "type") return;
		const type = option.type;
		for (const member of Array.isArray(type) ? type : [type]) {
			if (typeof member !== "string") return;
			if (!types.includes(member)) types.push(member);
		}
	}
	delete schema.anyOf;
	schema.type = types.length === 1 ? types[0] : types;
}
/** Keywords `foldIntersection` knows how to combine. Anything else — `$ref`, `patternProperties`,
* an annotation like `description` — makes a member unfoldable, so a constraint this does not
* understand leaves the `allOf` alone instead of being silently dropped or misattributed. */
var FOLDABLE_KEYS = /* @__PURE__ */ new Set([
	"type",
	"properties",
	"required",
	"additionalProperties"
]);
var UNION_KEYS = ["oneOf", "anyOf"];
/** A member's constraint on a key it does not declare itself. A `catchall` states one; `false`, an absent `additionalProperties`, and the empty schema a loose object emits state nothing. */
function undeclaredConstraint(member) {
	const extra = member.additionalProperties;
	if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
	return Object.keys(extra).length ? extra : null;
}
/** Combines object members into the single object they describe together, or returns `null` if any of them carries a keyword outside {@link FOLDABLE_KEYS}. */
function foldObjects(members) {
	const objects = [];
	for (const member of members) {
		if (typeof member !== "object" || member.type !== "object") return null;
		for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
		objects.push(member);
	}
	const properties = {};
	const required = /* @__PURE__ */ new Set();
	for (const object of objects) {
		for (const key in object.properties) {
			if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
			const parts = [];
			for (const other of objects) {
				const part = other.properties?.[key] ?? undeclaredConstraint(other);
				if (part === null || part === void 0) continue;
				if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
			}
			assignProp(properties, key, parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts });
		}
		for (const key of object.required ?? []) required.add(key);
	}
	const folded = {
		type: "object",
		properties
	};
	if (required.size) folded.required = [...required];
	if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
	else {
		const constraints = [];
		for (const object of objects) {
			const constraint = undeclaredConstraint(object);
			if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
		}
		if (constraints.length === 1) folded.additionalProperties = constraints[0];
		else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
	}
	return folded;
}
/** `additionalProperties` in an `allOf` member sees only that member's own `properties`, so two
* closed object members reject each other's keys and the schema validates nothing. Zod's parser
* pools the key sets instead — `handleIntersectionResults` reports a key as unrecognized only when
* *every* side rejects it — so the emitted schema has to pool them too, and folding the members
* into one object is the encoding that says so on every target.
*
* This runs from `finalize`, after `extractDefs`, which is what keeps it clear of the `$ref`
* machinery: a member extracted into `$defs` is already a `$ref` by now and declines to fold, so it
* keeps its reference and its own closedness rather than being inlined as a stale copy. */
function foldIntersection(json) {
	const allOf = json.allOf;
	if (!Array.isArray(allOf) || allOf.length < 2) return;
	for (const key of FOLDABLE_KEYS) if (key in json) return;
	const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
	let folded = null;
	if (!unions.length) folded = foldObjects(allOf);
	else {
		const union = unions[0];
		const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
		if (Object.keys(union).length !== 1) return;
		const rest = allOf.filter((m) => m !== union);
		const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
		if (branches.some((b) => !b)) return;
		folded = { [keyword]: branches };
	}
	if (!folded) return;
	delete json.allOf;
	assignProps(json, folded);
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else assignProps(schema, refSchema);
			assignProps(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
		for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
		if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
		for (const rewrite of ctx.deferred) rewrite();
		if (ctx.intersections.length) {
			const carriers = /* @__PURE__ */ new Map();
			for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
				const allOf = json?.allOf;
				if (!Array.isArray(allOf)) continue;
				const existing = carriers.get(allOf);
				if (existing) existing.push(json);
				else carriers.set(allOf, [json]);
			}
			for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
		}
	}
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			assignProp(defs, seen.defId, seen.def);
		}
	}
	if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
	if (ctx.external) {} else if (Object.keys(defs).length > 0) {
		if (ctx.target === "draft-2020-12") result.$defs = defs;
		else result.definitions = defs;
	}
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
// node_modules/zod/v4/core/json-schema-processors.js
var narrowMin = (agg, key, value) => {
	if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
};
var narrowMax = (agg, key, value) => {
	if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
};
var narrowBoth = (agg, value) => {
	narrowMin(agg, "minimum", value);
	narrowMax(agg, "maximum", value);
};
var addDivisor = (agg, value) => {
	agg.multipleOf ?? (agg.multipleOf = []);
	if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
};
var addPattern = (agg, pattern) => {
	agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
	agg.patterns.add(pattern);
};
var intersectMime = (agg, mime) => {
	agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
var setFormat = (agg, format) => {
	agg.format = format;
	if (format.includes("int")) agg.isInt = true;
};
var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
var formatContributor = (ranges) => (agg, def) => {
	setFormat(agg, def.format);
	const [minimum, maximum] = ranges[def.format];
	narrowMin(agg, "minimum", minimum);
	narrowMax(agg, "maximum", maximum);
};
var contributors = {
	greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
	less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
	multiple_of: (agg, def) => addDivisor(agg, def.value),
	number_format: formatContributor(NUMBER_FORMAT_RANGES),
	bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
	min_length: minContributor,
	max_length: maxContributor,
	length_equals: (agg, def) => narrowBoth(agg, def.length),
	min_size: minContributor,
	max_size: maxContributor,
	size_equals: (agg, def) => narrowBoth(agg, def.size),
	string_format: (agg, def) => {
		setFormat(agg, def.format);
		if (def.pattern) addPattern(agg, def.pattern);
		if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
		if (def.local || def.precision === -1) agg.laxFormat = true;
	},
	mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
	const agg = {};
	const def = schema._zod.def;
	const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
	for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
	const bag = schema._zod.bag;
	if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
	if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
	if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
	if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
	if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
	if (bag.format !== void 0) {
		agg.format ?? (agg.format = bag.format);
		if (bag.format.includes("int")) agg.isInt = true;
	}
	if (bag.mime) intersectMime(agg, bag.mime);
	for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
	return agg;
}
var formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
var exactPatterns = /* @__PURE__ */ new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
var exactPattern = (p) => exactPatterns.get(p) ?? p;
var stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time" || laxFormat) delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const patternList = [...patterns].map(exactPattern);
		if (patternList.length === 1) json.pattern = patternList[0].source;
		else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
var numberProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
	json.type = isInt ? "integer" : "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) {
		if (legacy) {
			json.minimum = exclusiveMinimum;
			json.exclusiveMinimum = true;
		} else json.exclusiveMinimum = exclusiveMinimum;
	} else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) {
		if (legacy) {
			json.maximum = exclusiveMaximum;
			json.exclusiveMaximum = true;
		} else json.exclusiveMaximum = exclusiveMaximum;
	} else if (typeof maximum === "number") json.maximum = maximum;
	if (multipleOf) {
		const divisors = /* @__PURE__ */ new Set();
		for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
		else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
		const [first, ...rest] = divisors;
		if (first !== void 0) json.multipleOf = first;
		if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
	}
};
var booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
var neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
var enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.length === 0) {
		json.not = {};
		return;
	}
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
var customProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
var transformProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
var arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = processSchema(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
function inputOptin(schema) {
	const def = schema._zod.def;
	if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
	if (def.type === "catch") return inputOptin(def.innerType);
	return schema._zod.optin;
}
var objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const shape = def.shape;
	if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
	json.type = "object";
	json.properties = {};
	for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	}));
	const requiredKeys = [];
	for (const key of Object.keys(shape)) {
		const field = def.shape[key];
		if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) requiredKeys.push(key);
	}
	if (requiredKeys.length > 0) json.required = requiredKeys;
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
var unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => processSchema(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
var intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = processSchema(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = processSchema(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
	json.allOf = allOf;
	ctx.intersections.push(allOf);
};
var nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
/** Round-trips a default value through JSON so the emitted schema is guaranteed to be valid JSON.
* A BigInt has no reliable encoding, so it goes through `unrepresentable` like any other
* unrepresentable value. Returns a sentinel when the caller must not write a default of its own. */
var UNREPRESENTABLE_DEFAULT = Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
	let unrepresentable = false;
	const serialized = JSON.stringify(value, (_, val) => {
		if (typeof val !== "bigint") return val;
		unrepresentable = true;
		return null;
	});
	if (!unrepresentable) return JSON.parse(serialized);
	handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
	return UNREPRESENTABLE_DEFAULT;
}
var defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
};
var prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io !== "input") return;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
};
var catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
		return;
	}
	json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	processSchema(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
var optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
// node_modules/zod/v4/classic/errors.js
var _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
	Object.defineProperty(proto, key, {
		configurable: true,
		enumerable: false,
		get() {
			const value = make(this);
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
			return value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
		}
	});
}
var initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	const proto = Object.getPrototypeOf(inst);
	if (_installedErrorProtos.has(proto)) return;
	_installedErrorProtos.add(proto);
	_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
	_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
	_lazyMethod(proto, "addIssue", (self) => (issue) => {
		self.issues.push(issue);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	_lazyMethod(proto, "addIssues", (self) => (issues) => {
		self.issues.push(...issues);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	Object.defineProperty(proto, "isEmpty", {
		configurable: true,
		enumerable: false,
		get() {
			return this.issues.length === 0;
		}
	});
};
var ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, void 0, { Parent: Error });
// node_modules/zod/v4/classic/parse.js
var parse$2 = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
// node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
	if (!globalConfig.localeError) config(en_default());
}
function _ensureDefaultMemoizer() {
	if (!globalConfig.memoizer) config({ memoizer: memoizer() });
}
var ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
	_ensureDefaultLocale();
	$ZodType.init(inst, def);
	inst.def = def;
	inst.type = def.type;
	return inst;
}, {
	check(...chks) {
		const def = this.def;
		return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
			check: ch,
			def: { check: "custom" },
			onattach: []
		} } : ch)] }), { parent: true });
	},
	with(...chks) {
		return this.check(...chks);
	},
	clone(def, params) {
		return clone(this, def, params);
	},
	brand() {
		return this;
	},
	register(reg, meta) {
		reg.add(this, meta);
		return this;
	},
	refine(check, params) {
		return this.check(refine(check, params));
	},
	superRefine(refinement, params) {
		return this.check(superRefine(refinement, params));
	},
	overwrite(fn) {
		return this.check(/* @__PURE__ */ _overwrite(fn));
	},
	optional() {
		return optional(this);
	},
	exactOptional() {
		return exactOptional(this);
	},
	nullable() {
		return nullable(this);
	},
	nullish() {
		return optional(nullable(this));
	},
	nonoptional(params) {
		return nonoptional(this, params);
	},
	array() {
		return array(this);
	},
	or(arg) {
		return union$1([this, arg]);
	},
	and(arg) {
		return intersection(this, arg);
	},
	transform(tx) {
		return pipe(this, transform(tx));
	},
	default(d) {
		return _default(this, d);
	},
	prefault(d) {
		return prefault(this, d);
	},
	catch(params) {
		return _catch(this, params);
	},
	pipe(target) {
		return pipe(this, target);
	},
	readonly() {
		return readonly(this);
	},
	describe(description) {
		const cl = this.clone();
		globalRegistry.add(cl, { description });
		return cl;
	},
	meta(...args) {
		if (args.length === 0) return globalRegistry.get(this);
		const cl = this.clone();
		globalRegistry.add(cl, args[0]);
		return cl;
	},
	isOptional() {
		return this.safeParse(void 0).success;
	},
	isNullable() {
		return this.safeParse(null).success;
	},
	apply(fn, ...args) {
		return args.length === 0 ? fn(this) : fn(this, ...args);
	},
	get "~standard"() {
		return hide(this, "~standard", {
			...standardProps(this),
			jsonSchema: {
				input: createStandardJSONSchemaMethod(this, "input"),
				output: createStandardJSONSchemaMethod(this, "output")
			}
		});
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	},
	parse: function _parse(data, params) {
		return parse$2(this, data, params, { callee: _parse });
	},
	parseAsync: async function _parseAsync(data, params) {
		return await parseAsync(this, data, params, { callee: _parseAsync });
	},
	safeParse(data, params) {
		return safeParse(this, data, params);
	},
	async safeParseAsync(data, params) {
		return safeParseAsync(this, data, params);
	},
	get spa() {
		return this?.safeParseAsync;
	},
	set spa(value) {
		own(this, "spa", value);
	},
	validate(data, params) {
		return validate$1(this, data, params);
	},
	validateAsync(data, params) {
		return validateAsync$1(this, data, params);
	},
	encode: function _encode(data, params) {
		return encode(this, data, params, { callee: _encode });
	},
	decode: function _decode(data, params) {
		return decode(this, data, params, { callee: _decode });
	},
	encodeAsync: async function _encodeAsync(data, params) {
		return await encodeAsync(this, data, params, { callee: _encodeAsync });
	},
	decodeAsync: async function _decodeAsync(data, params) {
		return await decodeAsync(this, data, params, { callee: _decodeAsync });
	},
	safeEncode(data, params) {
		return safeEncode(this, data, params);
	},
	safeDecode(data, params) {
		return safeDecode(this, data, params);
	},
	async safeEncodeAsync(data, params) {
		return safeEncodeAsync(this, data, params);
	},
	async safeDecodeAsync(data, params) {
		return safeDecodeAsync(this, data, params);
	},
	toJSONSchema(params) {
		return createToJSONSchemaMethod(this, {})(params);
	},
	get description() {
		return globalRegistry.get(this)?.description;
	},
	get _def() {
		return this._zod.def;
	}
});
/** @internal */
var _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
}, /*@__PURE__*/ derived({
	format: (inst) => aggregateChecks(inst).format ?? null,
	minLength: (inst) => aggregateChecks(inst).minimum ?? null,
	maxLength: (inst) => aggregateChecks(inst).maximum ?? null
}, {
	regex(...args) {
		return this.check(/* @__PURE__ */ _regex(...args));
	},
	includes(...args) {
		return this.check(/* @__PURE__ */ _includes(...args));
	},
	startsWith(...args) {
		return this.check(/* @__PURE__ */ _startsWith(...args));
	},
	endsWith(...args) {
		return this.check(/* @__PURE__ */ _endsWith(...args));
	},
	min(...args) {
		return this.check(/* @__PURE__ */ _minLength(...args));
	},
	max(...args) {
		return this.check(/* @__PURE__ */ _maxLength(...args));
	},
	length(...args) {
		return this.check(/* @__PURE__ */ _length(...args));
	},
	nonempty(...args) {
		return this.check(/* @__PURE__ */ _minLength(1, ...args));
	},
	lowercase(params) {
		return this.check(/* @__PURE__ */ _lowercase(params));
	},
	uppercase(params) {
		return this.check(/* @__PURE__ */ _uppercase(params));
	},
	trim() {
		return this.check(/* @__PURE__ */ _trim());
	},
	normalize(...args) {
		return this.check(/* @__PURE__ */ _normalize(...args));
	},
	toLowerCase() {
		return this.check(/* @__PURE__ */ _toLowerCase());
	},
	toUpperCase() {
		return this.check(/* @__PURE__ */ _toUpperCase());
	},
	slugify() {
		return this.check(/* @__PURE__ */ _slugify());
	}
}));
var ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
}, {
	email(params) {
		return this.check(/* @__PURE__ */ _email(ZodEmail, params));
	},
	url(params) {
		return this.check(/* @__PURE__ */ _url(ZodURL, params));
	},
	jwt(params) {
		return this.check(/* @__PURE__ */ _jwt(ZodJWT, params));
	},
	emoji(params) {
		return this.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
	},
	guid(params) {
		return this.check(/* @__PURE__ */ _guid(ZodGUID, params));
	},
	uuid(params) {
		return this.check(/* @__PURE__ */ _uuid(ZodUUID, params));
	},
	uuidv4(params) {
		return this.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
	},
	uuidv6(params) {
		return this.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
	},
	uuidv7(params) {
		return this.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
	},
	nanoid(params) {
		return this.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
	},
	cuid(params) {
		return this.check(/* @__PURE__ */ _cuid(ZodCUID, params));
	},
	cuid2(params) {
		return this.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
	},
	ulid(params) {
		return this.check(/* @__PURE__ */ _ulid(ZodULID, params));
	},
	base64(params) {
		return this.check(/* @__PURE__ */ _base64(ZodBase64, params));
	},
	base64url(params) {
		return this.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
	},
	xid(params) {
		return this.check(/* @__PURE__ */ _xid(ZodXID, params));
	},
	ksuid(params) {
		return this.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
	},
	ipv4(params) {
		return this.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
	},
	ipv6(params) {
		return this.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
	},
	cidrv4(params) {
		return this.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
	},
	cidrv6(params) {
		return this.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
	},
	e164(params) {
		return this.check(/* @__PURE__ */ _e164(ZodE164, params));
	},
	datetime(params) {
		return this.check(/* @__PURE__ */ _isoDateTime(ZodISODateTime, params));
	},
	date(params) {
		return this.check(/* @__PURE__ */ _isoDate(ZodISODate, params));
	},
	time(params) {
		return this.check(/* @__PURE__ */ _isoTime(ZodISOTime, params));
	},
	duration(params) {
		return this.check(/* @__PURE__ */ _isoDuration(ZodISODuration, params));
	}
});
function string(params) {
	return /* @__PURE__ */ _string(ZodString, params);
}
var ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
var ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	inst.isFinite = true;
}, /*@__PURE__*/ derived({
	minValue: (inst) => {
		const { minimum, exclusiveMinimum } = aggregateChecks(inst);
		return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
	},
	maxValue: (inst) => {
		const { maximum, exclusiveMaximum } = aggregateChecks(inst);
		return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
	},
	isInt: (inst) => {
		const { isInt, multipleOf } = aggregateChecks(inst);
		return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
	},
	format: (inst) => aggregateChecks(inst).format ?? null
}, {
	gt(value, params) {
		return this.check(/* @__PURE__ */ _gt(value, params));
	},
	gte(value, params) {
		return this.check(/* @__PURE__ */ _gte(value, params));
	},
	min(value, params) {
		return this.check(/* @__PURE__ */ _gte(value, params));
	},
	lt(value, params) {
		return this.check(/* @__PURE__ */ _lt(value, params));
	},
	lte(value, params) {
		return this.check(/* @__PURE__ */ _lte(value, params));
	},
	max(value, params) {
		return this.check(/* @__PURE__ */ _lte(value, params));
	},
	int(params) {
		return this.check(int(params));
	},
	safe(params) {
		return this.check(int(params));
	},
	positive(params) {
		return this.check(/* @__PURE__ */ _gt(0, params));
	},
	nonnegative(params) {
		return this.check(/* @__PURE__ */ _gte(0, params));
	},
	negative(params) {
		return this.check(/* @__PURE__ */ _lt(0, params));
	},
	nonpositive(params) {
		return this.check(/* @__PURE__ */ _lte(0, params));
	},
	multipleOf(value, params) {
		return this.check(/* @__PURE__ */ _multipleOf(value, params));
	},
	step(value, params) {
		return this.check(/* @__PURE__ */ _multipleOf(value, params));
	},
	finite() {
		return this;
	}
}));
var ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int(params) {
	return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
var ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
var ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => void 0;
});
function unknown() {
	return /* @__PURE__ */ _unknown(ZodUnknown);
}
var ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return /* @__PURE__ */ _never(ZodNever, params);
}
var ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
}, {
	min(n, params) {
		return this.check(/* @__PURE__ */ _minLength(n, params));
	},
	nonempty(params) {
		return this.check(/* @__PURE__ */ _minLength(1, params));
	},
	max(n, params) {
		return this.check(/* @__PURE__ */ _maxLength(n, params));
	},
	length(n, params) {
		return this.check(/* @__PURE__ */ _length(n, params));
	},
	unwrap() {
		return this.element;
	}
});
function array(element, params) {
	return /* @__PURE__ */ _array(ZodArray, element, params);
}
var ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
	keyof() {
		return _enum(Object.keys(this._zod.def.shape));
	},
	catchall(catchall) {
		return this.clone(mergeDefs(this._zod.def, { catchall }));
	},
	passthrough() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	loose() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	strict() {
		return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
	},
	strip() {
		return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
	},
	extend(incoming) {
		return extend(this, incoming);
	},
	safeExtend(incoming) {
		return safeExtend(this, incoming);
	},
	merge(other) {
		return merge(this, other);
	},
	pick(mask) {
		return pick(this, mask);
	},
	omit(mask) {
		return omit(this, mask);
	},
	partial(...args) {
		return partial(ZodOptional, this, args[0]);
	},
	exactPartial(...args) {
		return partial(ZodExactOptional, this, args[0], "exactPartial");
	},
	required(...args) {
		return required(ZodNonOptional, this, args[0]);
	}
});
function object(shape, params) {
	return new ZodObject({
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	});
}
var ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union$1(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
var ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
var ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = [...inst._zod.values];
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	return new ZodEnum({
		type: "enum",
		entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
		...normalizeParams(params)
	});
}
var ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			return payload;
		});
		payload.value = output;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
var ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
var ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
var ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
var ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
var ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
	});
}
var ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
var ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
var ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
	return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return /* @__PURE__ */ _superRefine(fn, params);
}
// node_modules/zod/v4/classic/coerce.js
function number(params) {
	return /* @__PURE__ */ _coercedNumber(ZodNumber, params);
}
// shared/api.ts
/**
* API conventions shared by the worker and the web app (PRD §6).
* - Base path /api/v1.
* - Lists: ?page&pageSize(default 25, max 100)&sort&q&filters -> { data, page, pageSize, total }.
* - Errors: { error: { code, message, fields? } }.
* - Money: strings with 2 decimals. Dates: ISO 8601.
*/
var API_BASE = "/api/v1";
var listQuerySchema = object({
	page: number().int().min(1).default(1),
	pageSize: number().int().min(1).max(100).default(25),
	sort: string().regex(/^-?[a-zA-Z_]+$/).optional(),
	q: string().trim().max(100).optional()
});
// node_modules/drizzle-orm/entity.js
var entityKind = Symbol.for("drizzle:entityKind");
function is(value, type) {
	if (!value || typeof value !== "object") return false;
	if (value instanceof type) return true;
	if (!Object.prototype.hasOwnProperty.call(type, entityKind)) throw new Error(`Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`);
	let cls = Object.getPrototypeOf(value).constructor;
	if (cls) while (cls) {
		if (entityKind in cls && cls[entityKind] === type[entityKind]) return true;
		cls = Object.getPrototypeOf(cls);
	}
	return false;
}
// node_modules/drizzle-orm/column.js
var Column = class {
	constructor(table, config) {
		this.table = table;
		this.config = config;
		this.name = config.name;
		this.keyAsName = config.keyAsName;
		this.notNull = config.notNull;
		this.default = config.default;
		this.defaultFn = config.defaultFn;
		this.onUpdateFn = config.onUpdateFn;
		this.hasDefault = config.hasDefault;
		this.primary = config.primaryKey;
		this.isUnique = config.isUnique;
		this.uniqueName = config.uniqueName;
		this.uniqueType = config.uniqueType;
		this.dataType = config.dataType;
		this.columnType = config.columnType;
		this.generated = config.generated;
		this.generatedIdentity = config.generatedIdentity;
	}
	static [entityKind] = "Column";
	name;
	keyAsName;
	primary;
	notNull;
	default;
	defaultFn;
	onUpdateFn;
	hasDefault;
	isUnique;
	uniqueName;
	uniqueType;
	dataType;
	columnType;
	enumValues = void 0;
	generated = void 0;
	generatedIdentity = void 0;
	config;
	mapFromDriverValue(value) {
		return value;
	}
	mapToDriverValue(value) {
		return value;
	}
	shouldDisableInsert() {
		return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
	}
};
// node_modules/drizzle-orm/column-builder.js
var ColumnBuilder = class {
	static [entityKind] = "ColumnBuilder";
	config;
	constructor(name, dataType, columnType) {
		this.config = {
			name,
			keyAsName: name === "",
			notNull: false,
			default: void 0,
			hasDefault: false,
			primaryKey: false,
			isUnique: false,
			uniqueName: void 0,
			uniqueType: void 0,
			dataType,
			columnType,
			generated: void 0
		};
	}
	/**
	* Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
	*
	* @example
	* ```ts
	* const users = pgTable('users', {
	* 	id: integer('id').$type<UserId>().primaryKey(),
	* 	details: json('details').$type<UserDetails>().notNull(),
	* });
	* ```
	*/
	$type() {
		return this;
	}
	/**
	* Adds a `not null` clause to the column definition.
	*
	* Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
	*/
	notNull() {
		this.config.notNull = true;
		return this;
	}
	/**
	* Adds a `default <value>` clause to the column definition.
	*
	* Affects the `insert` model of the table - columns *with* `default` are optional on insert.
	*
	* If you need to set a dynamic default value, use {@link $defaultFn} instead.
	*/
	default(value) {
		this.config.default = value;
		this.config.hasDefault = true;
		return this;
	}
	/**
	* Adds a dynamic default value to the column.
	* The function will be called when the row is inserted, and the returned value will be used as the column value.
	*
	* **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
	*/
	$defaultFn(fn) {
		this.config.defaultFn = fn;
		this.config.hasDefault = true;
		return this;
	}
	/**
	* Alias for {@link $defaultFn}.
	*/
	$default = this.$defaultFn;
	/**
	* Adds a dynamic update value to the column.
	* The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
	* If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
	*
	* **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
	*/
	$onUpdateFn(fn) {
		this.config.onUpdateFn = fn;
		this.config.hasDefault = true;
		return this;
	}
	/**
	* Alias for {@link $onUpdateFn}.
	*/
	$onUpdate = this.$onUpdateFn;
	/**
	* Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
	*
	* In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
	*/
	primaryKey() {
		this.config.primaryKey = true;
		this.config.notNull = true;
		return this;
	}
	/** @internal Sets the name of the column to the key within the table definition if a name was not given. */
	setName(name) {
		if (this.config.name !== "") return;
		this.config.name = name;
	}
};
// node_modules/drizzle-orm/table.utils.js
var TableName = Symbol.for("drizzle:Name");
// node_modules/drizzle-orm/pg-core/columns/enum.js
var isPgEnumSym = Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
	return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
// node_modules/drizzle-orm/subquery.js
var Subquery = class {
	static [entityKind] = "Subquery";
	constructor(sql, fields, alias, isWith = false, usedTables = []) {
		this._ = {
			brand: "Subquery",
			sql,
			selectedFields: fields,
			alias,
			isWith,
			usedTables
		};
	}
};
var WithSubquery = class extends Subquery {
	static [entityKind] = "WithSubquery";
};
// node_modules/drizzle-orm/tracing.js
var tracer = { startActiveSpan(name, fn) {
	return fn();
} };
// node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");
// node_modules/drizzle-orm/table.js
var Schema = Symbol.for("drizzle:Schema");
var Columns = Symbol.for("drizzle:Columns");
var ExtraConfigColumns = Symbol.for("drizzle:ExtraConfigColumns");
var OriginalName = Symbol.for("drizzle:OriginalName");
var BaseName = Symbol.for("drizzle:BaseName");
var IsAlias = Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
var Table = class {
	static [entityKind] = "Table";
	/** @internal */
	static Symbol = {
		Name: TableName,
		Schema,
		OriginalName,
		Columns,
		ExtraConfigColumns,
		BaseName,
		IsAlias,
		ExtraConfigBuilder
	};
	/**
	* @internal
	* Can be changed if the table is aliased.
	*/
	[TableName];
	/**
	* @internal
	* Used to store the original name of the table, before any aliasing.
	*/
	[OriginalName];
	/** @internal */
	[Schema];
	/** @internal */
	[Columns];
	/** @internal */
	[ExtraConfigColumns];
	/**
	*  @internal
	* Used to store the table name before the transformation via the `tableCreator` functions.
	*/
	[BaseName];
	/** @internal */
	[IsAlias] = false;
	/** @internal */
	[IsDrizzleTable] = true;
	/** @internal */
	[ExtraConfigBuilder] = void 0;
	constructor(name, schema, baseName) {
		this[TableName] = this[OriginalName] = name;
		this[Schema] = schema;
		this[BaseName] = baseName;
	}
};
function getTableName(table) {
	return table[TableName];
}
function getTableUniqueName(table) {
	return `${table[Schema] ?? "public"}.${table[TableName]}`;
}
// node_modules/drizzle-orm/sql/sql.js
function isSQLWrapper(value) {
	return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
	const result = {
		sql: "",
		params: []
	};
	for (const query of queries) {
		result.sql += query.sql;
		result.params.push(...query.params);
		if (query.typings?.length) {
			if (!result.typings) result.typings = [];
			result.typings.push(...query.typings);
		}
	}
	return result;
}
var StringChunk = class {
	static [entityKind] = "StringChunk";
	value;
	constructor(value) {
		this.value = Array.isArray(value) ? value : [value];
	}
	getSQL() {
		return new SQL([this]);
	}
};
var SQL = class SQL {
	constructor(queryChunks) {
		this.queryChunks = queryChunks;
		for (const chunk of queryChunks) if (is(chunk, Table)) {
			const schemaName = chunk[Table.Symbol.Schema];
			this.usedTables.push(schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]);
		}
	}
	static [entityKind] = "SQL";
	/** @internal */
	decoder = noopDecoder;
	shouldInlineParams = false;
	/** @internal */
	usedTables = [];
	append(query) {
		this.queryChunks.push(...query.queryChunks);
		return this;
	}
	toQuery(config) {
		return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
			const query = this.buildQueryFromSourceParams(this.queryChunks, config);
			span?.setAttributes({
				"drizzle.query.text": query.sql,
				"drizzle.query.params": JSON.stringify(query.params)
			});
			return query;
		});
	}
	buildQueryFromSourceParams(chunks, _config) {
		const config = Object.assign({}, _config, {
			inlineParams: _config.inlineParams || this.shouldInlineParams,
			paramStartIndex: _config.paramStartIndex || { value: 0 }
		});
		const { casing, escapeName, escapeParam, prepareTyping, inlineParams, paramStartIndex } = config;
		return mergeQueries(chunks.map((chunk) => {
			if (is(chunk, StringChunk)) return {
				sql: chunk.value.join(""),
				params: []
			};
			if (is(chunk, Name)) return {
				sql: escapeName(chunk.value),
				params: []
			};
			if (chunk === void 0) return {
				sql: "",
				params: []
			};
			if (Array.isArray(chunk)) {
				const result = [new StringChunk("(")];
				for (const [i, p] of chunk.entries()) {
					result.push(p);
					if (i < chunk.length - 1) result.push(new StringChunk(", "));
				}
				result.push(new StringChunk(")"));
				return this.buildQueryFromSourceParams(result, config);
			}
			if (is(chunk, SQL)) return this.buildQueryFromSourceParams(chunk.queryChunks, {
				...config,
				inlineParams: inlineParams || chunk.shouldInlineParams
			});
			if (is(chunk, Table)) {
				const schemaName = chunk[Table.Symbol.Schema];
				const tableName = chunk[Table.Symbol.Name];
				return {
					sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
					params: []
				};
			}
			if (is(chunk, Column)) {
				const columnName = casing.getColumnCasing(chunk);
				if (_config.invokeSource === "indexes") return {
					sql: escapeName(columnName),
					params: []
				};
				const schemaName = chunk.table[Table.Symbol.Schema];
				return {
					sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
					params: []
				};
			}
			if (is(chunk, View)) {
				const schemaName = chunk[ViewBaseConfig].schema;
				const viewName = chunk[ViewBaseConfig].name;
				return {
					sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
					params: []
				};
			}
			if (is(chunk, Param)) {
				if (is(chunk.value, Placeholder)) return {
					sql: escapeParam(paramStartIndex.value++, chunk),
					params: [chunk],
					typings: ["none"]
				};
				const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
				if (is(mappedValue, SQL)) return this.buildQueryFromSourceParams([mappedValue], config);
				if (inlineParams) return {
					sql: this.mapInlineParam(mappedValue, config),
					params: []
				};
				let typings = ["none"];
				if (prepareTyping) typings = [prepareTyping(chunk.encoder)];
				return {
					sql: escapeParam(paramStartIndex.value++, mappedValue),
					params: [mappedValue],
					typings
				};
			}
			if (is(chunk, Placeholder)) return {
				sql: escapeParam(paramStartIndex.value++, chunk),
				params: [chunk],
				typings: ["none"]
			};
			if (is(chunk, SQL.Aliased) && chunk.fieldAlias !== void 0) return {
				sql: escapeName(chunk.fieldAlias),
				params: []
			};
			if (is(chunk, Subquery)) {
				if (chunk._.isWith) return {
					sql: escapeName(chunk._.alias),
					params: []
				};
				return this.buildQueryFromSourceParams([
					new StringChunk("("),
					chunk._.sql,
					new StringChunk(") "),
					new Name(chunk._.alias)
				], config);
			}
			if (isPgEnum(chunk)) {
				if (chunk.schema) return {
					sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName),
					params: []
				};
				return {
					sql: escapeName(chunk.enumName),
					params: []
				};
			}
			if (isSQLWrapper(chunk)) {
				if (chunk.shouldOmitSQLParens?.()) return this.buildQueryFromSourceParams([chunk.getSQL()], config);
				return this.buildQueryFromSourceParams([
					new StringChunk("("),
					chunk.getSQL(),
					new StringChunk(")")
				], config);
			}
			if (inlineParams) return {
				sql: this.mapInlineParam(chunk, config),
				params: []
			};
			return {
				sql: escapeParam(paramStartIndex.value++, chunk),
				params: [chunk],
				typings: ["none"]
			};
		}));
	}
	mapInlineParam(chunk, { escapeString }) {
		if (chunk === null) return "null";
		if (typeof chunk === "number" || typeof chunk === "boolean") return chunk.toString();
		if (typeof chunk === "string") return escapeString(chunk);
		if (typeof chunk === "object") {
			const mappedValueAsString = chunk.toString();
			if (mappedValueAsString === "[object Object]") return escapeString(JSON.stringify(chunk));
			return escapeString(mappedValueAsString);
		}
		throw new Error("Unexpected param value: " + chunk);
	}
	getSQL() {
		return this;
	}
	as(alias) {
		if (alias === void 0) return this;
		return new SQL.Aliased(this, alias);
	}
	mapWith(decoder) {
		this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
		return this;
	}
	inlineParams() {
		this.shouldInlineParams = true;
		return this;
	}
	/**
	* This method is used to conditionally include a part of the query.
	*
	* @param condition - Condition to check
	* @returns itself if the condition is `true`, otherwise `undefined`
	*/
	if(condition) {
		return condition ? this : void 0;
	}
};
var Name = class {
	constructor(value) {
		this.value = value;
	}
	static [entityKind] = "Name";
	brand;
	getSQL() {
		return new SQL([this]);
	}
};
function isDriverValueEncoder(value) {
	return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
var noopDecoder = { mapFromDriverValue: (value) => value };
var noopEncoder = { mapToDriverValue: (value) => value };
({
	...noopDecoder,
	...noopEncoder
});
var Param = class {
	/**
	* @param value - Parameter value
	* @param encoder - Encoder to convert the value to a driver parameter
	*/
	constructor(value, encoder = noopEncoder) {
		this.value = value;
		this.encoder = encoder;
	}
	static [entityKind] = "Param";
	brand;
	getSQL() {
		return new SQL([this]);
	}
};
function sql(strings, ...params) {
	const queryChunks = [];
	if (params.length > 0 || strings.length > 0 && strings[0] !== "") queryChunks.push(new StringChunk(strings[0]));
	for (const [paramIndex, param2] of params.entries()) queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
	return new SQL(queryChunks);
}
((sql2) => {
	function empty() {
		return new SQL([]);
	}
	sql2.empty = empty;
	function fromList(list) {
		return new SQL(list);
	}
	sql2.fromList = fromList;
	function raw(str) {
		return new SQL([new StringChunk(str)]);
	}
	sql2.raw = raw;
	function join(chunks, separator) {
		const result = [];
		for (const [i, chunk] of chunks.entries()) {
			if (i > 0 && separator !== void 0) result.push(separator);
			result.push(chunk);
		}
		return new SQL(result);
	}
	sql2.join = join;
	function identifier(value) {
		return new Name(value);
	}
	sql2.identifier = identifier;
	function placeholder2(name2) {
		return new Placeholder(name2);
	}
	sql2.placeholder = placeholder2;
	function param2(value, encoder) {
		return new Param(value, encoder);
	}
	sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
	class Aliased {
		constructor(sql2, fieldAlias) {
			this.sql = sql2;
			this.fieldAlias = fieldAlias;
		}
		static [entityKind] = "SQL.Aliased";
		/** @internal */
		isSelectionField = false;
		getSQL() {
			return this.sql;
		}
		/** @internal */
		clone() {
			return new Aliased(this.sql, this.fieldAlias);
		}
	}
	SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var Placeholder = class {
	constructor(name2) {
		this.name = name2;
	}
	static [entityKind] = "Placeholder";
	getSQL() {
		return new SQL([this]);
	}
};
function fillPlaceholders(params, values) {
	return params.map((p) => {
		if (is(p, Placeholder)) {
			if (!(p.name in values)) throw new Error(`No value for placeholder "${p.name}" was provided`);
			return values[p.name];
		}
		if (is(p, Param) && is(p.value, Placeholder)) {
			if (!(p.value.name in values)) throw new Error(`No value for placeholder "${p.value.name}" was provided`);
			return p.encoder.mapToDriverValue(values[p.value.name]);
		}
		return p;
	});
}
var IsDrizzleView = Symbol.for("drizzle:IsDrizzleView");
var View = class {
	static [entityKind] = "View";
	/** @internal */
	[ViewBaseConfig];
	/** @internal */
	[IsDrizzleView] = true;
	constructor({ name: name2, schema, selectedFields, query }) {
		this[ViewBaseConfig] = {
			name: name2,
			originalName: name2,
			schema,
			selectedFields,
			query,
			isExisting: !query,
			isAlias: false
		};
	}
	getSQL() {
		return new SQL([this]);
	}
};
Column.prototype.getSQL = function() {
	return new SQL([this]);
};
Table.prototype.getSQL = function() {
	return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
	return new SQL([this]);
};
// node_modules/drizzle-orm/alias.js
var ColumnAliasProxyHandler = class {
	constructor(table) {
		this.table = table;
	}
	static [entityKind] = "ColumnAliasProxyHandler";
	get(columnObj, prop) {
		if (prop === "table") return this.table;
		return columnObj[prop];
	}
};
var TableAliasProxyHandler = class {
	constructor(alias, replaceOriginalName) {
		this.alias = alias;
		this.replaceOriginalName = replaceOriginalName;
	}
	static [entityKind] = "TableAliasProxyHandler";
	get(target, prop) {
		if (prop === Table.Symbol.IsAlias) return true;
		if (prop === Table.Symbol.Name) return this.alias;
		if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) return this.alias;
		if (prop === ViewBaseConfig) return {
			...target[ViewBaseConfig],
			name: this.alias,
			isAlias: true
		};
		if (prop === Table.Symbol.Columns) {
			const columns = target[Table.Symbol.Columns];
			if (!columns) return columns;
			const proxiedColumns = {};
			Object.keys(columns).map((key) => {
				proxiedColumns[key] = new Proxy(columns[key], new ColumnAliasProxyHandler(new Proxy(target, this)));
			});
			return proxiedColumns;
		}
		const value = target[prop];
		if (is(value, Column)) return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
		return value;
	}
};
function aliasedTable(table, tableAlias) {
	return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
	return new Proxy(column, new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false))));
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
	return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
function mapColumnsInSQLToAlias(query, alias) {
	return sql.join(query.queryChunks.map((c) => {
		if (is(c, Column)) return aliasedTableColumn(c, alias);
		if (is(c, SQL)) return mapColumnsInSQLToAlias(c, alias);
		if (is(c, SQL.Aliased)) return mapColumnsInAliasedSQLToAlias(c, alias);
		return c;
	}));
}
// node_modules/drizzle-orm/errors.js
var DrizzleError = class extends Error {
	static [entityKind] = "DrizzleError";
	constructor({ message, cause }) {
		super(message);
		this.name = "DrizzleError";
		this.cause = cause;
	}
};
var DrizzleQueryError = class DrizzleQueryError extends Error {
	constructor(query, params, cause) {
		super(`Failed query: ${query}
params: ${params}`);
		this.query = query;
		this.params = params;
		this.cause = cause;
		Error.captureStackTrace(this, DrizzleQueryError);
		if (cause) this.cause = cause;
	}
};
var TransactionRollbackError = class extends DrizzleError {
	static [entityKind] = "TransactionRollbackError";
	constructor() {
		super({ message: "Rollback" });
	}
};
// node_modules/drizzle-orm/logger.js
var ConsoleLogWriter = class {
	static [entityKind] = "ConsoleLogWriter";
	write(message) {
		console.log(message);
	}
};
var DefaultLogger = class {
	static [entityKind] = "DefaultLogger";
	writer;
	constructor(config) {
		this.writer = config?.writer ?? new ConsoleLogWriter();
	}
	logQuery(query, params) {
		const stringifiedParams = params.map((p) => {
			try {
				return JSON.stringify(p);
			} catch {
				return String(p);
			}
		});
		const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
		this.writer.write(`Query: ${query}${paramsStr}`);
	}
};
var NoopLogger = class {
	static [entityKind] = "NoopLogger";
	logQuery() {}
};
// node_modules/drizzle-orm/query-promise.js
var QueryPromise = class {
	static [entityKind] = "QueryPromise";
	[Symbol.toStringTag] = "QueryPromise";
	catch(onRejected) {
		return this.then(void 0, onRejected);
	}
	finally(onFinally) {
		return this.then((value) => {
			onFinally?.();
			return value;
		}, (reason) => {
			onFinally?.();
			throw reason;
		});
	}
	then(onFulfilled, onRejected) {
		return this.execute().then(onFulfilled, onRejected);
	}
};
// node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
	const nullifyMap = {};
	const result = columns.reduce((result2, { path, field }, columnIndex) => {
		let decoder;
		if (is(field, Column)) decoder = field;
		else if (is(field, SQL)) decoder = field.decoder;
		else if (is(field, Subquery)) decoder = field._.sql.decoder;
		else decoder = field.sql.decoder;
		let node = result2;
		for (const [pathChunkIndex, pathChunk] of path.entries()) if (pathChunkIndex < path.length - 1) {
			if (!(pathChunk in node)) node[pathChunk] = {};
			node = node[pathChunk];
		} else {
			const rawValue = row[columnIndex];
			const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
			if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
				const objectName = path[0];
				if (!(objectName in nullifyMap)) nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
				else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) nullifyMap[objectName] = false;
			}
		}
		return result2;
	}, {});
	if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
		for (const [objectName, tableName] of Object.entries(nullifyMap)) if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) result[objectName] = null;
	}
	return result;
}
function orderSelectedFields(fields, pathPrefix) {
	return Object.entries(fields).reduce((result, [name, field]) => {
		if (typeof name !== "string") return result;
		const newPath = pathPrefix ? [...pathPrefix, name] : [name];
		if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) result.push({
			path: newPath,
			field
		});
		else if (is(field, Table)) result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
		else result.push(...orderSelectedFields(field, newPath));
		return result;
	}, []);
}
function haveSameKeys(left, right) {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const [index, key] of leftKeys.entries()) if (key !== rightKeys[index]) return false;
	return true;
}
function mapUpdateSet(table, values) {
	const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
		if (is(value, SQL) || is(value, Column)) return [key, value];
		else return [key, new Param(value, table[Table.Symbol.Columns][key])];
	});
	if (entries.length === 0) throw new Error("No values to set");
	return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
	for (const extendedClass of extendedClasses) for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
		if (name === "constructor") continue;
		Object.defineProperty(baseClass.prototype, name, Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null));
	}
}
function getTableColumns(table) {
	return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
	return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
	return {
		name: typeof a === "string" && a.length > 0 ? a : "",
		config: typeof a === "object" ? a : b
	};
}
var textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();
// node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys$1 = Symbol.for("drizzle:PgInlineForeignKeys");
var EnableRLS = Symbol.for("drizzle:EnableRLS");
var PgTable = class extends Table {
	static [entityKind] = "PgTable";
	/** @internal */
	static Symbol = Object.assign({}, Table.Symbol, {
		InlineForeignKeys: InlineForeignKeys$1,
		EnableRLS
	});
	/**@internal */
	[InlineForeignKeys$1] = [];
	/** @internal */
	[EnableRLS] = false;
	/** @internal */
	[Table.Symbol.ExtraConfigBuilder] = void 0;
	/** @internal */
	[Table.Symbol.ExtraConfigColumns] = {};
};
// node_modules/drizzle-orm/pg-core/primary-keys.js
var PrimaryKeyBuilder$1 = class {
	static [entityKind] = "PgPrimaryKeyBuilder";
	/** @internal */
	columns;
	/** @internal */
	name;
	constructor(columns, name) {
		this.columns = columns;
		this.name = name;
	}
	/** @internal */
	build(table) {
		return new PrimaryKey$1(table, this.columns, this.name);
	}
};
var PrimaryKey$1 = class {
	constructor(table, columns, name) {
		this.table = table;
		this.columns = columns;
		this.name = name;
	}
	static [entityKind] = "PgPrimaryKey";
	columns;
	name;
	getName() {
		return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
	}
};
// node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
	if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) return new Param(value, column);
	return value;
}
var eq = (left, right) => {
	return sql`${left} = ${bindIfParam(right, left)}`;
};
var ne = (left, right) => {
	return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
	const conditions = unfilteredConditions.filter((c) => c !== void 0);
	if (conditions.length === 0) return;
	if (conditions.length === 1) return new SQL(conditions);
	return new SQL([
		new StringChunk("("),
		sql.join(conditions, new StringChunk(" and ")),
		new StringChunk(")")
	]);
}
function or(...unfilteredConditions) {
	const conditions = unfilteredConditions.filter((c) => c !== void 0);
	if (conditions.length === 0) return;
	if (conditions.length === 1) return new SQL(conditions);
	return new SQL([
		new StringChunk("("),
		sql.join(conditions, new StringChunk(" or ")),
		new StringChunk(")")
	]);
}
function not(condition) {
	return sql`not ${condition}`;
}
var gt = (left, right) => {
	return sql`${left} > ${bindIfParam(right, left)}`;
};
var gte = (left, right) => {
	return sql`${left} >= ${bindIfParam(right, left)}`;
};
var lt = (left, right) => {
	return sql`${left} < ${bindIfParam(right, left)}`;
};
var lte = (left, right) => {
	return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column, values) {
	if (Array.isArray(values)) {
		if (values.length === 0) return sql`false`;
		return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
	}
	return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
	if (Array.isArray(values)) {
		if (values.length === 0) return sql`true`;
		return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
	}
	return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
	return sql`${value} is null`;
}
function isNotNull(value) {
	return sql`${value} is not null`;
}
function exists(subquery) {
	return sql`exists ${subquery}`;
}
function notExists(subquery) {
	return sql`not exists ${subquery}`;
}
function between(column, min, max) {
	return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(max, column)}`;
}
function notBetween(column, min, max) {
	return sql`${column} not between ${bindIfParam(min, column)} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
	return sql`${column} like ${value}`;
}
function notLike(column, value) {
	return sql`${column} not like ${value}`;
}
function ilike(column, value) {
	return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
	return sql`${column} not ilike ${value}`;
}
// node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
	return sql`${column} asc`;
}
function desc(column) {
	return sql`${column} desc`;
}
// node_modules/drizzle-orm/relations.js
var Relation = class {
	constructor(sourceTable, referencedTable, relationName) {
		this.sourceTable = sourceTable;
		this.referencedTable = referencedTable;
		this.relationName = relationName;
		this.referencedTableName = referencedTable[Table.Symbol.Name];
	}
	static [entityKind] = "Relation";
	referencedTableName;
	fieldName;
};
var Relations = class {
	constructor(table, config) {
		this.table = table;
		this.config = config;
	}
	static [entityKind] = "Relations";
};
var One = class One extends Relation {
	constructor(sourceTable, referencedTable, config, isNullable) {
		super(sourceTable, referencedTable, config?.relationName);
		this.config = config;
		this.isNullable = isNullable;
	}
	static [entityKind] = "One";
	withFieldName(fieldName) {
		const relation = new One(this.sourceTable, this.referencedTable, this.config, this.isNullable);
		relation.fieldName = fieldName;
		return relation;
	}
};
var Many = class Many extends Relation {
	constructor(sourceTable, referencedTable, config) {
		super(sourceTable, referencedTable, config?.relationName);
		this.config = config;
	}
	static [entityKind] = "Many";
	withFieldName(fieldName) {
		const relation = new Many(this.sourceTable, this.referencedTable, this.config);
		relation.fieldName = fieldName;
		return relation;
	}
};
function getOperators() {
	return {
		and,
		between,
		eq,
		exists,
		gt,
		gte,
		ilike,
		inArray,
		isNull,
		isNotNull,
		like,
		lt,
		lte,
		ne,
		not,
		notBetween,
		notExists,
		notLike,
		notIlike,
		notInArray,
		or,
		sql
	};
}
function getOrderByOperators() {
	return {
		sql,
		asc,
		desc
	};
}
function extractTablesRelationalConfig(schema, configHelpers) {
	if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) schema = schema["default"];
	const tableNamesMap = {};
	const relationsBuffer = {};
	const tablesConfig = {};
	for (const [key, value] of Object.entries(schema)) if (is(value, Table)) {
		const dbName = getTableUniqueName(value);
		const bufferedRelations = relationsBuffer[dbName];
		tableNamesMap[dbName] = key;
		tablesConfig[key] = {
			tsName: key,
			dbName: value[Table.Symbol.Name],
			schema: value[Table.Symbol.Schema],
			columns: value[Table.Symbol.Columns],
			relations: bufferedRelations?.relations ?? {},
			primaryKey: bufferedRelations?.primaryKey ?? []
		};
		for (const column of Object.values(value[Table.Symbol.Columns])) if (column.primary) tablesConfig[key].primaryKey.push(column);
		const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
		if (extraConfig) {
			for (const configEntry of Object.values(extraConfig)) if (is(configEntry, PrimaryKeyBuilder$1)) tablesConfig[key].primaryKey.push(...configEntry.columns);
		}
	} else if (is(value, Relations)) {
		const dbName = getTableUniqueName(value.table);
		const tableName = tableNamesMap[dbName];
		const relations2 = value.config(configHelpers(value.table));
		let primaryKey;
		for (const [relationName, relation] of Object.entries(relations2)) if (tableName) {
			const tableConfig = tablesConfig[tableName];
			tableConfig.relations[relationName] = relation;
		} else {
			if (!(dbName in relationsBuffer)) relationsBuffer[dbName] = {
				relations: {},
				primaryKey
			};
			relationsBuffer[dbName].relations[relationName] = relation;
		}
	}
	return {
		tables: tablesConfig,
		tableNamesMap
	};
}
function createOne(sourceTable) {
	return function one(table, config) {
		return new One(sourceTable, table, config, config?.fields.reduce((res, f) => res && f.notNull, true) ?? false);
	};
}
function createMany(sourceTable) {
	return function many(referencedTable, config) {
		return new Many(sourceTable, referencedTable, config);
	};
}
function normalizeRelation(schema, tableNamesMap, relation) {
	if (is(relation, One) && relation.config) return {
		fields: relation.config.fields,
		references: relation.config.references
	};
	const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
	if (!referencedTableTsName) throw new Error(`Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`);
	const referencedTableConfig = schema[referencedTableTsName];
	if (!referencedTableConfig) throw new Error(`Table "${referencedTableTsName}" not found in schema`);
	const sourceTable = relation.sourceTable;
	const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
	if (!sourceTableTsName) throw new Error(`Table "${sourceTable[Table.Symbol.Name]}" not found in schema`);
	const reverseRelations = [];
	for (const referencedTableRelation of Object.values(referencedTableConfig.relations)) if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) reverseRelations.push(referencedTableRelation);
	if (reverseRelations.length > 1) throw relation.relationName ? /* @__PURE__ */ new Error(`There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`) : /* @__PURE__ */ new Error(`There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`);
	if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) return {
		fields: reverseRelations[0].config.references,
		references: reverseRelations[0].config.fields
	};
	throw new Error(`There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`);
}
function createTableRelationsHelpers(sourceTable) {
	return {
		one: createOne(sourceTable),
		many: createMany(sourceTable)
	};
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
	const result = {};
	for (const [selectionItemIndex, selectionItem] of buildQueryResultSelection.entries()) if (selectionItem.isJson) {
		const relation = tableConfig.relations[selectionItem.tsKey];
		const rawSubRows = row[selectionItemIndex];
		const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
		result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(tablesConfig, tablesConfig[selectionItem.relationTableTsKey], subRows, selectionItem.selection, mapColumnValue) : subRows.map((subRow) => mapRelationalRow(tablesConfig, tablesConfig[selectionItem.relationTableTsKey], subRow, selectionItem.selection, mapColumnValue));
	} else {
		const value = mapColumnValue(row[selectionItemIndex]);
		const field = selectionItem.field;
		let decoder;
		if (is(field, Column)) decoder = field;
		else if (is(field, SQL)) decoder = field.decoder;
		else decoder = field.sql.decoder;
		result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
	}
	return result;
}
// node_modules/drizzle-orm/sql/functions/aggregate.js
function count(expression) {
	return sql`count(${expression || sql.raw("*")})`.mapWith(Number);
}
// node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler = class SelectionProxyHandler {
	static [entityKind] = "SelectionProxyHandler";
	config;
	constructor(config) {
		this.config = { ...config };
	}
	get(subquery, prop) {
		if (prop === "_") return {
			...subquery["_"],
			selectedFields: new Proxy(subquery._.selectedFields, this)
		};
		if (prop === ViewBaseConfig) return {
			...subquery[ViewBaseConfig],
			selectedFields: new Proxy(subquery[ViewBaseConfig].selectedFields, this)
		};
		if (typeof prop === "symbol") return subquery[prop];
		const value = (is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery)[prop];
		if (is(value, SQL.Aliased)) {
			if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) return value.sql;
			const newValue = value.clone();
			newValue.isSelectionField = true;
			return newValue;
		}
		if (is(value, SQL)) {
			if (this.config.sqlBehavior === "sql") return value;
			throw new Error(`You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`);
		}
		if (is(value, Column)) {
			if (this.config.alias) return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(value.table, new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false))));
			return value;
		}
		if (typeof value !== "object" || value === null) return value;
		return new Proxy(value, new SelectionProxyHandler(this.config));
	}
};
// node_modules/drizzle-orm/sqlite-core/foreign-keys.js
var ForeignKeyBuilder = class {
	static [entityKind] = "SQLiteForeignKeyBuilder";
	/** @internal */
	reference;
	/** @internal */
	_onUpdate;
	/** @internal */
	_onDelete;
	constructor(config, actions) {
		this.reference = () => {
			const { name, columns, foreignColumns } = config();
			return {
				name,
				columns,
				foreignTable: foreignColumns[0].table,
				foreignColumns
			};
		};
		if (actions) {
			this._onUpdate = actions.onUpdate;
			this._onDelete = actions.onDelete;
		}
	}
	onUpdate(action) {
		this._onUpdate = action;
		return this;
	}
	onDelete(action) {
		this._onDelete = action;
		return this;
	}
	/** @internal */
	build(table) {
		return new ForeignKey(table, this);
	}
};
var ForeignKey = class {
	constructor(table, builder) {
		this.table = table;
		this.reference = builder.reference;
		this.onUpdate = builder._onUpdate;
		this.onDelete = builder._onDelete;
	}
	static [entityKind] = "SQLiteForeignKey";
	reference;
	onUpdate;
	onDelete;
	getName() {
		const { name, columns, foreignColumns } = this.reference();
		const columnNames = columns.map((column) => column.name);
		const foreignColumnNames = foreignColumns.map((column) => column.name);
		const chunks = [
			this.table[TableName],
			...columnNames,
			foreignColumns[0].table[TableName],
			...foreignColumnNames
		];
		return name ?? `${chunks.join("_")}_fk`;
	}
};
// node_modules/drizzle-orm/sqlite-core/unique-constraint.js
function uniqueKeyName(table, columns) {
	return `${table[TableName]}_${columns.join("_")}_unique`;
}
// node_modules/drizzle-orm/sqlite-core/columns/common.js
var SQLiteColumnBuilder = class extends ColumnBuilder {
	static [entityKind] = "SQLiteColumnBuilder";
	foreignKeyConfigs = [];
	references(ref, actions = {}) {
		this.foreignKeyConfigs.push({
			ref,
			actions
		});
		return this;
	}
	unique(name) {
		this.config.isUnique = true;
		this.config.uniqueName = name;
		return this;
	}
	generatedAlwaysAs(as, config) {
		this.config.generated = {
			as,
			type: "always",
			mode: config?.mode ?? "virtual"
		};
		return this;
	}
	/** @internal */
	buildForeignKeys(column, table) {
		return this.foreignKeyConfigs.map(({ ref, actions }) => {
			return ((ref2, actions2) => {
				const builder = new ForeignKeyBuilder(() => {
					const foreignColumn = ref2();
					return {
						columns: [column],
						foreignColumns: [foreignColumn]
					};
				});
				if (actions2.onUpdate) builder.onUpdate(actions2.onUpdate);
				if (actions2.onDelete) builder.onDelete(actions2.onDelete);
				return builder.build(table);
			})(ref, actions);
		});
	}
};
var SQLiteColumn = class extends Column {
	constructor(table, config) {
		if (!config.uniqueName) config.uniqueName = uniqueKeyName(table, [config.name]);
		super(table, config);
		this.table = table;
	}
	static [entityKind] = "SQLiteColumn";
};
// node_modules/drizzle-orm/sqlite-core/columns/blob.js
var SQLiteBigIntBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteBigIntBuilder";
	constructor(name) {
		super(name, "bigint", "SQLiteBigInt");
	}
	/** @internal */
	build(table) {
		return new SQLiteBigInt(table, this.config);
	}
};
var SQLiteBigInt = class extends SQLiteColumn {
	static [entityKind] = "SQLiteBigInt";
	getSQLType() {
		return "blob";
	}
	mapFromDriverValue(value) {
		if (typeof Buffer !== "undefined" && Buffer.from) {
			const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
			return BigInt(buf.toString("utf8"));
		}
		return BigInt(textDecoder.decode(value));
	}
	mapToDriverValue(value) {
		return Buffer.from(value.toString());
	}
};
var SQLiteBlobJsonBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteBlobJsonBuilder";
	constructor(name) {
		super(name, "json", "SQLiteBlobJson");
	}
	/** @internal */
	build(table) {
		return new SQLiteBlobJson(table, this.config);
	}
};
var SQLiteBlobJson = class extends SQLiteColumn {
	static [entityKind] = "SQLiteBlobJson";
	getSQLType() {
		return "blob";
	}
	mapFromDriverValue(value) {
		if (typeof Buffer !== "undefined" && Buffer.from) {
			const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
			return JSON.parse(buf.toString("utf8"));
		}
		return JSON.parse(textDecoder.decode(value));
	}
	mapToDriverValue(value) {
		return Buffer.from(JSON.stringify(value));
	}
};
var SQLiteBlobBufferBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteBlobBufferBuilder";
	constructor(name) {
		super(name, "buffer", "SQLiteBlobBuffer");
	}
	/** @internal */
	build(table) {
		return new SQLiteBlobBuffer(table, this.config);
	}
};
var SQLiteBlobBuffer = class extends SQLiteColumn {
	static [entityKind] = "SQLiteBlobBuffer";
	mapFromDriverValue(value) {
		if (Buffer.isBuffer(value)) return value;
		return Buffer.from(value);
	}
	getSQLType() {
		return "blob";
	}
};
function blob(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (config?.mode === "json") return new SQLiteBlobJsonBuilder(name);
	if (config?.mode === "bigint") return new SQLiteBigIntBuilder(name);
	return new SQLiteBlobBufferBuilder(name);
}
// node_modules/drizzle-orm/sqlite-core/columns/custom.js
var SQLiteCustomColumnBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteCustomColumnBuilder";
	constructor(name, fieldConfig, customTypeParams) {
		super(name, "custom", "SQLiteCustomColumn");
		this.config.fieldConfig = fieldConfig;
		this.config.customTypeParams = customTypeParams;
	}
	/** @internal */
	build(table) {
		return new SQLiteCustomColumn(table, this.config);
	}
};
var SQLiteCustomColumn = class extends SQLiteColumn {
	static [entityKind] = "SQLiteCustomColumn";
	sqlName;
	mapTo;
	mapFrom;
	constructor(table, config) {
		super(table, config);
		this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
		this.mapTo = config.customTypeParams.toDriver;
		this.mapFrom = config.customTypeParams.fromDriver;
	}
	getSQLType() {
		return this.sqlName;
	}
	mapFromDriverValue(value) {
		return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
	}
	mapToDriverValue(value) {
		return typeof this.mapTo === "function" ? this.mapTo(value) : value;
	}
};
function customType(customTypeParams) {
	return (a, b) => {
		const { name, config } = getColumnNameAndConfig(a, b);
		return new SQLiteCustomColumnBuilder(name, config, customTypeParams);
	};
}
// node_modules/drizzle-orm/sqlite-core/columns/integer.js
var SQLiteBaseIntegerBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteBaseIntegerBuilder";
	constructor(name, dataType, columnType) {
		super(name, dataType, columnType);
		this.config.autoIncrement = false;
	}
	primaryKey(config) {
		if (config?.autoIncrement) this.config.autoIncrement = true;
		this.config.hasDefault = true;
		return super.primaryKey();
	}
};
var SQLiteBaseInteger = class extends SQLiteColumn {
	static [entityKind] = "SQLiteBaseInteger";
	autoIncrement = this.config.autoIncrement;
	getSQLType() {
		return "integer";
	}
};
var SQLiteIntegerBuilder = class extends SQLiteBaseIntegerBuilder {
	static [entityKind] = "SQLiteIntegerBuilder";
	constructor(name) {
		super(name, "number", "SQLiteInteger");
	}
	build(table) {
		return new SQLiteInteger(table, this.config);
	}
};
var SQLiteInteger = class extends SQLiteBaseInteger {
	static [entityKind] = "SQLiteInteger";
};
var SQLiteTimestampBuilder = class extends SQLiteBaseIntegerBuilder {
	static [entityKind] = "SQLiteTimestampBuilder";
	constructor(name, mode) {
		super(name, "date", "SQLiteTimestamp");
		this.config.mode = mode;
	}
	/**
	* @deprecated Use `default()` with your own expression instead.
	*
	* Adds `DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))` to the column, which is the current epoch timestamp in milliseconds.
	*/
	defaultNow() {
		return this.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`);
	}
	build(table) {
		return new SQLiteTimestamp(table, this.config);
	}
};
var SQLiteTimestamp = class extends SQLiteBaseInteger {
	static [entityKind] = "SQLiteTimestamp";
	mode = this.config.mode;
	mapFromDriverValue(value) {
		if (this.config.mode === "timestamp") return /* @__PURE__ */ new Date(value * 1e3);
		return new Date(value);
	}
	mapToDriverValue(value) {
		const unix = value.getTime();
		if (this.config.mode === "timestamp") return Math.floor(unix / 1e3);
		return unix;
	}
};
var SQLiteBooleanBuilder = class extends SQLiteBaseIntegerBuilder {
	static [entityKind] = "SQLiteBooleanBuilder";
	constructor(name, mode) {
		super(name, "boolean", "SQLiteBoolean");
		this.config.mode = mode;
	}
	build(table) {
		return new SQLiteBoolean(table, this.config);
	}
};
var SQLiteBoolean = class extends SQLiteBaseInteger {
	static [entityKind] = "SQLiteBoolean";
	mode = this.config.mode;
	mapFromDriverValue(value) {
		return Number(value) === 1;
	}
	mapToDriverValue(value) {
		return value ? 1 : 0;
	}
};
function integer(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (config?.mode === "timestamp" || config?.mode === "timestamp_ms") return new SQLiteTimestampBuilder(name, config.mode);
	if (config?.mode === "boolean") return new SQLiteBooleanBuilder(name, config.mode);
	return new SQLiteIntegerBuilder(name);
}
// node_modules/drizzle-orm/sqlite-core/columns/numeric.js
var SQLiteNumericBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteNumericBuilder";
	constructor(name) {
		super(name, "string", "SQLiteNumeric");
	}
	/** @internal */
	build(table) {
		return new SQLiteNumeric(table, this.config);
	}
};
var SQLiteNumeric = class extends SQLiteColumn {
	static [entityKind] = "SQLiteNumeric";
	mapFromDriverValue(value) {
		if (typeof value === "string") return value;
		return String(value);
	}
	getSQLType() {
		return "numeric";
	}
};
var SQLiteNumericNumberBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteNumericNumberBuilder";
	constructor(name) {
		super(name, "number", "SQLiteNumericNumber");
	}
	/** @internal */
	build(table) {
		return new SQLiteNumericNumber(table, this.config);
	}
};
var SQLiteNumericNumber = class extends SQLiteColumn {
	static [entityKind] = "SQLiteNumericNumber";
	mapFromDriverValue(value) {
		if (typeof value === "number") return value;
		return Number(value);
	}
	mapToDriverValue = String;
	getSQLType() {
		return "numeric";
	}
};
var SQLiteNumericBigIntBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteNumericBigIntBuilder";
	constructor(name) {
		super(name, "bigint", "SQLiteNumericBigInt");
	}
	/** @internal */
	build(table) {
		return new SQLiteNumericBigInt(table, this.config);
	}
};
var SQLiteNumericBigInt = class extends SQLiteColumn {
	static [entityKind] = "SQLiteNumericBigInt";
	mapFromDriverValue = BigInt;
	mapToDriverValue = String;
	getSQLType() {
		return "numeric";
	}
};
function numeric(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	const mode = config?.mode;
	return mode === "number" ? new SQLiteNumericNumberBuilder(name) : mode === "bigint" ? new SQLiteNumericBigIntBuilder(name) : new SQLiteNumericBuilder(name);
}
// node_modules/drizzle-orm/sqlite-core/columns/real.js
var SQLiteRealBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteRealBuilder";
	constructor(name) {
		super(name, "number", "SQLiteReal");
	}
	/** @internal */
	build(table) {
		return new SQLiteReal(table, this.config);
	}
};
var SQLiteReal = class extends SQLiteColumn {
	static [entityKind] = "SQLiteReal";
	getSQLType() {
		return "real";
	}
};
function real(name) {
	return new SQLiteRealBuilder(name ?? "");
}
// node_modules/drizzle-orm/sqlite-core/columns/text.js
var SQLiteTextBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteTextBuilder";
	constructor(name, config) {
		super(name, "string", "SQLiteText");
		this.config.enumValues = config.enum;
		this.config.length = config.length;
	}
	/** @internal */
	build(table) {
		return new SQLiteText(table, this.config);
	}
};
var SQLiteText = class extends SQLiteColumn {
	static [entityKind] = "SQLiteText";
	enumValues = this.config.enumValues;
	length = this.config.length;
	constructor(table, config) {
		super(table, config);
	}
	getSQLType() {
		return `text${this.config.length ? `(${this.config.length})` : ""}`;
	}
};
var SQLiteTextJsonBuilder = class extends SQLiteColumnBuilder {
	static [entityKind] = "SQLiteTextJsonBuilder";
	constructor(name) {
		super(name, "json", "SQLiteTextJson");
	}
	/** @internal */
	build(table) {
		return new SQLiteTextJson(table, this.config);
	}
};
var SQLiteTextJson = class extends SQLiteColumn {
	static [entityKind] = "SQLiteTextJson";
	getSQLType() {
		return "text";
	}
	mapFromDriverValue(value) {
		return JSON.parse(value);
	}
	mapToDriverValue(value) {
		return JSON.stringify(value);
	}
};
function text(a, b = {}) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (config.mode === "json") return new SQLiteTextJsonBuilder(name);
	return new SQLiteTextBuilder(name, config);
}
// node_modules/drizzle-orm/sqlite-core/columns/all.js
function getSQLiteColumnBuilders() {
	return {
		blob,
		customType,
		integer,
		numeric,
		real,
		text
	};
}
// node_modules/drizzle-orm/sqlite-core/table.js
var InlineForeignKeys = Symbol.for("drizzle:SQLiteInlineForeignKeys");
var SQLiteTable = class extends Table {
	static [entityKind] = "SQLiteTable";
	/** @internal */
	static Symbol = Object.assign({}, Table.Symbol, { InlineForeignKeys });
	/** @internal */
	[Table.Symbol.Columns];
	/** @internal */
	[InlineForeignKeys] = [];
	/** @internal */
	[Table.Symbol.ExtraConfigBuilder] = void 0;
};
function sqliteTableBase(name, columns, extraConfig, schema, baseName = name) {
	const rawTable = new SQLiteTable(name, schema, baseName);
	const parsedColumns = typeof columns === "function" ? columns(getSQLiteColumnBuilders()) : columns;
	const builtColumns = Object.fromEntries(Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
		const colBuilder = colBuilderBase;
		colBuilder.setName(name2);
		const column = colBuilder.build(rawTable);
		rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
		return [name2, column];
	}));
	const table = Object.assign(rawTable, builtColumns);
	table[Table.Symbol.Columns] = builtColumns;
	table[Table.Symbol.ExtraConfigColumns] = builtColumns;
	if (extraConfig) table[SQLiteTable.Symbol.ExtraConfigBuilder] = extraConfig;
	return table;
}
var sqliteTable = (name, columns, extraConfig) => {
	return sqliteTableBase(name, columns, extraConfig);
};
// node_modules/drizzle-orm/sqlite-core/indexes.js
var IndexBuilderOn = class {
	constructor(name, unique) {
		this.name = name;
		this.unique = unique;
	}
	static [entityKind] = "SQLiteIndexBuilderOn";
	on(...columns) {
		return new IndexBuilder(this.name, columns, this.unique);
	}
};
var IndexBuilder = class {
	static [entityKind] = "SQLiteIndexBuilder";
	/** @internal */
	config;
	constructor(name, columns, unique) {
		this.config = {
			name,
			columns,
			unique,
			where: void 0
		};
	}
	/**
	* Condition for partial index.
	*/
	where(condition) {
		this.config.where = condition;
		return this;
	}
	/** @internal */
	build(table) {
		return new Index(this.config, table);
	}
};
var Index = class {
	static [entityKind] = "SQLiteIndex";
	config;
	constructor(config, table) {
		this.config = {
			...config,
			table
		};
	}
};
function index(name) {
	return new IndexBuilderOn(name, false);
}
function uniqueIndex(name) {
	return new IndexBuilderOn(name, true);
}
// node_modules/drizzle-orm/sqlite-core/primary-keys.js
function primaryKey(...config) {
	if (config[0].columns) return new PrimaryKeyBuilder(config[0].columns, config[0].name);
	return new PrimaryKeyBuilder(config);
}
var PrimaryKeyBuilder = class {
	static [entityKind] = "SQLitePrimaryKeyBuilder";
	/** @internal */
	columns;
	/** @internal */
	name;
	constructor(columns, name) {
		this.columns = columns;
		this.name = name;
	}
	/** @internal */
	build(table) {
		return new PrimaryKey(table, this.columns, this.name);
	}
};
var PrimaryKey = class {
	constructor(table, columns, name) {
		this.table = table;
		this.columns = columns;
		this.name = name;
	}
	static [entityKind] = "SQLitePrimaryKey";
	columns;
	name;
	getName() {
		return this.name ?? `${this.table[SQLiteTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
	}
};
// node_modules/drizzle-orm/sqlite-core/utils.js
function extractUsedTable(table) {
	if (is(table, SQLiteTable)) return [`${table[Table.Symbol.BaseName]}`];
	if (is(table, Subquery)) return table._.usedTables ?? [];
	if (is(table, SQL)) return table.usedTables ?? [];
	return [];
}
// node_modules/drizzle-orm/sqlite-core/query-builders/delete.js
var SQLiteDeleteBase = class extends QueryPromise {
	constructor(table, session, dialect, withList) {
		super();
		this.table = table;
		this.session = session;
		this.dialect = dialect;
		this.config = {
			table,
			withList
		};
	}
	static [entityKind] = "SQLiteDelete";
	/** @internal */
	config;
	/**
	* Adds a `where` clause to the query.
	*
	* Calling this method will delete only those rows that fulfill a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/delete}
	*
	* @param where the `where` clause.
	*
	* @example
	* You can use conditional operators and `sql function` to filter the rows to be deleted.
	*
	* ```ts
	* // Delete all cars with green color
	* db.delete(cars).where(eq(cars.color, 'green'));
	* // or
	* db.delete(cars).where(sql`${cars.color} = 'green'`)
	* ```
	*
	* You can logically combine conditional operators with `and()` and `or()` operators:
	*
	* ```ts
	* // Delete all BMW cars with a green color
	* db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
	*
	* // Delete all cars with the green or blue color
	* db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
	* ```
	*/
	where(where) {
		this.config.where = where;
		return this;
	}
	orderBy(...columns) {
		if (typeof columns[0] === "function") {
			const orderBy = columns[0](new Proxy(this.config.table[Table.Symbol.Columns], new SelectionProxyHandler({
				sqlAliasedBehavior: "alias",
				sqlBehavior: "sql"
			})));
			const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
			this.config.orderBy = orderByArray;
		} else {
			const orderByArray = columns;
			this.config.orderBy = orderByArray;
		}
		return this;
	}
	limit(limit) {
		this.config.limit = limit;
		return this;
	}
	returning(fields = this.table[SQLiteTable.Symbol.Columns]) {
		this.config.returning = orderSelectedFields(fields);
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildDeleteQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	/** @internal */
	_prepare(isOneTimeQuery = true) {
		return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), this.config.returning, this.config.returning ? "all" : "run", true, void 0, {
			type: "delete",
			tables: extractUsedTable(this.config.table)
		});
	}
	prepare() {
		return this._prepare(false);
	}
	run = (placeholderValues) => {
		return this._prepare().run(placeholderValues);
	};
	all = (placeholderValues) => {
		return this._prepare().all(placeholderValues);
	};
	get = (placeholderValues) => {
		return this._prepare().get(placeholderValues);
	};
	values = (placeholderValues) => {
		return this._prepare().values(placeholderValues);
	};
	async execute(placeholderValues) {
		return this._prepare().execute(placeholderValues);
	}
	$dynamic() {
		return this;
	}
};
// node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
	return (input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? []).map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
	return (input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? []).reduce((acc, word, i) => {
		return acc + (i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`);
	}, "");
}
function noopCase(input) {
	return input;
}
var CasingCache = class {
	static [entityKind] = "CasingCache";
	/** @internal */
	cache = {};
	cachedTables = {};
	convert;
	constructor(casing) {
		this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
	}
	getColumnCasing(column) {
		if (!column.keyAsName) return column.name;
		const key = `${column.table[Table.Symbol.Schema] ?? "public"}.${column.table[Table.Symbol.OriginalName]}.${column.name}`;
		if (!this.cache[key]) this.cacheTable(column.table);
		return this.cache[key];
	}
	cacheTable(table) {
		const tableKey = `${table[Table.Symbol.Schema] ?? "public"}.${table[Table.Symbol.OriginalName]}`;
		if (!this.cachedTables[tableKey]) {
			for (const column of Object.values(table[Table.Symbol.Columns])) {
				const columnKey = `${tableKey}.${column.name}`;
				this.cache[columnKey] = this.convert(column.name);
			}
			this.cachedTables[tableKey] = true;
		}
	}
	clearCache() {
		this.cache = {};
		this.cachedTables = {};
	}
};
// node_modules/drizzle-orm/sqlite-core/view-base.js
var SQLiteViewBase = class extends View {
	static [entityKind] = "SQLiteViewBase";
};
// node_modules/drizzle-orm/sqlite-core/dialect.js
var SQLiteDialect = class {
	static [entityKind] = "SQLiteDialect";
	/** @internal */
	casing;
	constructor(config) {
		this.casing = new CasingCache(config?.casing);
	}
	escapeName(name) {
		return `"${name.replace(/"/g, "\"\"")}"`;
	}
	escapeParam(_num) {
		return "?";
	}
	escapeString(str) {
		return `'${str.replace(/'/g, "''")}'`;
	}
	buildWithCTE(queries) {
		if (!queries?.length) return void 0;
		const withSqlChunks = [sql`with `];
		for (const [i, w] of queries.entries()) {
			withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
			if (i < queries.length - 1) withSqlChunks.push(sql`, `);
		}
		withSqlChunks.push(sql` `);
		return sql.join(withSqlChunks);
	}
	buildDeleteQuery({ table, where, returning, withList, limit, orderBy }) {
		const withSql = this.buildWithCTE(withList);
		const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
		const whereSql = where ? sql` where ${where}` : void 0;
		const orderBySql = this.buildOrderBy(orderBy);
		const limitSql = this.buildLimit(limit);
		return sql`${withSql}delete from ${table}${whereSql}${returningSql}${orderBySql}${limitSql}`;
	}
	buildUpdateSet(table, set) {
		const tableColumns = table[Table.Symbol.Columns];
		const columnNames = Object.keys(tableColumns).filter((colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0);
		const setSize = columnNames.length;
		return sql.join(columnNames.flatMap((colName, i) => {
			const col = tableColumns[colName];
			const onUpdateFnResult = col.onUpdateFn?.();
			const value = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
			const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
			if (i < setSize - 1) return [res, sql.raw(", ")];
			return [res];
		}));
	}
	buildUpdateQuery({ table, set, where, returning, withList, joins, from, limit, orderBy }) {
		const withSql = this.buildWithCTE(withList);
		const setSql = this.buildUpdateSet(table, set);
		const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
		const joinsSql = this.buildJoins(joins);
		const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
		const whereSql = where ? sql` where ${where}` : void 0;
		const orderBySql = this.buildOrderBy(orderBy);
		const limitSql = this.buildLimit(limit);
		return sql`${withSql}update ${table} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}${orderBySql}${limitSql}`;
	}
	/**
	* Builds selection SQL with provided fields/expressions
	*
	* Examples:
	*
	* `select <selection> from`
	*
	* `insert ... returning <selection>`
	*
	* If `isSingleTable` is true, then columns won't be prefixed with table name
	*/
	buildSelection(fields, { isSingleTable = false } = {}) {
		const columnsLen = fields.length;
		const chunks = fields.flatMap(({ field }, i) => {
			const chunk = [];
			if (is(field, SQL.Aliased) && field.isSelectionField) chunk.push(sql.identifier(field.fieldAlias));
			else if (is(field, SQL.Aliased) || is(field, SQL)) {
				const query = is(field, SQL.Aliased) ? field.sql : field;
				if (isSingleTable) chunk.push(new SQL(query.queryChunks.map((c) => {
					if (is(c, Column)) return sql.identifier(this.casing.getColumnCasing(c));
					return c;
				})));
				else chunk.push(query);
				if (is(field, SQL.Aliased)) chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
			} else if (is(field, Column)) {
				const tableName = field.table[Table.Symbol.Name];
				if (field.columnType === "SQLiteNumericBigInt") {
					if (isSingleTable) chunk.push(sql`cast(${sql.identifier(this.casing.getColumnCasing(field))} as text)`);
					else chunk.push(sql`cast(${sql.identifier(tableName)}.${sql.identifier(this.casing.getColumnCasing(field))} as text)`);
				} else if (isSingleTable) chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
				else chunk.push(sql`${sql.identifier(tableName)}.${sql.identifier(this.casing.getColumnCasing(field))}`);
			} else if (is(field, Subquery)) {
				const entries = Object.entries(field._.selectedFields);
				if (entries.length === 1) {
					const entry = entries[0][1];
					const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: (v) => entry.mapFromDriverValue(v) } : entry.sql.decoder;
					if (fieldDecoder) field._.sql.decoder = fieldDecoder;
				}
				chunk.push(field);
			}
			if (i < columnsLen - 1) chunk.push(sql`, `);
			return chunk;
		});
		return sql.join(chunks);
	}
	buildJoins(joins) {
		if (!joins || joins.length === 0) return;
		const joinsArray = [];
		if (joins) for (const [index, joinMeta] of joins.entries()) {
			if (index === 0) joinsArray.push(sql` `);
			const table = joinMeta.table;
			const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
			if (is(table, SQLiteTable)) {
				const tableName = table[SQLiteTable.Symbol.Name];
				const tableSchema = table[SQLiteTable.Symbol.Schema];
				const origTableName = table[SQLiteTable.Symbol.OriginalName];
				const alias = tableName === origTableName ? void 0 : joinMeta.alias;
				joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`);
			} else joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join ${table}${onSql}`);
			if (index < joins.length - 1) joinsArray.push(sql` `);
		}
		return sql.join(joinsArray);
	}
	buildLimit(limit) {
		return typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
	}
	buildOrderBy(orderBy) {
		const orderByList = [];
		if (orderBy) for (const [index, orderByValue] of orderBy.entries()) {
			orderByList.push(orderByValue);
			if (index < orderBy.length - 1) orderByList.push(sql`, `);
		}
		return orderByList.length > 0 ? sql` order by ${sql.join(orderByList)}` : void 0;
	}
	buildFromTable(table) {
		if (is(table, Table) && table[Table.Symbol.IsAlias]) return sql`${sql`${sql.identifier(table[Table.Symbol.Schema] ?? "")}.`.if(table[Table.Symbol.Schema])}${sql.identifier(table[Table.Symbol.OriginalName])} ${sql.identifier(table[Table.Symbol.Name])}`;
		return table;
	}
	buildSelectQuery({ withList, fields, fieldsFlat, where, having, table, joins, orderBy, groupBy, limit, offset, distinct, setOperators }) {
		const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
		for (const f of fieldsList) if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, SQLiteViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])))(f.field.table)) {
			const tableName = getTableName(f.field.table);
			throw new Error(`Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`);
		}
		const isSingleTable = !joins || joins.length === 0;
		const withSql = this.buildWithCTE(withList);
		const distinctSql = distinct ? sql` distinct` : void 0;
		const selection = this.buildSelection(fieldsList, { isSingleTable });
		const tableSql = this.buildFromTable(table);
		const joinsSql = this.buildJoins(joins);
		const whereSql = where ? sql` where ${where}` : void 0;
		const havingSql = having ? sql` having ${having}` : void 0;
		const groupByList = [];
		if (groupBy) for (const [index, groupByValue] of groupBy.entries()) {
			groupByList.push(groupByValue);
			if (index < groupBy.length - 1) groupByList.push(sql`, `);
		}
		const groupBySql = groupByList.length > 0 ? sql` group by ${sql.join(groupByList)}` : void 0;
		const orderBySql = this.buildOrderBy(orderBy);
		const limitSql = this.buildLimit(limit);
		const offsetSql = offset ? sql` offset ${offset}` : void 0;
		const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}`;
		if (setOperators.length > 0) return this.buildSetOperations(finalQuery, setOperators);
		return finalQuery;
	}
	buildSetOperations(leftSelect, setOperators) {
		const [setOperator, ...rest] = setOperators;
		if (!setOperator) throw new Error("Cannot pass undefined values to any set operator");
		if (rest.length === 0) return this.buildSetOperationQuery({
			leftSelect,
			setOperator
		});
		return this.buildSetOperations(this.buildSetOperationQuery({
			leftSelect,
			setOperator
		}), rest);
	}
	buildSetOperationQuery({ leftSelect, setOperator: { type, isAll, rightSelect, limit, orderBy, offset } }) {
		const leftChunk = sql`${leftSelect.getSQL()} `;
		const rightChunk = sql`${rightSelect.getSQL()}`;
		let orderBySql;
		if (orderBy && orderBy.length > 0) {
			const orderByValues = [];
			for (const singleOrderBy of orderBy) if (is(singleOrderBy, SQLiteColumn)) orderByValues.push(sql.identifier(singleOrderBy.name));
			else if (is(singleOrderBy, SQL)) {
				for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
					const chunk = singleOrderBy.queryChunks[i];
					if (is(chunk, SQLiteColumn)) singleOrderBy.queryChunks[i] = sql.identifier(this.casing.getColumnCasing(chunk));
				}
				orderByValues.push(sql`${singleOrderBy}`);
			} else orderByValues.push(sql`${singleOrderBy}`);
			orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)}`;
		}
		const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
		const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
		const offsetSql = offset ? sql` offset ${offset}` : void 0;
		return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
	}
	buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select }) {
		const valuesSqlList = [];
		const columns = table[Table.Symbol.Columns];
		const colEntries = Object.entries(columns).filter(([_, col]) => !col.shouldDisableInsert());
		const insertOrder = colEntries.map(([, column]) => sql.identifier(this.casing.getColumnCasing(column)));
		if (select) {
			const select2 = valuesOrSelect;
			if (is(select2, SQL)) valuesSqlList.push(select2);
			else valuesSqlList.push(select2.getSQL());
		} else {
			const values = valuesOrSelect;
			valuesSqlList.push(sql.raw("values "));
			for (const [valueIndex, value] of values.entries()) {
				const valueList = [];
				for (const [fieldName, col] of colEntries) {
					const colValue = value[fieldName];
					if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
						let defaultValue;
						if (col.default !== null && col.default !== void 0) defaultValue = is(col.default, SQL) ? col.default : sql.param(col.default, col);
						else if (col.defaultFn !== void 0) {
							const defaultFnResult = col.defaultFn();
							defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
						} else if (!col.default && col.onUpdateFn !== void 0) {
							const onUpdateFnResult = col.onUpdateFn();
							defaultValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
						} else defaultValue = sql`null`;
						valueList.push(defaultValue);
					} else valueList.push(colValue);
				}
				valuesSqlList.push(valueList);
				if (valueIndex < values.length - 1) valuesSqlList.push(sql`, `);
			}
		}
		const withSql = this.buildWithCTE(withList);
		const valuesSql = sql.join(valuesSqlList);
		const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
		const onConflictSql = onConflict?.length ? sql.join(onConflict) : void 0;
		return sql`${withSql}insert into ${table} ${insertOrder} ${valuesSql}${onConflictSql}${returningSql}`;
	}
	sqlToQuery(sql2, invokeSource) {
		return sql2.toQuery({
			casing: this.casing,
			escapeName: this.escapeName,
			escapeParam: this.escapeParam,
			escapeString: this.escapeString,
			invokeSource
		});
	}
	buildRelationalQuery({ fullSchema, schema, tableNamesMap, table, tableConfig, queryConfig: config, tableAlias, nestedQueryRelation, joinOn }) {
		let selection = [];
		let limit, offset, orderBy = [], where;
		const joins = [];
		if (config === true) selection = Object.entries(tableConfig.columns).map(([key, value]) => ({
			dbKey: value.name,
			tsKey: key,
			field: aliasedTableColumn(value, tableAlias),
			relationTableTsKey: void 0,
			isJson: false,
			selection: []
		}));
		else {
			const aliasedColumns = Object.fromEntries(Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]));
			if (config.where) {
				const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
				where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
			}
			const fieldsSelection = [];
			let selectedColumns = [];
			if (config.columns) {
				let isIncludeMode = false;
				for (const [field, value] of Object.entries(config.columns)) {
					if (value === void 0) continue;
					if (field in tableConfig.columns) {
						if (!isIncludeMode && value === true) isIncludeMode = true;
						selectedColumns.push(field);
					}
				}
				if (selectedColumns.length > 0) selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
			} else selectedColumns = Object.keys(tableConfig.columns);
			for (const field of selectedColumns) {
				const column = tableConfig.columns[field];
				fieldsSelection.push({
					tsKey: field,
					value: column
				});
			}
			let selectedRelations = [];
			if (config.with) selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({
				tsKey,
				queryConfig,
				relation: tableConfig.relations[tsKey]
			}));
			let extras;
			if (config.extras) {
				extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
				for (const [tsKey, value] of Object.entries(extras)) fieldsSelection.push({
					tsKey,
					value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
				});
			}
			for (const { tsKey, value } of fieldsSelection) selection.push({
				dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
				tsKey,
				field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
				relationTableTsKey: void 0,
				isJson: false,
				selection: []
			});
			let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
			if (!Array.isArray(orderByOrig)) orderByOrig = [orderByOrig];
			orderBy = orderByOrig.map((orderByValue) => {
				if (is(orderByValue, Column)) return aliasedTableColumn(orderByValue, tableAlias);
				return mapColumnsInSQLToAlias(orderByValue, tableAlias);
			});
			limit = config.limit;
			offset = config.offset;
			for (const { tsKey: selectedRelationTsKey, queryConfig: selectedRelationConfigValue, relation } of selectedRelations) {
				const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
				const relationTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
				const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
				const joinOn2 = and(...normalizedRelation.fields.map((field2, i) => eq(aliasedTableColumn(normalizedRelation.references[i], relationTableAlias), aliasedTableColumn(field2, tableAlias))));
				const builtRelation = this.buildRelationalQuery({
					fullSchema,
					schema,
					tableNamesMap,
					table: fullSchema[relationTableTsName],
					tableConfig: schema[relationTableTsName],
					queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : {
						...selectedRelationConfigValue,
						limit: 1
					} : selectedRelationConfigValue,
					tableAlias: relationTableAlias,
					joinOn: joinOn2,
					nestedQueryRelation: relation
				});
				const field = sql`(${builtRelation.sql})`.as(selectedRelationTsKey);
				selection.push({
					dbKey: selectedRelationTsKey,
					tsKey: selectedRelationTsKey,
					field,
					relationTableTsKey: relationTableTsName,
					isJson: true,
					selection: builtRelation.selection
				});
			}
		}
		if (selection.length === 0) throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}"). You need to have at least one item in "columns", "with" or "extras". If you need to select all columns, omit the "columns" key or set it to undefined.` });
		let result;
		where = and(joinOn, where);
		if (nestedQueryRelation) {
			let field = sql`json_array(${sql.join(selection.map(({ field: field2 }) => is(field2, SQLiteColumn) ? sql.identifier(this.casing.getColumnCasing(field2)) : is(field2, SQL.Aliased) ? field2.sql : field2), sql`, `)})`;
			if (is(nestedQueryRelation, Many)) field = sql`coalesce(json_group_array(${field}), json_array())`;
			const nestedSelection = [{
				dbKey: "data",
				tsKey: "data",
				field: field.as("data"),
				isJson: true,
				relationTableTsKey: tableConfig.tsName,
				selection
			}];
			if (limit !== void 0 || offset !== void 0 || orderBy.length > 0) {
				result = this.buildSelectQuery({
					table: aliasedTable(table, tableAlias),
					fields: {},
					fieldsFlat: [{
						path: [],
						field: sql.raw("*")
					}],
					where,
					limit,
					offset,
					orderBy,
					setOperators: []
				});
				where = void 0;
				limit = void 0;
				offset = void 0;
				orderBy = void 0;
			} else result = aliasedTable(table, tableAlias);
			result = this.buildSelectQuery({
				table: is(result, SQLiteTable) ? result : new Subquery(result, {}, tableAlias),
				fields: {},
				fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
					path: [],
					field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
				})),
				joins,
				where,
				limit,
				offset,
				orderBy,
				setOperators: []
			});
		} else result = this.buildSelectQuery({
			table: aliasedTable(table, tableAlias),
			fields: {},
			fieldsFlat: selection.map(({ field }) => ({
				path: [],
				field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
			})),
			joins,
			where,
			limit,
			offset,
			orderBy,
			setOperators: []
		});
		return {
			tableTsKey: tableConfig.tsName,
			sql: result,
			selection
		};
	}
};
var SQLiteSyncDialect = class extends SQLiteDialect {
	static [entityKind] = "SQLiteSyncDialect";
	migrate(migrations, session, config) {
		const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
		const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
		session.run(migrationTableCreate);
		const lastDbMigration = session.values(sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`)[0] ?? void 0;
		session.run(sql`BEGIN`);
		try {
			for (const migration of migrations) if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
				for (const stmt of migration.sql) session.run(sql.raw(stmt));
				session.run(sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`);
			}
			session.run(sql`COMMIT`);
		} catch (e) {
			session.run(sql`ROLLBACK`);
			throw e;
		}
	}
};
var SQLiteAsyncDialect = class extends SQLiteDialect {
	static [entityKind] = "SQLiteAsyncDialect";
	async migrate(migrations, session, config) {
		const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
		const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
		await session.run(migrationTableCreate);
		const lastDbMigration = (await session.values(sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`))[0] ?? void 0;
		await session.transaction(async (tx) => {
			for (const migration of migrations) if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
				for (const stmt of migration.sql) await tx.run(sql.raw(stmt));
				await tx.run(sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`);
			}
		});
	}
};
// node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder = class {
	static [entityKind] = "TypedQueryBuilder";
	/** @internal */
	getSelectedFields() {
		return this._.selectedFields;
	}
};
// node_modules/drizzle-orm/sqlite-core/query-builders/select.js
var SQLiteSelectBuilder = class {
	static [entityKind] = "SQLiteSelectBuilder";
	fields;
	session;
	dialect;
	withList;
	distinct;
	constructor(config) {
		this.fields = config.fields;
		this.session = config.session;
		this.dialect = config.dialect;
		this.withList = config.withList;
		this.distinct = config.distinct;
	}
	from(source) {
		const isPartialSelect = !!this.fields;
		let fields;
		if (this.fields) fields = this.fields;
		else if (is(source, Subquery)) fields = Object.fromEntries(Object.keys(source._.selectedFields).map((key) => [key, source[key]]));
		else if (is(source, SQLiteViewBase)) fields = source[ViewBaseConfig].selectedFields;
		else if (is(source, SQL)) fields = {};
		else fields = getTableColumns(source);
		return new SQLiteSelectBase({
			table: source,
			fields,
			isPartialSelect,
			session: this.session,
			dialect: this.dialect,
			withList: this.withList,
			distinct: this.distinct
		});
	}
};
var SQLiteSelectQueryBuilderBase = class extends TypedQueryBuilder {
	static [entityKind] = "SQLiteSelectQueryBuilder";
	_;
	/** @internal */
	config;
	joinsNotNullableMap;
	tableName;
	isPartialSelect;
	session;
	dialect;
	cacheConfig = void 0;
	usedTables = /* @__PURE__ */ new Set();
	constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
		super();
		this.config = {
			withList,
			table,
			fields: { ...fields },
			distinct,
			setOperators: []
		};
		this.isPartialSelect = isPartialSelect;
		this.session = session;
		this.dialect = dialect;
		this._ = {
			selectedFields: fields,
			config: this.config
		};
		this.tableName = getTableLikeName(table);
		this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
		for (const item of extractUsedTable(table)) this.usedTables.add(item);
	}
	/** @internal */
	getUsedTables() {
		return [...this.usedTables];
	}
	createJoin(joinType) {
		return (table, on) => {
			const baseTableName = this.tableName;
			const tableName = getTableLikeName(table);
			for (const item of extractUsedTable(table)) this.usedTables.add(item);
			if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) throw new Error(`Alias "${tableName}" is already used in this query`);
			if (!this.isPartialSelect) {
				if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") this.config.fields = { [baseTableName]: this.config.fields };
				if (typeof tableName === "string" && !is(table, SQL)) {
					const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
					this.config.fields[tableName] = selection;
				}
			}
			if (typeof on === "function") on = on(new Proxy(this.config.fields, new SelectionProxyHandler({
				sqlAliasedBehavior: "sql",
				sqlBehavior: "sql"
			})));
			if (!this.config.joins) this.config.joins = [];
			this.config.joins.push({
				on,
				table,
				joinType,
				alias: tableName
			});
			if (typeof tableName === "string") switch (joinType) {
				case "left":
					this.joinsNotNullableMap[tableName] = false;
					break;
				case "right":
					this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
					this.joinsNotNullableMap[tableName] = true;
					break;
				case "cross":
				case "inner":
					this.joinsNotNullableMap[tableName] = true;
					break;
				case "full":
					this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
					this.joinsNotNullableMap[tableName] = false;
			}
			return this;
		};
	}
	/**
	* Executes a `left join` operation by adding another table to the current query.
	*
	* Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
	*   .from(users)
	*   .leftJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .leftJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	leftJoin = this.createJoin("left");
	/**
	* Executes a `right join` operation by adding another table to the current query.
	*
	* Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
	*   .from(users)
	*   .rightJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .rightJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	rightJoin = this.createJoin("right");
	/**
	* Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
	*
	* Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
	*   .from(users)
	*   .innerJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .innerJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	innerJoin = this.createJoin("inner");
	/**
	* Executes a `full join` operation by combining rows from two tables into a new table.
	*
	* Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
	*   .from(users)
	*   .fullJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .fullJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	fullJoin = this.createJoin("full");
	/**
	* Executes a `cross join` operation by combining rows from two tables into a new table.
	*
	* Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
	*
	* @param table the table to join.
	*
	* @example
	*
	* ```ts
	* // Select all users, each user with every pet
	* const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
	*   .from(users)
	*   .crossJoin(pets)
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .crossJoin(pets)
	* ```
	*/
	crossJoin = this.createJoin("cross");
	createSetOperator(type, isAll) {
		return (rightSelection) => {
			const rightSelect = typeof rightSelection === "function" ? rightSelection(getSQLiteSetOperators()) : rightSelection;
			if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) throw new Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
			this.config.setOperators.push({
				type,
				isAll,
				rightSelect
			});
			return this;
		};
	}
	/**
	* Adds `union` set operator to the query.
	*
	* Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
	*
	* @example
	*
	* ```ts
	* // Select all unique names from customers and users tables
	* await db.select({ name: users.name })
	*   .from(users)
	*   .union(
	*     db.select({ name: customers.name }).from(customers)
	*   );
	* // or
	* import { union } from 'drizzle-orm/sqlite-core'
	*
	* await union(
	*   db.select({ name: users.name }).from(users),
	*   db.select({ name: customers.name }).from(customers)
	* );
	* ```
	*/
	union = this.createSetOperator("union", false);
	/**
	* Adds `union all` set operator to the query.
	*
	* Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
	*
	* @example
	*
	* ```ts
	* // Select all transaction ids from both online and in-store sales
	* await db.select({ transaction: onlineSales.transactionId })
	*   .from(onlineSales)
	*   .unionAll(
	*     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
	*   );
	* // or
	* import { unionAll } from 'drizzle-orm/sqlite-core'
	*
	* await unionAll(
	*   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
	*   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
	* );
	* ```
	*/
	unionAll = this.createSetOperator("union", true);
	/**
	* Adds `intersect` set operator to the query.
	*
	* Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
	*
	* @example
	*
	* ```ts
	* // Select course names that are offered in both departments A and B
	* await db.select({ courseName: depA.courseName })
	*   .from(depA)
	*   .intersect(
	*     db.select({ courseName: depB.courseName }).from(depB)
	*   );
	* // or
	* import { intersect } from 'drizzle-orm/sqlite-core'
	*
	* await intersect(
	*   db.select({ courseName: depA.courseName }).from(depA),
	*   db.select({ courseName: depB.courseName }).from(depB)
	* );
	* ```
	*/
	intersect = this.createSetOperator("intersect", false);
	/**
	* Adds `except` set operator to the query.
	*
	* Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
	*
	* @example
	*
	* ```ts
	* // Select all courses offered in department A but not in department B
	* await db.select({ courseName: depA.courseName })
	*   .from(depA)
	*   .except(
	*     db.select({ courseName: depB.courseName }).from(depB)
	*   );
	* // or
	* import { except } from 'drizzle-orm/sqlite-core'
	*
	* await except(
	*   db.select({ courseName: depA.courseName }).from(depA),
	*   db.select({ courseName: depB.courseName }).from(depB)
	* );
	* ```
	*/
	except = this.createSetOperator("except", false);
	/** @internal */
	addSetOperators(setOperators) {
		this.config.setOperators.push(...setOperators);
		return this;
	}
	/**
	* Adds a `where` clause to the query.
	*
	* Calling this method will select only those rows that fulfill a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#filtering}
	*
	* @param where the `where` clause.
	*
	* @example
	* You can use conditional operators and `sql function` to filter the rows to be selected.
	*
	* ```ts
	* // Select all cars with green color
	* await db.select().from(cars).where(eq(cars.color, 'green'));
	* // or
	* await db.select().from(cars).where(sql`${cars.color} = 'green'`)
	* ```
	*
	* You can logically combine conditional operators with `and()` and `or()` operators:
	*
	* ```ts
	* // Select all BMW cars with a green color
	* await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
	*
	* // Select all cars with the green or blue color
	* await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
	* ```
	*/
	where(where) {
		if (typeof where === "function") where = where(new Proxy(this.config.fields, new SelectionProxyHandler({
			sqlAliasedBehavior: "sql",
			sqlBehavior: "sql"
		})));
		this.config.where = where;
		return this;
	}
	/**
	* Adds a `having` clause to the query.
	*
	* Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
	*
	* @param having the `having` clause.
	*
	* @example
	*
	* ```ts
	* // Select all brands with more than one car
	* await db.select({
	* 	brand: cars.brand,
	* 	count: sql<number>`cast(count(${cars.id}) as int)`,
	* })
	*   .from(cars)
	*   .groupBy(cars.brand)
	*   .having(({ count }) => gt(count, 1));
	* ```
	*/
	having(having) {
		if (typeof having === "function") having = having(new Proxy(this.config.fields, new SelectionProxyHandler({
			sqlAliasedBehavior: "sql",
			sqlBehavior: "sql"
		})));
		this.config.having = having;
		return this;
	}
	groupBy(...columns) {
		if (typeof columns[0] === "function") {
			const groupBy = columns[0](new Proxy(this.config.fields, new SelectionProxyHandler({
				sqlAliasedBehavior: "alias",
				sqlBehavior: "sql"
			})));
			this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
		} else this.config.groupBy = columns;
		return this;
	}
	orderBy(...columns) {
		if (typeof columns[0] === "function") {
			const orderBy = columns[0](new Proxy(this.config.fields, new SelectionProxyHandler({
				sqlAliasedBehavior: "alias",
				sqlBehavior: "sql"
			})));
			const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
			if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).orderBy = orderByArray;
			else this.config.orderBy = orderByArray;
		} else {
			const orderByArray = columns;
			if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).orderBy = orderByArray;
			else this.config.orderBy = orderByArray;
		}
		return this;
	}
	/**
	* Adds a `limit` clause to the query.
	*
	* Calling this method will set the maximum number of rows that will be returned by this query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
	*
	* @param limit the `limit` clause.
	*
	* @example
	*
	* ```ts
	* // Get the first 10 people from this query.
	* await db.select().from(people).limit(10);
	* ```
	*/
	limit(limit) {
		if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).limit = limit;
		else this.config.limit = limit;
		return this;
	}
	/**
	* Adds an `offset` clause to the query.
	*
	* Calling this method will skip a number of rows when returning results from this query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
	*
	* @param offset the `offset` clause.
	*
	* @example
	*
	* ```ts
	* // Get the 10th-20th people from this query.
	* await db.select().from(people).offset(10).limit(10);
	* ```
	*/
	offset(offset) {
		if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).offset = offset;
		else this.config.offset = offset;
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildSelectQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	as(alias) {
		const usedTables = [];
		usedTables.push(...extractUsedTable(this.config.table));
		if (this.config.joins) for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
		return new Proxy(new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]), new SelectionProxyHandler({
			alias,
			sqlAliasedBehavior: "alias",
			sqlBehavior: "error"
		}));
	}
	/** @internal */
	getSelectedFields() {
		return new Proxy(this.config.fields, new SelectionProxyHandler({
			alias: this.tableName,
			sqlAliasedBehavior: "alias",
			sqlBehavior: "error"
		}));
	}
	$dynamic() {
		return this;
	}
};
var SQLiteSelectBase = class extends SQLiteSelectQueryBuilderBase {
	static [entityKind] = "SQLiteSelect";
	/** @internal */
	_prepare(isOneTimeQuery = true) {
		if (!this.session) throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
		const fieldsList = orderSelectedFields(this.config.fields);
		const query = this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), fieldsList, "all", true, void 0, {
			type: "select",
			tables: [...this.usedTables]
		}, this.cacheConfig);
		query.joinsNotNullableMap = this.joinsNotNullableMap;
		return query;
	}
	$withCache(config) {
		this.cacheConfig = config === void 0 ? {
			config: {},
			enable: true,
			autoInvalidate: true
		} : config === false ? { enable: false } : {
			enable: true,
			autoInvalidate: true,
			...config
		};
		return this;
	}
	prepare() {
		return this._prepare(false);
	}
	run = (placeholderValues) => {
		return this._prepare().run(placeholderValues);
	};
	all = (placeholderValues) => {
		return this._prepare().all(placeholderValues);
	};
	get = (placeholderValues) => {
		return this._prepare().get(placeholderValues);
	};
	values = (placeholderValues) => {
		return this._prepare().values(placeholderValues);
	};
	async execute() {
		return this.all();
	}
};
applyMixins(SQLiteSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
	return (leftSelect, rightSelect, ...restSelects) => {
		const setOperators = [rightSelect, ...restSelects].map((select) => ({
			type,
			isAll,
			rightSelect: select
		}));
		for (const setOperator of setOperators) if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) throw new Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
		return leftSelect.addSetOperators(setOperators);
	};
}
var getSQLiteSetOperators = () => ({
	union,
	unionAll,
	intersect,
	except
});
var union = createSetOperator("union", false);
var unionAll = createSetOperator("union", true);
var intersect = createSetOperator("intersect", false);
var except = createSetOperator("except", false);
// node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js
var QueryBuilder = class {
	static [entityKind] = "SQLiteQueryBuilder";
	dialect;
	dialectConfig;
	constructor(dialect) {
		this.dialect = is(dialect, SQLiteDialect) ? dialect : void 0;
		this.dialectConfig = is(dialect, SQLiteDialect) ? void 0 : dialect;
	}
	$with = (alias, selection) => {
		const queryBuilder = this;
		const as = (qb) => {
			if (typeof qb === "function") qb = qb(queryBuilder);
			return new Proxy(new WithSubquery(qb.getSQL(), selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}), alias, true), new SelectionProxyHandler({
				alias,
				sqlAliasedBehavior: "alias",
				sqlBehavior: "error"
			}));
		};
		return { as };
	};
	with(...queries) {
		const self = this;
		function select(fields) {
			return new SQLiteSelectBuilder({
				fields: fields ?? void 0,
				session: void 0,
				dialect: self.getDialect(),
				withList: queries
			});
		}
		function selectDistinct(fields) {
			return new SQLiteSelectBuilder({
				fields: fields ?? void 0,
				session: void 0,
				dialect: self.getDialect(),
				withList: queries,
				distinct: true
			});
		}
		return {
			select,
			selectDistinct
		};
	}
	select(fields) {
		return new SQLiteSelectBuilder({
			fields: fields ?? void 0,
			session: void 0,
			dialect: this.getDialect()
		});
	}
	selectDistinct(fields) {
		return new SQLiteSelectBuilder({
			fields: fields ?? void 0,
			session: void 0,
			dialect: this.getDialect(),
			distinct: true
		});
	}
	getDialect() {
		if (!this.dialect) this.dialect = new SQLiteSyncDialect(this.dialectConfig);
		return this.dialect;
	}
};
// node_modules/drizzle-orm/sqlite-core/query-builders/insert.js
var SQLiteInsertBuilder = class {
	constructor(table, session, dialect, withList) {
		this.table = table;
		this.session = session;
		this.dialect = dialect;
		this.withList = withList;
	}
	static [entityKind] = "SQLiteInsertBuilder";
	values(values) {
		values = Array.isArray(values) ? values : [values];
		if (values.length === 0) throw new Error("values() must be called with at least one value");
		const mappedValues = values.map((entry) => {
			const result = {};
			const cols = this.table[Table.Symbol.Columns];
			for (const colKey of Object.keys(entry)) {
				const colValue = entry[colKey];
				result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
			}
			return result;
		});
		return new SQLiteInsertBase(this.table, mappedValues, this.session, this.dialect, this.withList);
	}
	select(selectQuery) {
		const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
		if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) throw new Error("Insert select error: selected fields are not the same or are in a different order compared to the table definition");
		return new SQLiteInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
	}
};
var SQLiteInsertBase = class extends QueryPromise {
	constructor(table, values, session, dialect, withList, select) {
		super();
		this.session = session;
		this.dialect = dialect;
		this.config = {
			table,
			values,
			withList,
			select
		};
	}
	static [entityKind] = "SQLiteInsert";
	/** @internal */
	config;
	returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
		this.config.returning = orderSelectedFields(fields);
		return this;
	}
	/**
	* Adds an `on conflict do nothing` clause to the query.
	*
	* Calling this method simply avoids inserting a row as its alternative action.
	*
	* See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
	*
	* @param config The `target` and `where` clauses.
	*
	* @example
	* ```ts
	* // Insert one row and cancel the insert if there's a conflict
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoNothing();
	*
	* // Explicitly specify conflict target
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoNothing({ target: cars.id });
	* ```
	*/
	onConflictDoNothing(config = {}) {
		if (!this.config.onConflict) this.config.onConflict = [];
		if (config.target === void 0) this.config.onConflict.push(sql` on conflict do nothing`);
		else {
			const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
			const whereSql = config.where ? sql` where ${config.where}` : sql``;
			this.config.onConflict.push(sql` on conflict ${targetSql} do nothing${whereSql}`);
		}
		return this;
	}
	/**
	* Adds an `on conflict do update` clause to the query.
	*
	* Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
	*
	* See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
	*
	* @param config The `target`, `set` and `where` clauses.
	*
	* @example
	* ```ts
	* // Update the row if there's a conflict
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoUpdate({
	*     target: cars.id,
	*     set: { brand: 'Porsche' }
	*   });
	*
	* // Upsert with 'where' clause
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoUpdate({
	*     target: cars.id,
	*     set: { brand: 'newBMW' },
	*     where: sql`${cars.createdAt} > '2023-01-01'::date`,
	*   });
	* ```
	*/
	onConflictDoUpdate(config) {
		if (config.where && (config.targetWhere || config.setWhere)) throw new Error("You cannot use both \"where\" and \"targetWhere\"/\"setWhere\" at the same time - \"where\" is deprecated, use \"targetWhere\" or \"setWhere\" instead.");
		if (!this.config.onConflict) this.config.onConflict = [];
		const whereSql = config.where ? sql` where ${config.where}` : void 0;
		const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
		const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
		const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
		const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
		this.config.onConflict.push(sql` on conflict ${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`);
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildInsertQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	/** @internal */
	_prepare(isOneTimeQuery = true) {
		return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), this.config.returning, this.config.returning ? "all" : "run", true, void 0, {
			type: "insert",
			tables: extractUsedTable(this.config.table)
		});
	}
	prepare() {
		return this._prepare(false);
	}
	run = (placeholderValues) => {
		return this._prepare().run(placeholderValues);
	};
	all = (placeholderValues) => {
		return this._prepare().all(placeholderValues);
	};
	get = (placeholderValues) => {
		return this._prepare().get(placeholderValues);
	};
	values = (placeholderValues) => {
		return this._prepare().values(placeholderValues);
	};
	async execute() {
		return this.config.returning ? this.all() : this.run();
	}
	$dynamic() {
		return this;
	}
};
// node_modules/drizzle-orm/sqlite-core/query-builders/update.js
var SQLiteUpdateBuilder = class {
	constructor(table, session, dialect, withList) {
		this.table = table;
		this.session = session;
		this.dialect = dialect;
		this.withList = withList;
	}
	static [entityKind] = "SQLiteUpdateBuilder";
	set(values) {
		return new SQLiteUpdateBase(this.table, mapUpdateSet(this.table, values), this.session, this.dialect, this.withList);
	}
};
var SQLiteUpdateBase = class extends QueryPromise {
	constructor(table, set, session, dialect, withList) {
		super();
		this.session = session;
		this.dialect = dialect;
		this.config = {
			set,
			table,
			withList,
			joins: []
		};
	}
	static [entityKind] = "SQLiteUpdate";
	/** @internal */
	config;
	from(source) {
		this.config.from = source;
		return this;
	}
	createJoin(joinType) {
		return (table, on) => {
			const tableName = getTableLikeName(table);
			if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) throw new Error(`Alias "${tableName}" is already used in this query`);
			if (typeof on === "function") {
				const from = this.config.from ? is(table, SQLiteTable) ? table[Table.Symbol.Columns] : is(table, Subquery) ? table._.selectedFields : is(table, SQLiteViewBase) ? table[ViewBaseConfig].selectedFields : void 0 : void 0;
				on = on(new Proxy(this.config.table[Table.Symbol.Columns], new SelectionProxyHandler({
					sqlAliasedBehavior: "sql",
					sqlBehavior: "sql"
				})), from && new Proxy(from, new SelectionProxyHandler({
					sqlAliasedBehavior: "sql",
					sqlBehavior: "sql"
				})));
			}
			this.config.joins.push({
				on,
				table,
				joinType,
				alias: tableName
			});
			return this;
		};
	}
	leftJoin = this.createJoin("left");
	rightJoin = this.createJoin("right");
	innerJoin = this.createJoin("inner");
	fullJoin = this.createJoin("full");
	/**
	* Adds a 'where' clause to the query.
	*
	* Calling this method will update only those rows that fulfill a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/update}
	*
	* @param where the 'where' clause.
	*
	* @example
	* You can use conditional operators and `sql function` to filter the rows to be updated.
	*
	* ```ts
	* // Update all cars with green color
	* db.update(cars).set({ color: 'red' })
	*   .where(eq(cars.color, 'green'));
	* // or
	* db.update(cars).set({ color: 'red' })
	*   .where(sql`${cars.color} = 'green'`)
	* ```
	*
	* You can logically combine conditional operators with `and()` and `or()` operators:
	*
	* ```ts
	* // Update all BMW cars with a green color
	* db.update(cars).set({ color: 'red' })
	*   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
	*
	* // Update all cars with the green or blue color
	* db.update(cars).set({ color: 'red' })
	*   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
	* ```
	*/
	where(where) {
		this.config.where = where;
		return this;
	}
	orderBy(...columns) {
		if (typeof columns[0] === "function") {
			const orderBy = columns[0](new Proxy(this.config.table[Table.Symbol.Columns], new SelectionProxyHandler({
				sqlAliasedBehavior: "alias",
				sqlBehavior: "sql"
			})));
			const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
			this.config.orderBy = orderByArray;
		} else {
			const orderByArray = columns;
			this.config.orderBy = orderByArray;
		}
		return this;
	}
	limit(limit) {
		this.config.limit = limit;
		return this;
	}
	returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
		this.config.returning = orderSelectedFields(fields);
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildUpdateQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	/** @internal */
	_prepare(isOneTimeQuery = true) {
		return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), this.config.returning, this.config.returning ? "all" : "run", true, void 0, {
			type: "insert",
			tables: extractUsedTable(this.config.table)
		});
	}
	prepare() {
		return this._prepare(false);
	}
	run = (placeholderValues) => {
		return this._prepare().run(placeholderValues);
	};
	all = (placeholderValues) => {
		return this._prepare().all(placeholderValues);
	};
	get = (placeholderValues) => {
		return this._prepare().get(placeholderValues);
	};
	values = (placeholderValues) => {
		return this._prepare().values(placeholderValues);
	};
	async execute() {
		return this.config.returning ? this.all() : this.run();
	}
	$dynamic() {
		return this;
	}
};
// node_modules/drizzle-orm/sqlite-core/query-builders/count.js
var SQLiteCountBuilder = class SQLiteCountBuilder extends SQL {
	constructor(params) {
		super(SQLiteCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
		this.params = params;
		this.session = params.session;
		this.sql = SQLiteCountBuilder.buildCount(params.source, params.filters);
	}
	sql;
	static [entityKind] = "SQLiteCountBuilderAsync";
	[Symbol.toStringTag] = "SQLiteCountBuilderAsync";
	session;
	static buildEmbeddedCount(source, filters) {
		return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
	}
	static buildCount(source, filters) {
		return sql`select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters}`;
	}
	then(onfulfilled, onrejected) {
		return Promise.resolve(this.session.count(this.sql)).then(onfulfilled, onrejected);
	}
	catch(onRejected) {
		return this.then(void 0, onRejected);
	}
	finally(onFinally) {
		return this.then((value) => {
			onFinally?.();
			return value;
		}, (reason) => {
			onFinally?.();
			throw reason;
		});
	}
};
// node_modules/drizzle-orm/sqlite-core/query-builders/query.js
var RelationalQueryBuilder = class {
	constructor(mode, fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
		this.mode = mode;
		this.fullSchema = fullSchema;
		this.schema = schema;
		this.tableNamesMap = tableNamesMap;
		this.table = table;
		this.tableConfig = tableConfig;
		this.dialect = dialect;
		this.session = session;
	}
	static [entityKind] = "SQLiteAsyncRelationalQueryBuilder";
	findMany(config) {
		return this.mode === "sync" ? new SQLiteSyncRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? config : {}, "many") : new SQLiteRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? config : {}, "many");
	}
	findFirst(config) {
		return this.mode === "sync" ? new SQLiteSyncRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? {
			...config,
			limit: 1
		} : { limit: 1 }, "first") : new SQLiteRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? {
			...config,
			limit: 1
		} : { limit: 1 }, "first");
	}
};
var SQLiteRelationalQuery = class extends QueryPromise {
	constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
		super();
		this.fullSchema = fullSchema;
		this.schema = schema;
		this.tableNamesMap = tableNamesMap;
		this.table = table;
		this.tableConfig = tableConfig;
		this.dialect = dialect;
		this.session = session;
		this.config = config;
		this.mode = mode;
	}
	static [entityKind] = "SQLiteAsyncRelationalQuery";
	/** @internal */
	mode;
	/** @internal */
	getSQL() {
		return this.dialect.buildRelationalQuery({
			fullSchema: this.fullSchema,
			schema: this.schema,
			tableNamesMap: this.tableNamesMap,
			table: this.table,
			tableConfig: this.tableConfig,
			queryConfig: this.config,
			tableAlias: this.tableConfig.tsName
		}).sql;
	}
	/** @internal */
	_prepare(isOneTimeQuery = false) {
		const { query, builtQuery } = this._toSQL();
		return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](builtQuery, void 0, this.mode === "first" ? "get" : "all", true, (rawRows, mapColumnValue) => {
			const rows = rawRows.map((row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue));
			if (this.mode === "first") return rows[0];
			return rows;
		});
	}
	prepare() {
		return this._prepare(false);
	}
	_toSQL() {
		const query = this.dialect.buildRelationalQuery({
			fullSchema: this.fullSchema,
			schema: this.schema,
			tableNamesMap: this.tableNamesMap,
			table: this.table,
			tableConfig: this.tableConfig,
			queryConfig: this.config,
			tableAlias: this.tableConfig.tsName
		});
		return {
			query,
			builtQuery: this.dialect.sqlToQuery(query.sql)
		};
	}
	toSQL() {
		return this._toSQL().builtQuery;
	}
	/** @internal */
	executeRaw() {
		if (this.mode === "first") return this._prepare(false).get();
		return this._prepare(false).all();
	}
	async execute() {
		return this.executeRaw();
	}
};
var SQLiteSyncRelationalQuery = class extends SQLiteRelationalQuery {
	static [entityKind] = "SQLiteSyncRelationalQuery";
	sync() {
		return this.executeRaw();
	}
};
// node_modules/drizzle-orm/sqlite-core/query-builders/raw.js
var SQLiteRaw = class extends QueryPromise {
	constructor(execute, getSQL, action, dialect, mapBatchResult) {
		super();
		this.execute = execute;
		this.getSQL = getSQL;
		this.dialect = dialect;
		this.mapBatchResult = mapBatchResult;
		this.config = { action };
	}
	static [entityKind] = "SQLiteRaw";
	/** @internal */
	config;
	getQuery() {
		return {
			...this.dialect.sqlToQuery(this.getSQL()),
			method: this.config.action
		};
	}
	mapResult(result, isFromBatch) {
		return isFromBatch ? this.mapBatchResult(result) : result;
	}
	_prepare() {
		return this;
	}
	/** @internal */
	isResponseInArrayMode() {
		return false;
	}
};
// node_modules/drizzle-orm/sqlite-core/db.js
var BaseSQLiteDatabase = class {
	constructor(resultKind, dialect, session, schema) {
		this.resultKind = resultKind;
		this.dialect = dialect;
		this.session = session;
		this._ = schema ? {
			schema: schema.schema,
			fullSchema: schema.fullSchema,
			tableNamesMap: schema.tableNamesMap
		} : {
			schema: void 0,
			fullSchema: {},
			tableNamesMap: {}
		};
		this.query = {};
		const query = this.query;
		if (this._.schema) for (const [tableName, columns] of Object.entries(this._.schema)) query[tableName] = new RelationalQueryBuilder(resultKind, schema.fullSchema, this._.schema, this._.tableNamesMap, schema.fullSchema[tableName], columns, dialect, session);
		this.$cache = { invalidate: async (_params) => {} };
	}
	static [entityKind] = "BaseSQLiteDatabase";
	query;
	/**
	* Creates a subquery that defines a temporary named result set as a CTE.
	*
	* It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
	*
	* @param alias The alias for the subquery.
	*
	* Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
	*
	* @example
	*
	* ```ts
	* // Create a subquery with alias 'sq' and use it in the select query
	* const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
	*
	* const result = await db.with(sq).select().from(sq);
	* ```
	*
	* To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
	*
	* ```ts
	* // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
	* const sq = db.$with('sq').as(db.select({
	*   name: sql<string>`upper(${users.name})`.as('name'),
	* })
	* .from(users));
	*
	* const result = await db.with(sq).select({ name: sq.name }).from(sq);
	* ```
	*/
	$with = (alias, selection) => {
		const self = this;
		const as = (qb) => {
			if (typeof qb === "function") qb = qb(new QueryBuilder(self.dialect));
			return new Proxy(new WithSubquery(qb.getSQL(), selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}), alias, true), new SelectionProxyHandler({
				alias,
				sqlAliasedBehavior: "alias",
				sqlBehavior: "error"
			}));
		};
		return { as };
	};
	$count(source, filters) {
		return new SQLiteCountBuilder({
			source,
			filters,
			session: this.session
		});
	}
	/**
	* Incorporates a previously defined CTE (using `$with`) into the main query.
	*
	* This method allows the main query to reference a temporary named result set.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
	*
	* @param queries The CTEs to incorporate into the main query.
	*
	* @example
	*
	* ```ts
	* // Define a subquery 'sq' as a CTE using $with
	* const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
	*
	* // Incorporate the CTE 'sq' into the main query and select from it
	* const result = await db.with(sq).select().from(sq);
	* ```
	*/
	with(...queries) {
		const self = this;
		function select(fields) {
			return new SQLiteSelectBuilder({
				fields: fields ?? void 0,
				session: self.session,
				dialect: self.dialect,
				withList: queries
			});
		}
		function selectDistinct(fields) {
			return new SQLiteSelectBuilder({
				fields: fields ?? void 0,
				session: self.session,
				dialect: self.dialect,
				withList: queries,
				distinct: true
			});
		}
		function update(table) {
			return new SQLiteUpdateBuilder(table, self.session, self.dialect, queries);
		}
		function insert(into) {
			return new SQLiteInsertBuilder(into, self.session, self.dialect, queries);
		}
		function delete_(from) {
			return new SQLiteDeleteBase(from, self.session, self.dialect, queries);
		}
		return {
			select,
			selectDistinct,
			update,
			insert,
			delete: delete_
		};
	}
	select(fields) {
		return new SQLiteSelectBuilder({
			fields: fields ?? void 0,
			session: this.session,
			dialect: this.dialect
		});
	}
	selectDistinct(fields) {
		return new SQLiteSelectBuilder({
			fields: fields ?? void 0,
			session: this.session,
			dialect: this.dialect,
			distinct: true
		});
	}
	/**
	* Creates an update query.
	*
	* Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
	*
	* Use `.set()` method to specify which values to update.
	*
	* See docs: {@link https://orm.drizzle.team/docs/update}
	*
	* @param table The table to update.
	*
	* @example
	*
	* ```ts
	* // Update all rows in the 'cars' table
	* await db.update(cars).set({ color: 'red' });
	*
	* // Update rows with filters and conditions
	* await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
	*
	* // Update with returning clause
	* const updatedCar: Car[] = await db.update(cars)
	*   .set({ color: 'red' })
	*   .where(eq(cars.id, 1))
	*   .returning();
	* ```
	*/
	update(table) {
		return new SQLiteUpdateBuilder(table, this.session, this.dialect);
	}
	$cache;
	/**
	* Creates an insert query.
	*
	* Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
	*
	* See docs: {@link https://orm.drizzle.team/docs/insert}
	*
	* @param table The table to insert into.
	*
	* @example
	*
	* ```ts
	* // Insert one row
	* await db.insert(cars).values({ brand: 'BMW' });
	*
	* // Insert multiple rows
	* await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
	*
	* // Insert with returning clause
	* const insertedCar: Car[] = await db.insert(cars)
	*   .values({ brand: 'BMW' })
	*   .returning();
	* ```
	*/
	insert(into) {
		return new SQLiteInsertBuilder(into, this.session, this.dialect);
	}
	/**
	* Creates a delete query.
	*
	* Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
	*
	* See docs: {@link https://orm.drizzle.team/docs/delete}
	*
	* @param table The table to delete from.
	*
	* @example
	*
	* ```ts
	* // Delete all rows in the 'cars' table
	* await db.delete(cars);
	*
	* // Delete rows with filters and conditions
	* await db.delete(cars).where(eq(cars.color, 'green'));
	*
	* // Delete with returning clause
	* const deletedCar: Car[] = await db.delete(cars)
	*   .where(eq(cars.id, 1))
	*   .returning();
	* ```
	*/
	delete(from) {
		return new SQLiteDeleteBase(from, this.session, this.dialect);
	}
	run(query) {
		const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
		if (this.resultKind === "async") return new SQLiteRaw(async () => this.session.run(sequel), () => sequel, "run", this.dialect, this.session.extractRawRunValueFromBatchResult.bind(this.session));
		return this.session.run(sequel);
	}
	all(query) {
		const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
		if (this.resultKind === "async") return new SQLiteRaw(async () => this.session.all(sequel), () => sequel, "all", this.dialect, this.session.extractRawAllValueFromBatchResult.bind(this.session));
		return this.session.all(sequel);
	}
	get(query) {
		const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
		if (this.resultKind === "async") return new SQLiteRaw(async () => this.session.get(sequel), () => sequel, "get", this.dialect, this.session.extractRawGetValueFromBatchResult.bind(this.session));
		return this.session.get(sequel);
	}
	values(query) {
		const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
		if (this.resultKind === "async") return new SQLiteRaw(async () => this.session.values(sequel), () => sequel, "values", this.dialect, this.session.extractRawValuesValueFromBatchResult.bind(this.session));
		return this.session.values(sequel);
	}
	transaction(transaction, config) {
		return this.session.transaction(transaction, config);
	}
};
// node_modules/drizzle-orm/cache/core/cache.js
var Cache = class {
	static [entityKind] = "Cache";
};
var NoopCache = class extends Cache {
	strategy() {
		return "all";
	}
	static [entityKind] = "NoopCache";
	async get(_key) {}
	async put(_hashedQuery, _response, _tables, _config) {}
	async onMutate(_params) {}
};
async function hashQuery(sql, params) {
	const dataToHash = `${sql}-${JSON.stringify(params)}`;
	const data = new TextEncoder().encode(dataToHash);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// node_modules/drizzle-orm/sqlite-core/session.js
var ExecuteResultSync = class extends QueryPromise {
	constructor(resultCb) {
		super();
		this.resultCb = resultCb;
	}
	static [entityKind] = "ExecuteResultSync";
	async execute() {
		return this.resultCb();
	}
	sync() {
		return this.resultCb();
	}
};
var SQLitePreparedQuery = class {
	constructor(mode, executeMethod, query, cache, queryMetadata, cacheConfig) {
		this.mode = mode;
		this.executeMethod = executeMethod;
		this.query = query;
		this.cache = cache;
		this.queryMetadata = queryMetadata;
		this.cacheConfig = cacheConfig;
		if (cache && cache.strategy() === "all" && cacheConfig === void 0) this.cacheConfig = {
			enable: true,
			autoInvalidate: true
		};
		if (!this.cacheConfig?.enable) this.cacheConfig = void 0;
	}
	static [entityKind] = "PreparedQuery";
	/** @internal */
	joinsNotNullableMap;
	/** @internal */
	async queryWithCache(queryString, params, query) {
		if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) try {
			return await query();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if (this.cacheConfig && !this.cacheConfig.enable) try {
			return await query();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) try {
			const [res] = await Promise.all([query(), this.cache.onMutate({ tables: this.queryMetadata.tables })]);
			return res;
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if (!this.cacheConfig) try {
			return await query();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if (this.queryMetadata.type === "select") {
			const fromCache = await this.cache.get(this.cacheConfig.tag ?? await hashQuery(queryString, params), this.queryMetadata.tables, this.cacheConfig.tag !== void 0, this.cacheConfig.autoInvalidate);
			if (fromCache === void 0) {
				let result;
				try {
					result = await query();
				} catch (e) {
					throw new DrizzleQueryError(queryString, params, e);
				}
				await this.cache.put(this.cacheConfig.tag ?? await hashQuery(queryString, params), result, this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [], this.cacheConfig.tag !== void 0, this.cacheConfig.config);
				return result;
			}
			return fromCache;
		}
		try {
			return await query();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
	}
	getQuery() {
		return this.query;
	}
	mapRunResult(result, _isFromBatch) {
		return result;
	}
	mapAllResult(_result, _isFromBatch) {
		throw new Error("Not implemented");
	}
	mapGetResult(_result, _isFromBatch) {
		throw new Error("Not implemented");
	}
	execute(placeholderValues) {
		if (this.mode === "async") return this[this.executeMethod](placeholderValues);
		return new ExecuteResultSync(() => this[this.executeMethod](placeholderValues));
	}
	mapResult(response, isFromBatch) {
		switch (this.executeMethod) {
			case "run": return this.mapRunResult(response, isFromBatch);
			case "all": return this.mapAllResult(response, isFromBatch);
			case "get": return this.mapGetResult(response, isFromBatch);
		}
	}
};
var SQLiteSession = class {
	constructor(dialect) {
		this.dialect = dialect;
	}
	static [entityKind] = "SQLiteSession";
	prepareOneTimeQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
		return this.prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig);
	}
	run(query) {
		const staticQuery = this.dialect.sqlToQuery(query);
		try {
			return this.prepareOneTimeQuery(staticQuery, void 0, "run", false).run();
		} catch (err) {
			throw new DrizzleError({
				cause: err,
				message: `Failed to run the query '${staticQuery.sql}'`
			});
		}
	}
	/** @internal */
	extractRawRunValueFromBatchResult(result) {
		return result;
	}
	all(query) {
		return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).all();
	}
	/** @internal */
	extractRawAllValueFromBatchResult(_result) {
		throw new Error("Not implemented");
	}
	get(query) {
		return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).get();
	}
	/** @internal */
	extractRawGetValueFromBatchResult(_result) {
		throw new Error("Not implemented");
	}
	values(query) {
		return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).values();
	}
	async count(sql) {
		return (await this.values(sql))[0][0];
	}
	/** @internal */
	extractRawValuesValueFromBatchResult(_result) {
		throw new Error("Not implemented");
	}
};
var SQLiteTransaction = class extends BaseSQLiteDatabase {
	constructor(resultType, dialect, session, schema, nestedIndex = 0) {
		super(resultType, dialect, session, schema);
		this.schema = schema;
		this.nestedIndex = nestedIndex;
	}
	static [entityKind] = "SQLiteTransaction";
	rollback() {
		throw new TransactionRollbackError();
	}
};
// node_modules/drizzle-orm/d1/session.js
var SQLiteD1Session = class extends SQLiteSession {
	constructor(client, dialect, schema, options = {}) {
		super(dialect);
		this.client = client;
		this.schema = schema;
		this.options = options;
		this.logger = options.logger ?? new NoopLogger();
		this.cache = options.cache ?? new NoopCache();
	}
	static [entityKind] = "SQLiteD1Session";
	logger;
	cache;
	prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
		return new D1PreparedQuery(this.client.prepare(query.sql), query, this.logger, this.cache, queryMetadata, cacheConfig, fields, executeMethod, isResponseInArrayMode, customResultMapper);
	}
	async batch(queries) {
		const preparedQueries = [];
		const builtQueries = [];
		for (const query of queries) {
			const preparedQuery = query._prepare();
			const builtQuery = preparedQuery.getQuery();
			preparedQueries.push(preparedQuery);
			if (builtQuery.params.length > 0) builtQueries.push(preparedQuery.stmt.bind(...builtQuery.params));
			else {
				const builtQuery2 = preparedQuery.getQuery();
				builtQueries.push(this.client.prepare(builtQuery2.sql).bind(...builtQuery2.params));
			}
		}
		return (await this.client.batch(builtQueries)).map((result, i) => preparedQueries[i].mapResult(result, true));
	}
	extractRawAllValueFromBatchResult(result) {
		return result.results;
	}
	extractRawGetValueFromBatchResult(result) {
		return result.results[0];
	}
	extractRawValuesValueFromBatchResult(result) {
		return d1ToRawMapping(result.results);
	}
	async transaction(transaction, config) {
		const tx = new D1Transaction("async", this.dialect, this, this.schema);
		await this.run(sql.raw(`begin${config?.behavior ? " " + config.behavior : ""}`));
		try {
			const result = await transaction(tx);
			await this.run(sql`commit`);
			return result;
		} catch (err) {
			await this.run(sql`rollback`);
			throw err;
		}
	}
};
var D1Transaction = class D1Transaction extends SQLiteTransaction {
	static [entityKind] = "D1Transaction";
	async transaction(transaction) {
		const savepointName = `sp${this.nestedIndex}`;
		const tx = new D1Transaction("async", this.dialect, this.session, this.schema, this.nestedIndex + 1);
		await this.session.run(sql.raw(`savepoint ${savepointName}`));
		try {
			const result = await transaction(tx);
			await this.session.run(sql.raw(`release savepoint ${savepointName}`));
			return result;
		} catch (err) {
			await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
			throw err;
		}
	}
};
function d1ToRawMapping(results) {
	const rows = [];
	for (const row of results) {
		const entry = Object.keys(row).map((k) => row[k]);
		rows.push(entry);
	}
	return rows;
}
var D1PreparedQuery = class extends SQLitePreparedQuery {
	constructor(stmt, query, logger, cache, queryMetadata, cacheConfig, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
		super("async", executeMethod, query, cache, queryMetadata, cacheConfig);
		this.logger = logger;
		this._isResponseInArrayMode = _isResponseInArrayMode;
		this.customResultMapper = customResultMapper;
		this.fields = fields;
		this.stmt = stmt;
	}
	static [entityKind] = "D1PreparedQuery";
	/** @internal */
	customResultMapper;
	/** @internal */
	fields;
	/** @internal */
	stmt;
	async run(placeholderValues) {
		const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
		this.logger.logQuery(this.query.sql, params);
		return await this.queryWithCache(this.query.sql, params, async () => {
			return this.stmt.bind(...params).run();
		});
	}
	async all(placeholderValues) {
		const { fields, query, logger, stmt, customResultMapper } = this;
		if (!fields && !customResultMapper) {
			const params = fillPlaceholders(query.params, placeholderValues ?? {});
			logger.logQuery(query.sql, params);
			return await this.queryWithCache(query.sql, params, async () => {
				return stmt.bind(...params).all().then(({ results }) => this.mapAllResult(results));
			});
		}
		const rows = await this.values(placeholderValues);
		return this.mapAllResult(rows);
	}
	mapAllResult(rows, isFromBatch) {
		if (isFromBatch) rows = d1ToRawMapping(rows.results);
		if (!this.fields && !this.customResultMapper) return rows;
		if (this.customResultMapper) return this.customResultMapper(rows);
		return rows.map((row) => mapResultRow(this.fields, row, this.joinsNotNullableMap));
	}
	async get(placeholderValues) {
		const { fields, joinsNotNullableMap, query, logger, stmt, customResultMapper } = this;
		if (!fields && !customResultMapper) {
			const params = fillPlaceholders(query.params, placeholderValues ?? {});
			logger.logQuery(query.sql, params);
			return await this.queryWithCache(query.sql, params, async () => {
				return stmt.bind(...params).all().then(({ results }) => results[0]);
			});
		}
		const rows = await this.values(placeholderValues);
		if (!rows[0]) return;
		if (customResultMapper) return customResultMapper(rows);
		return mapResultRow(fields, rows[0], joinsNotNullableMap);
	}
	mapGetResult(result, isFromBatch) {
		if (isFromBatch) result = d1ToRawMapping(result.results)[0];
		if (!this.fields && !this.customResultMapper) return result;
		if (this.customResultMapper) return this.customResultMapper([result]);
		return mapResultRow(this.fields, result, this.joinsNotNullableMap);
	}
	async values(placeholderValues) {
		const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
		this.logger.logQuery(this.query.sql, params);
		return await this.queryWithCache(this.query.sql, params, async () => {
			return this.stmt.bind(...params).raw();
		});
	}
	/** @internal */
	isResponseInArrayMode() {
		return this._isResponseInArrayMode;
	}
};
// node_modules/drizzle-orm/d1/driver.js
var DrizzleD1Database = class extends BaseSQLiteDatabase {
	static [entityKind] = "D1Database";
	async batch(batch) {
		return this.session.batch(batch);
	}
};
function drizzle(client, config = {}) {
	const dialect = new SQLiteAsyncDialect({ casing: config.casing });
	let logger;
	if (config.logger === true) logger = new DefaultLogger();
	else if (config.logger !== false) logger = config.logger;
	let schema;
	if (config.schema) {
		const tablesConfig = extractTablesRelationalConfig(config.schema, createTableRelationsHelpers);
		schema = {
			fullSchema: config.schema,
			schema: tablesConfig.tables,
			tableNamesMap: tablesConfig.tableNamesMap
		};
	}
	const db = new DrizzleD1Database("async", dialect, new SQLiteD1Session(client, dialect, schema, {
		logger,
		cache: config.cache
	}), schema);
	db.$client = client;
	db.$cache = config.cache;
	if (db.$cache) db.$cache["invalidate"] = config.cache?.onMutate;
	return db;
}
// db/schema.ts
/**
* Brightloop database schema (Cloudflare D1 / SQLite).
*
* Conventions
* - Primary keys are text UUIDs generated in the worker (crypto.randomUUID()).
* - Money is stored as INTEGER minor units (paise/cents). Never floats.
* - Percentages are stored as INTEGER basis points (18% = 1800).
* - Dates are ISO strings: `YYYY-MM-DD` for calendar dates, full ISO for timestamps.
* - Every foreign key is indexed.
*
* Ownership of each table is documented in docs/database-schema.md.
* Change this file only through a reviewed PR; then run `npm run db:generate`.
*/
var schema_exports = /* @__PURE__ */ __exportAll({
	auditLog: () => auditLog,
	billingRuns: () => billingRuns,
	cancellationRequests: () => cancellationRequests$1,
	counters: () => counters,
	customerActivity: () => customerActivity$1,
	customerNotes: () => customerNotes$1,
	customers: () => customers$7,
	discountProducts: () => discountProducts$1,
	discountRedemptions: () => discountRedemptions$1,
	discounts: () => discounts$2,
	findings: () => findings,
	invoiceLines: () => invoiceLines$1,
	invoices: () => invoices$4,
	notifications: () => notifications,
	passwordResetTokens: () => passwordResetTokens,
	paymentReminders: () => paymentReminders,
	payments: () => payments$3,
	plans: () => plans$8,
	productTaxes: () => productTaxes$1,
	productVariants: () => productVariants$2,
	products: () => products$3,
	quotationTemplateLines: () => quotationTemplateLines,
	quotationTemplates: () => quotationTemplates,
	rateLimits: () => rateLimits,
	renewalTasks: () => renewalTasks,
	sessions: () => sessions,
	settings: () => settings,
	subscriptionLines: () => subscriptionLines$2,
	subscriptionStatusHistory: () => subscriptionStatusHistory$1,
	subscriptions: () => subscriptions$7,
	taxes: () => taxes$2,
	users: () => users$2
});
var id = () => text("id").primaryKey();
var createdAt = () => text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
var updatedAt = () => text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
var bool = (name) => integer(name, { mode: "boolean" });
var users$2 = sqliteTable("users", {
	id: id(),
	email: text("email").notNull(),
	passwordHash: text("password_hash").notNull(),
	name: text("name").notNull(),
	role: text("role", { enum: [
		"admin",
		"staff",
		"customer"
	] }).notNull(),
	isActive: bool("is_active").notNull().default(true),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_role_idx").on(t.role)]);
var sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => users$2.id, { onDelete: "cascade" }),
	expiresAt: text("expires_at").notNull(),
	createdAt: createdAt()
}, (t) => [index("sessions_user_idx").on(t.userId)]);
var passwordResetTokens = sqliteTable("password_reset_tokens", {
	id: id(),
	userId: text("user_id").notNull().references(() => users$2.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull(),
	expiresAt: text("expires_at").notNull(),
	usedAt: text("used_at"),
	createdAt: createdAt()
}, (t) => [uniqueIndex("password_reset_tokens_hash_uq").on(t.tokenHash), index("password_reset_tokens_user_idx").on(t.userId)]);
var rateLimits = sqliteTable("rate_limits", {
	key: text("key").primaryKey(),
	windowStart: integer("window_start").notNull(),
	count: integer("count").notNull()
});
var customers$7 = sqliteTable("customers", {
	id: id(),
	userId: text("user_id").references(() => users$2.id, { onDelete: "set null" }),
	email: text("email").notNull(),
	companyName: text("company_name"),
	contactName: text("contact_name").notNull(),
	phone: text("phone"),
	billingAddress: text("billing_address"),
	taxId: text("tax_id"),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [
	uniqueIndex("customers_user_uq").on(t.userId),
	uniqueIndex("customers_email_uq").on(t.email),
	index("customers_contact_idx").on(t.contactName),
	index("customers_created_idx").on(t.createdAt)
]);
var settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value", { mode: "json" }).notNull(),
	updatedAt: updatedAt()
});
/** Monotonic counters for human-readable numbers (SUB-000123, INV-000456). */
var counters = sqliteTable("counters", {
	name: text("name").primaryKey(),
	value: integer("value").notNull().default(0)
});
var auditLog = sqliteTable("audit_log", {
	id: id(),
	actorId: text("actor_id").references(() => users$2.id, { onDelete: "set null" }),
	action: text("action").notNull(),
	entity: text("entity").notNull(),
	entityId: text("entity_id"),
	meta: text("meta", { mode: "json" }),
	createdAt: createdAt()
}, (t) => [
	index("audit_log_entity_idx").on(t.entity, t.entityId),
	index("audit_log_actor_idx").on(t.actorId),
	index("audit_log_created_idx").on(t.createdAt)
]);
/** Outbox for every email/in-app message. In `outbox` mode messages are simulated, never sent. */
var notifications = sqliteTable("notifications", {
	id: id(),
	channel: text("channel", { enum: ["email", "in_app"] }).notNull(),
	userId: text("user_id").references(() => users$2.id, { onDelete: "set null" }),
	recipient: text("recipient").notNull(),
	subject: text("subject").notNull(),
	body: text("body").notNull(),
	status: text("status", { enum: [
		"simulated",
		"sent",
		"failed"
	] }).notNull(),
	entity: text("entity"),
	entityId: text("entity_id"),
	readAt: text("read_at"),
	createdAt: createdAt()
}, (t) => [index("notifications_user_idx").on(t.userId), index("notifications_entity_idx").on(t.entity, t.entityId)]);
var products$3 = sqliteTable("products", {
	id: id(),
	name: text("name").notNull(),
	type: text("type", { enum: [
		"service",
		"goods",
		"software"
	] }).notNull(),
	salesPrice: integer("sales_price").notNull(),
	costPrice: integer("cost_price").notNull().default(0),
	notes: text("notes"),
	isActive: bool("is_active").notNull().default(true),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [index("products_name_idx").on(t.name), index("products_active_idx").on(t.isActive)]);
var productVariants$2 = sqliteTable("product_variants", {
	id: id(),
	productId: text("product_id").notNull().references(() => products$3.id, { onDelete: "cascade" }),
	attribute: text("attribute").notNull(),
	value: text("value").notNull(),
	extraPrice: integer("extra_price").notNull().default(0),
	createdAt: createdAt()
}, (t) => [index("product_variants_product_idx").on(t.productId), uniqueIndex("product_variants_uq").on(t.productId, t.attribute, t.value)]);
var taxes$2 = sqliteTable("taxes", {
	id: id(),
	name: text("name").notNull(),
	kind: text("kind", { enum: ["percentage", "fixed"] }).notNull(),
	/** Basis points for `percentage`, minor units per unit for `fixed`. */
	rate: integer("rate").notNull(),
	isActive: bool("is_active").notNull().default(true),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});
var productTaxes$1 = sqliteTable("product_taxes", {
	productId: text("product_id").notNull().references(() => products$3.id, { onDelete: "cascade" }),
	taxId: text("tax_id").notNull().references(() => taxes$2.id, { onDelete: "cascade" })
}, (t) => [primaryKey({ columns: [t.productId, t.taxId] }), index("product_taxes_tax_idx").on(t.taxId)]);
var plans$8 = sqliteTable("plans", {
	id: id(),
	name: text("name").notNull(),
	price: integer("price").notNull(),
	billingPeriod: text("billing_period", { enum: [
		"daily",
		"weekly",
		"monthly",
		"yearly"
	] }).notNull(),
	minQuantity: integer("min_quantity").notNull().default(1),
	availableFrom: text("available_from").notNull(),
	availableTo: text("available_to"),
	autoClose: bool("auto_close").notNull().default(false),
	closable: bool("closable").notNull().default(true),
	pausable: bool("pausable").notNull().default(false),
	renewable: bool("renewable").notNull().default(true),
	status: text("status", { enum: ["active", "closed"] }).notNull().default("active"),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [index("plans_status_idx").on(t.status)]);
var discounts$2 = sqliteTable("discounts", {
	id: id(),
	name: text("name").notNull(),
	kind: text("kind", { enum: ["fixed", "percentage"] }).notNull(),
	/** Basis points for `percentage`, minor units for `fixed`. */
	value: integer("value").notNull(),
	minPurchase: integer("min_purchase").notNull().default(0),
	minQuantity: integer("min_quantity").notNull().default(0),
	startsOn: text("starts_on").notNull(),
	endsOn: text("ends_on"),
	usageLimit: integer("usage_limit"),
	usageCount: integer("usage_count").notNull().default(0),
	scope: text("scope", { enum: ["product", "subscription"] }).notNull(),
	isActive: bool("is_active").notNull().default(true),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [index("discounts_dates_idx").on(t.startsOn, t.endsOn)]);
var discountProducts$1 = sqliteTable("discount_products", {
	discountId: text("discount_id").notNull().references(() => discounts$2.id, { onDelete: "cascade" }),
	productId: text("product_id").notNull().references(() => products$3.id, { onDelete: "cascade" })
}, (t) => [primaryKey({ columns: [t.discountId, t.productId] }), index("discount_products_product_idx").on(t.productId)]);
var quotationTemplates = sqliteTable("quotation_templates", {
	id: id(),
	name: text("name").notNull(),
	planId: text("plan_id").notNull().references(() => plans$8.id),
	validityDays: integer("validity_days").notNull().default(30),
	paymentTermDays: integer("payment_term_days").notNull().default(15),
	createdBy: text("created_by").references(() => users$2.id, { onDelete: "set null" }),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [index("quotation_templates_plan_idx").on(t.planId), index("quotation_templates_creator_idx").on(t.createdBy)]);
var quotationTemplateLines = sqliteTable("quotation_template_lines", {
	id: id(),
	templateId: text("template_id").notNull().references(() => quotationTemplates.id, { onDelete: "cascade" }),
	productId: text("product_id").notNull().references(() => products$3.id),
	variantId: text("variant_id").references(() => productVariants$2.id, { onDelete: "set null" }),
	quantity: integer("quantity").notNull().default(1)
}, (t) => [
	index("qt_lines_template_idx").on(t.templateId),
	index("qt_lines_product_idx").on(t.productId),
	index("qt_lines_variant_idx").on(t.variantId)
]);
var subscriptions$7 = sqliteTable("subscriptions", {
	id: id(),
	number: text("number").notNull(),
	customerId: text("customer_id").notNull().references(() => customers$7.id),
	planId: text("plan_id").notNull().references(() => plans$8.id),
	templateId: text("template_id").references(() => quotationTemplates.id, { onDelete: "set null" }),
	/** Set when this subscription is a renewal quotation of an earlier one. */
	renewedFromId: text("renewed_from_id"),
	status: text("status", { enum: [
		"draft",
		"quotation",
		"confirmed",
		"active",
		"paused",
		"closed"
	] }).notNull(),
	startDate: text("start_date").notNull(),
	expiryDate: text("expiry_date"),
	/** Billing anchor: periods are computed from start_date + n periods to avoid month-end drift. */
	billedPeriods: integer("billed_periods").notNull().default(0),
	nextInvoiceDate: text("next_invoice_date"),
	paymentTermDays: integer("payment_term_days").notNull().default(15),
	quoteValidUntil: text("quote_valid_until"),
	closedReason: text("closed_reason"),
	createdBy: text("created_by").references(() => users$2.id, { onDelete: "set null" }),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [
	uniqueIndex("subscriptions_number_uq").on(t.number),
	index("subscriptions_status_idx").on(t.status),
	index("subscriptions_customer_idx").on(t.customerId),
	index("subscriptions_plan_idx").on(t.planId),
	index("subscriptions_template_idx").on(t.templateId),
	index("subscriptions_renewed_from_idx").on(t.renewedFromId),
	index("subscriptions_next_invoice_idx").on(t.status, t.nextInvoiceDate),
	index("subscriptions_expiry_idx").on(t.expiryDate),
	index("subscriptions_created_idx").on(t.createdAt),
	index("subscriptions_start_idx").on(t.startDate)
]);
var subscriptionLines$2 = sqliteTable("subscription_lines", {
	id: id(),
	subscriptionId: text("subscription_id").notNull().references(() => subscriptions$7.id, { onDelete: "cascade" }),
	productId: text("product_id").notNull().references(() => products$3.id),
	variantId: text("variant_id").references(() => productVariants$2.id, { onDelete: "set null" }),
	quantity: integer("quantity").notNull(),
	unitPrice: integer("unit_price").notNull(),
	taxId: text("tax_id").references(() => taxes$2.id, { onDelete: "set null" }),
	discountId: text("discount_id").references(() => discounts$2.id, { onDelete: "set null" }),
	amount: integer("amount").notNull()
}, (t) => [
	index("subscription_lines_sub_idx").on(t.subscriptionId),
	index("subscription_lines_product_idx").on(t.productId),
	index("subscription_lines_variant_idx").on(t.variantId),
	index("subscription_lines_tax_idx").on(t.taxId),
	index("subscription_lines_discount_idx").on(t.discountId)
]);
var subscriptionStatusHistory$1 = sqliteTable("subscription_status_history", {
	id: id(),
	subscriptionId: text("subscription_id").notNull().references(() => subscriptions$7.id, { onDelete: "cascade" }),
	fromStatus: text("from_status"),
	toStatus: text("to_status").notNull(),
	actorId: text("actor_id").references(() => users$2.id, { onDelete: "set null" }),
	note: text("note"),
	createdAt: createdAt()
}, (t) => [index("sub_history_sub_idx").on(t.subscriptionId), index("sub_history_actor_idx").on(t.actorId)]);
var invoices$4 = sqliteTable("invoices", {
	id: id(),
	number: text("number").notNull(),
	subscriptionId: text("subscription_id").notNull().references(() => subscriptions$7.id),
	customerId: text("customer_id").notNull().references(() => customers$7.id),
	periodStart: text("period_start").notNull(),
	periodEnd: text("period_end").notNull(),
	status: text("status", { enum: [
		"draft",
		"confirmed",
		"paid",
		"cancelled"
	] }).notNull(),
	issueDate: text("issue_date").notNull(),
	dueDate: text("due_date").notNull(),
	subtotal: integer("subtotal").notNull(),
	discountTotal: integer("discount_total").notNull().default(0),
	taxTotal: integer("tax_total").notNull().default(0),
	total: integer("total").notNull(),
	amountPaid: integer("amount_paid").notNull().default(0),
	/** Snapshot of customer billing details at issue time. */
	customerSnapshot: text("customer_snapshot", { mode: "json" }),
	billingRunId: text("billing_run_id"),
	sentAt: text("sent_at"),
	confirmedAt: text("confirmed_at"),
	paidAt: text("paid_at"),
	cancelledAt: text("cancelled_at"),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [
	uniqueIndex("invoices_number_uq").on(t.number),
	uniqueIndex("invoices_sub_period_uq").on(t.subscriptionId, t.periodStart),
	index("invoices_status_due_idx").on(t.status, t.dueDate),
	index("invoices_customer_idx").on(t.customerId),
	index("invoices_issue_idx").on(t.issueDate),
	index("invoices_billing_run_idx").on(t.billingRunId)
]);
var invoiceLines$1 = sqliteTable("invoice_lines", {
	id: id(),
	invoiceId: text("invoice_id").notNull().references(() => invoices$4.id, { onDelete: "cascade" }),
	description: text("description").notNull(),
	productId: text("product_id").references(() => products$3.id, { onDelete: "set null" }),
	quantity: integer("quantity").notNull(),
	unitPrice: integer("unit_price").notNull(),
	discountAmount: integer("discount_amount").notNull().default(0),
	taxAmount: integer("tax_amount").notNull().default(0),
	amount: integer("amount").notNull(),
	sortOrder: integer("sort_order").notNull().default(0)
}, (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId), index("invoice_lines_product_idx").on(t.productId)]);
var discountRedemptions$1 = sqliteTable("discount_redemptions", {
	id: id(),
	discountId: text("discount_id").notNull().references(() => discounts$2.id),
	invoiceId: text("invoice_id").notNull().references(() => invoices$4.id, { onDelete: "cascade" }),
	amount: integer("amount").notNull(),
	releasedAt: text("released_at"),
	createdAt: createdAt()
}, (t) => [index("discount_redemptions_discount_idx").on(t.discountId), uniqueIndex("discount_redemptions_invoice_uq").on(t.invoiceId, t.discountId)]);
var payments$3 = sqliteTable("payments", {
	id: id(),
	/** Nullable so unmatched receipts can be recorded and surfaced by leakage detection. */
	invoiceId: text("invoice_id").references(() => invoices$4.id),
	customerId: text("customer_id").references(() => customers$7.id),
	method: text("method", { enum: [
		"bank_transfer",
		"cash",
		"upi",
		"card",
		"other"
	] }).notNull(),
	amount: integer("amount").notNull(),
	paidOn: text("paid_on").notNull(),
	reference: text("reference"),
	note: text("note"),
	recordedBy: text("recorded_by").references(() => users$2.id, { onDelete: "set null" }),
	createdAt: createdAt()
}, (t) => [
	index("payments_invoice_idx").on(t.invoiceId),
	index("payments_customer_idx").on(t.customerId),
	index("payments_paid_on_idx").on(t.paidOn),
	index("payments_recorded_by_idx").on(t.recordedBy),
	index("payments_created_idx").on(t.createdAt)
]);
var billingRuns = sqliteTable("billing_runs", {
	id: id(),
	trigger: text("trigger", { enum: ["cron", "manual"] }).notNull(),
	runDate: text("run_date").notNull(),
	actorId: text("actor_id").references(() => users$2.id, { onDelete: "set null" }),
	status: text("status", { enum: [
		"running",
		"completed",
		"failed"
	] }).notNull(),
	created: integer("created").notNull().default(0),
	skipped: integer("skipped").notNull().default(0),
	failed: integer("failed").notNull().default(0),
	details: text("details", { mode: "json" }),
	startedAt: createdAt(),
	finishedAt: text("finished_at")
}, (t) => [index("billing_runs_started_idx").on(t.startedAt), index("billing_runs_actor_idx").on(t.actorId)]);
/** Customer 360° timeline. Every module appends events through lib/activity. */
var customerActivity$1 = sqliteTable("customer_activity", {
	id: id(),
	customerId: text("customer_id").notNull().references(() => customers$7.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	entity: text("entity"),
	entityId: text("entity_id"),
	summary: text("summary").notNull(),
	actorId: text("actor_id").references(() => users$2.id, { onDelete: "set null" }),
	createdAt: createdAt()
}, (t) => [index("customer_activity_customer_idx").on(t.customerId, t.createdAt), index("customer_activity_actor_idx").on(t.actorId)]);
var customerNotes$1 = sqliteTable("customer_notes", {
	id: id(),
	customerId: text("customer_id").notNull().references(() => customers$7.id, { onDelete: "cascade" }),
	authorId: text("author_id").references(() => users$2.id, { onDelete: "set null" }),
	body: text("body").notNull(),
	createdAt: createdAt()
}, (t) => [index("customer_notes_customer_idx").on(t.customerId), index("customer_notes_author_idx").on(t.authorId)]);
/** Dunning reminder history. One row per (invoice, step) so a step is never sent twice. */
var paymentReminders = sqliteTable("payment_reminders", {
	id: id(),
	invoiceId: text("invoice_id").notNull().references(() => invoices$4.id, { onDelete: "cascade" }),
	step: text("step").notNull(),
	notificationId: text("notification_id").references(() => notifications.id, { onDelete: "set null" }),
	createdAt: createdAt()
}, (t) => [uniqueIndex("payment_reminders_invoice_step_uq").on(t.invoiceId, t.step), index("payment_reminders_notification_idx").on(t.notificationId)]);
var renewalTasks = sqliteTable("renewal_tasks", {
	id: id(),
	subscriptionId: text("subscription_id").notNull().references(() => subscriptions$7.id, { onDelete: "cascade" }),
	dueOn: text("due_on").notNull(),
	status: text("status", { enum: [
		"open",
		"quoted",
		"renewed",
		"cancelled",
		"expired"
	] }).notNull().default("open"),
	renewalSubscriptionId: text("renewal_subscription_id").references(() => subscriptions$7.id, { onDelete: "set null" }),
	assigneeId: text("assignee_id").references(() => users$2.id, { onDelete: "set null" }),
	note: text("note"),
	createdAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [
	uniqueIndex("renewal_tasks_sub_uq").on(t.subscriptionId),
	index("renewal_tasks_status_due_idx").on(t.status, t.dueOn),
	index("renewal_tasks_renewal_idx").on(t.renewalSubscriptionId),
	index("renewal_tasks_assignee_idx").on(t.assigneeId)
]);
var cancellationRequests$1 = sqliteTable("cancellation_requests", {
	id: id(),
	subscriptionId: text("subscription_id").notNull().references(() => subscriptions$7.id, { onDelete: "cascade" }),
	customerId: text("customer_id").notNull().references(() => customers$7.id, { onDelete: "cascade" }),
	reason: text("reason", { enum: [
		"too_expensive",
		"temporary",
		"missing_features",
		"not_using",
		"other"
	] }).notNull(),
	comment: text("comment"),
	offeredAlternative: text("offered_alternative"),
	outcome: text("outcome", { enum: [
		"pending",
		"accepted_alternative",
		"cancelled"
	] }).notNull().default("pending"),
	createdAt: createdAt(),
	resolvedAt: text("resolved_at")
}, (t) => [index("cancellation_requests_sub_idx").on(t.subscriptionId), index("cancellation_requests_customer_idx").on(t.customerId)]);
/** Revenue leakage and invoice anomaly findings share one table, split by `kind`. */
var findings = sqliteTable("findings", {
	id: id(),
	kind: text("kind", { enum: ["leakage", "anomaly"] }).notNull(),
	rule: text("rule").notNull(),
	severity: text("severity", { enum: [
		"critical",
		"high",
		"medium",
		"low"
	] }).notNull(),
	/** Stable hash of rule + subject ids, so a re-scan never duplicates a finding. */
	fingerprint: text("fingerprint").notNull(),
	customerId: text("customer_id").references(() => customers$7.id, { onDelete: "cascade" }),
	subscriptionId: text("subscription_id").references(() => subscriptions$7.id, { onDelete: "cascade" }),
	invoiceId: text("invoice_id").references(() => invoices$4.id, { onDelete: "cascade" }),
	paymentId: text("payment_id").references(() => payments$3.id, { onDelete: "cascade" }),
	amountAtRisk: integer("amount_at_risk").notNull().default(0),
	expected: integer("expected"),
	actual: integer("actual"),
	explanation: text("explanation").notNull(),
	suggestion: text("suggestion").notNull(),
	status: text("status", { enum: [
		"open",
		"reviewed",
		"resolved"
	] }).notNull().default("open"),
	resolutionNote: text("resolution_note"),
	resolvedBy: text("resolved_by").references(() => users$2.id, { onDelete: "set null" }),
	detectedAt: createdAt(),
	updatedAt: updatedAt()
}, (t) => [
	uniqueIndex("findings_fingerprint_uq").on(t.fingerprint),
	index("findings_kind_status_idx").on(t.kind, t.status, t.severity),
	index("findings_customer_idx").on(t.customerId),
	index("findings_subscription_idx").on(t.subscriptionId),
	index("findings_invoice_idx").on(t.invoiceId),
	index("findings_payment_idx").on(t.paymentId),
	index("findings_resolved_by_idx").on(t.resolvedBy)
]);
// worker/lib/db.ts
function createDb(d1) {
	return drizzle(d1, { schema: schema_exports });
}
function newId() {
	return crypto.randomUUID();
}
function nowISO() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
// shared/dates.ts
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isISODate(value) {
	if (!DATE_RE.test(value)) return false;
	return toISODate(parse$1(value)) === value;
}
function toISODate(d) {
	return d.toISOString().slice(0, 10);
}
function todayISO(now = /* @__PURE__ */ new Date()) {
	return toISODate(now);
}
function addDays(date, days) {
	const d = parse$1(date);
	d.setUTCDate(d.getUTCDate() + days);
	return toISODate(d);
}
/** Whole days from `a` to `b` (b - a). */
function diffDays(a, b) {
	return Math.round((parse$1(b).getTime() - parse$1(a).getTime()) / 864e5);
}
/** Add months, clamping to the last day of the target month (31 Jan + 1 month = 28/29 Feb). */
function addMonths(date, months) {
	const d = parse$1(date);
	const day = d.getUTCDate();
	const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
	const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
	target.setUTCDate(Math.min(day, lastDay));
	return toISODate(target);
}
/**
* Start date of billing period `n` (0-based) for a subscription anchored at `anchor`.
* Always computed from the anchor, so month-end dates never drift (31 Jan → 28 Feb → 31 Mar).
*/
function periodStart(anchor, period, n) {
	switch (period) {
		case "daily": return addDays(anchor, n);
		case "weekly": return addDays(anchor, 7 * n);
		case "monthly": return addMonths(anchor, n);
		case "yearly": return addMonths(anchor, 12 * n);
	}
}
/** Inclusive end date of billing period `n`. */
function periodEnd(anchor, period, n) {
	return addDays(periodStart(anchor, period, n + 1), -1);
}
/** True when `date` is within [from, to]; a null bound is open. */
function isWithin(date, from, to) {
	if (from && date < from) return false;
	if (to && date > to) return false;
	return true;
}
function parse$1(date) {
	return /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
}
// shared/lifecycle.ts
/**
* Subscription and invoice state machines (PRD §4). The API enforces these through
* explicit action endpoints; the UI uses them to decide which buttons to show.
*/
var SUBSCRIPTION_STATUSES = [
	"draft",
	"quotation",
	"confirmed",
	"active",
	"paused",
	"closed"
];
var INVOICE_STATUSES = [
	"draft",
	"confirmed",
	"paid",
	"cancelled"
];
/** Forward-only moves, plus Active ↔ Paused when the plan is pausable. */
var SUBSCRIPTION_MOVES = {
	draft: ["quotation", "closed"],
	quotation: ["confirmed", "closed"],
	confirmed: ["active", "closed"],
	active: ["paused", "closed"],
	paused: ["active", "closed"],
	closed: []
};
function canTransitionSubscription(from, to, plan, ctx = { today: "" }) {
	if (!SUBSCRIPTION_MOVES[from].includes(to)) return {
		ok: false,
		reason: `Cannot move a subscription from ${from} to ${to}.`
	};
	if (to === "paused" && !plan.pausable) return {
		ok: false,
		reason: "This plan does not allow pausing."
	};
	if (to === "closed" && from === "active" && !plan.closable) return {
		ok: false,
		reason: "This plan does not allow closing early."
	};
	if (from === "quotation" && to === "confirmed" && ctx.quoteValidUntil && ctx.today > ctx.quoteValidUntil) return {
		ok: false,
		reason: "This quotation has expired and cannot be confirmed."
	};
	return { ok: true };
}
var INVOICE_MOVES = {
	draft: ["confirmed", "cancelled"],
	confirmed: ["paid", "cancelled"],
	paid: [],
	cancelled: []
};
function canTransitionInvoice(from, to) {
	return INVOICE_MOVES[from].includes(to);
}
/** Overdue = Confirmed, past due date, balance above zero. */
function isInvoiceOverdue(inv, today) {
	return inv.status === "confirmed" && inv.dueDate < today && inv.total - inv.amountPaid > 0;
}
// shared/money.ts
var MONEY_RE = /^-?\d+(\.\d{1,2})?$/;
/** "2560.5" -> 256050. Throws on invalid input; validate with zod first. */
function toMinor(value) {
	const s = typeof value === "number" ? value.toFixed(2) : value.trim();
	if (!MONEY_RE.test(s)) throw new Error(`Invalid money value: ${value}`);
	const negative = s.startsWith("-");
	const [whole = "0", frac = ""] = s.replace("-", "").split(".");
	const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
	return negative ? -minor : minor;
}
/** 256050 -> "2560.50" */
function fromMinor(minor) {
	assertInt(minor);
	const negative = minor < 0;
	const abs = Math.abs(minor);
	const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
	return negative ? `-${s}` : s;
}
/** "18" | "18.5" -> 1800 | 1850 basis points. */
function toBasisPoints(value) {
	return toMinor(value);
}
function fromBasisPoints(bp) {
	return fromMinor(bp);
}
/** Round half away from zero to an integer number of minor units. */
function roundMinor(value) {
	return Math.sign(value) * Math.round(Math.abs(value));
}
/** amount × basisPoints / 10000, rounded to minor units. */
function applyBasisPoints(amount, bp) {
	return roundMinor(amount * bp / 1e4);
}
function sumMinor(values) {
	return values.reduce((a, b) => a + b, 0);
}
function formatMoney(minor, currency = "INR", locale = "en-IN") {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: 2
	}).format(minor / 100);
}
function assertInt(n) {
	if (!Number.isSafeInteger(n)) throw new Error(`Money must be an integer of minor units, got ${n}`);
}
// shared/pricing.ts
function unitPrice(salesPrice, variantExtraPrice = 0) {
	return salesPrice + variantExtraPrice;
}
/** Tax for one line, computed on the discounted (net) amount. */
function lineTax(net, quantity, taxes) {
	return sumMinor(taxes.map((t) => t.kind === "percentage" ? applyBasisPoints(net, t.rate) : roundMinor(t.rate * quantity)));
}
/** Whether a discount passes its date, usage and active checks (thresholds are checked separately). */
function isDiscountActive(d, on) {
	if (d.isActive === false) return false;
	if (on < d.startsOn) return false;
	if (d.endsOn && on > d.endsOn) return false;
	if (d.usageLimit !== null && d.usageCount >= d.usageLimit) return false;
	return true;
}
/**
* Discount amount per line for one discount rule, or null when the rule is not eligible.
* Subscription-scope discounts are allocated across lines proportionally to gross
* (largest-remainder) so tax can be computed on each discounted line.
*/
function discountAllocation(d, lines, on) {
	if (!isDiscountActive(d, on)) return null;
	const gross = lines.map((l) => l.quantity * l.unitPrice);
	if (d.scope === "product") {
		const allowed = new Set(d.productIds);
		let any = false;
		const out = lines.map((l, i) => {
			const g = gross[i] ?? 0;
			if (!l.productId || !allowed.has(l.productId)) return 0;
			if (g < d.minPurchase || l.quantity < d.minQuantity) return 0;
			any = true;
			return d.kind === "percentage" ? applyBasisPoints(g, d.value) : Math.min(d.value, g);
		});
		return any ? out : null;
	}
	const subtotal = sumMinor(gross);
	const totalQty = sumMinor(lines.map((l) => l.quantity));
	if (subtotal <= 0 || subtotal < d.minPurchase || totalQty < d.minQuantity) return null;
	return allocateProportionally(d.kind === "percentage" ? applyBasisPoints(subtotal, d.value) : Math.min(d.value, subtotal), gross);
}
/** Split `amount` across `weights` proportionally; parts sum exactly to `amount`. */
function allocateProportionally(amount, weights) {
	const total = sumMinor(weights);
	if (total <= 0) return weights.map(() => 0);
	const raw = weights.map((w) => amount * w / total);
	const floors = raw.map(Math.floor);
	let remainder = amount - sumMinor(floors);
	const order = raw.map((r, i) => ({
		i,
		frac: r - Math.floor(r)
	})).sort((a, b) => b.frac - a.frac);
	for (const { i } of order) {
		if (remainder <= 0) break;
		floors[i] = (floors[i] ?? 0) + 1;
		remainder--;
	}
	return floors;
}
/** Pick the eligible discount with the largest total reduction (no stacking). */
function bestDiscount(discounts, lines, on) {
	let best = null;
	for (const d of discounts) {
		const allocation = discountAllocation(d, lines, on);
		if (!allocation) continue;
		const amount = sumMinor(allocation);
		if (amount > 0 && (!best || amount > best.amount)) best = {
			discount: d,
			allocation,
			amount
		};
	}
	return best;
}
/** Price a full invoice: per-line discount, tax on discounted amount, totals from rounded lines. */
function priceInvoice(lines, discounts, on) {
	const best = bestDiscount(discounts, lines, on);
	const priced = lines.map((l, i) => {
		const gross = l.quantity * l.unitPrice;
		const discountAmount = best?.allocation[i] ?? 0;
		const net = gross - discountAmount;
		const taxAmount = lineTax(net, l.quantity, l.taxes);
		return {
			...l,
			gross,
			discountAmount,
			net,
			taxAmount,
			amount: net + taxAmount
		};
	});
	return {
		lines: priced,
		subtotal: sumMinor(priced.map((l) => l.gross)),
		discountTotal: sumMinor(priced.map((l) => l.discountAmount)),
		taxTotal: sumMinor(priced.map((l) => l.taxAmount)),
		total: sumMinor(priced.map((l) => l.amount)),
		appliedDiscount: best ? {
			id: best.discount.id,
			name: best.discount.name,
			amount: best.amount
		} : null
	};
}
// worker/lib/counters.ts
/**
* Human-readable sequential numbers (SUB-000001, INV-000001). The counter row is
* incremented atomically; a gap appears only if the later insert fails, which is
* acceptable for display numbers (uniqueness is still enforced by the database).
*/
async function nextNumber(d1, name, prefix) {
	const row = await d1.prepare(`INSERT INTO counters (name, value) VALUES (?1, 1)
       ON CONFLICT(name) DO UPDATE SET value = counters.value + 1
       RETURNING value`).bind(name).first();
	if (!row) throw new Error(`Counter ${name} failed`);
	return `${prefix}-${String(row.value).padStart(6, "0")}`;
}
// worker/lib/dto.ts
/**
* Row → API DTO converters shared by every module, so money and computed fields
* (balance, overdue) are serialized one way only. Owner: Person 1.
*/
function toCustomer(r) {
	return {
		id: r.id,
		userId: r.userId,
		email: r.email,
		contactName: r.contactName,
		companyName: r.companyName,
		phone: r.phone,
		billingAddress: r.billingAddress,
		taxId: r.taxId,
		createdAt: r.createdAt
	};
}
function toProduct(r, taxIds = []) {
	return {
		id: r.id,
		name: r.name,
		type: r.type,
		salesPrice: fromMinor(r.salesPrice),
		costPrice: fromMinor(r.costPrice),
		notes: r.notes,
		isActive: r.isActive,
		taxIds
	};
}
function toPlan(r) {
	return {
		id: r.id,
		name: r.name,
		price: fromMinor(r.price),
		billingPeriod: r.billingPeriod,
		minQuantity: r.minQuantity,
		availableFrom: r.availableFrom,
		availableTo: r.availableTo,
		autoClose: r.autoClose,
		closable: r.closable,
		pausable: r.pausable,
		renewable: r.renewable,
		status: r.status
	};
}
function toTax(r) {
	return {
		id: r.id,
		name: r.name,
		kind: r.kind,
		rate: r.kind === "percentage" ? fromBasisPoints(r.rate) : fromMinor(r.rate),
		isActive: r.isActive
	};
}
function toDiscount(r, productIds = []) {
	return {
		id: r.id,
		name: r.name,
		kind: r.kind,
		value: r.kind === "percentage" ? fromBasisPoints(r.value) : fromMinor(r.value),
		minPurchase: fromMinor(r.minPurchase),
		minQuantity: r.minQuantity,
		startsOn: r.startsOn,
		endsOn: r.endsOn,
		usageLimit: r.usageLimit,
		usageCount: r.usageCount,
		scope: r.scope,
		productIds,
		isActive: r.isActive
	};
}
function toSubscription(r, extra = {}) {
	return {
		id: r.id,
		number: r.number,
		customerId: r.customerId,
		customerName: extra.customerName ?? void 0,
		planId: r.planId,
		planName: extra.planName ?? void 0,
		status: r.status,
		startDate: r.startDate,
		expiryDate: r.expiryDate,
		nextInvoiceDate: r.nextInvoiceDate,
		paymentTermDays: r.paymentTermDays,
		quoteValidUntil: r.quoteValidUntil,
		createdAt: r.createdAt
	};
}
function toInvoice(r, extra = {}, today = todayISO()) {
	const overdue = isInvoiceOverdue(r, today);
	return {
		id: r.id,
		number: r.number,
		subscriptionId: r.subscriptionId,
		subscriptionNumber: extra.subscriptionNumber ?? void 0,
		customerId: r.customerId,
		customerName: extra.customerName ?? void 0,
		periodStart: r.periodStart,
		periodEnd: r.periodEnd,
		status: r.status,
		issueDate: r.issueDate,
		dueDate: r.dueDate,
		subtotal: fromMinor(r.subtotal),
		discountTotal: fromMinor(r.discountTotal),
		taxTotal: fromMinor(r.taxTotal),
		total: fromMinor(r.total),
		amountPaid: fromMinor(r.amountPaid),
		balance: fromMinor(r.status === "cancelled" ? 0 : r.total - r.amountPaid),
		isOverdue: overdue,
		daysOverdue: overdue ? diffDays(r.dueDate, today) : 0,
		sentAt: r.sentAt
	};
}
function toInvoiceLine(r) {
	return {
		id: r.id,
		description: r.description,
		productId: r.productId,
		quantity: r.quantity,
		unitPrice: fromMinor(r.unitPrice),
		discountAmount: fromMinor(r.discountAmount),
		taxAmount: fromMinor(r.taxAmount),
		amount: fromMinor(r.amount)
	};
}
function toPayment(r, extra = {}) {
	return {
		id: r.id,
		invoiceId: r.invoiceId,
		invoiceNumber: extra.invoiceNumber ?? void 0,
		customerId: r.customerId,
		customerName: extra.customerName ?? void 0,
		method: r.method,
		amount: fromMinor(r.amount),
		paidOn: r.paidOn,
		reference: r.reference,
		note: r.note,
		recordedBy: r.recordedBy,
		createdAt: r.createdAt
	};
}
/** Display name for a customer row: company, else contact. */
function customerLabel(c) {
	if (!c) return null;
	return c.companyName || c.contactName;
}
// worker/lib/errors.ts
var STATUS = {
	bad_request: 400,
	validation_failed: 422,
	unauthenticated: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	rate_limited: 429,
	invalid_transition: 409,
	internal: 500
};
/** Throw from any route or service; the global handler turns it into the shared error shape. */
var ApiError = class ApiError extends Error {
	code;
	fields;
	constructor(code, message, fields) {
		super(message);
		this.code = code;
		this.fields = fields;
	}
	static notFound(what = "Resource") {
		return new ApiError("not_found", `${what} not found.`);
	}
	static forbidden(message = "You do not have access to this resource.") {
		return new ApiError("forbidden", message);
	}
	static conflict(message, fields) {
		return new ApiError("conflict", message, fields);
	}
};
function zodFields(error) {
	const fields = {};
	for (const issue of error.issues) {
		const key = issue.path.join(".") || "_";
		fields[key] ??= issue.message;
	}
	return fields;
}
function errorResponse(c, err) {
	if (err instanceof ApiError) {
		const body = { error: {
			code: err.code,
			message: err.message,
			fields: err.fields
		} };
		return c.json(body, STATUS[err.code]);
	}
	console.error("Unhandled error", err);
	return c.json({ error: {
		code: "internal",
		message: "Something went wrong. Try again."
	} }, 500);
}
/** True when a D1 error is a UNIQUE constraint violation. */
function isUniqueViolation(err) {
	const msg = err instanceof Error ? `${err.message} ${String(err.cause ?? "")}` : String(err);
	return /UNIQUE constraint failed/i.test(msg);
}
// worker/lib/events.ts
function auditEntry(db, e) {
	return db.insert(auditLog).values({
		id: newId(),
		actorId: e.actorId,
		action: e.action,
		entity: e.entity,
		entityId: e.entityId ?? null,
		meta: e.meta ?? null
	});
}
function activityEntry(db, e) {
	return db.insert(customerActivity$1).values({
		id: newId(),
		customerId: e.customerId,
		type: e.type,
		summary: e.summary,
		actorId: e.actorId ?? null,
		entity: e.entity ?? null,
		entityId: e.entityId ?? null
	});
}
// worker/modules/subscriptions/service.ts
/**
* Subscription lifecycle service (SUB-1, SUB-2, PLAN-3). Owner: Person 1.
* Every status change in the system goes through `transitionSubscription`, so the
* rules in shared/lifecycle.ts live in exactly one place.
*/
var { subscriptions: subscriptions$6, subscriptionLines: subscriptionLines$1, subscriptionStatusHistory, plans: plans$7, customers: customers$6, products: products$2, productVariants: productVariants$1, taxes: taxes$1 } = schema_exports;
/** Resolve and price subscription lines from catalog data. */
async function buildLines(db, subscriptionId, input, minQuantity) {
	const fields = {};
	const productIds = [...new Set(input.lines.map((l) => l.productId))];
	const variantIds = input.lines.map((l) => l.variantId).filter((v) => !!v);
	const [productRows, variantRows, productTaxRows, taxRows] = await Promise.all([
		productIds.length ? db.select().from(products$2).where(inArray(products$2.id, productIds)) : [],
		variantIds.length ? db.select().from(productVariants$1).where(inArray(productVariants$1.id, variantIds)) : [],
		productIds.length ? db.select().from(productTaxes$1).where(inArray(productTaxes$1.productId, productIds)) : [],
		db.select().from(taxes$1)
	]);
	const productMap = new Map(productRows.map((p) => [p.id, p]));
	const variantMap = new Map(variantRows.map((v) => [v.id, v]));
	const taxMap = new Map(taxRows.map((t) => [t.id, t]));
	const rows = input.lines.map((l, i) => {
		const product = productMap.get(l.productId);
		if (!product) {
			fields[`lines.${i}.productId`] = "Product not found";
			return null;
		}
		const variant = l.variantId ? variantMap.get(l.variantId) : void 0;
		if (l.variantId && (!variant || variant.productId !== product.id)) {
			fields[`lines.${i}.variantId`] = "Variant does not belong to this product";
			return null;
		}
		if (l.quantity < minQuantity) {
			fields[`lines.${i}.quantity`] = `At least ${minQuantity} for this plan`;
			return null;
		}
		const price = l.unitPrice !== void 0 ? toMinor(l.unitPrice) : unitPrice(product.salesPrice, variant?.extraPrice ?? 0);
		const taxId = l.taxId !== void 0 ? l.taxId : productTaxRows.find((pt) => pt.productId === product.id)?.taxId ?? null;
		const tax = taxId ? taxMap.get(taxId) : void 0;
		const priced = priceInvoice([{
			description: product.name,
			productId: product.id,
			quantity: l.quantity,
			unitPrice: price,
			taxes: tax ? [tax] : []
		}], [], todayISO());
		return {
			id: newId(),
			subscriptionId,
			productId: product.id,
			variantId: variant?.id ?? null,
			quantity: l.quantity,
			unitPrice: price,
			taxId: tax?.id ?? null,
			discountId: null,
			amount: priced.total
		};
	});
	if (Object.keys(fields).length) throw new ApiError("validation_failed", "Check the highlighted lines.", fields);
	return rows;
}
async function loadPlanFor(db, planId, startDate) {
	const plan = await db.select().from(plans$7).where(eq(plans$7.id, planId)).get();
	if (!plan) throw new ApiError("validation_failed", "Choose a plan.", { planId: "Plan not found" });
	if (plan.status !== "active") throw new ApiError("validation_failed", "This plan is closed.", { planId: "Plan is closed" });
	if (!isWithin(startDate, plan.availableFrom, plan.availableTo)) throw new ApiError("validation_failed", "The plan is not available on the start date.", { startDate: `Plan is available ${plan.availableFrom}${plan.availableTo ? ` to ${plan.availableTo}` : " onwards"}` });
	return plan;
}
async function createSubscription(db, d1, input, actorId, opts = {}) {
	const customer = await db.select().from(customers$6).where(eq(customers$6.id, input.customerId)).get();
	if (!customer) throw new ApiError("validation_failed", "Choose a customer.", { customerId: "Customer not found" });
	const plan = await loadPlanFor(db, input.planId, input.startDate);
	const id = newId();
	const lines = await buildLines(db, id, input, plan.minQuantity);
	const number = await nextNumber(d1, "subscription", "SUB");
	const status = opts.status ?? "draft";
	await db.batch([
		db.insert(subscriptions$6).values({
			id,
			number,
			customerId: customer.id,
			planId: plan.id,
			templateId: opts.templateId ?? null,
			renewedFromId: opts.renewedFromId ?? null,
			status,
			startDate: input.startDate,
			expiryDate: input.expiryDate ?? null,
			paymentTermDays: input.paymentTermDays,
			quoteValidUntil: opts.quoteValidUntil ?? null,
			createdBy: actorId
		}),
		...lines.map((l) => db.insert(subscriptionLines$1).values(l)),
		db.insert(subscriptionStatusHistory).values({
			id: newId(),
			subscriptionId: id,
			fromStatus: null,
			toStatus: status,
			actorId
		}),
		activityEntry(db, {
			customerId: customer.id,
			type: status === "quotation" ? "quotation.created" : "subscription.status_changed",
			summary: `${status === "quotation" ? "Quotation" : "Draft subscription"} ${number} created on ${plan.name}`,
			actorId,
			entity: "subscription",
			entityId: id
		}),
		auditEntry(db, {
			actorId,
			action: "subscription.created",
			entity: "subscription",
			entityId: id,
			meta: { status }
		})
	]);
	return getSubscription(db, id);
}
/** Edit customer, plan, dates and lines while the subscription is still a draft or quotation. */
async function updateSubscription(db, id, input, actorId) {
	const sub = await db.select().from(subscriptions$6).where(eq(subscriptions$6.id, id)).get();
	if (!sub) throw ApiError.notFound("Subscription");
	if (sub.status !== "draft" && sub.status !== "quotation") throw new ApiError("invalid_transition", "Only draft subscriptions and quotations can be edited.");
	const plan = await loadPlanFor(db, input.planId, input.startDate);
	const lines = await buildLines(db, id, input, plan.minQuantity);
	await db.batch([
		db.update(subscriptions$6).set({
			customerId: input.customerId,
			planId: plan.id,
			startDate: input.startDate,
			expiryDate: input.expiryDate ?? null,
			paymentTermDays: input.paymentTermDays,
			updatedAt: nowISO()
		}).where(eq(subscriptions$6.id, id)),
		db.delete(subscriptionLines$1).where(eq(subscriptionLines$1.subscriptionId, id)),
		...lines.map((l) => db.insert(subscriptionLines$1).values(l)),
		auditEntry(db, {
			actorId,
			action: "subscription.updated",
			entity: "subscription",
			entityId: id
		})
	]);
	return getSubscription(db, id);
}
async function getSubscription(db, id) {
	const row = await db.select({
		s: subscriptions$6,
		c: customers$6,
		planName: plans$7.name,
		plan: plans$7
	}).from(subscriptions$6).innerJoin(customers$6, eq(customers$6.id, subscriptions$6.customerId)).innerJoin(plans$7, eq(plans$7.id, subscriptions$6.planId)).where(eq(subscriptions$6.id, id)).get();
	if (!row) throw ApiError.notFound("Subscription");
	const lines = await db.select({
		l: subscriptionLines$1,
		productName: products$2.name,
		variantValue: productVariants$1.value,
		taxName: taxes$1.name
	}).from(subscriptionLines$1).innerJoin(products$2, eq(products$2.id, subscriptionLines$1.productId)).leftJoin(productVariants$1, eq(productVariants$1.id, subscriptionLines$1.variantId)).leftJoin(taxes$1, eq(taxes$1.id, subscriptionLines$1.taxId)).where(eq(subscriptionLines$1.subscriptionId, id));
	const mappedLines = lines.map((r) => ({
		id: r.l.id,
		productId: r.l.productId,
		productName: r.productName,
		variantId: r.l.variantId,
		variantName: r.variantValue ?? null,
		quantity: r.l.quantity,
		unitPrice: fromMinor(r.l.unitPrice),
		taxId: r.l.taxId,
		taxName: r.taxName ?? null,
		discountId: r.l.discountId,
		amount: fromMinor(r.l.amount)
	}));
	const recurringTotal = row.plan.price + lines.reduce((a, r) => a + r.l.amount, 0);
	return {
		...toSubscription(row.s, {
			customerName: customerLabel(row.c),
			planName: row.planName
		}),
		lines: mappedLines,
		plan: {
			id: row.plan.id,
			name: row.plan.name,
			price: fromMinor(row.plan.price),
			billingPeriod: row.plan.billingPeriod,
			closable: row.plan.closable,
			pausable: row.plan.pausable,
			renewable: row.plan.renewable
		},
		recurringTotal: fromMinor(recurringTotal),
		renewedFromId: row.s.renewedFromId,
		closedReason: row.s.closedReason,
		quoteExpired: row.s.status === "quotation" && !!row.s.quoteValidUntil && row.s.quoteValidUntil < todayISO()
	};
}
async function getSubscriptionHistory(db, id) {
	return (await db.select({
		h: subscriptionStatusHistory,
		actorName: users$2.name
	}).from(subscriptionStatusHistory).leftJoin(users$2, eq(users$2.id, subscriptionStatusHistory.actorId)).where(eq(subscriptionStatusHistory.subscriptionId, id)).orderBy(desc(subscriptionStatusHistory.createdAt))).map((r) => ({
		id: r.h.id,
		fromStatus: r.h.fromStatus ?? null,
		toStatus: r.h.toStatus,
		actorName: r.actorName ?? (r.h.actorId ? null : "System"),
		note: r.h.note,
		createdAt: r.h.createdAt
	}));
}
async function getSubscriptionInvoices(db, id) {
	return (await db.select().from(invoices$4).where(eq(invoices$4.subscriptionId, id)).orderBy(desc(invoices$4.periodStart)).limit(100)).map((r) => toInvoice(r));
}
/**
* Move a subscription to `to`, enforcing forward-only moves and the plan switches.
* Confirming a quotation whose start date has passed activates it immediately.
*/
async function transitionSubscription(db, id, to, actorId, note, today = todayISO()) {
	const sub = await db.select().from(subscriptions$6).where(eq(subscriptions$6.id, id)).get();
	if (!sub) throw ApiError.notFound("Subscription");
	const plan = await db.select().from(plans$7).where(eq(plans$7.id, sub.planId)).get();
	if (!plan) throw ApiError.notFound("Plan");
	const switches = actorId === null && to === "closed" ? {
		...plan,
		closable: true
	} : plan;
	const check = canTransitionSubscription(sub.status, to, switches, {
		today,
		quoteValidUntil: sub.quoteValidUntil
	});
	if (!check.ok) throw new ApiError("invalid_transition", check.reason);
	const moves = [{
		from: sub.status,
		to
	}];
	const patch = {
		status: to,
		updatedAt: nowISO()
	};
	if (to === "quotation" && !sub.quoteValidUntil) patch.quoteValidUntil = addDays(today, 30);
	if (to === "active" && sub.status === "confirmed" && sub.startDate > today) throw new ApiError("invalid_transition", `This subscription starts on ${sub.startDate} and activates automatically that day.`);
	if (to === "confirmed" && sub.startDate <= today) {
		moves.push({
			from: "confirmed",
			to: "active"
		});
		patch.status = "active";
	}
	if (patch.status === "active") {
		if (sub.status === "paused") {
			let n = sub.billedPeriods;
			while (periodStart(sub.startDate, plan.billingPeriod, n) < today) n++;
			patch.billedPeriods = n;
			patch.nextInvoiceDate = periodStart(sub.startDate, plan.billingPeriod, n);
		} else patch.nextInvoiceDate = periodStart(sub.startDate, plan.billingPeriod, sub.billedPeriods);
	}
	if (to === "closed") {
		patch.nextInvoiceDate = null;
		patch.closedReason = note ?? "Closed manually";
	}
	if (!(await db.update(subscriptions$6).set(patch).where(and(eq(subscriptions$6.id, id), eq(subscriptions$6.status, sub.status))).returning({ id: subscriptions$6.id })).length) throw ApiError.conflict("This subscription changed while you were working. Reload and try again.");
	await db.batch([
		activityEntry(db, {
			customerId: sub.customerId,
			type: to === "quotation" ? "quotation.sent" : "subscription.status_changed",
			summary: `${sub.number} moved to ${moves.map((m) => m.to).join(" → ")}${note ? ` — ${note}` : ""}`,
			actorId,
			entity: "subscription",
			entityId: id
		}),
		...moves.map((m) => db.insert(subscriptionStatusHistory).values({
			id: newId(),
			subscriptionId: id,
			fromStatus: m.from,
			toStatus: m.to,
			actorId,
			note: note ?? null
		})),
		auditEntry(db, {
			actorId,
			action: "subscription.transition",
			entity: "subscription",
			entityId: id,
			meta: {
				from: sub.status,
				to: patch.status
			}
		})
	]);
	return getSubscription(db, id);
}
/** Create a renewal quotation that continues `id` after its expiry date (plan must be renewable). */
async function createRenewalQuotation(db, d1, id, actorId, today = todayISO()) {
	const sub = await db.select().from(subscriptions$6).where(eq(subscriptions$6.id, id)).get();
	if (!sub) throw ApiError.notFound("Subscription");
	if (!(await db.select().from(plans$7).where(eq(plans$7.id, sub.planId)).get())?.renewable) throw new ApiError("invalid_transition", "This plan does not allow renewals.");
	if (![
		"active",
		"paused",
		"closed"
	].includes(sub.status)) throw new ApiError("invalid_transition", "Only active, paused or closed subscriptions can be renewed.");
	if (await db.select({ id: subscriptions$6.id }).from(subscriptions$6).where(and(eq(subscriptions$6.renewedFromId, id), inArray(subscriptions$6.status, [
		"draft",
		"quotation",
		"confirmed",
		"active"
	]))).get()) throw ApiError.conflict("A renewal already exists for this subscription.");
	const lines = await db.select().from(subscriptionLines$1).where(eq(subscriptionLines$1.subscriptionId, id)).orderBy(asc(subscriptionLines$1.id));
	const startDate = sub.expiryDate && sub.expiryDate >= today ? addDays(sub.expiryDate, 1) : today;
	const term = sub.expiryDate ? diffDays(sub.startDate, sub.expiryDate) : null;
	return createSubscription(db, d1, {
		customerId: sub.customerId,
		planId: sub.planId,
		startDate,
		expiryDate: term !== null ? addDays(startDate, term) : null,
		paymentTermDays: sub.paymentTermDays,
		lines: lines.map((l) => ({
			productId: l.productId,
			variantId: l.variantId,
			quantity: l.quantity,
			unitPrice: fromMinor(l.unitPrice),
			taxId: l.taxId
		}))
	}, actorId, {
		status: "quotation",
		quoteValidUntil: addDays(today, 14),
		renewedFromId: id,
		templateId: sub.templateId
	});
}
// worker/lib/notifications.ts
/**
* Single entry point for outgoing messages (reset links, invoices, dunning reminders).
*
* EMAIL_MODE=outbox (default): the message is stored in `notifications` with status
* "simulated" and logged to the console. It is never delivered and the UI labels it
* as simulated. A real provider can be added here later without touching callers.
*/
async function sendEmail(db, env, email) {
	const id = newId();
	await db.insert(notifications).values({
		id,
		channel: "email",
		userId: email.userId ?? null,
		recipient: email.to,
		subject: email.subject,
		body: email.body,
		status: env.EMAIL_MODE === "outbox" ? "simulated" : "failed",
		entity: email.entity ?? null,
		entityId: email.entityId ?? null
	});
	console.log(`[email:${env.EMAIL_MODE}] to=${email.to} subject="${email.subject}"\n${email.body}`);
	return id;
}
async function notifyInApp(db, n) {
	const id = newId();
	await db.insert(notifications).values({
		id,
		channel: "in_app",
		userId: n.userId,
		recipient: n.recipient,
		subject: n.subject,
		body: n.body,
		status: "sent",
		entity: n.entity ?? null,
		entityId: n.entityId ?? null
	});
	return id;
}
// worker/lib/format.ts
/** Money for emails and activity summaries, e.g. "₹2,560.00". */
function money(minor) {
	return formatMoney(minor, "INR");
}
// worker/modules/billing/service.ts
/**
* Recurring billing engine and authoritative invoice actions (INV-1, INV-2, INV-4,
* DISC-3). Owner: Person 1.
*
* "Nothing billed twice, nothing skipped":
* - unique index invoices(subscription_id, period_start) makes duplicates impossible;
* - each period is written in one atomic D1 batch (invoice, lines, discount usage,
*   subscription billing anchor);
* - the run loops while next_invoice_date <= today, so missed days catch up.
*/
var { invoices: invoices$3, invoiceLines, subscriptions: subscriptions$5, subscriptionLines, plans: plans$6, customers: customers$5, discounts: discounts$1, discountRedemptions } = schema_exports;
/** Safety valve per run (free-plan CPU): remaining subscriptions are picked up by the next run. */
var MAX_PERIODS_PER_RUN = 500;
async function loadDiscountRules(db) {
	const [rows, links] = await Promise.all([db.select().from(discounts$1).where(eq(discounts$1.isActive, true)), db.select().from(discountProducts$1)]);
	return rows.map((d) => ({
		...d,
		productIds: links.filter((l) => l.discountId === d.id).map((l) => l.productId)
	}));
}
async function loadTaxes(db) {
	const rows = await db.select().from(taxes$2);
	return new Map(rows.map((t) => [t.id, t]));
}
/**
* Create the invoice for billing period `n` of a subscription. Returns "skipped" when
* the period was already invoiced (another run won the race).
*/
async function generateInvoiceForPeriod(db, d1, subscriptionId, n, ctx) {
	const row = await db.select({
		s: subscriptions$5,
		p: plans$6,
		c: customers$5
	}).from(subscriptions$5).innerJoin(plans$6, eq(plans$6.id, subscriptions$5.planId)).innerJoin(customers$5, eq(customers$5.id, subscriptions$5.customerId)).where(eq(subscriptions$5.id, subscriptionId)).get();
	if (!row) return "failed";
	const { s, p, c } = row;
	const start = periodStart(s.startDate, p.billingPeriod, n);
	const end = periodEnd(s.startDate, p.billingPeriod, n);
	const subLines = await db.select({
		l: subscriptionLines,
		productName: products$3.name,
		variantValue: productVariants$2.value
	}).from(subscriptionLines).innerJoin(products$3, eq(products$3.id, subscriptionLines.productId)).leftJoin(productVariants$2, eq(productVariants$2.id, subscriptionLines.variantId)).where(eq(subscriptionLines.subscriptionId, s.id));
	const priced = priceInvoice([{
		description: `${p.name} — ${start} to ${end}`,
		productId: null,
		quantity: 1,
		unitPrice: p.price,
		taxes: []
	}, ...subLines.map((r) => ({
		description: r.variantValue ? `${r.productName} (${r.variantValue})` : r.productName,
		productId: r.l.productId,
		quantity: r.l.quantity,
		unitPrice: r.l.unitPrice,
		taxes: r.l.taxId && ctx.taxes.get(r.l.taxId) ? [ctx.taxes.get(r.l.taxId)] : []
	}))], ctx.discountRules, ctx.today);
	const invoiceId = newId();
	const number = await nextNumber(d1, "invoice", "INV");
	const advance = db.update(subscriptions$5).set({
		billedPeriods: n + 1,
		nextInvoiceDate: periodStart(s.startDate, p.billingPeriod, n + 1),
		updatedAt: nowISO()
	}).where(and(eq(subscriptions$5.id, s.id), eq(subscriptions$5.billedPeriods, n)));
	try {
		await db.batch([
			db.insert(invoices$3).values({
				id: invoiceId,
				number,
				subscriptionId: s.id,
				customerId: c.id,
				periodStart: start,
				periodEnd: end,
				status: "draft",
				issueDate: ctx.today,
				dueDate: addDays(ctx.today, s.paymentTermDays),
				subtotal: priced.subtotal,
				discountTotal: priced.discountTotal,
				taxTotal: priced.taxTotal,
				total: priced.total,
				customerSnapshot: {
					name: customerLabel(c),
					contactName: c.contactName,
					email: c.email,
					billingAddress: c.billingAddress,
					taxId: c.taxId
				},
				billingRunId: ctx.runId
			}),
			...priced.lines.map((l, i) => db.insert(invoiceLines).values({
				id: newId(),
				invoiceId,
				description: l.description,
				productId: l.productId,
				quantity: l.quantity,
				unitPrice: l.unitPrice,
				discountAmount: l.discountAmount,
				taxAmount: l.taxAmount,
				amount: l.amount,
				sortOrder: i
			})),
			...priced.appliedDiscount ? [db.insert(discountRedemptions).values({
				id: newId(),
				discountId: priced.appliedDiscount.id,
				invoiceId,
				amount: priced.appliedDiscount.amount
			}), db.update(discounts$1).set({ usageCount: sql`usage_count + 1` }).where(eq(discounts$1.id, priced.appliedDiscount.id))] : [],
			advance,
			activityEntry(db, {
				customerId: c.id,
				type: "invoice.generated",
				summary: `Invoice ${number} generated for ${start} – ${end} (${money(priced.total)})`,
				entity: "invoice",
				entityId: invoiceId
			})
		]);
		if (priced.appliedDiscount) {
			const rule = ctx.discountRules.find((d) => d.id === priced.appliedDiscount.id);
			if (rule) rule.usageCount++;
		}
		return "created";
	} catch (err) {
		if (!isUniqueViolation(err)) throw err;
		await advance;
		return "skipped";
	}
}
/** Run billing for every Active subscription due on or before `today`. */
async function runBilling(db, d1, opts) {
	const today = opts.today ?? todayISO();
	const runId = newId();
	await db.insert(billingRuns).values({
		id: runId,
		trigger: opts.trigger,
		runDate: today,
		actorId: opts.actorId ?? null,
		status: "running"
	});
	const ctx = {
		today,
		runId,
		discountRules: await loadDiscountRules(db),
		taxes: await loadTaxes(db)
	};
	const counts = {
		created: 0,
		skipped: 0,
		failed: 0
	};
	const details = [];
	let processed = 0;
	const due = await db.select({
		id: subscriptions$5.id,
		number: subscriptions$5.number,
		startDate: subscriptions$5.startDate,
		expiryDate: subscriptions$5.expiryDate,
		billedPeriods: subscriptions$5.billedPeriods,
		period: plans$6.billingPeriod
	}).from(subscriptions$5).innerJoin(plans$6, eq(plans$6.id, subscriptions$5.planId)).where(and(eq(subscriptions$5.status, "active"), isNotNull(subscriptions$5.nextInvoiceDate), lte(subscriptions$5.nextInvoiceDate, today)));
	for (const sub of due) {
		let n = sub.billedPeriods;
		while (processed < MAX_PERIODS_PER_RUN) {
			const start = periodStart(sub.startDate, sub.period, n);
			if (start > today || sub.expiryDate && start > sub.expiryDate) break;
			processed++;
			try {
				const outcome = await generateInvoiceForPeriod(db, d1, sub.id, n, ctx);
				counts[outcome]++;
				details.push({
					subscription: sub.number,
					period: start,
					outcome
				});
				if (outcome === "failed") break;
			} catch (err) {
				counts.failed++;
				details.push({
					subscription: sub.number,
					period: start,
					outcome: "failed",
					error: err instanceof Error ? err.message : String(err)
				});
				break;
			}
			n++;
		}
		if (sub.expiryDate) {
			if (periodStart(sub.startDate, sub.period, n) > sub.expiryDate) await db.update(subscriptions$5).set({ nextInvoiceDate: null }).where(eq(subscriptions$5.id, sub.id));
		}
	}
	const finishedAt = nowISO();
	await db.batch([db.update(billingRuns).set({
		status: "completed",
		...counts,
		details: details.slice(0, 200),
		finishedAt
	}).where(eq(billingRuns.id, runId)), auditEntry(db, {
		actorId: opts.actorId ?? null,
		action: "billing.run",
		entity: "billing_run",
		entityId: runId,
		meta: counts
	})]);
	return {
		...await db.select().from(billingRuns).where(eq(billingRuns.id, runId)).get(),
		details
	};
}
async function loadInvoice(db, id) {
	const inv = await db.select().from(invoices$3).where(eq(invoices$3.id, id)).get();
	if (!inv) throw ApiError.notFound("Invoice");
	return inv;
}
async function getInvoiceDetail(db, id) {
	const row = await db.select({
		i: invoices$3,
		c: customers$5,
		subNumber: subscriptions$5.number
	}).from(invoices$3).innerJoin(customers$5, eq(customers$5.id, invoices$3.customerId)).innerJoin(subscriptions$5, eq(subscriptions$5.id, invoices$3.subscriptionId)).where(eq(invoices$3.id, id)).get();
	if (!row) throw ApiError.notFound("Invoice");
	const [lines, redemption] = await Promise.all([db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id)).orderBy(invoiceLines.sortOrder), db.select({
		name: discounts$1.name,
		amount: discountRedemptions.amount
	}).from(discountRedemptions).innerJoin(discounts$1, eq(discounts$1.id, discountRedemptions.discountId)).where(and(eq(discountRedemptions.invoiceId, id), isNull(discountRedemptions.releasedAt))).get()]);
	return {
		...toInvoice(row.i, {
			customerName: customerLabel(row.c),
			subscriptionNumber: row.subNumber
		}),
		lines: lines.map(toInvoiceLine),
		customer: row.i.customerSnapshot ?? {
			name: customerLabel(row.c),
			email: row.c.email
		},
		discount: redemption ? {
			name: redemption.name,
			amount: fromMinor(redemption.amount)
		} : null,
		confirmedAt: row.i.confirmedAt,
		paidAt: row.i.paidAt,
		cancelledAt: row.i.cancelledAt
	};
}
async function confirmInvoice(db, id, actorId) {
	const inv = await loadInvoice(db, id);
	if (!canTransitionInvoice(inv.status, "confirmed")) throw new ApiError("invalid_transition", `A ${inv.status} invoice cannot be confirmed.`);
	const sub = await db.select({ terms: subscriptions$5.paymentTermDays }).from(subscriptions$5).where(eq(subscriptions$5.id, inv.subscriptionId)).get();
	const today = todayISO();
	await db.batch([db.update(invoices$3).set({
		status: "confirmed",
		issueDate: today,
		dueDate: addDays(today, sub?.terms ?? 15),
		confirmedAt: nowISO(),
		updatedAt: nowISO()
	}).where(and(eq(invoices$3.id, id), eq(invoices$3.status, "draft"))), auditEntry(db, {
		actorId,
		action: "invoice.confirmed",
		entity: "invoice",
		entityId: id
	})]);
	return toInvoice(await loadInvoice(db, id));
}
/** Cancel a draft or confirmed invoice with no payments; releases discount usage. */
async function cancelInvoice(db, id, actorId, reason) {
	const inv = await loadInvoice(db, id);
	if (!canTransitionInvoice(inv.status, "cancelled")) throw new ApiError("invalid_transition", `A ${inv.status} invoice cannot be cancelled.`);
	if (inv.amountPaid > 0) throw new ApiError("invalid_transition", "This invoice has payments recorded and cannot be cancelled.");
	const redemptions = await db.select().from(discountRedemptions).where(and(eq(discountRedemptions.invoiceId, id), isNull(discountRedemptions.releasedAt)));
	await db.batch([
		db.update(invoices$3).set({
			status: "cancelled",
			cancelledAt: nowISO(),
			updatedAt: nowISO()
		}).where(eq(invoices$3.id, id)),
		...redemptions.flatMap((r) => [db.update(discountRedemptions).set({ releasedAt: nowISO() }).where(eq(discountRedemptions.id, r.id)), db.update(discounts$1).set({ usageCount: sql`max(usage_count - 1, 0)` }).where(eq(discounts$1.id, r.discountId))]),
		activityEntry(db, {
			customerId: inv.customerId,
			type: "invoice.cancelled",
			summary: `Invoice ${inv.number} cancelled${reason ? ` — ${reason}` : ""}`,
			actorId,
			entity: "invoice",
			entityId: id
		}),
		auditEntry(db, {
			actorId,
			action: "invoice.cancelled",
			entity: "invoice",
			entityId: id,
			meta: { reason }
		})
	]);
	return toInvoice(await loadInvoice(db, id));
}
/** Edit quantities, unit prices and descriptions of a draft invoice; totals are recomputed. */
async function updateDraftInvoice(db, id, input, actorId) {
	const inv = await loadInvoice(db, id);
	if (inv.status !== "draft") throw new ApiError("invalid_transition", "Only draft invoices can be edited.");
	const existing = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
	const productIds = existing.map((l) => l.productId).filter((p) => !!p);
	const [links, taxes] = await Promise.all([productIds.length ? db.select().from(productTaxes$1).where(inArray(productTaxes$1.productId, productIds)) : [], loadTaxes(db)]);
	const updated = input.lines.map((l) => {
		const old = existing.find((e) => e.id === l.id);
		if (!old) throw new ApiError("validation_failed", "Unknown invoice line.", { lines: "Unknown line" });
		const gross = l.quantity * toMinor(l.unitPrice);
		const discountAmount = Math.min(old.discountAmount, gross);
		const lineTaxes = links.filter((x) => x.productId === old.productId).map((x) => taxes.get(x.taxId)).filter((t) => !!t);
		const net = gross - discountAmount;
		const taxAmount = old.productId ? lineTax(net, l.quantity, lineTaxes.slice(0, 1)) : 0;
		return {
			...old,
			description: l.description,
			quantity: l.quantity,
			unitPrice: toMinor(l.unitPrice),
			discountAmount,
			taxAmount,
			amount: net + taxAmount
		};
	});
	const subtotal = updated.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
	const discountTotal = updated.reduce((a, l) => a + l.discountAmount, 0);
	const taxTotal = updated.reduce((a, l) => a + l.taxAmount, 0);
	await db.batch([
		db.update(invoices$3).set({
			subtotal,
			discountTotal,
			taxTotal,
			total: subtotal - discountTotal + taxTotal,
			dueDate: input.dueDate ?? inv.dueDate,
			updatedAt: nowISO()
		}).where(eq(invoices$3.id, id)),
		...updated.map((l) => db.update(invoiceLines).set({
			description: l.description,
			quantity: l.quantity,
			unitPrice: l.unitPrice,
			discountAmount: l.discountAmount,
			taxAmount: l.taxAmount,
			amount: l.amount
		}).where(eq(invoiceLines.id, l.id))),
		auditEntry(db, {
			actorId,
			action: "invoice.edited",
			entity: "invoice",
			entityId: id
		})
	]);
	return toInvoice(await loadInvoice(db, id));
}
/** Email the invoice to the customer (simulated outbox in demo mode). Confirms drafts first. */
async function sendInvoice(db, env, id, actorId) {
	let inv = await loadInvoice(db, id);
	if (inv.status === "draft") {
		await confirmInvoice(db, id, actorId);
		inv = await loadInvoice(db, id);
	}
	if (inv.status === "cancelled") throw new ApiError("invalid_transition", "A cancelled invoice cannot be sent.");
	const customer = await db.select().from(customers$5).where(eq(customers$5.id, inv.customerId)).get();
	if (!customer) throw ApiError.notFound("Customer");
	await sendEmail(db, env, {
		to: customer.email,
		userId: customer.userId,
		subject: `Invoice ${inv.number} from Brightloop — ${money(inv.total)} due ${inv.dueDate}`,
		body: `Hi ${customer.contactName},\n\nInvoice ${inv.number} for ${inv.periodStart} to ${inv.periodEnd} is ready.\nTotal: ${money(inv.total)}\nBalance: ${money(inv.total - inv.amountPaid)}\nDue: ${inv.dueDate}\n\nView and print it in your portal: ${env.APP_URL}/portal/invoices/${inv.id}\n`,
		entity: "invoice",
		entityId: id
	});
	await db.batch([db.update(invoices$3).set({
		sentAt: nowISO(),
		updatedAt: nowISO()
	}).where(eq(invoices$3.id, id)), activityEntry(db, {
		customerId: inv.customerId,
		type: "invoice.sent",
		summary: `Invoice ${inv.number} sent to ${customer.email}`,
		actorId,
		entity: "invoice",
		entityId: id
	})]);
	return toInvoice(await loadInvoice(db, id));
}
// worker/modules/billing/jobs.ts
/**
* Daily lifecycle jobs. Owner: Person 1. Registered in worker/jobs/scheduler.ts.
*/
var { subscriptions: subscriptions$4, plans: plans$5 } = schema_exports;
var activateConfirmedJob = {
	name: "activate-confirmed",
	async run({ db, today }) {
		const due = await db.select({ id: subscriptions$4.id }).from(subscriptions$4).where(and(eq(subscriptions$4.status, "confirmed"), lte(subscriptions$4.startDate, today)));
		for (const s of due) await transitionSubscription(db, s.id, "active", null, "Start date reached", today);
		return { activated: due.length };
	}
};
var billingRunJob = {
	name: "billing-run",
	async run({ db, env, today }) {
		const r = await runBilling(db, env.DB, {
			today,
			trigger: "cron"
		});
		return {
			created: r.created,
			skipped: r.skipped,
			failed: r.failed
		};
	}
};
/** Close subscriptions whose plan ended with auto-close on, and subscriptions past expiry. */
var planAutoCloseJob = {
	name: "plan-auto-close",
	async run({ db, today }) {
		const endedPlans = await db.select({
			id: plans$5.id,
			name: plans$5.name
		}).from(plans$5).where(and(eq(plans$5.autoClose, true), isNotNull(plans$5.availableTo), lt(plans$5.availableTo, today)));
		let closed = 0;
		if (endedPlans.length) {
			await db.update(plans$5).set({ status: "closed" }).where(inArray(plans$5.id, endedPlans.map((p) => p.id)));
			const subs = await db.select({ id: subscriptions$4.id }).from(subscriptions$4).where(and(inArray(subscriptions$4.planId, endedPlans.map((p) => p.id)), inArray(subscriptions$4.status, ["active", "paused"])));
			for (const s of subs) {
				await transitionSubscription(db, s.id, "closed", null, "Plan ended (auto-close)", today);
				closed++;
			}
		}
		const expired = await db.select({ id: subscriptions$4.id }).from(subscriptions$4).where(and(inArray(subscriptions$4.status, ["active", "paused"]), isNotNull(subscriptions$4.expiryDate), lt(subscriptions$4.expiryDate, today)));
		for (const s of expired) {
			await transitionSubscription(db, s.id, "closed", null, "Expired", today).catch(() => void 0);
			closed++;
		}
		return {
			plansClosed: endedPlans.length,
			subscriptionsClosed: closed
		};
	}
};
// worker/lib/settings.ts
/** Typed access to the `settings` key/value table. Owner: Person 1. */
async function getSetting(db, key, fallback) {
	return (await db.select().from(settings).where(eq(settings.key, key)).get())?.value ?? fallback;
}
async function setSetting(db, key, value) {
	await db.insert(settings).values({
		key,
		value
	}).onConflictDoUpdate({
		target: settings.key,
		set: {
			value,
			updatedAt: nowISO()
		}
	});
}
// worker/lib/sql.ts
/**
* Small helpers for raw D1 SQL (aggregates and reports). Always bind values; never
* interpolate request input into SQL text. Owner: Person 1.
*/
async function all(d1, sql, ...binds) {
	return (await d1.prepare(sql).bind(...binds).all()).results;
}
async function first(d1, sql, ...binds) {
	return d1.prepare(sql).bind(...binds).first();
}
/** `%term%` for LIKE (case-insensitive for ASCII in SQLite). */
function likeTerm(q) {
	return `%${q.trim()}%`;
}
/** CSV with RFC 4180 quoting; formula-leading cells are prefixed to avoid spreadsheet injection. */
function toCsv(headers, rows) {
	const cell = (v) => {
		let s = v === null || v === void 0 ? "" : String(v);
		if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
	};
	return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}
/** Monthly-normalised recurring amount of a subscription row aliased `s` joined to plan `p`. */
var MRR_EXPR = `(CASE p.billing_period
  WHEN 'monthly' THEN 1.0 WHEN 'yearly' THEN 1.0/12 WHEN 'weekly' THEN 52.0/12 ELSE 365.0/12 END)
  * (p.price + COALESCE((SELECT SUM(l.amount) FROM subscription_lines l WHERE l.subscription_id = s.id), 0))`;
var dunningScheduleSchema = array(object({
	step: string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and _ only"),
	offsetDays: number().int().min(-30).max(120),
	action: _enum([
		"remind",
		"remind_and_notify_staff",
		"escalate"
	])
})).min(1).max(8);
var DEFAULT_SCHEDULE = [
	{
		step: "pre_due",
		offsetDays: -3,
		action: "remind"
	},
	{
		step: "overdue_3",
		offsetDays: 3,
		action: "remind"
	},
	{
		step: "overdue_7",
		offsetDays: 7,
		action: "remind_and_notify_staff"
	},
	{
		step: "escalate_14",
		offsetDays: 14,
		action: "escalate"
	}
];
async function getSchedule(db) {
	return [...await getSetting(db, "dunning.schedule", DEFAULT_SCHEDULE)].sort((a, b) => a.offsetDays - b.offsetDays);
}
function message(step, inv, today, appUrl) {
	const days = diffDays(inv.due_date, today);
	const when = days < 0 ? `is due on ${inv.due_date}` : `was due on ${inv.due_date} (${days} day${days === 1 ? "" : "s"} ago)`;
	const tone = step.action === "escalate" ? "This invoice is now significantly overdue and has been passed to our finance team. Please pay or contact us today." : days < 0 ? "This is a friendly reminder ahead of the due date." : "We have not yet received payment for this invoice.";
	return {
		subject: `${days < 0 ? "Upcoming payment" : "Payment overdue"}: invoice ${inv.number} (${money(inv.balance)})`,
		body: `Hi ${inv.contact_name},\n\nInvoice ${inv.number} for ${money(inv.balance)} ${when}.\n${tone}\n\nView the invoice: ${appUrl}/portal/invoices/${inv.id}\n`
	};
}
/** Send the most recent applicable step for each unpaid invoice, once per (invoice, step). */
async function runDunning({ db, env, today }) {
	const schedule = await getSchedule(db);
	const earliest = Math.min(...schedule.map((s) => s.offsetDays));
	const invoices = await all(env.DB, `SELECT i.id, i.number, i.customer_id, c.email, c.contact_name, c.user_id, i.due_date, i.total - i.amount_paid AS balance,
            (SELECT group_concat(step) FROM payment_reminders r WHERE r.invoice_id = i.id) AS sent_steps
     FROM invoices i JOIN customers c ON c.id = i.customer_id
     WHERE i.status = 'confirmed' AND i.total > i.amount_paid AND i.due_date <= ?1
     LIMIT 500`, addDays(today, -earliest));
	const staff = await all(env.DB, `SELECT id, email FROM users WHERE role IN ('admin','staff') AND is_active = 1`);
	let sent = 0;
	let escalated = 0;
	for (const inv of invoices) {
		const days = diffDays(inv.due_date, today);
		const applicable = schedule.filter((s) => days >= s.offsetDays);
		const step = applicable[applicable.length - 1];
		const already = new Set((inv.sent_steps ?? "").split(",").filter(Boolean));
		if (!step || already.has(step.step)) continue;
		const reminderId = newId();
		if (!(await env.DB.prepare(`INSERT OR IGNORE INTO payment_reminders (id, invoice_id, step) VALUES (?1, ?2, ?3)`).bind(reminderId, inv.id, step.step).run()).meta.changes) continue;
		const msg = message(step, inv, today, env.APP_URL);
		const notificationId = await sendEmail(db, env, {
			to: inv.email,
			userId: inv.user_id,
			subject: msg.subject,
			body: msg.body,
			entity: "invoice",
			entityId: inv.id
		});
		await env.DB.batch([env.DB.prepare(`UPDATE payment_reminders SET notification_id = ?1 WHERE id = ?2`).bind(notificationId, reminderId), env.DB.prepare(`INSERT INTO customer_activity (id, customer_id, type, entity, entity_id, summary) VALUES (?1, ?2, 'reminder.sent', 'invoice', ?3, ?4)`).bind(newId(), inv.customer_id, inv.id, `Reminder "${step.step}" sent for ${inv.number} (simulated email)`)]);
		sent++;
		if (step.action !== "remind") {
			escalated++;
			for (const s of staff) await notifyInApp(db, {
				userId: s.id,
				recipient: s.email,
				subject: `${step.action === "escalate" ? "Escalation" : "Follow up"}: ${inv.number} is ${days} days overdue`,
				body: `${inv.contact_name} owes ${money(inv.balance)} on ${inv.number}.`,
				entity: "invoice",
				entityId: inv.id
			});
		}
	}
	return {
		sent,
		escalated
	};
}
// worker/modules/finance/detection.ts
/**
* Revenue Leakage Detector and Invoice Anomaly Detection. Owner: Person 3.
* Deterministic SQL rules; no AI. Each finding has a stable fingerprint, so a rescan
* never duplicates it. Amounts are "potential revenue at risk" until verified.
*/
var RULES = {
	missing_invoice: {
		kind: "leakage",
		label: "Billing period not invoiced"
	},
	unmatched_payment: {
		kind: "leakage",
		label: "Payment not matched to an invoice"
	},
	expired_discount_used: {
		kind: "leakage",
		label: "Discount applied outside its dates"
	},
	discount_over_limit: {
		kind: "leakage",
		label: "Discount used beyond its limit"
	},
	expiring_no_renewal: {
		kind: "leakage",
		label: "Expiring without a renewal"
	},
	overdue_unreminded: {
		kind: "leakage",
		label: "Overdue invoice never chased"
	},
	total_mismatch: {
		kind: "anomaly",
		label: "Total does not match lines"
	},
	discount_exceeds_subtotal: {
		kind: "anomaly",
		label: "Discount exceeds subtotal"
	},
	closed_subscription_invoice: {
		kind: "anomaly",
		label: "Invoice for a closed subscription"
	},
	amount_jump: {
		kind: "anomaly",
		label: "Unusual change from previous period"
	},
	customer_mismatch: {
		kind: "anomaly",
		label: "Customer reference mismatch"
	}
};
async function leakageCandidates(d1, today) {
	const out = [];
	const behind = await all(d1, `SELECT s.id, s.number, s.customer_id, s.next_invoice_date, ${MRR_EXPR} AS mrr
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id
     WHERE s.status = 'active' AND s.next_invoice_date IS NOT NULL AND s.next_invoice_date < ?1`, today);
	for (const s of behind) out.push({
		kind: "leakage",
		rule: "missing_invoice",
		severity: "critical",
		key: `${s.id}:${s.next_invoice_date}`,
		customerId: s.customer_id,
		subscriptionId: s.id,
		amountAtRisk: Math.round(s.mrr),
		explanation: `${s.number} is active but its period starting ${s.next_invoice_date} has no invoice.`,
		suggestion: "Run billing now. If the run fails for this subscription, check its lines and plan."
	});
	const unmatched = await all(d1, `SELECT id, amount, customer_id, paid_on, reference FROM payments WHERE invoice_id IS NULL`);
	for (const p of unmatched) out.push({
		kind: "leakage",
		rule: "unmatched_payment",
		severity: "high",
		key: p.id,
		customerId: p.customer_id,
		paymentId: p.id,
		amountAtRisk: p.amount,
		explanation: `${money(p.amount)} received on ${p.paid_on}${p.reference ? ` (ref ${p.reference})` : ""} is not linked to any invoice, so the customer's balance is overstated.`,
		suggestion: "Match the payment to the customer's open invoice from the Payments page."
	});
	const outsideDates = await all(d1, `SELECT r.id, r.invoice_id, i.number, i.customer_id, r.amount, d.name, i.issue_date
     FROM discount_redemptions r JOIN discounts d ON d.id = r.discount_id JOIN invoices i ON i.id = r.invoice_id
     WHERE r.released_at IS NULL AND i.status != 'cancelled' AND (i.issue_date < d.starts_on OR (d.ends_on IS NOT NULL AND i.issue_date > d.ends_on))`);
	for (const r of outsideDates) out.push({
		kind: "leakage",
		rule: "expired_discount_used",
		severity: "medium",
		key: r.id,
		customerId: r.customer_id,
		invoiceId: r.invoice_id,
		amountAtRisk: r.amount,
		explanation: `"${r.name}" reduced ${r.number} by ${money(r.amount)} although the invoice date ${r.issue_date} is outside the discount's dates.`,
		suggestion: "If the invoice is still a draft, edit it; otherwise review the discount dates."
	});
	const overLimit = await all(d1, `SELECT d.id, d.name, d.usage_count, d.usage_limit,
            CAST(ROUND((d.usage_count - d.usage_limit) * COALESCE((SELECT AVG(r.amount) FROM discount_redemptions r
              WHERE r.discount_id = d.id AND r.released_at IS NULL), 0)) AS INTEGER) AS over_amount
     FROM discounts d WHERE d.usage_limit IS NOT NULL AND d.usage_count > d.usage_limit`);
	for (const d of overLimit) out.push({
		kind: "leakage",
		rule: "discount_over_limit",
		severity: "medium",
		key: `${d.id}:${d.usage_count}`,
		amountAtRisk: d.over_amount,
		explanation: `"${d.name}" has been used ${d.usage_count} times against a limit of ${d.usage_limit}.`,
		suggestion: "Deactivate the discount or raise its limit deliberately."
	});
	const expiring = await all(d1, `SELECT s.id, s.number, s.customer_id, s.expiry_date, ${MRR_EXPR} AS mrr
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id
     WHERE s.status = 'active' AND s.expiry_date BETWEEN ?1 AND ?2
       AND NOT EXISTS (SELECT 1 FROM subscriptions r WHERE r.renewed_from_id = s.id AND r.status NOT IN ('closed'))`, today, addDays(today, 30));
	for (const s of expiring) out.push({
		kind: "leakage",
		rule: "expiring_no_renewal",
		severity: s.expiry_date <= addDays(today, 7) ? "high" : "low",
		key: `${s.id}:${s.expiry_date}`,
		customerId: s.customer_id,
		subscriptionId: s.id,
		amountAtRisk: Math.round(s.mrr),
		explanation: `${s.number} expires on ${s.expiry_date} and has no renewal quotation.`,
		suggestion: "Prepare a renewal quotation from the Renewals page."
	});
	const unchased = await all(d1, `SELECT i.id, i.number, i.customer_id, i.total - i.amount_paid AS balance, i.due_date FROM invoices i
     WHERE i.status = 'confirmed' AND i.due_date < ?1 AND i.total > i.amount_paid
       AND NOT EXISTS (SELECT 1 FROM payment_reminders r WHERE r.invoice_id = i.id)`, addDays(today, -7));
	for (const i of unchased) out.push({
		kind: "leakage",
		rule: "overdue_unreminded",
		severity: "high",
		key: i.id,
		customerId: i.customer_id,
		invoiceId: i.id,
		amountAtRisk: i.balance,
		explanation: `${i.number} has been overdue since ${i.due_date} and no reminder has been sent.`,
		suggestion: "Check the dunning schedule and send a reminder."
	});
	return out;
}
async function anomalyCandidates(d1) {
	const out = [];
	const mismatched = await all(d1, `SELECT i.id, i.number, i.customer_id, i.subscription_id, i.total, i.subtotal, i.discount_total,
            i.subtotal - i.discount_total + i.tax_total AS expected,
            COALESCE((SELECT SUM(amount) FROM invoice_lines l WHERE l.invoice_id = i.id), 0) AS lines
     FROM invoices i WHERE i.status != 'cancelled'
       AND (i.total != i.subtotal - i.discount_total + i.tax_total
            OR i.total != COALESCE((SELECT SUM(amount) FROM invoice_lines l WHERE l.invoice_id = i.id), 0)
            OR i.discount_total > i.subtotal)`);
	for (const i of mismatched) if (i.discount_total > i.subtotal) out.push({
		kind: "anomaly",
		rule: "discount_exceeds_subtotal",
		severity: "high",
		key: i.id,
		customerId: i.customer_id,
		subscriptionId: i.subscription_id,
		invoiceId: i.id,
		amountAtRisk: i.discount_total - i.subtotal,
		expected: i.subtotal,
		actual: i.discount_total,
		explanation: `${i.number} has a discount of ${money(i.discount_total)} on a subtotal of ${money(i.subtotal)}.`,
		suggestion: "Correct the discount on the draft or cancel and reissue the invoice."
	});
	else out.push({
		kind: "anomaly",
		rule: "total_mismatch",
		severity: "critical",
		key: i.id,
		customerId: i.customer_id,
		subscriptionId: i.subscription_id,
		invoiceId: i.id,
		amountAtRisk: Math.abs(i.expected - i.total),
		expected: i.lines,
		actual: i.total,
		explanation: `${i.number} totals ${money(i.total)}, but its lines add up to ${money(i.lines)} and subtotal − discount + tax is ${money(i.expected)}.`,
		suggestion: "Cancel and reissue the invoice; check for manual database edits."
	});
	const closed = await all(d1, `SELECT i.id, i.number, i.customer_id, i.subscription_id, i.total - i.amount_paid AS balance, i.period_start,
            (SELECT MIN(substr(h.created_at, 1, 10)) FROM subscription_status_history h WHERE h.subscription_id = s.id AND h.to_status = 'closed') AS closed_on
     FROM invoices i JOIN subscriptions s ON s.id = i.subscription_id
     WHERE s.status = 'closed' AND i.status IN ('draft','confirmed')
       AND i.period_start > (SELECT MIN(substr(h.created_at, 1, 10)) FROM subscription_status_history h WHERE h.subscription_id = s.id AND h.to_status = 'closed')`);
	for (const i of closed) out.push({
		kind: "anomaly",
		rule: "closed_subscription_invoice",
		severity: "high",
		key: i.id,
		customerId: i.customer_id,
		subscriptionId: i.subscription_id,
		invoiceId: i.id,
		amountAtRisk: i.balance,
		explanation: `${i.number} bills the period from ${i.period_start}, after the subscription closed on ${i.closed_on}.`,
		suggestion: "Cancel the invoice unless the customer agreed to the extra period."
	});
	const jumps = await all(d1, `SELECT i.id, i.number, i.customer_id, i.subscription_id, i.total,
            (SELECT p.total FROM invoices p WHERE p.subscription_id = i.subscription_id AND p.period_start < i.period_start AND p.status != 'cancelled'
             ORDER BY p.period_start DESC LIMIT 1) AS prev
     FROM invoices i WHERE i.status IN ('draft','confirmed') AND i.issue_date >= ?1`, addDays(todayISO(), -90));
	for (const i of jumps) {
		if (!i.prev || i.prev <= 0) continue;
		const change = (i.total - i.prev) / i.prev;
		if (Math.abs(change) < .5) continue;
		out.push({
			kind: "anomaly",
			rule: "amount_jump",
			severity: "medium",
			key: i.id,
			customerId: i.customer_id,
			subscriptionId: i.subscription_id,
			invoiceId: i.id,
			amountAtRisk: Math.abs(i.total - i.prev),
			expected: i.prev,
			actual: i.total,
			explanation: `${i.number} is ${Math.round(change * 100)}% ${change > 0 ? "higher" : "lower"} than the previous period (${money(i.prev)} → ${money(i.total)}).`,
			suggestion: "Confirm the change is intended (quantity change, expired discount) before sending. This is an alert, not proof of an error."
		});
	}
	const wrongCustomer = await all(d1, `SELECT i.id, i.number, i.customer_id, i.subscription_id, i.total - i.amount_paid AS balance
     FROM invoices i LEFT JOIN subscriptions s ON s.id = i.subscription_id
     WHERE s.id IS NULL OR s.customer_id != i.customer_id`);
	for (const i of wrongCustomer) out.push({
		kind: "anomaly",
		rule: "customer_mismatch",
		severity: "high",
		key: i.id,
		customerId: i.customer_id,
		invoiceId: i.id,
		amountAtRisk: i.balance,
		explanation: `${i.number} is billed to a different customer than its subscription, or its subscription is missing.`,
		suggestion: "Cancel and reissue the invoice to the correct customer."
	});
	return out;
}
async function save(d1, candidates) {
	if (!candidates.length) return 0;
	const stmt = d1.prepare(`INSERT OR IGNORE INTO findings (id, kind, rule, severity, fingerprint, customer_id, subscription_id, invoice_id, payment_id,
       amount_at_risk, expected, actual, explanation, suggestion)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`);
	let created = 0;
	for (let i = 0; i < candidates.length; i += 50) {
		const res = await d1.batch(candidates.slice(i, i + 50).map((f) => stmt.bind(newId(), f.kind, f.rule, f.severity, `${f.rule}:${f.key}`, f.customerId ?? null, f.subscriptionId ?? null, f.invoiceId ?? null, f.paymentId ?? null, f.amountAtRisk, f.expected ?? null, f.actual ?? null, f.explanation, f.suggestion)));
		created += res.reduce((a, r) => a + (r.meta.changes ?? 0), 0);
	}
	return created;
}
async function scanRevenueLeakage({ env, today }) {
	return { created: await save(env.DB, await leakageCandidates(env.DB, today)) };
}
async function scanInvoiceAnomalies({ env }) {
	return { created: await save(env.DB, await anomalyCandidates(env.DB)) };
}
// worker/modules/renewals/service.ts
/**
* Smart Renewal Management. Owner: Person 4.
* A daily job opens a renewal task for every renewable subscription nearing expiry and
* keeps task status in step with what happened (quoted, renewed, expired).
*/
async function scanRenewals({ db, env, today }) {
	const reminderDays = await getSetting(db, "renewals.reminderDays", [30, 7]);
	const horizon = addDays(today, Math.max(...reminderDays, 7));
	const due = await all(env.DB, `SELECT s.id, s.number, s.expiry_date FROM subscriptions s JOIN plans p ON p.id = s.plan_id
     WHERE s.status IN ('active','paused') AND p.renewable = 1 AND s.expiry_date IS NOT NULL AND s.expiry_date BETWEEN ?1 AND ?2
       AND NOT EXISTS (SELECT 1 FROM renewal_tasks t WHERE t.subscription_id = s.id)`, today, horizon);
	const stmt = env.DB.prepare(`INSERT OR IGNORE INTO renewal_tasks (id, subscription_id, due_on, status) VALUES (?1, ?2, ?3, 'open')`);
	if (due.length) await env.DB.batch(due.map((s) => stmt.bind(newId(), s.id, s.expiry_date)));
	await env.DB.batch([env.DB.prepare(`UPDATE renewal_tasks SET status = 'renewed', updated_at = ?1
       WHERE status IN ('open','quoted') AND renewal_subscription_id IN (SELECT id FROM subscriptions WHERE status IN ('confirmed','active'))`).bind((/* @__PURE__ */ new Date()).toISOString()), env.DB.prepare(`UPDATE renewal_tasks SET status = 'expired', updated_at = ?1
       WHERE status IN ('open','quoted') AND subscription_id IN (SELECT id FROM subscriptions WHERE status = 'closed')`).bind((/* @__PURE__ */ new Date()).toISOString())]);
	if (due.length) {
		const staff = await all(env.DB, `SELECT id, email FROM users WHERE role IN ('admin','staff') AND is_active = 1`);
		for (const s of staff) await notifyInApp(db, {
			userId: s.id,
			recipient: s.email,
			subject: `${due.length} subscription${due.length > 1 ? "s" : ""} need a renewal decision`,
			body: due.map((d) => `${d.number} expires ${d.expiry_date}`).join("\n"),
			entity: "renewal"
		});
	}
	return { created: due.length };
}
/** Create the renewal quotation for a task and mark it quoted. */
async function quoteRenewal(db, d1, taskId, actorId) {
	const task = await d1.prepare(`SELECT * FROM renewal_tasks WHERE id = ?1`).bind(taskId).first();
	if (!task) return null;
	const quotation = await createRenewalQuotation(db, d1, task.subscription_id, actorId);
	await d1.prepare(`UPDATE renewal_tasks SET status = 'quoted', renewal_subscription_id = ?1, updated_at = ?2 WHERE id = ?3`).bind(quotation.id, (/* @__PURE__ */ new Date()).toISOString(), taskId).run();
	await d1.prepare(`INSERT INTO customer_activity (id, customer_id, type, entity, entity_id, summary, actor_id) VALUES (?1, ?2, 'renewal.created', 'subscription', ?3, ?4, ?5)`).bind(newId(), quotation.customerId, quotation.id, `Renewal quotation ${quotation.number} prepared`, actorId).run();
	return quotation;
}
// worker/jobs/scheduler.ts
/**
* Daily scheduler (Cloudflare Cron Trigger, see wrangler.jsonc). Owner: Person 1.
*
* Modules never create their own cron triggers: they register a job here. Jobs run
* in order; one failing job is logged and does not stop the others. Every job must
* be idempotent, because a cron can fire twice and an admin can run jobs manually.
*/
/**
* Order matters: billing first (needs Active subscriptions), then plan auto-close,
* then overdue/dunning, renewals and detection, which read the invoices billing made.
* Module owners append their job here in their PR.
*/
var jobs = [
	activateConfirmedJob,
	billingRunJob,
	planAutoCloseJob,
	{
		name: "dunning",
		run: runDunning
	},
	{
		name: "renewals",
		run: scanRenewals
	},
	{
		name: "revenue-leakage",
		run: scanRevenueLeakage
	},
	{
		name: "invoice-anomalies",
		run: scanInvoiceAnomalies
	},
	{
		name: "cleanup-expired-sessions",
		async run({ db }) {
			const now = (/* @__PURE__ */ new Date()).toISOString();
			await db.delete(sessions).where(lt(sessions.expiresAt, now));
			await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now));
		}
	}
];
async function runScheduledJobs(env, now = /* @__PURE__ */ new Date()) {
	const ctx = {
		db: createDb(env.DB),
		env,
		today: now.toISOString().slice(0, 10)
	};
	const results = {};
	for (const job of jobs) try {
		results[job.name] = await job.run(ctx) ?? "ok";
	} catch (err) {
		console.error(`Scheduled job ${job.name} failed`, err);
		results[job.name] = { error: err instanceof Error ? err.message : String(err) };
	}
	console.log("Scheduled jobs finished", JSON.stringify(results));
	return results;
}
// node_modules/hono/dist/utils/cookie.js
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var relaxedCookieNameRegEx = /^[!#-:<>-[\]-~]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var trimCookieWhitespace = (value) => {
	let start = 0;
	let end = value.length;
	while (start < end) {
		const charCode = value.charCodeAt(start);
		if (charCode !== 32 && charCode !== 9) break;
		start++;
	}
	while (end > start) {
		const charCode = value.charCodeAt(end - 1);
		if (charCode !== 32 && charCode !== 9) break;
		end--;
	}
	return start === 0 && end === value.length ? value : value.slice(start, end);
};
var parse = (cookie, name) => {
	if (name && cookie.indexOf(name) === -1) return {};
	const pairs = cookie.split(";");
	const parsedCookie = Object.create(null);
	for (const pairStr of pairs) {
		const valueStartPos = pairStr.indexOf("=");
		if (valueStartPos === -1) continue;
		const cookieName = trimCookieWhitespace(pairStr.substring(0, valueStartPos));
		if (name && name !== cookieName || !relaxedCookieNameRegEx.test(cookieName) || cookieName in parsedCookie) continue;
		let cookieValue = trimCookieWhitespace(pairStr.substring(valueStartPos + 1));
		if (cookieValue.startsWith("\"") && cookieValue.endsWith("\"")) cookieValue = cookieValue.slice(1, -1);
		if (validCookieValueRegEx.test(cookieValue)) {
			parsedCookie[cookieName] = tryDecodeURIComponent(cookieValue);
			if (name) break;
		}
	}
	return parsedCookie;
};
var _serialize = (name, value, opt = {}) => {
	if (!validCookieNameRegEx.test(name)) throw new Error("Invalid cookie name");
	let cookie = `${name}=${value}`;
	if (name.startsWith("__Secure-") && !opt.secure) throw new Error("__Secure- Cookie must have Secure attributes");
	if (name.startsWith("__Host-")) {
		if (!opt.secure) throw new Error("__Host- Cookie must have Secure attributes");
		if (opt.path !== "/") throw new Error("__Host- Cookie must have Path attributes with \"/\"");
		if (opt.domain) throw new Error("__Host- Cookie must not have Domain attributes");
	}
	for (const key of [
		"domain",
		"path",
		"sameSite",
		"priority"
	]) if (opt[key] && /[;\r\n]/.test(opt[key])) throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
	if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
		if (opt.maxAge > 3456e4) throw new Error("Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.");
		cookie += `; Max-Age=${opt.maxAge | 0}`;
	}
	if (opt.domain && opt.prefix !== "host") cookie += `; Domain=${opt.domain}`;
	if (opt.path) cookie += `; Path=${opt.path}`;
	if (opt.expires) {
		if (opt.expires.getTime() - Date.now() > 3456e7) throw new Error("Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future.");
		cookie += `; Expires=${opt.expires.toUTCString()}`;
	}
	if (opt.httpOnly) cookie += "; HttpOnly";
	if (opt.secure) cookie += "; Secure";
	if (opt.sameSite) cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
	if (opt.priority) cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
	if (opt.partitioned) {
		if (!opt.secure) throw new Error("Partitioned Cookie must have Secure attributes");
		cookie += "; Partitioned";
	}
	return cookie;
};
var serialize = (name, value, opt) => {
	value = encodeURIComponent(value);
	return _serialize(name, value, opt);
};
// node_modules/hono/dist/helper/cookie/index.js
var getCookie = (c, key, prefix) => {
	const cookie = c.req.raw.headers.get("Cookie");
	if (typeof key === "string") {
		if (!cookie) return;
		let finalKey = key;
		if (prefix === "secure") finalKey = "__Secure-" + key;
		else if (prefix === "host") finalKey = "__Host-" + key;
		return parse(cookie, finalKey)[finalKey];
	}
	if (!cookie) return {};
	return parse(cookie);
};
var generateCookie = (name, value, opt) => {
	let cookie;
	if (opt?.prefix === "secure") cookie = serialize("__Secure-" + name, value, {
		path: "/",
		...opt,
		secure: true
	});
	else if (opt?.prefix === "host") cookie = serialize("__Host-" + name, value, {
		...opt,
		path: "/",
		secure: true,
		domain: void 0
	});
	else cookie = serialize(name, value, {
		path: "/",
		...opt
	});
	return cookie;
};
var setCookie = (c, name, value, opt) => {
	const cookie = generateCookie(name, value, opt);
	c.header("Set-Cookie", cookie, { append: true });
};
var deleteCookie = (c, name, opt) => {
	const deletedCookie = getCookie(c, name, opt?.prefix);
	setCookie(c, name, "", {
		...opt,
		maxAge: 0
	});
	return deletedCookie;
};
// shared/permissions.ts
var PERMISSIONS = {
	"staff:manage": ["admin"],
	"catalog:read": ["admin", "staff"],
	"catalog:write": ["admin"],
	"tax:read": ["admin", "staff"],
	"tax:write": ["admin"],
	"discount:read": ["admin", "staff"],
	"discount:write": ["admin"],
	"template:read": ["admin", "staff"],
	"template:write": ["admin", "staff"],
	"customer:read": ["admin", "staff"],
	"customer:write": ["admin", "staff"],
	"subscription:read": ["admin", "staff"],
	"subscription:write": ["admin", "staff"],
	"invoice:read": ["admin", "staff"],
	"invoice:write": ["admin", "staff"],
	"billing:run": ["admin", "staff"],
	"payment:read": ["admin", "staff"],
	"payment:write": ["admin", "staff"],
	"report:read": ["admin", "staff"],
	"finding:read": ["admin", "staff"],
	"finding:write": ["admin", "staff"],
	"settings:write": ["admin"],
	"ai:use": ["admin", "staff"],
	"portal:access": ["customer"]
};
function can(role, permission) {
	if (!role) return false;
	return PERMISSIONS[permission].includes(role);
}
// worker/lib/crypto.ts
/**
* Password hashing and token helpers built on Web Crypto, so they run in Workers
* and in Node (seed script) without native modules.
*
* PBKDF2-SHA256 is used instead of bcrypt: bcrypt in pure JS exceeds the Workers
* free-plan CPU budget, while Web Crypto PBKDF2 runs natively. The iteration count is
* stored in the hash, so it can be raised later without breaking existing passwords.
* This file must not import anything: scripts/seed.ts imports it directly in Node.
*/
var ITERATIONS = 1e5;
var KEY_LENGTH_BITS = 256;
var PREFIX = "pbkdf2_sha256";
async function hashPassword(password) {
	const salt = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16));
	const hash = await derive(password, salt, ITERATIONS);
	return `${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}
async function verifyPassword(password, stored) {
	const [prefix, iter, saltB64, hashB64] = stored.split("$");
	if (prefix !== PREFIX || !iter || !saltB64 || !hashB64) return false;
	const expected = fromBase64(hashB64);
	return constantTimeEqual(await derive(password, fromBase64(saltB64), Number(iter)), expected);
}
/** URL-safe random token (default 32 bytes of entropy). */
function randomToken(bytes = 32) {
	return toBase64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256Hex(value) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function derive(password, salt, iterations) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({
		name: "PBKDF2",
		hash: "SHA-256",
		salt,
		iterations
	}, key, KEY_LENGTH_BITS);
	return new Uint8Array(bits);
}
function constantTimeEqual(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	return diff === 0;
}
function toBase64(bytes) {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}
function fromBase64(value) {
	const s = atob(value);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}
// worker/lib/auth.ts
/**
* Sessions and authorization guards. Every protected route uses `requirePermission`
* (or `requireRole`) so access is decided by shared/permissions.ts only.
*
* Sessions are random tokens in an httpOnly cookie; the database stores only the
* SHA-256 of the token, so a leaked database cannot be replayed as sessions.
*/
var SESSION_COOKIE = "bl_session";
var SESSION_TTL_MS = 6048e5;
/** Resolves the signed-in user (or null) for every /api request. */
var loadSession = async (c, next) => {
	c.set("user", null);
	c.set("sessionId", null);
	const token = getCookie(c, SESSION_COOKIE);
	if (token) {
		const sessionId = await sha256Hex(token);
		const user = await findSessionUser(c.get("db"), sessionId);
		if (user) {
			c.set("user", user);
			c.set("sessionId", sessionId);
		} else deleteCookie(c, SESSION_COOKIE, { path: "/" });
	}
	await next();
};
async function findSessionUser(db, sessionId) {
	const row = await db.select({
		id: users$2.id,
		email: users$2.email,
		name: users$2.name,
		role: users$2.role,
		isActive: users$2.isActive,
		customerId: customers$7.id
	}).from(sessions).innerJoin(users$2, eq(users$2.id, sessions.userId)).leftJoin(customers$7, eq(customers$7.userId, users$2.id)).where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, (/* @__PURE__ */ new Date()).toISOString()))).get();
	if (!row || !row.isActive) return null;
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		role: row.role,
		customerId: row.customerId ?? null
	};
}
async function startSession(c, userId) {
	const token = randomToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	await c.get("db").insert(sessions).values({
		id: await sha256Hex(token),
		userId,
		expiresAt: expiresAt.toISOString()
	});
	setCookie(c, SESSION_COOKIE, token, {
		path: "/",
		httpOnly: true,
		sameSite: "Lax",
		secure: new URL(c.req.url).protocol === "https:",
		expires: expiresAt
	});
}
async function endSession(c) {
	const sessionId = c.get("sessionId");
	if (sessionId) await c.get("db").delete(sessions).where(eq(sessions.id, sessionId));
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
var requireAuth = async (c, next) => {
	if (!c.get("user")) throw new ApiError("unauthenticated", "Sign in to continue.");
	await next();
};
function requirePermission(permission) {
	return async (c, next) => {
		const user = c.get("user");
		if (!user) throw new ApiError("unauthenticated", "Sign in to continue.");
		if (!can(user.role, permission)) throw ApiError.forbidden();
		await next();
	};
}
function requireRole(...roles) {
	return async (c, next) => {
		const user = c.get("user");
		if (!user) throw new ApiError("unauthenticated", "Sign in to continue.");
		if (!roles.includes(user.role)) throw ApiError.forbidden();
		await next();
	};
}
/** The signed-in user; use only behind requireAuth/requirePermission. */
function currentUser(c) {
	const user = c.get("user");
	if (!user) throw new ApiError("unauthenticated", "Sign in to continue.");
	return user;
}
/**
* Customer id the signed-in customer may access. Portal queries must always filter
* by this value, never by an id from the request.
*/
function ownCustomerId(c) {
	const user = currentUser(c);
	if (user.role !== "customer" || !user.customerId) throw ApiError.forbidden();
	return user.customerId;
}
// worker/lib/rate-limit.ts
/**
* Fixed-window rate limit stored in D1 (one row per key). Used on login and
* password-reset endpoints only, to stay well inside the free-plan write quota.
*/
function rateLimit(opts) {
	return async (c, next) => {
		const ip = c.req.header("cf-connecting-ip") ?? "local";
		const windowStart = Math.floor(Date.now() / 1e3 / opts.windowSeconds);
		const key = `${opts.name}:${ip}`;
		const row = await c.env.DB.prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`).bind(key, windowStart).first();
		if (row && row.count > opts.limit) throw new ApiError("rate_limited", "Too many attempts. Wait a few minutes and try again.");
		await next();
	};
}
// node_modules/hono/dist/validator/validator.js
var jsonRegex = /^application\/([a-z-\.]+\+)?json(;\s*[a-zA-Z0-9\-]+\=([^;]+))*$/i;
var multipartRegex = /^multipart\/form-data(;\s?boundary=[a-zA-Z0-9'"()+_,\-./:=?]+)?$/i;
var urlencodedRegex = /^application\/x-www-form-urlencoded(;\s*[a-zA-Z0-9\-]+\=([^;]+))*$/i;
var validator = (target, validationFunc) => {
	return async (c, next) => {
		let value = {};
		const contentType = c.req.header("Content-Type");
		switch (target) {
			case "json":
				if (!contentType || !jsonRegex.test(contentType)) break;
				try {
					value = await c.req.json();
				} catch {
					throw new HTTPException(400, { message: "Malformed JSON in request body" });
				}
				break;
			case "form": {
				if (!contentType || !(multipartRegex.test(contentType) || urlencodedRegex.test(contentType))) break;
				let formData;
				if (c.req.bodyCache.formData) formData = await c.req.bodyCache.formData;
				else try {
					formData = await bufferToFormData(await c.req.arrayBuffer(), contentType);
					c.req.bodyCache.formData = formData;
				} catch (e) {
					let message = "Malformed FormData request.";
					message += e instanceof Error ? ` ${e.message}` : ` ${String(e)}`;
					throw new HTTPException(400, { message });
				}
				const form = Object.create(null);
				formData.forEach((value, key) => {
					if (key.endsWith("[]")) (form[key] ??= []).push(value);
					else if (Array.isArray(form[key])) form[key].push(value);
					else if (Object.hasOwn(form, key)) form[key] = [form[key], value];
					else form[key] = value;
				});
				value = form;
				break;
			}
			case "query":
				value = Object.fromEntries(Object.entries(c.req.queries()).map(([k, v]) => {
					return v.length === 1 ? [k, v[0]] : [k, v];
				}));
				break;
			case "param":
				value = c.req.param();
				break;
			case "header":
				value = c.req.header();
				break;
			case "cookie": value = getCookie(c);
		}
		const res = await validationFunc(value, c);
		if (res instanceof Response) return res;
		c.req.addValidatedData(target, res);
		return await next();
	};
};
// node_modules/@hono/zod-validator/dist/index.mjs
function zValidatorFunction(target, schema, hook, options) {
	const caseInsensitiveKeymap = target === "header" && ("_def" in schema || "_zod" in schema) ? Object.fromEntries(Object.keys("in" in schema ? schema.in.shape : schema.shape).map((key) => [key.toLowerCase(), key])) : void 0;
	return validator(target, async (value, c) => {
		let validatorValue = value;
		if (caseInsensitiveKeymap) validatorValue = Object.fromEntries(Object.entries(value).map(([key, value]) => [caseInsensitiveKeymap[key] || key, value]));
		const result = options && options.validationFunction ? await options.validationFunction(schema, validatorValue) : await schema.safeParseAsync(validatorValue);
		if (hook) {
			const hookResult = await hook({
				data: validatorValue,
				...result,
				target
			}, c);
			if (hookResult) {
				if (hookResult instanceof Response) return hookResult;
				if ("response" in hookResult) return hookResult.response;
			}
		}
		if (!result.success) return c.json(result, 400);
		return result.data;
	});
}
var zValidator = zValidatorFunction;
// worker/lib/validate.ts
/**
* Request validation with the shared zod schemas. Failures become
* `{ error: { code: "validation_failed", fields } }` so the UI can show inline errors.
*/
function validate(target, schema) {
	return zValidator(target, schema, (result) => {
		if (!result.success) throw new ApiError("validation_failed", "Check the highlighted fields.", zodFields(result.error));
	});
}
// worker/modules/customers/health.ts
/**
* Customer Subscription Health Score. Owner: Person 4.
* Transparent rules: start at 100, subtract a penalty per signal, clamp to 0..100.
* This is a rule-based score, not a statistically validated churn probability.
*/
/** Penalties are configurable here; tune them with the demo data. */
var PENALTIES = {
	latePayment: 10,
	repeatedLatePayments: 15,
	overdue: 10,
	significantlyOverdue: 20,
	expiringWithoutRenewal: 10,
	pause: 5,
	cancellationRequested: 15
};
function scoreFromSignals(s) {
	const reasons = [];
	if (s.late_payments >= 1) reasons.push({
		signal: `${s.late_payments} late payment${s.late_payments > 1 ? "s" : ""} in the last 180 days`,
		penalty: PENALTIES.latePayment
	});
	if (s.late_payments >= 2) reasons.push({
		signal: "Repeated late payments",
		penalty: PENALTIES.repeatedLatePayments
	});
	if (s.overdue_count > 0) {
		const significant = (s.max_days_overdue ?? 0) > 14;
		reasons.push({
			signal: significant ? `Invoice overdue by ${s.max_days_overdue} days` : `${s.overdue_count} overdue invoice${s.overdue_count > 1 ? "s" : ""}`,
			penalty: significant ? PENALTIES.significantlyOverdue : PENALTIES.overdue
		});
	}
	if (s.expiring_no_renewal > 0) reasons.push({
		signal: "Subscription expiring within 30 days without a renewal",
		penalty: PENALTIES.expiringWithoutRenewal
	});
	if (s.pauses > 0) reasons.push({
		signal: `${s.pauses} pause${s.pauses > 1 ? "s" : ""} in the last 180 days`,
		penalty: Math.min(s.pauses * PENALTIES.pause, 10)
	});
	if (s.pending_cancellations > 0) reasons.push({
		signal: "Cancellation requested",
		penalty: PENALTIES.cancellationRequested
	});
	const score = Math.max(0, Math.min(100, 100 - reasons.reduce((a, r) => a + r.penalty, 0)));
	return {
		score,
		category: score >= 80 ? "healthy" : score >= 50 ? "needs_attention" : "at_risk",
		reasons,
		nextAction: s.pending_cancellations > 0 ? "Call the customer about their cancellation request and offer an alternative plan." : (s.max_days_overdue ?? 0) > 14 ? "Escalate the overdue invoice and agree a payment date." : s.expiring_no_renewal > 0 ? "Prepare a renewal quotation." : s.late_payments >= 2 ? "Suggest automatic payment or shorter payment terms." : s.overdue_count > 0 ? "Send a friendly payment reminder." : "No action needed."
	};
}
/**
* Health for one customer, or for all customers when `customerId` is omitted.
* Each signal is one GROUP BY query (linear in table size), merged in memory, so the
* all-customers view stays fast with thousands of customers.
*/
async function computeHealth(d1, customerId, today = todayISO()) {
	const since = addDays(today, -180);
	const id = customerId ?? null;
	const [customers, active, late, overdue, outstanding, expiring, pauses, cancels] = await Promise.all([
		all(d1, `SELECT id, COALESCE(company_name, contact_name) AS name, email FROM customers WHERE (?1 IS NULL OR id = ?1)`, id),
		all(d1, `SELECT customer_id, COUNT(*) AS n FROM subscriptions WHERE status = 'active' AND (?1 IS NULL OR customer_id = ?1) GROUP BY customer_id`, id),
		all(d1, `SELECT i.customer_id, COUNT(*) AS n FROM payments p JOIN invoices i ON i.id = p.invoice_id
       WHERE p.paid_on > i.due_date AND p.paid_on >= ?2 AND (?1 IS NULL OR i.customer_id = ?1) GROUP BY i.customer_id`, id, since),
		all(d1, `SELECT customer_id, COUNT(*) AS n, MAX(CAST(julianday(?2) - julianday(due_date) AS INTEGER)) AS m FROM invoices
       WHERE status = 'confirmed' AND due_date < ?2 AND total > amount_paid AND (?1 IS NULL OR customer_id = ?1) GROUP BY customer_id`, id, today),
		all(d1, `SELECT customer_id, SUM(total - amount_paid) AS n FROM invoices WHERE status = 'confirmed' AND (?1 IS NULL OR customer_id = ?1) GROUP BY customer_id`, id),
		all(d1, `SELECT s.customer_id, COUNT(*) AS n FROM subscriptions s
       WHERE s.status = 'active' AND s.expiry_date BETWEEN ?2 AND ?3 AND (?1 IS NULL OR s.customer_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM subscriptions r WHERE r.renewed_from_id = s.id AND r.status != 'closed')
       GROUP BY s.customer_id`, id, today, addDays(today, 30)),
		all(d1, `SELECT s.customer_id, COUNT(*) AS n FROM subscription_status_history h JOIN subscriptions s ON s.id = h.subscription_id
       WHERE h.to_status = 'paused' AND h.created_at >= ?2 AND (?1 IS NULL OR s.customer_id = ?1) GROUP BY s.customer_id`, id, since),
		all(d1, `SELECT customer_id, COUNT(*) AS n FROM cancellation_requests WHERE outcome = 'pending' AND (?1 IS NULL OR customer_id = ?1) GROUP BY customer_id`, id)
	]);
	const map = (rows) => new Map(rows.map((r) => [r.customer_id, r]));
	const [a, l, o, out, e, p, cx] = [
		active,
		late,
		overdue,
		outstanding,
		expiring,
		pauses,
		cancels
	].map(map);
	return customers.map((c) => {
		const signals = {
			late_payments: l.get(c.id)?.n ?? 0,
			overdue_count: o.get(c.id)?.n ?? 0,
			max_days_overdue: o.get(c.id)?.m ?? null,
			expiring_no_renewal: e.get(c.id)?.n ?? 0,
			pauses: p.get(c.id)?.n ?? 0,
			pending_cancellations: cx.get(c.id)?.n ?? 0
		};
		return {
			customerId: c.id,
			customerName: c.name,
			email: c.email,
			activeSubscriptions: a.get(c.id)?.n ?? 0,
			outstanding: fromMinor(out.get(c.id)?.n ?? 0),
			...scoreFromSignals(signals)
		};
	});
}
// worker/modules/ai/routes.ts
/**
* Optional AI Finance Copilot. Owner: Person 1.
*
* 1. Match the question to a supported intent (deterministic keyword rules).
* 2. Fetch the figures with predefined, parameterised queries (no model-written SQL).
* 3. If AI_PROVIDER/AI_API_KEY are set, ask the model to phrase a short answer from
*    those figures only; otherwise return a template answer. Figures and links always
*    come from the database, never from the model.
*/
var SUPPORTED = [
	"Which customers have overdue invoices above ₹10,000?",
	"How much revenue did we receive this month?",
	"Which subscriptions expire next week?",
	"Explain the revenue leakage alerts.",
	"Summarize the customers at risk.",
	"What is our MRR?"
];
async function answer(d1, question) {
	const q = question.toLowerCase();
	const today = todayISO();
	if (/overdue|late|unpaid/.test(q)) {
		const threshold = q.match(/(?:above|over|more than|>)\s*₹?\s*([\d,]+)/)?.[1]?.replace(/,/g, "");
		const min = threshold ? toMinor(threshold) : 0;
		const rows = await all(d1, `SELECT c.id, COALESCE(c.company_name, c.contact_name) AS name, SUM(i.total - i.amount_paid) AS balance, COUNT(*) AS invoices, MIN(i.due_date) AS oldest
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.status = 'confirmed' AND i.due_date < ?1 AND i.total > i.amount_paid
       GROUP BY c.id HAVING balance > ?2 ORDER BY balance DESC LIMIT 10`, today, min);
		const total = rows.reduce((a, r) => a + r.balance, 0);
		return {
			intent: "overdue_customers",
			title: `Customers with overdue balances${min ? ` above ${money(min)}` : ""}`,
			figures: [{
				label: "Customers",
				value: String(rows.length)
			}, {
				label: "Overdue amount",
				value: money(total)
			}],
			rows: rows.map((r) => ({
				label: r.name,
				detail: `${money(r.balance)} across ${r.invoices} invoice(s), oldest due ${r.oldest}`,
				href: `/customers/${r.id}`
			})),
			fallback: rows.length ? `${rows.length} customer(s) owe ${money(total)} in overdue invoices. The largest is ${rows[0].name} with ${money(rows[0].balance)}.` : "No customers have overdue invoices matching that amount."
		};
	}
	if (/revenue|collected|received|income/.test(q)) {
		const from = `${today.slice(0, 8)}01`;
		const r = await first(d1, `SELECT (SELECT COALESCE(SUM(amount),0) FROM payments WHERE paid_on BETWEEN ?1 AND ?2) AS amount,
              (SELECT COUNT(*) FROM payments WHERE paid_on BETWEEN ?1 AND ?2) AS count,
              (SELECT COALESCE(SUM(total),0) FROM invoices WHERE status != 'cancelled' AND issue_date BETWEEN ?1 AND ?2) AS billed`, from, today);
		return {
			intent: "revenue_month",
			title: "Revenue this month",
			figures: [
				{
					label: "Collected",
					value: money(r?.amount ?? 0)
				},
				{
					label: "Payments",
					value: String(r?.count ?? 0)
				},
				{
					label: "Billed",
					value: money(r?.billed ?? 0)
				}
			],
			rows: [{
				label: "Open the revenue report",
				detail: `${from} to ${today}`,
				href: "/reports"
			}],
			fallback: `From ${from} to ${today} we collected ${money(r?.amount ?? 0)} from ${r?.count ?? 0} payments, against ${money(r?.billed ?? 0)} billed.`
		};
	}
	if (/expir|renew/.test(q)) {
		const days = /month|30/.test(q) ? 30 : 7;
		const rows = await all(d1, `SELECT s.id, s.number, COALESCE(c.company_name, c.contact_name) AS name, s.expiry_date, ${MRR_EXPR} AS mrr
       FROM subscriptions s JOIN customers c ON c.id = s.customer_id JOIN plans p ON p.id = s.plan_id
       WHERE s.status = 'active' AND s.expiry_date BETWEEN ?1 AND ?2 ORDER BY s.expiry_date LIMIT 20`, today, addDays(today, days));
		return {
			intent: "expiring",
			title: `Subscriptions expiring in the next ${days} days`,
			figures: [{
				label: "Subscriptions",
				value: String(rows.length)
			}, {
				label: "Monthly value",
				value: money(Math.round(rows.reduce((a, r) => a + r.mrr, 0)))
			}],
			rows: rows.map((r) => ({
				label: `${r.number} · ${r.name}`,
				detail: `Expires ${r.expiry_date}`,
				href: `/subscriptions/${r.id}`
			})),
			fallback: rows.length ? `${rows.length} subscription(s) expire in the next ${days} days. Prepare renewals from the Renewals page.` : `No subscriptions expire in the next ${days} days.`
		};
	}
	if (/leak|anomal|finding|risk.*revenue|alert/.test(q)) {
		const rows = await all(d1, `SELECT rule, COUNT(*) AS count, SUM(amount_at_risk) AS amount FROM findings WHERE status != 'resolved' GROUP BY rule ORDER BY amount DESC`);
		const total = rows.reduce((a, r) => a + r.amount, 0);
		return {
			intent: "leakage",
			title: "Open revenue leakage and anomaly findings",
			figures: [{
				label: "Open findings",
				value: String(rows.reduce((a, r) => a + r.count, 0))
			}, {
				label: "Potential revenue at risk",
				value: money(total)
			}],
			rows: rows.map((r) => ({
				label: r.rule.replace(/_/g, " "),
				detail: `${r.count} finding(s), ${money(r.amount)} at risk`,
				href: "/finance/leakage"
			})),
			fallback: rows.length ? `There are ${rows.reduce((a, r) => a + r.count, 0)} open findings with ${money(total)} of potential revenue at risk. The biggest category is "${rows[0].rule.replace(/_/g, " ")}".` : "There are no open leakage or anomaly findings."
		};
	}
	if (/risk|health|churn/.test(q)) {
		const all = (await computeHealth(d1)).filter((h) => h.category !== "healthy").sort((a, b) => a.score - b.score);
		return {
			intent: "at_risk",
			title: "Customers at risk",
			figures: [{
				label: "At risk",
				value: String(all.filter((h) => h.category === "at_risk").length)
			}, {
				label: "Needs attention",
				value: String(all.filter((h) => h.category === "needs_attention").length)
			}],
			rows: all.slice(0, 10).map((h) => ({
				label: `${h.customerName} · score ${h.score}`,
				detail: h.reasons.map((r) => r.signal).join("; "),
				href: `/customers/${h.customerId}`
			})),
			fallback: all.length ? `${all.length} customer(s) need attention. Lowest score: ${all[0].customerName} (${all[0].score}) — ${all[0].nextAction}` : "All customers are healthy."
		};
	}
	if (/mrr|arr|recurring/.test(q)) {
		const r = await first(d1, `SELECT COALESCE(SUM(${MRR_EXPR}),0) AS mrr, COUNT(*) AS n FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.status = 'active'`);
		const mrr = Math.round(r?.mrr ?? 0);
		return {
			intent: "mrr",
			title: "Monthly recurring revenue",
			figures: [
				{
					label: "MRR",
					value: money(mrr)
				},
				{
					label: "ARR",
					value: money(mrr * 12)
				},
				{
					label: "Active subscriptions",
					value: String(r?.n ?? 0)
				}
			],
			rows: [{
				label: "Open the MRR trend",
				detail: "Reports → MRR",
				href: "/reports"
			}],
			fallback: `MRR is ${money(mrr)} (ARR ${money(mrr * 12)}) from ${r?.n ?? 0} active subscriptions.`
		};
	}
	return null;
}
var cache = /* @__PURE__ */ new Map();
async function phrase(env, question, a) {
	if (!env.AI_API_KEY || !env.AI_PROVIDER) return {
		text: a.fallback,
		source: "rules"
	};
	const context = JSON.stringify({
		title: a.title,
		figures: a.figures,
		items: a.rows.slice(0, 8).map((r) => `${r.label}: ${r.detail}`)
	});
	const key = `${a.intent}:${context}`;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < 3e5) return {
		text: hit.text,
		source: "ai"
	};
	const system = "You are a finance assistant for a subscription business. Answer in at most 4 short sentences using ONLY the figures in the context. Never invent numbers. Use ₹ amounts exactly as given. Suggest one concrete next step.";
	try {
		let text;
		if (env.AI_PROVIDER === "groq") {
			const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
				method: "POST",
				headers: {
					authorization: `Bearer ${env.AI_API_KEY}`,
					"content-type": "application/json"
				},
				body: JSON.stringify({
					model: env.AI_MODEL || "llama-3.3-70b-versatile",
					max_tokens: 220,
					temperature: .2,
					messages: [{
						role: "system",
						content: system
					}, {
						role: "user",
						content: `Question: ${question}\nContext: ${context}`
					}]
				})
			});
			if (!res.ok) throw new Error(`Groq ${res.status}`);
			text = (await res.json()).choices?.[0]?.message?.content;
		} else if (env.AI_PROVIDER === "gemini") {
			const model = env.AI_MODEL || "gemini-2.0-flash";
			const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
				method: "POST",
				headers: {
					"x-goog-api-key": env.AI_API_KEY,
					"content-type": "application/json"
				},
				body: JSON.stringify({
					systemInstruction: { parts: [{ text: system }] },
					contents: [{
						role: "user",
						parts: [{ text: `Question: ${question}\nContext: ${context}` }]
					}],
					generationConfig: {
						maxOutputTokens: 220,
						temperature: .2
					}
				})
			});
			if (!res.ok) throw new Error(`Gemini ${res.status}`);
			text = (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
		}
		if (!text) return {
			text: a.fallback,
			source: "rules"
		};
		cache.set(key, {
			at: Date.now(),
			text: text.trim()
		});
		return {
			text: text.trim(),
			source: "ai"
		};
	} catch (err) {
		console.warn("AI copilot fallback", err);
		return {
			text: a.fallback,
			source: "rules"
		};
	}
}
var aiRoutes = new Hono().get("/status", requirePermission("ai:use"), (c) => c.json({
	enabled: !!(c.env.AI_API_KEY && c.env.AI_PROVIDER),
	provider: c.env.AI_PROVIDER || null,
	suggestions: SUPPORTED
})).post("/ask", requirePermission("ai:use"), rateLimit({
	name: "ai",
	limit: 30,
	windowSeconds: 3600
}), validate("json", object({ question: string().trim().min(3).max(300) })), async (c) => {
	const { question } = c.req.valid("json");
	const a = await answer(c.env.DB, question);
	if (!a) return c.json({ data: {
		supported: false,
		text: "I can answer questions about overdue invoices, revenue this month, expiring subscriptions, revenue leakage, customers at risk and MRR.",
		suggestions: SUPPORTED
	} });
	const { text, source } = await phrase(c.env, question, a);
	return c.json({ data: {
		supported: true,
		intent: a.intent,
		title: a.title,
		text,
		source,
		figures: a.figures,
		rows: a.rows
	} });
});
// shared/schemas/common.ts
var idSchema = string().min(1).max(64);
/** Money as a string with up to 2 decimals, 0 or more. Convert with toMinor() on the server. */
var moneySchema = string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount with up to 2 decimals");
var positiveMoneySchema = moneySchema.refine((v) => Number(v) > 0, "Amount must be above 0");
/** Percentage 0-100 with up to 2 decimals. */
var percentSchema = string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage").refine((v) => Number(v) >= 0 && Number(v) <= 100, "Must be between 0 and 100");
var isoDateSchema = string().refine(isISODate, "Enter a valid date (YYYY-MM-DD)");
var emailSchema = string().trim().toLowerCase().email("Enter a valid email address").max(254);
/** PRD: more than 8 characters, one uppercase, one lowercase, one special character. */
var PASSWORD_RULES = [
	{
		id: "length",
		label: "More than 8 characters",
		test: (v) => v.length > 8
	},
	{
		id: "upper",
		label: "One uppercase letter",
		test: (v) => /[A-Z]/.test(v)
	},
	{
		id: "lower",
		label: "One lowercase letter",
		test: (v) => /[a-z]/.test(v)
	},
	{
		id: "special",
		label: "One special character",
		test: (v) => /[^A-Za-z0-9]/.test(v)
	}
];
var passwordSchema = string().max(128, "Password is too long").superRefine((v, ctx) => {
	const failed = PASSWORD_RULES.filter((r) => !r.test(v));
	if (failed.length) ctx.addIssue({
		code: "custom",
		message: `Password needs: ${failed.map((r) => r.label.toLowerCase()).join(", ")}`
	});
});
var nameSchema = string().trim().min(1, "Required").max(120);
var notesSchema = string().trim().max(2e3).optional().nullable();
var quantitySchema = number().int("Whole number only").min(1, "At least 1");
// shared/schemas/auth.ts
var signupSchema = object({
	name: nameSchema,
	email: emailSchema,
	password: passwordSchema,
	companyName: string().trim().max(120).optional()
});
var loginSchema = object({
	email: emailSchema,
	password: string().min(1, "Required").max(128)
});
var forgotPasswordSchema = object({ email: emailSchema });
var resetPasswordSchema = object({
	token: string().min(20).max(200),
	password: passwordSchema
});
var createStaffSchema = object({
	name: nameSchema,
	email: emailSchema,
	password: passwordSchema,
	role: _enum(["admin", "staff"]).default("staff")
});
var updateStaffSchema = object({
	name: nameSchema.optional(),
	isActive: boolean().optional(),
	role: _enum(["admin", "staff"]).optional()
});
// shared/schemas/catalog.ts
var PRODUCT_TYPES = [
	"service",
	"goods",
	"software"
];
var BILLING_PERIODS = [
	"daily",
	"weekly",
	"monthly",
	"yearly"
];
var productSchema = object({
	name: nameSchema,
	type: _enum(PRODUCT_TYPES),
	salesPrice: moneySchema,
	costPrice: moneySchema.default("0.00"),
	notes: notesSchema,
	isActive: boolean().default(true),
	taxIds: array(idSchema).default([])
});
var variantSchema = object({
	attribute: nameSchema,
	value: nameSchema,
	extraPrice: moneySchema.default("0.00")
});
var planSchema = object({
	name: nameSchema,
	price: moneySchema,
	billingPeriod: _enum(BILLING_PERIODS),
	minQuantity: number().int().min(1).default(1),
	availableFrom: isoDateSchema,
	availableTo: isoDateSchema.nullable().optional(),
	autoClose: boolean().default(false),
	closable: boolean().default(true),
	pausable: boolean().default(false),
	renewable: boolean().default(true)
}).refine((p) => !p.availableTo || p.availableTo >= p.availableFrom, {
	path: ["availableTo"],
	message: "End date must be on or after the start date"
});
var taxSchema = object({
	name: nameSchema,
	kind: _enum(["percentage", "fixed"]),
	/** Percentage (e.g. "18") or fixed amount per unit (e.g. "25.00"). */
	rate: string().trim(),
	isActive: boolean().default(true)
}).superRefine((t, ctx) => {
	const r = t.kind === "percentage" ? percentSchema.safeParse(t.rate) : moneySchema.safeParse(t.rate);
	if (!r.success) ctx.addIssue({
		code: "custom",
		path: ["rate"],
		message: r.error.issues[0]?.message ?? "Invalid"
	});
});
var discountSchema = object({
	name: nameSchema,
	kind: _enum(["fixed", "percentage"]),
	/** Percentage (e.g. "10") or fixed amount (e.g. "500.00"). */
	value: string().trim(),
	minPurchase: moneySchema.default("0.00"),
	minQuantity: number().int().min(0).default(0),
	startsOn: isoDateSchema,
	endsOn: isoDateSchema.nullable().optional(),
	usageLimit: number().int().min(1).nullable().optional(),
	scope: _enum(["product", "subscription"]),
	productIds: array(idSchema).default([]),
	isActive: boolean().default(true)
}).superRefine((d, ctx) => {
	const r = d.kind === "percentage" ? percentSchema.safeParse(d.value) : moneySchema.safeParse(d.value);
	if (!r.success) ctx.addIssue({
		code: "custom",
		path: ["value"],
		message: r.error.issues[0]?.message ?? "Invalid"
	});
	if (d.endsOn && d.endsOn < d.startsOn) ctx.addIssue({
		code: "custom",
		path: ["endsOn"],
		message: "End date must be on or after the start date"
	});
	if (d.scope === "product" && d.productIds.length === 0) ctx.addIssue({
		code: "custom",
		path: ["productIds"],
		message: "Choose at least one product"
	});
});
// shared/schemas/sales.ts
var templateLineSchema = object({
	productId: idSchema,
	variantId: idSchema.nullable().optional(),
	quantity: quantitySchema
});
var quotationTemplateSchema = object({
	name: nameSchema,
	planId: idSchema,
	validityDays: number().int().min(1).max(365),
	paymentTermDays: number().int().min(0).max(365).default(15),
	lines: array(templateLineSchema).default([])
});
var customerSchema = object({
	contactName: nameSchema,
	email: emailSchema,
	companyName: string().trim().max(120).optional().nullable(),
	phone: string().trim().max(40).optional().nullable(),
	billingAddress: string().trim().max(500).optional().nullable(),
	taxId: string().trim().max(40).optional().nullable()
});
var subscriptionLineSchema = object({
	productId: idSchema,
	variantId: idSchema.nullable().optional(),
	quantity: quantitySchema,
	/** Optional override; defaults to product sales price + variant extra price. */
	unitPrice: moneySchema.optional(),
	taxId: idSchema.nullable().optional()
});
var subscriptionSchema = object({
	customerId: idSchema,
	planId: idSchema,
	startDate: isoDateSchema,
	expiryDate: isoDateSchema.nullable().optional(),
	paymentTermDays: number().int().min(0).max(365).default(15),
	lines: array(subscriptionLineSchema).default([])
}).refine((s) => !s.expiryDate || s.expiryDate >= s.startDate, {
	path: ["expiryDate"],
	message: "Expiry must be on or after the start date"
});
var subscriptionTransitionSchema = object({
	to: _enum([
		"quotation",
		"confirmed",
		"active",
		"paused",
		"closed"
	]),
	note: notesSchema
});
var PAYMENT_METHODS = [
	"bank_transfer",
	"cash",
	"upi",
	"card",
	"other"
];
var paymentSchema = object({
	method: _enum(PAYMENT_METHODS),
	amount: positiveMoneySchema,
	paidOn: isoDateSchema,
	reference: string().trim().max(100).optional().nullable(),
	note: notesSchema
});
// worker/modules/auth/routes.ts
/**
* AUTH-1, AUTH-2: signup, login, logout, session, forgot/reset password.
* Owner: Person 1 (core backend).
*/
var RESET_TTL_MS = 18e5;
var authRoutes = new Hono().post("/signup", rateLimit({
	name: "signup",
	limit: 10,
	windowSeconds: 600
}), validate("json", signupSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	if (await db.select({ id: users$2.id }).from(users$2).where(eq(users$2.email, input.email)).get()) throw ApiError.conflict("An account with this email already exists.", { email: "Email is already registered" });
	const userId = newId();
	const passwordHash = await hashPassword(input.password);
	const staffCreated = await db.select({ id: customers$7.id }).from(customers$7).where(and(eq(customers$7.email, input.email), isNull(customers$7.userId))).get();
	const customerId = staffCreated?.id ?? newId();
	try {
		await db.batch([
			db.insert(users$2).values({
				id: userId,
				email: input.email,
				passwordHash,
				name: input.name,
				role: "customer"
			}),
			staffCreated ? db.update(customers$7).set({
				userId,
				updatedAt: nowISO()
			}).where(eq(customers$7.id, customerId)) : db.insert(customers$7).values({
				id: customerId,
				userId,
				email: input.email,
				contactName: input.name,
				companyName: input.companyName ?? null
			}),
			activityEntry(db, {
				customerId,
				type: "customer.registered",
				summary: `${input.name} created a portal account`,
				actorId: userId
			})
		]);
	} catch (err) {
		if (isUniqueViolation(err)) throw ApiError.conflict("An account with this email already exists.", { email: "Email is already registered" });
		throw err;
	}
	await startSession(c, userId);
	return c.json({ user: {
		id: userId,
		email: input.email,
		name: input.name,
		role: "customer",
		customerId
	} }, 201);
}).post("/login", rateLimit({
	name: "login",
	limit: 10,
	windowSeconds: 300
}), validate("json", loginSchema), async (c) => {
	const { email, password } = c.req.valid("json");
	const db = c.get("db");
	const user = await db.select().from(users$2).where(eq(users$2.email, email)).get();
	const ok = user ? await verifyPassword(password, user.passwordHash) : false;
	if (!user || !ok) throw new ApiError("unauthenticated", "Email or password is incorrect.");
	if (!user.isActive) throw ApiError.forbidden("This account is disabled. Contact your administrator.");
	await startSession(c, user.id);
	const customer = await db.select({ id: customers$7.id }).from(customers$7).where(eq(customers$7.userId, user.id)).get();
	return c.json({ user: {
		id: user.id,
		email: user.email,
		name: user.name,
		role: user.role,
		customerId: customer?.id ?? null
	} });
}).post("/logout", async (c) => {
	await endSession(c);
	return c.body(null, 204);
}).get("/me", requireAuth, (c) => c.json({ user: currentUser(c) })).post("/forgot-password", rateLimit({
	name: "forgot",
	limit: 5,
	windowSeconds: 900
}), validate("json", forgotPasswordSchema), async (c) => {
	const { email } = c.req.valid("json");
	const db = c.get("db");
	const user = await db.select().from(users$2).where(eq(users$2.email, email)).get();
	if (user?.isActive) {
		const token = randomToken();
		await db.insert(passwordResetTokens).values({
			id: newId(),
			userId: user.id,
			tokenHash: await sha256Hex(token),
			expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString()
		});
		const link = `${c.env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
		await sendEmail(db, c.env, {
			to: user.email,
			userId: user.id,
			subject: "Reset your Brightloop password",
			body: `Hi ${user.name},\n\nUse this link to set a new password. It works once and expires in 30 minutes.\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
			entity: "user",
			entityId: user.id
		});
	}
	return c.json({ message: "If an account exists for this email, a reset link is on its way." });
}).post("/reset-password", rateLimit({
	name: "reset",
	limit: 10,
	windowSeconds: 900
}), validate("json", resetPasswordSchema), async (c) => {
	const { token, password } = c.req.valid("json");
	const db = c.get("db");
	const now = nowISO();
	const row = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, await sha256Hex(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now))).get();
	if (!row) throw new ApiError("bad_request", "This reset link is invalid or has expired. Request a new one.");
	const passwordHash = await hashPassword(password);
	await db.batch([
		db.update(users$2).set({
			passwordHash,
			updatedAt: now
		}).where(eq(users$2.id, row.userId)),
		db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, row.id)),
		db.delete(sessions).where(eq(sessions.userId, row.userId)),
		auditEntry(db, {
			actorId: row.userId,
			action: "password.reset",
			entity: "user",
			entityId: row.userId
		})
	]);
	return c.json({ message: "Password updated. Sign in with your new password." });
});
// worker/lib/pagination.ts
function pageOffset(q) {
	return {
		limit: q.pageSize,
		offset: (q.page - 1) * q.pageSize
	};
}
function paginated(data, q, total) {
	return {
		data,
		page: q.page,
		pageSize: q.pageSize,
		total
	};
}
/**
* Turn `?sort=-createdAt` into an ORDER BY using an allow-list of sortable columns.
* Unknown keys fall back to the default so user input never reaches SQL directly.
*/
function orderBy(sort, columns, fallback) {
	if (!sort) return fallback;
	const column = columns[sort.replace(/^-/, "")];
	if (!column) return fallback;
	return sort.startsWith("-") ? desc(column) : asc(column);
}
// worker/modules/billing/routes.ts
/**
* INV-4: "Run billing now" and billing run history. Owner: Person 1.
*/
var runSchema = object({ 
/** Demo mode only: bill "as of" another date to simulate a month of billing. */
asOf: isoDateSchema.optional() });
var billingRoutes = new Hono().use(requirePermission("billing:run")).post("/run", validate("json", runSchema), async (c) => {
	const { asOf } = c.req.valid("json");
	if (asOf && c.env.DEMO_MODE !== "true") throw ApiError.forbidden("Billing for another date is available in demo mode only.");
	const result = await runBilling(c.get("db"), c.env.DB, {
		today: asOf,
		trigger: "manual",
		actorId: currentUser(c).id
	});
	return c.json({ data: result });
}).get("/runs", validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const [rows, total] = await Promise.all([db.select({
		r: billingRuns,
		actorName: users$2.name
	}).from(billingRuns).leftJoin(users$2, eq(users$2.id, billingRuns.actorId)).orderBy(desc(billingRuns.startedAt)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(billingRuns).get()]);
	const data = rows.map((r) => ({
		...r.r,
		actorName: r.actorName,
		details: r.r.details
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/config", (c) => c.json({ demoMode: c.env.DEMO_MODE === "true" }));
// worker/modules/staff/routes.ts
/**
* AUTH-4: admin-only creation, disabling and role view of staff members.
* Owner: Person 1 (core backend).
*/
var { users: users$1 } = schema_exports;
var staffColumns = {
	id: users$1.id,
	email: users$1.email,
	name: users$1.name,
	role: users$1.role,
	isActive: users$1.isActive,
	createdAt: users$1.createdAt
};
var staffRoutes = new Hono().use(requirePermission("staff:manage")).get("/", validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = and(inArray(users$1.role, ["admin", "staff"]), q.q ? or(like(users$1.name, `%${q.q}%`), like(users$1.email, `%${q.q}%`)) : void 0);
	const [rows, total] = await Promise.all([db.select(staffColumns).from(users$1).where(where).orderBy(orderBy(q.sort, {
		name: users$1.name,
		email: users$1.email,
		createdAt: users$1.createdAt
	}, sql`${users$1.createdAt} desc`)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(users$1).where(where).get()]);
	return c.json(paginated(rows, q, total?.n ?? 0));
}).post("/", validate("json", createStaffSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	const id = newId();
	try {
		await db.batch([db.insert(users$1).values({
			id,
			email: input.email,
			name: input.name,
			role: input.role,
			passwordHash: await hashPassword(input.password)
		}), auditEntry(db, {
			actorId: currentUser(c).id,
			action: "staff.created",
			entity: "user",
			entityId: id,
			meta: { role: input.role }
		})]);
	} catch (err) {
		if (isUniqueViolation(err)) throw ApiError.conflict("An account with this email already exists.", { email: "Email is already registered" });
		throw err;
	}
	const created = await db.select(staffColumns).from(users$1).where(eq(users$1.id, id)).get();
	return c.json({ data: created }, 201);
}).patch("/:id", validate("json", updateStaffSchema), async (c) => {
	const id = c.req.param("id");
	const input = c.req.valid("json");
	const db = c.get("db");
	const actor = currentUser(c);
	const target = await db.select().from(users$1).where(eq(users$1.id, id)).get();
	if (!target || target.role === "customer") throw ApiError.notFound("Staff member");
	if (id === actor.id && (input.isActive === false || input.role && input.role !== "admin")) throw new ApiError("bad_request", "You cannot disable or demote your own account.");
	await db.batch([
		db.update(users$1).set({
			...input,
			updatedAt: nowISO()
		}).where(eq(users$1.id, id)),
		...input.isActive === false ? [db.delete(sessions).where(eq(sessions.userId, id))] : [],
		auditEntry(db, {
			actorId: actor.id,
			action: "staff.updated",
			entity: "user",
			entityId: id,
			meta: input
		})
	]);
	const updated = await db.select(staffColumns).from(users$1).where(eq(users$1.id, id)).get();
	return c.json({ data: updated });
});
// worker/modules/subscriptions/routes.ts
/**
* SUB-1..3: subscriptions list, detail, lifecycle actions. Owner: Person 1.
*/
var { subscriptions: subscriptions$3, customers: customers$4, plans: plans$4 } = schema_exports;
var listSchema$6 = listQuerySchema.extend({
	status: string().optional(),
	customerId: string().optional(),
	planId: string().optional(),
	from: string().optional(),
	to: string().optional()
});
var subscriptionRoutes = new Hono().get("/", requirePermission("subscription:read"), validate("query", listSchema$6), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const statuses = (q.status ?? "").split(",").filter((s) => SUBSCRIPTION_STATUSES.includes(s));
	const where = and(statuses.length ? inArray(subscriptions$3.status, statuses) : void 0, q.customerId ? eq(subscriptions$3.customerId, q.customerId) : void 0, q.planId ? eq(subscriptions$3.planId, q.planId) : void 0, q.from ? gte(subscriptions$3.startDate, q.from) : void 0, q.to ? lte(subscriptions$3.startDate, q.to) : void 0, q.q ? or(sql`${subscriptions$3.number} like ${likeTerm(q.q)}`, sql`${customers$4.companyName} like ${likeTerm(q.q)}`, sql`${customers$4.contactName} like ${likeTerm(q.q)}`) : void 0);
	const [rows, total] = await Promise.all([db.select({
		s: subscriptions$3,
		c: customers$4,
		planName: plans$4.name,
		billingPeriod: plans$4.billingPeriod,
		planPrice: plans$4.price
	}).from(subscriptions$3).innerJoin(customers$4, eq(customers$4.id, subscriptions$3.customerId)).innerJoin(plans$4, eq(plans$4.id, subscriptions$3.planId)).where(where).orderBy(orderBy(q.sort, {
		number: subscriptions$3.number,
		startDate: subscriptions$3.startDate,
		nextInvoiceDate: subscriptions$3.nextInvoiceDate,
		createdAt: subscriptions$3.createdAt
	}, desc(subscriptions$3.createdAt))).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(subscriptions$3).innerJoin(customers$4, eq(customers$4.id, subscriptions$3.customerId)).where(where).get()]);
	const ids = rows.map((r) => r.s.id);
	const lineTotals = ids.length ? await db.select({
		id: subscriptionLines$2.subscriptionId,
		total: sql`sum(${subscriptionLines$2.amount})`
	}).from(subscriptionLines$2).where(inArray(subscriptionLines$2.subscriptionId, ids)).groupBy(subscriptionLines$2.subscriptionId) : [];
	const data = rows.map((r) => ({
		...toSubscription(r.s, {
			customerName: customerLabel(r.c),
			planName: r.planName
		}),
		billingPeriod: r.billingPeriod,
		recurringTotal: fromMinor(r.planPrice + (lineTotals.find((l) => l.id === r.s.id)?.total ?? 0))
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).post("/", requirePermission("subscription:write"), validate("json", subscriptionSchema), async (c) => {
	const data = await createSubscription(c.get("db"), c.env.DB, c.req.valid("json"), currentUser(c).id);
	return c.json({ data }, 201);
}).get("/:id", requirePermission("subscription:read"), async (c) => c.json({ data: await getSubscription(c.get("db"), c.req.param("id")) })).patch("/:id", requirePermission("subscription:write"), validate("json", subscriptionSchema), async (c) => {
	const data = await updateSubscription(c.get("db"), c.req.param("id"), c.req.valid("json"), currentUser(c).id);
	return c.json({ data });
}).post("/:id/transition", requirePermission("subscription:write"), validate("json", subscriptionTransitionSchema), async (c) => {
	const { to, note } = c.req.valid("json");
	const data = await transitionSubscription(c.get("db"), c.req.param("id"), to, currentUser(c).id, note);
	return c.json({ data });
}).post("/:id/renew", requirePermission("subscription:write"), async (c) => {
	const data = await createRenewalQuotation(c.get("db"), c.env.DB, c.req.param("id"), currentUser(c).id);
	return c.json({ data }, 201);
}).get("/:id/history", requirePermission("subscription:read"), async (c) => c.json({ data: await getSubscriptionHistory(c.get("db"), c.req.param("id")) })).get("/:id/invoices", requirePermission("subscription:read"), async (c) => c.json({ data: await getSubscriptionInvoices(c.get("db"), c.req.param("id")) }));
// worker/modules/system/routes.ts
/**
* Platform endpoints: health check and the signed-in user's notifications (outbox).
* Owner: Person 1 (core backend).
*/
var systemRoutes = new Hono().get("/health", async (c) => {
	const row = await c.env.DB.prepare("SELECT 1 AS ok").first();
	return c.json({
		status: "ok",
		database: row?.ok === 1 ? "ok" : "unavailable",
		time: (/* @__PURE__ */ new Date()).toISOString()
	});
}).get("/notifications", requireAuth, async (c) => {
	const user = currentUser(c);
	const { notifications: n } = schema_exports;
	const rows = await c.get("db").select().from(n).where(or(eq(n.userId, user.id), and(eq(n.channel, "email"), eq(n.recipient, user.email)))).orderBy(desc(n.createdAt)).limit(50);
	return c.json({ data: rows });
}).get("/outbox", requirePermission("customer:read"), async (c) => {
	const { notifications: n } = schema_exports;
	const rows = await c.get("db").select().from(n).where(eq(n.channel, "email")).orderBy(desc(n.createdAt)).limit(100);
	return c.json({ data: rows });
});
// worker/modules/discounts/routes.ts
/**
* DISC-1, DISC-2: discount rules. Owner: Person 2. Application to invoices (DISC-3)
* happens in the billing run through shared/pricing.ts.
* Read: admin + staff. Write: admin only.
*/
var { discounts, discountProducts } = schema_exports;
var listSchema$5 = listQuerySchema.extend({ state: _enum([
	"live",
	"expired",
	"exhausted"
]).optional() });
function values(input) {
	return {
		name: input.name,
		kind: input.kind,
		value: input.kind === "percentage" ? toBasisPoints(input.value) : toMinor(input.value),
		minPurchase: toMinor(input.minPurchase),
		minQuantity: input.minQuantity,
		startsOn: input.startsOn,
		endsOn: input.endsOn ?? null,
		usageLimit: input.usageLimit ?? null,
		scope: input.scope,
		isActive: input.isActive
	};
}
async function productIdsFor(db, ids) {
	const map = /* @__PURE__ */ new Map();
	if (!ids.length) return map;
	const rows = await db.select().from(discountProducts).where(inArray(discountProducts.discountId, ids));
	for (const r of rows) map.set(r.discountId, [...map.get(r.discountId) ?? [], r.productId]);
	return map;
}
async function load(db, id) {
	const row = await db.select().from(discounts).where(eq(discounts.id, id)).get();
	if (!row) throw ApiError.notFound("Discount");
	return toDiscount(row, (await productIdsFor(db, [id])).get(id) ?? []);
}
var discountRoutes = new Hono().get("/", requirePermission("discount:read"), validate("query", listSchema$5), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = and(q.q ? like(discounts.name, likeTerm(q.q)) : void 0);
	const [rows, total] = await Promise.all([db.select().from(discounts).where(where).orderBy(asc(discounts.name)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(discounts).where(where).get()]);
	const products = await productIdsFor(db, rows.map((r) => r.id));
	const today = todayISO();
	const data = rows.map((r) => ({
		...toDiscount(r, products.get(r.id) ?? []),
		state: r.usageLimit !== null && r.usageCount >= r.usageLimit ? "exhausted" : r.endsOn && r.endsOn < today ? "expired" : r.startsOn > today ? "scheduled" : r.isActive ? "live" : "inactive"
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/:id", requirePermission("discount:read"), async (c) => c.json({ data: await load(c.get("db"), c.req.param("id")) })).post("/", requirePermission("discount:write"), validate("json", discountSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	const id = newId();
	await db.batch([
		db.insert(discounts).values({
			id,
			...values(input)
		}),
		...input.scope === "product" ? input.productIds.map((productId) => db.insert(discountProducts).values({
			discountId: id,
			productId
		})) : [],
		auditEntry(db, {
			actorId: currentUser(c).id,
			action: "discount.created",
			entity: "discount",
			entityId: id
		})
	]);
	return c.json({ data: await load(db, id) }, 201);
}).patch("/:id", requirePermission("discount:write"), validate("json", discountSchema), async (c) => {
	const id = c.req.param("id");
	const input = c.req.valid("json");
	const db = c.get("db");
	await load(db, id);
	await db.batch([
		db.update(discounts).set({
			...values(input),
			updatedAt: nowISO()
		}).where(eq(discounts.id, id)),
		db.delete(discountProducts).where(eq(discountProducts.discountId, id)),
		...input.scope === "product" ? input.productIds.map((productId) => db.insert(discountProducts).values({
			discountId: id,
			productId
		})) : [],
		auditEntry(db, {
			actorId: currentUser(c).id,
			action: "discount.updated",
			entity: "discount",
			entityId: id
		})
	]);
	return c.json({ data: await load(db, id) });
}).delete("/:id", requirePermission("discount:write"), async (c) => {
	const id = c.req.param("id");
	const db = c.get("db");
	const used = await db.select({ n: count() }).from(discountRedemptions$1).where(eq(discountRedemptions$1.discountId, id)).get();
	if (used && used.n > 0) throw ApiError.conflict("This discount has been used on invoices. Deactivate it instead.");
	await db.delete(discounts).where(eq(discounts.id, id));
	return c.body(null, 204);
});
// worker/modules/plans/routes.ts
/**
* PLAN-1, PLAN-2: subscription plans and their lifecycle switches. Owner: Person 2.
* Read: admin + staff. Write: admin only.
*/
var { plans: plans$3 } = schema_exports;
var listSchema$4 = listQuerySchema.extend({ status: _enum(["active", "closed"]).optional() });
function planValues(input) {
	return {
		name: input.name,
		price: toMinor(input.price),
		billingPeriod: input.billingPeriod,
		minQuantity: input.minQuantity,
		availableFrom: input.availableFrom,
		availableTo: input.availableTo ?? null,
		autoClose: input.autoClose,
		closable: input.closable,
		pausable: input.pausable,
		renewable: input.renewable
	};
}
var planRoutes = new Hono().get("/", requirePermission("catalog:read"), validate("query", listSchema$4), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = and(q.q ? like(plans$3.name, likeTerm(q.q)) : void 0, q.status ? eq(plans$3.status, q.status) : void 0);
	const activeSubs = sql`(select count(*) from subscriptions s where s.plan_id = ${plans$3.id} and s.status in ('active','paused'))`;
	const [rows, total] = await Promise.all([db.select({
		p: plans$3,
		activeSubs
	}).from(plans$3).where(where).orderBy(orderBy(q.sort, {
		name: plans$3.name,
		price: plans$3.price,
		createdAt: plans$3.createdAt
	}, asc(plans$3.name))).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(plans$3).where(where).get()]);
	return c.json(paginated(rows.map((r) => ({
		...toPlan(r.p),
		activeSubscriptions: r.activeSubs
	})), q, total?.n ?? 0));
}).get("/:id", requirePermission("catalog:read"), async (c) => {
	const row = await c.get("db").select().from(plans$3).where(eq(plans$3.id, c.req.param("id"))).get();
	if (!row) throw ApiError.notFound("Plan");
	return c.json({ data: toPlan(row) });
}).post("/", requirePermission("catalog:write"), validate("json", planSchema), async (c) => {
	const db = c.get("db");
	const id = newId();
	await db.batch([db.insert(plans$3).values({
		id,
		...planValues(c.req.valid("json"))
	}), auditEntry(db, {
		actorId: currentUser(c).id,
		action: "plan.created",
		entity: "plan",
		entityId: id
	})]);
	const row = await db.select().from(plans$3).where(eq(plans$3.id, id)).get();
	return c.json({ data: toPlan(row) }, 201);
}).patch("/:id", requirePermission("catalog:write"), validate("json", planSchema), async (c) => {
	const id = c.req.param("id");
	const db = c.get("db");
	const res = await db.update(plans$3).set({
		...planValues(c.req.valid("json")),
		updatedAt: nowISO()
	}).where(eq(plans$3.id, id)).returning();
	if (!res[0]) throw ApiError.notFound("Plan");
	await auditEntry(db, {
		actorId: currentUser(c).id,
		action: "plan.updated",
		entity: "plan",
		entityId: id
	});
	return c.json({ data: toPlan(res[0]) });
}).post("/:id/close", requirePermission("catalog:write"), async (c) => {
	const id = c.req.param("id");
	const db = c.get("db");
	const res = await db.update(plans$3).set({
		status: "closed",
		updatedAt: nowISO()
	}).where(eq(plans$3.id, id)).returning();
	if (!res[0]) throw ApiError.notFound("Plan");
	await auditEntry(db, {
		actorId: currentUser(c).id,
		action: "plan.closed",
		entity: "plan",
		entityId: id
	});
	return c.json({ data: toPlan(res[0]) });
}).post("/:id/reopen", requirePermission("catalog:write"), async (c) => {
	const id = c.req.param("id");
	const res = await c.get("db").update(plans$3).set({
		status: "active",
		updatedAt: nowISO()
	}).where(eq(plans$3.id, id)).returning();
	if (!res[0]) throw ApiError.notFound("Plan");
	return c.json({ data: toPlan(res[0]) });
});
// worker/modules/products/routes.ts
/**
* CAT-1, CAT-2: products and variants. Owner: Person 2.
* Read: admin + staff. Write: admin only.
*/
var { products: products$1, productVariants, productTaxes } = schema_exports;
var listSchema$3 = listQuerySchema.extend({
	active: _enum(["true", "false"]).optional(),
	type: _enum([
		"service",
		"goods",
		"software"
	]).optional()
});
function toVariant(r) {
	return {
		id: r.id,
		productId: r.productId,
		attribute: r.attribute,
		value: r.value,
		extraPrice: fromMinor(r.extraPrice)
	};
}
async function taxIdsFor(db, ids) {
	const map = /* @__PURE__ */ new Map();
	if (!ids.length) return map;
	const rows = await db.select().from(productTaxes).where(inArray(productTaxes.productId, ids));
	for (const r of rows) map.set(r.productId, [...map.get(r.productId) ?? [], r.taxId]);
	return map;
}
async function loadProduct(db, id) {
	const row = await db.select().from(products$1).where(eq(products$1.id, id)).get();
	if (!row) throw ApiError.notFound("Product");
	const [taxes, variants] = await Promise.all([taxIdsFor(db, [id]), db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.attribute), asc(productVariants.value))]);
	return {
		...toProduct(row, taxes.get(id) ?? []),
		variants: variants.map(toVariant)
	};
}
var productRoutes = new Hono().get("/", requirePermission("catalog:read"), validate("query", listSchema$3), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = and(q.q ? like(products$1.name, likeTerm(q.q)) : void 0, q.active ? eq(products$1.isActive, q.active === "true") : void 0, q.type ? eq(products$1.type, q.type) : void 0);
	const variantCount = sql`(select count(*) from product_variants v where v.product_id = ${products$1.id})`;
	const [rows, total] = await Promise.all([db.select({
		p: products$1,
		variantCount
	}).from(products$1).where(where).orderBy(orderBy(q.sort, {
		name: products$1.name,
		salesPrice: products$1.salesPrice,
		createdAt: products$1.createdAt
	}, asc(products$1.name))).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(products$1).where(where).get()]);
	const taxes = await taxIdsFor(db, rows.map((r) => r.p.id));
	const data = rows.map((r) => ({
		...toProduct(r.p, taxes.get(r.p.id) ?? []),
		variantCount: r.variantCount
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/variants", requirePermission("catalog:read"), validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = q.q ? sql`(${productVariants.value} like ${likeTerm(q.q)} or ${productVariants.attribute} like ${likeTerm(q.q)} or ${products$1.name} like ${likeTerm(q.q)})` : void 0;
	const [rows, total] = await Promise.all([db.select({
		v: productVariants,
		productName: products$1.name,
		salesPrice: products$1.salesPrice
	}).from(productVariants).innerJoin(products$1, eq(products$1.id, productVariants.productId)).where(where).orderBy(asc(products$1.name), asc(productVariants.attribute)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(productVariants).innerJoin(products$1, eq(products$1.id, productVariants.productId)).where(where).get()]);
	const data = rows.map((r) => ({
		...toVariant(r.v),
		productName: r.productName,
		basePrice: fromMinor(r.salesPrice),
		finalPrice: fromMinor(r.salesPrice + r.v.extraPrice)
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/:id", requirePermission("catalog:read"), async (c) => c.json({ data: await loadProduct(c.get("db"), c.req.param("id")) })).post("/", requirePermission("catalog:write"), validate("json", productSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	const id = newId();
	await db.batch([
		db.insert(products$1).values({
			id,
			name: input.name,
			type: input.type,
			salesPrice: toMinor(input.salesPrice),
			costPrice: toMinor(input.costPrice),
			notes: input.notes ?? null,
			isActive: input.isActive
		}),
		...input.taxIds.map((taxId) => db.insert(productTaxes).values({
			productId: id,
			taxId
		})),
		auditEntry(db, {
			actorId: currentUser(c).id,
			action: "product.created",
			entity: "product",
			entityId: id
		})
	]);
	return c.json({ data: await loadProduct(db, id) }, 201);
}).patch("/:id", requirePermission("catalog:write"), validate("json", productSchema), async (c) => {
	const id = c.req.param("id");
	const input = c.req.valid("json");
	const db = c.get("db");
	await loadProduct(db, id);
	await db.batch([
		db.update(products$1).set({
			name: input.name,
			type: input.type,
			salesPrice: toMinor(input.salesPrice),
			costPrice: toMinor(input.costPrice),
			notes: input.notes ?? null,
			isActive: input.isActive,
			updatedAt: nowISO()
		}).where(eq(products$1.id, id)),
		db.delete(productTaxes).where(eq(productTaxes.productId, id)),
		...input.taxIds.map((taxId) => db.insert(productTaxes).values({
			productId: id,
			taxId
		})),
		auditEntry(db, {
			actorId: currentUser(c).id,
			action: "product.updated",
			entity: "product",
			entityId: id
		})
	]);
	return c.json({ data: await loadProduct(db, id) });
}).delete("/:id", requirePermission("catalog:write"), async (c) => {
	const id = c.req.param("id");
	const db = c.get("db");
	const used = await db.select({ n: count() }).from(subscriptionLines$2).where(eq(subscriptionLines$2.productId, id)).get();
	if (used && used.n > 0) throw ApiError.conflict("This product is used by subscriptions. Deactivate it instead of deleting it.");
	try {
		await db.batch([db.delete(products$1).where(eq(products$1.id, id)), auditEntry(db, {
			actorId: currentUser(c).id,
			action: "product.deleted",
			entity: "product",
			entityId: id
		})]);
	} catch {
		throw ApiError.conflict("This product is referenced by templates or invoices. Deactivate it instead.");
	}
	return c.body(null, 204);
}).post("/:id/variants", requirePermission("catalog:write"), validate("json", variantSchema), async (c) => {
	const productId = c.req.param("id");
	const input = c.req.valid("json");
	const db = c.get("db");
	await loadProduct(db, productId);
	const id = newId();
	try {
		await db.insert(productVariants).values({
			id,
			productId,
			attribute: input.attribute,
			value: input.value,
			extraPrice: toMinor(input.extraPrice)
		});
	} catch (err) {
		if (isUniqueViolation(err)) throw ApiError.conflict("This variant already exists.", { value: "Already exists for this attribute" });
		throw err;
	}
	const row = await db.select().from(productVariants).where(eq(productVariants.id, id)).get();
	return c.json({ data: toVariant(row) }, 201);
});
var variantRoutes = new Hono().patch("/:id", requirePermission("catalog:write"), validate("json", variantSchema), async (c) => {
	const id = c.req.param("id");
	const input = c.req.valid("json");
	const res = await c.get("db").update(productVariants).set({
		attribute: input.attribute,
		value: input.value,
		extraPrice: toMinor(input.extraPrice)
	}).where(eq(productVariants.id, id)).returning();
	if (!res[0]) throw ApiError.notFound("Variant");
	return c.json({ data: toVariant(res[0]) });
}).delete("/:id", requirePermission("catalog:write"), async (c) => {
	await c.get("db").delete(productVariants).where(eq(productVariants.id, c.req.param("id")));
	return c.body(null, 204);
});
// worker/modules/quotations/routes.ts
/**
* QT-1: quotation templates and "start a quotation from a template". Owner: Person 2.
* Quotations are subscriptions in status `quotation`; they are created through the
* subscription service (Person 1) so lifecycle rules stay in one place.
*/
var { quotationTemplates: templates, quotationTemplateLines: lines, plans: plans$2, products } = schema_exports;
async function loadTemplate(db, id) {
	const row = await db.select({
		t: templates,
		planName: plans$2.name
	}).from(templates).innerJoin(plans$2, eq(plans$2.id, templates.planId)).where(eq(templates.id, id)).get();
	if (!row) throw ApiError.notFound("Template");
	const lineRows = await db.select({
		l: lines,
		productName: products.name
	}).from(lines).innerJoin(products, eq(products.id, lines.productId)).where(eq(lines.templateId, id)).orderBy(asc(lines.id));
	return {
		id: row.t.id,
		name: row.t.name,
		planId: row.t.planId,
		planName: row.planName,
		validityDays: row.t.validityDays,
		paymentTermDays: row.t.paymentTermDays,
		lines: lineRows.map((r) => ({
			id: r.l.id,
			productId: r.l.productId,
			productName: r.productName,
			variantId: r.l.variantId,
			quantity: r.l.quantity
		}))
	};
}
var templateRoutes = new Hono().get("/", requirePermission("template:read"), validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = q.q ? like(templates.name, likeTerm(q.q)) : void 0;
	const [rows, total] = await Promise.all([db.select({
		t: templates,
		planName: plans$2.name
	}).from(templates).innerJoin(plans$2, eq(plans$2.id, templates.planId)).where(where).orderBy(asc(templates.name)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(templates).where(where).get()]);
	const ids = rows.map((r) => r.t.id);
	const lineRows = ids.length ? await db.select().from(lines).where(inArray(lines.templateId, ids)) : [];
	const data = rows.map((r) => ({
		id: r.t.id,
		name: r.t.name,
		planId: r.t.planId,
		planName: r.planName,
		validityDays: r.t.validityDays,
		paymentTermDays: r.t.paymentTermDays,
		lineCount: lineRows.filter((l) => l.templateId === r.t.id).length
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/:id", requirePermission("template:read"), async (c) => c.json({ data: await loadTemplate(c.get("db"), c.req.param("id")) })).post("/", requirePermission("template:write"), validate("json", quotationTemplateSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	const id = newId();
	await db.batch([
		db.insert(templates).values({
			id,
			name: input.name,
			planId: input.planId,
			validityDays: input.validityDays,
			paymentTermDays: input.paymentTermDays,
			createdBy: currentUser(c).id
		}),
		...input.lines.map((l) => db.insert(lines).values({
			id: newId(),
			templateId: id,
			productId: l.productId,
			variantId: l.variantId ?? null,
			quantity: l.quantity
		})),
		auditEntry(db, {
			actorId: currentUser(c).id,
			action: "template.created",
			entity: "quotation_template",
			entityId: id
		})
	]);
	return c.json({ data: await loadTemplate(db, id) }, 201);
}).patch("/:id", requirePermission("template:write"), validate("json", quotationTemplateSchema), async (c) => {
	const id = c.req.param("id");
	const input = c.req.valid("json");
	const db = c.get("db");
	await loadTemplate(db, id);
	await db.batch([
		db.update(templates).set({
			name: input.name,
			planId: input.planId,
			validityDays: input.validityDays,
			paymentTermDays: input.paymentTermDays,
			updatedAt: nowISO()
		}).where(eq(templates.id, id)),
		db.delete(lines).where(eq(lines.templateId, id)),
		...input.lines.map((l) => db.insert(lines).values({
			id: newId(),
			templateId: id,
			productId: l.productId,
			variantId: l.variantId ?? null,
			quantity: l.quantity
		}))
	]);
	return c.json({ data: await loadTemplate(db, id) });
}).delete("/:id", requirePermission("template:write"), async (c) => {
	await c.get("db").delete(templates).where(eq(templates.id, c.req.param("id")));
	return c.body(null, 204);
});
var fromTemplateSchema = object({
	customerId: idSchema,
	startDate: isoDateSchema,
	expiryDate: isoDateSchema.nullable().optional()
});
/** Mounted under /subscriptions: POST /subscriptions/from-template/:templateId */
var quotationRoutes = new Hono().post("/from-template/:templateId", requirePermission("subscription:write"), validate("json", fromTemplateSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	const tpl = await loadTemplate(db, c.req.param("templateId"));
	const today = todayISO();
	const data = await createSubscription(db, c.env.DB, {
		customerId: input.customerId,
		planId: tpl.planId,
		startDate: input.startDate,
		expiryDate: input.expiryDate ?? null,
		paymentTermDays: tpl.paymentTermDays,
		lines: tpl.lines.map((l) => ({
			productId: l.productId,
			variantId: l.variantId,
			quantity: l.quantity
		}))
	}, currentUser(c).id, {
		status: "quotation",
		templateId: tpl.id,
		quoteValidUntil: addDays(today, tpl.validityDays)
	});
	return c.json({ data }, 201);
});
// worker/modules/taxes/routes.ts
/**
* TAX-1: tax rules (percentage or fixed per unit). Owner: Person 2.
* Read: admin + staff. Write: admin only.
*/
var { taxes } = schema_exports;
var rateOf = (kind, rate) => kind === "percentage" ? toBasisPoints(rate) : toMinor(rate);
var taxRoutes = new Hono().get("/", requirePermission("tax:read"), validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const [rows, total] = await Promise.all([db.select().from(taxes).orderBy(asc(taxes.name)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(taxes).get()]);
	return c.json(paginated(rows.map(toTax), q, total?.n ?? 0));
}).post("/", requirePermission("tax:write"), validate("json", taxSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	const id = newId();
	await db.batch([db.insert(taxes).values({
		id,
		name: input.name,
		kind: input.kind,
		rate: rateOf(input.kind, input.rate),
		isActive: input.isActive
	}), auditEntry(db, {
		actorId: currentUser(c).id,
		action: "tax.created",
		entity: "tax",
		entityId: id
	})]);
	const row = await db.select().from(taxes).where(eq(taxes.id, id)).get();
	return c.json({ data: toTax(row) }, 201);
}).patch("/:id", requirePermission("tax:write"), validate("json", taxSchema), async (c) => {
	const input = c.req.valid("json");
	const res = await c.get("db").update(taxes).set({
		name: input.name,
		kind: input.kind,
		rate: rateOf(input.kind, input.rate),
		isActive: input.isActive,
		updatedAt: nowISO()
	}).where(eq(taxes.id, c.req.param("id"))).returning();
	if (!res[0]) throw ApiError.notFound("Tax");
	return c.json({ data: toTax(res[0]) });
}).delete("/:id", requirePermission("tax:write"), async (c) => {
	const id = c.req.param("id");
	const db = c.get("db");
	const used = await db.select({ n: count() }).from(subscriptionLines$2).where(eq(subscriptionLines$2.taxId, id)).get();
	if (used && used.n > 0) throw ApiError.conflict("This tax is used by subscriptions. Deactivate it instead.");
	await db.delete(taxes).where(eq(taxes.id, id));
	return c.body(null, 204);
});
// worker/modules/finance/routes.ts
/**
* Findings API for the Revenue Leakage and Invoice Anomaly pages. Owner: Person 3.
*/
var listSchema$2 = listQuerySchema.extend({
	kind: _enum(["leakage", "anomaly"]).default("leakage"),
	status: _enum([
		"open",
		"reviewed",
		"resolved"
	]).optional(),
	severity: _enum([
		"critical",
		"high",
		"medium",
		"low"
	]).optional(),
	rule: string().optional()
});
var findingRoutes = new Hono().get("/", requirePermission("finding:read"), validate("query", listSchema$2), async (c) => {
	const q = c.req.valid("query");
	const where = `f.kind = ?1 AND (?2 IS NULL OR f.status = ?2) AND (?3 IS NULL OR f.severity = ?3) AND (?4 IS NULL OR f.rule = ?4)`;
	const binds = [
		q.kind,
		q.status ?? null,
		q.severity ?? null,
		q.rule ?? null
	];
	const [rows, total] = await Promise.all([all(c.env.DB, `SELECT f.*, COALESCE(c.company_name, c.contact_name) AS customer_name, s.number AS subscription_number, i.number AS invoice_number
         FROM findings f LEFT JOIN customers c ON c.id = f.customer_id LEFT JOIN subscriptions s ON s.id = f.subscription_id
         LEFT JOIN invoices i ON i.id = f.invoice_id
         WHERE ${where}
         ORDER BY CASE f.status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
                  CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, f.amount_at_risk DESC
         LIMIT ?5 OFFSET ?6`, ...binds, q.pageSize, (q.page - 1) * q.pageSize), first(c.env.DB, `SELECT COUNT(*) AS n FROM findings f WHERE ${where}`, ...binds)]);
	const data = rows.map((r) => ({
		id: r.id,
		kind: r.kind,
		rule: r.rule,
		ruleLabel: RULES[r.rule]?.label ?? r.rule,
		severity: r.severity,
		customerId: r.customer_id,
		customerName: r.customer_name,
		subscriptionId: r.subscription_id,
		subscriptionNumber: r.subscription_number,
		invoiceId: r.invoice_id,
		invoiceNumber: r.invoice_number,
		paymentId: r.payment_id,
		amountAtRisk: fromMinor(r.amount_at_risk),
		expected: r.expected === null ? null : fromMinor(r.expected),
		actual: r.actual === null ? null : fromMinor(r.actual),
		explanation: r.explanation,
		suggestion: r.suggestion,
		status: r.status,
		resolutionNote: r.resolution_note,
		detectedAt: r.detected_at
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/summary", requirePermission("finding:read"), validate("query", object({ kind: _enum(["leakage", "anomaly"]).default("leakage") })), async (c) => {
	const { kind } = c.req.valid("query");
	const [bySeverity, byRule] = await Promise.all([all(c.env.DB, `SELECT severity, COUNT(*) AS count, SUM(amount_at_risk) AS amount FROM findings WHERE kind = ?1 AND status != 'resolved' GROUP BY severity`, kind), all(c.env.DB, `SELECT rule, COUNT(*) AS count, SUM(amount_at_risk) AS amount FROM findings WHERE kind = ?1 AND status != 'resolved' GROUP BY rule ORDER BY amount DESC`, kind)]);
	return c.json({
		totalAtRisk: fromMinor(bySeverity.reduce((a, r) => a + r.amount, 0)),
		openCount: bySeverity.reduce((a, r) => a + r.count, 0),
		bySeverity: [
			"critical",
			"high",
			"medium",
			"low"
		].map((s) => ({
			severity: s,
			count: bySeverity.find((r) => r.severity === s)?.count ?? 0
		})),
		byRule: byRule.map((r) => ({
			rule: r.rule,
			label: RULES[r.rule]?.label ?? r.rule,
			count: r.count,
			amount: fromMinor(r.amount)
		}))
	});
}).patch("/:id", requirePermission("finding:write"), validate("json", object({
	status: _enum([
		"open",
		"reviewed",
		"resolved"
	]),
	resolutionNote: notesSchema
})), async (c) => {
	const { status, resolutionNote } = c.req.valid("json");
	if (!(await c.env.DB.prepare(`UPDATE findings SET status = ?1, resolution_note = COALESCE(?2, resolution_note), resolved_by = ?3, updated_at = ?4 WHERE id = ?5`).bind(status, resolutionNote ?? null, currentUser(c).id, (/* @__PURE__ */ new Date()).toISOString(), c.req.param("id")).run()).meta.changes) throw ApiError.notFound("Finding");
	return c.json({ ok: true });
}).post("/scan", requirePermission("finding:write"), async (c) => {
	const today = todayISO();
	const [leakage, anomalies] = await Promise.all([scanRevenueLeakage({
		env: c.env,
		today
	}), scanInvoiceAnomalies({ env: c.env })]);
	return c.json({ data: {
		leakage: leakage.created,
		anomalies: anomalies.created
	} });
});
// worker/modules/invoices/routes.ts
/**
* INV-3: invoice list, detail and actions (confirm, cancel, send, edit draft).
* Owner: Person 3. Calculations and state changes come from the billing service (Person 1).
*/
var { invoices: invoices$2, customers: customers$3, subscriptions: subscriptions$2, payments: payments$2 } = schema_exports;
var invoiceListSchema = listQuerySchema.extend({
	status: string().optional(),
	customerId: string().optional(),
	subscriptionId: string().optional(),
	overdue: _enum(["true"]).optional(),
	outstanding: _enum(["true"]).optional(),
	from: string().optional(),
	to: string().optional()
});
/** Shared filter builder (also used by the portal, which forces customerId). */
function invoiceWhere(q, today = todayISO()) {
	const statuses = (q.status ?? "").split(",").filter((s) => INVOICE_STATUSES.includes(s));
	return and(statuses.length ? inArray(invoices$2.status, statuses) : void 0, q.customerId ? eq(invoices$2.customerId, q.customerId) : void 0, q.subscriptionId ? eq(invoices$2.subscriptionId, q.subscriptionId) : void 0, q.overdue ? and(eq(invoices$2.status, "confirmed"), lt(invoices$2.dueDate, today), gt(sql`${invoices$2.total} - ${invoices$2.amountPaid}`, 0)) : void 0, q.outstanding ? and(eq(invoices$2.status, "confirmed"), gt(sql`${invoices$2.total} - ${invoices$2.amountPaid}`, 0)) : void 0, q.from ? gte(invoices$2.issueDate, q.from) : void 0, q.to ? lte(invoices$2.issueDate, q.to) : void 0, q.q ? or(sql`${invoices$2.number} like ${likeTerm(q.q)}`, sql`${customers$3.companyName} like ${likeTerm(q.q)}`, sql`${customers$3.contactName} like ${likeTerm(q.q)}`) : void 0);
}
var editSchema = object({
	dueDate: isoDateSchema.optional(),
	lines: array(object({
		id: idSchema,
		description: nameSchema,
		quantity: number().int().min(1),
		unitPrice: moneySchema
	})).min(1)
});
var invoiceRoutes = new Hono().get("/", requirePermission("invoice:read"), validate("query", invoiceListSchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = invoiceWhere(q);
	const [rows, total, sums] = await Promise.all([
		db.select({
			i: invoices$2,
			c: customers$3,
			subNumber: subscriptions$2.number
		}).from(invoices$2).innerJoin(customers$3, eq(customers$3.id, invoices$2.customerId)).innerJoin(subscriptions$2, eq(subscriptions$2.id, invoices$2.subscriptionId)).where(where).orderBy(orderBy(q.sort, {
			number: invoices$2.number,
			issueDate: invoices$2.issueDate,
			dueDate: invoices$2.dueDate,
			total: invoices$2.total
		}, desc(invoices$2.issueDate))).limit(pageOffset(q).limit).offset(pageOffset(q).offset),
		db.select({ n: count() }).from(invoices$2).innerJoin(customers$3, eq(customers$3.id, invoices$2.customerId)).where(where).get(),
		db.select({
			total: sql`coalesce(sum(case when ${invoices$2.status} != 'cancelled' then ${invoices$2.total} end), 0)`,
			balance: sql`coalesce(sum(case when ${invoices$2.status} = 'confirmed' then ${invoices$2.total} - ${invoices$2.amountPaid} end), 0)`
		}).from(invoices$2).innerJoin(customers$3, eq(customers$3.id, invoices$2.customerId)).where(where).get()
	]);
	const data = rows.map((r) => toInvoice(r.i, {
		customerName: customerLabel(r.c),
		subscriptionNumber: r.subNumber
	}));
	return c.json({
		...paginated(data, q, total?.n ?? 0),
		totals: {
			total: ((sums?.total ?? 0) / 100).toFixed(2),
			balance: ((sums?.balance ?? 0) / 100).toFixed(2)
		}
	});
}).get("/:id", requirePermission("invoice:read"), async (c) => {
	const db = c.get("db");
	const id = c.req.param("id");
	const [detail, paymentRows] = await Promise.all([getInvoiceDetail(db, id), db.select().from(payments$2).where(eq(payments$2.invoiceId, id)).orderBy(desc(payments$2.paidOn))]);
	return c.json({ data: {
		...detail,
		payments: paymentRows.map((p) => toPayment(p))
	} });
}).patch("/:id", requirePermission("invoice:write"), validate("json", editSchema), async (c) => c.json({ data: await updateDraftInvoice(c.get("db"), c.req.param("id"), c.req.valid("json"), currentUser(c).id) })).post("/:id/confirm", requirePermission("invoice:write"), async (c) => c.json({ data: await confirmInvoice(c.get("db"), c.req.param("id"), currentUser(c).id) })).post("/:id/cancel", requirePermission("invoice:write"), validate("json", object({ reason: notesSchema })), async (c) => c.json({ data: await cancelInvoice(c.get("db"), c.req.param("id"), currentUser(c).id, c.req.valid("json").reason) })).post("/:id/send", requirePermission("invoice:write"), async (c) => c.json({ data: await sendInvoice(c.get("db"), c.env, c.req.param("id"), currentUser(c).id) })).post("/confirm-drafts", requirePermission("invoice:write"), validate("json", object({ ids: array(idSchema).max(100) })), async (c) => {
	const db = c.get("db");
	const actor = currentUser(c).id;
	let confirmed = 0;
	for (const id of c.req.valid("json").ids) await confirmInvoice(db, id, actor).then(() => confirmed++).catch(() => void 0);
	return c.json({ data: { confirmed } });
});
// worker/modules/payments/service.ts
/**
* PAY-1: payment recording with partial and multiple payments per invoice.
* Owner: Person 3.
*/
/**
* Record a payment against a Confirmed invoice. The amount cannot exceed the balance.
* The invoice update and the payment insert run in one atomic batch, and the insert is
* conditional on the update having applied, so concurrent payments cannot overpay.
*/
async function recordPayment(db, d1, invoiceId, input, actorId) {
	const inv = await db.select().from(invoices$4).where(eq(invoices$4.id, invoiceId)).get();
	if (!inv) throw ApiError.notFound("Invoice");
	if (inv.status === "draft") throw new ApiError("invalid_transition", "Confirm the invoice before recording a payment.");
	if (inv.status === "cancelled") throw new ApiError("invalid_transition", "Payments cannot be recorded against a cancelled invoice.");
	if (inv.status === "paid") throw new ApiError("invalid_transition", "This invoice is already paid in full.");
	const amount = toMinor(input.amount);
	const balance = inv.total - inv.amountPaid;
	if (amount > balance) throw new ApiError("validation_failed", "The payment is more than the balance.", { amount: `Cannot exceed the balance of ${money(balance)}` });
	const newPaid = inv.amountPaid + amount;
	const id = newId();
	const now = (/* @__PURE__ */ new Date()).toISOString();
	if (!(await d1.batch([
		d1.prepare(`UPDATE invoices SET amount_paid = ?1,
           status = CASE WHEN ?1 >= total THEN 'paid' ELSE status END,
           paid_at = CASE WHEN ?1 >= total THEN ?2 ELSE paid_at END,
           updated_at = ?2
         WHERE id = ?3 AND amount_paid = ?4 AND status = 'confirmed'`).bind(newPaid, now, invoiceId, inv.amountPaid),
		d1.prepare(`INSERT INTO payments (id, invoice_id, customer_id, method, amount, paid_on, reference, note, recorded_by, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
         WHERE (SELECT amount_paid FROM invoices WHERE id = ?2) = ?11 AND changes() > 0`).bind(id, invoiceId, inv.customerId, input.method, amount, input.paidOn, input.reference ?? null, input.note ?? null, actorId, now, newPaid),
		d1.prepare(`INSERT INTO customer_activity (id, customer_id, type, entity, entity_id, summary, actor_id, created_at)
         SELECT ?1, ?2, 'payment.received', 'payment', ?3, ?4, ?5, ?6 WHERE EXISTS (SELECT 1 FROM payments WHERE id = ?3)`).bind(newId(), inv.customerId, id, `Payment of ${money(amount)} received for ${inv.number} (${input.method.replace("_", " ")})`, actorId, now)
	]))[1]?.meta.changes) throw ApiError.conflict("This invoice changed while you were recording the payment. Reload and try again.");
	return toPayment(await db.select().from(payments$3).where(eq(payments$3.id, id)).get(), { invoiceNumber: inv.number });
}
/** Record a receipt that is not matched to an invoice yet (surfaced by leakage detection). */
async function recordUnmatchedPayment(db, input, actorId) {
	const id = newId();
	await db.insert(payments$3).values({
		id,
		invoiceId: null,
		customerId: input.customerId ?? null,
		method: input.method,
		amount: toMinor(input.amount),
		paidOn: input.paidOn,
		reference: input.reference ?? null,
		note: input.note ?? null,
		recordedBy: actorId
	});
	return toPayment(await db.select().from(payments$3).where(eq(payments$3.id, id)).get());
}
/** Match an unmatched receipt to an invoice: records it as a normal payment and removes the receipt. */
async function matchPayment(db, d1, paymentId, invoiceId, actorId) {
	const p = await db.select().from(payments$3).where(eq(payments$3.id, paymentId)).get();
	if (!p) throw ApiError.notFound("Payment");
	if (p.invoiceId) throw ApiError.conflict("This payment is already matched to an invoice.");
	const matched = await recordPayment(db, d1, invoiceId, {
		method: p.method,
		amount: (p.amount / 100).toFixed(2),
		paidOn: p.paidOn,
		reference: p.reference,
		note: p.note ?? "Matched receipt"
	}, actorId);
	await db.delete(payments$3).where(eq(payments$3.id, paymentId));
	return matched;
}
// worker/modules/payments/routes.ts
/**
* PAY-1, PAY-2: payment recording and history. Owner: Person 3.
*/
var { payments: payments$1, invoices: invoices$1, customers: customers$2 } = schema_exports;
var listSchema$1 = listQuerySchema.extend({
	invoiceId: string().optional(),
	customerId: string().optional(),
	method: _enum(PAYMENT_METHODS).optional(),
	unmatched: _enum(["true"]).optional(),
	from: string().optional(),
	to: string().optional()
});
/** Mounted under /invoices: POST /invoices/:id/payments */
var invoicePaymentRoutes = new Hono().post("/:id/payments", requirePermission("payment:write"), validate("json", paymentSchema), async (c) => c.json({ data: await recordPayment(c.get("db"), c.env.DB, c.req.param("id"), c.req.valid("json"), currentUser(c).id) }, 201));
var paymentRoutes = new Hono().get("/", requirePermission("payment:read"), validate("query", listSchema$1), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = and(q.invoiceId ? eq(payments$1.invoiceId, q.invoiceId) : void 0, q.customerId ? eq(payments$1.customerId, q.customerId) : void 0, q.method ? eq(payments$1.method, q.method) : void 0, q.unmatched ? isNull(payments$1.invoiceId) : void 0, q.from ? gte(payments$1.paidOn, q.from) : void 0, q.to ? lte(payments$1.paidOn, q.to) : void 0, q.q ? or(sql`${invoices$1.number} like ${likeTerm(q.q)}`, sql`${customers$2.companyName} like ${likeTerm(q.q)}`, sql`${payments$1.reference} like ${likeTerm(q.q)}`) : void 0);
	const base = () => db.select({
		p: payments$1,
		invoiceNumber: invoices$1.number,
		c: customers$2
	}).from(payments$1).leftJoin(invoices$1, eq(invoices$1.id, payments$1.invoiceId)).leftJoin(customers$2, eq(customers$2.id, payments$1.customerId));
	const [rows, total] = await Promise.all([base().where(where).orderBy(orderBy(q.sort, {
		paidOn: payments$1.paidOn,
		amount: payments$1.amount
	}, desc(payments$1.paidOn))).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({
		n: count(),
		sum: sql`coalesce(sum(${payments$1.amount}), 0)`
	}).from(payments$1).leftJoin(invoices$1, eq(invoices$1.id, payments$1.invoiceId)).leftJoin(customers$2, eq(customers$2.id, payments$1.customerId)).where(where).get()]);
	const data = rows.map((r) => toPayment(r.p, {
		invoiceNumber: r.invoiceNumber,
		customerName: customerLabel(r.c)
	}));
	return c.json({
		...paginated(data, q, total?.n ?? 0),
		totals: { amount: ((total?.sum ?? 0) / 100).toFixed(2) }
	});
}).post("/", requirePermission("payment:write"), validate("json", paymentSchema.extend({ customerId: idSchema.nullable().optional() })), async (c) => c.json({ data: await recordUnmatchedPayment(c.get("db"), c.req.valid("json"), currentUser(c).id) }, 201)).post("/:id/match", requirePermission("payment:write"), validate("json", object({ invoiceId: idSchema })), async (c) => c.json({ data: await matchPayment(c.get("db"), c.env.DB, c.req.param("id"), c.req.valid("json").invoiceId, currentUser(c).id) }));
// worker/modules/reports/routes.ts
/**
* REP-1..3: dashboard summary, revenue, overdue, MRR, subscription and payment
* reports, CSV export. Owner: Person 3. Every figure is an SQL aggregate on indexed
* columns, never rows loaded into the worker.
*/
var rangeSchema = object({
	from: string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	to: string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	customerId: string().optional(),
	planId: string().optional(),
	status: string().optional(),
	groupBy: _enum([
		"day",
		"week",
		"month"
	]).default("month")
});
function range(q) {
	const today = todayISO();
	return {
		from: q.from ?? `${today.slice(0, 8)}01`,
		to: q.to ?? today
	};
}
async function summary(d1, q) {
	const { from, to } = range(q);
	const today = todayISO();
	const [subs, revenue, outstanding] = await Promise.all([
		first(d1, `SELECT COUNT(*) AS active, COALESCE(SUM(${MRR_EXPR}), 0) AS mrr
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.status = 'active' AND (?1 IS NULL OR s.customer_id = ?1) AND (?2 IS NULL OR s.plan_id = ?2)`, q.customerId ?? null, q.planId ?? null),
		first(d1, `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count FROM payments
       WHERE paid_on BETWEEN ?1 AND ?2 AND (?3 IS NULL OR customer_id = ?3)`, from, to, q.customerId ?? null),
		first(d1, `SELECT COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total - amount_paid END), 0) AS outstanding,
              COUNT(CASE WHEN status = 'confirmed' AND due_date < ?1 AND total > amount_paid THEN 1 END) AS overdueCount,
              COALESCE(SUM(CASE WHEN status = 'confirmed' AND due_date < ?1 THEN total - amount_paid END), 0) AS overdueAmount,
              COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draftCount
       FROM invoices WHERE (?2 IS NULL OR customer_id = ?2)`, today, q.customerId ?? null)
	]);
	return {
		activeSubscriptions: subs?.active ?? 0,
		mrr: fromMinor(Math.round(subs?.mrr ?? 0)),
		arr: fromMinor(Math.round((subs?.mrr ?? 0) * 12)),
		revenueCollected: fromMinor(revenue?.amount ?? 0),
		paymentsCount: revenue?.count ?? 0,
		amountOutstanding: fromMinor(outstanding?.outstanding ?? 0),
		overdueInvoices: outstanding?.overdueCount ?? 0,
		overdueAmount: fromMinor(outstanding?.overdueAmount ?? 0),
		draftInvoices: outstanding?.draftCount ?? 0,
		range: {
			from,
			to
		}
	};
}
async function revenueSeries(d1, q) {
	const today = todayISO();
	const from = q.from ?? addMonths(`${today.slice(0, 8)}01`, -11);
	const to = q.to ?? today;
	const bucket = q.groupBy === "day" ? "paid_on" : q.groupBy === "week" ? "strftime('%Y-W%W', paid_on)" : "substr(paid_on, 1, 7)";
	const billedBucket = bucket.replace(/paid_on/g, "issue_date");
	const [collected, billed] = await Promise.all([all(d1, `SELECT ${bucket} AS period, SUM(amount) AS amount FROM payments
       WHERE paid_on BETWEEN ?1 AND ?2 AND (?3 IS NULL OR customer_id = ?3) GROUP BY period ORDER BY period`, from, to, q.customerId ?? null), all(d1, `SELECT ${billedBucket} AS period, SUM(total) AS amount FROM invoices
       WHERE status != 'cancelled' AND issue_date BETWEEN ?1 AND ?2 AND (?3 IS NULL OR customer_id = ?3) GROUP BY period ORDER BY period`, from, to, q.customerId ?? null)]);
	const periods = [.../* @__PURE__ */ new Set([...collected.map((r) => r.period), ...billed.map((r) => r.period)])].sort();
	return {
		range: {
			from,
			to
		},
		data: periods.map((period) => ({
			period,
			collected: fromMinor(collected.find((r) => r.period === period)?.amount ?? 0),
			billed: fromMinor(billed.find((r) => r.period === period)?.amount ?? 0)
		}))
	};
}
async function mrrTrend(d1) {
	const today = todayISO();
	const months = Array.from({ length: 12 }, (_, i) => addDays(addMonths(`${today.slice(0, 8)}01`, i - 10), -1)).map((d) => d > today ? today : d);
	const rows = await Promise.all(months.map((monthEnd) => first(d1, `SELECT COALESCE(SUM(${MRR_EXPR}), 0) AS mrr, COUNT(*) AS count
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.start_date <= ?1 AND s.status IN ('active','paused','closed')
           AND NOT EXISTS (SELECT 1 FROM subscription_status_history h
                           WHERE h.subscription_id = s.id AND h.to_status = 'closed' AND substr(h.created_at, 1, 10) <= ?1)`, monthEnd)));
	return { data: months.map((m, i) => ({
		period: m.slice(0, 7),
		mrr: fromMinor(Math.round(rows[i]?.mrr ?? 0)),
		subscriptions: rows[i]?.count ?? 0
	})) };
}
var reportRoutes = new Hono().use(requirePermission("report:read")).get("/summary", validate("query", rangeSchema), async (c) => c.json({ data: await summary(c.env.DB, c.req.valid("query")) })).get("/revenue", validate("query", rangeSchema), async (c) => c.json(await revenueSeries(c.env.DB, c.req.valid("query")))).get("/mrr", async (c) => c.json(await mrrTrend(c.env.DB))).get("/overdue", validate("query", rangeSchema), async (c) => {
	const today = todayISO();
	const q = c.req.valid("query");
	const [rows, aging] = await Promise.all([all(c.env.DB, `SELECT i.id, i.number, COALESCE(c.company_name, c.contact_name) AS customer, i.due_date,
                i.total - i.amount_paid AS balance, CAST(julianday(?1) - julianday(i.due_date) AS INTEGER) AS days
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         WHERE i.status = 'confirmed' AND i.due_date < ?1 AND i.total > i.amount_paid AND (?2 IS NULL OR i.customer_id = ?2)
         ORDER BY i.due_date ASC LIMIT 50`, today, q.customerId ?? null), all(c.env.DB, `SELECT CASE WHEN d <= 7 THEN '1-7' WHEN d <= 30 THEN '8-30' WHEN d <= 60 THEN '31-60' ELSE '60+' END AS bucket,
                COUNT(*) AS count, SUM(bal) AS amount
         FROM (SELECT julianday(?1) - julianday(due_date) AS d, total - amount_paid AS bal FROM invoices
               WHERE status = 'confirmed' AND due_date < ?1 AND total > amount_paid)
         GROUP BY bucket`, today)]);
	return c.json({
		data: rows.map((r) => ({
			id: r.id,
			number: r.number,
			customerName: r.customer,
			dueDate: r.due_date,
			balance: fromMinor(r.balance),
			daysOverdue: r.days
		})),
		aging: [
			"1-7",
			"8-30",
			"31-60",
			"60+"
		].map((b) => {
			const r = aging.find((a) => a.bucket === b);
			return {
				bucket: b,
				count: r?.count ?? 0,
				amount: fromMinor(r?.amount ?? 0)
			};
		})
	});
}).get("/subscriptions", async (c) => {
	const [byStatus, byPlan] = await Promise.all([all(c.env.DB, `SELECT status, COUNT(*) AS count FROM subscriptions GROUP BY status`), all(c.env.DB, `SELECT p.id, p.name, p.billing_period, COUNT(s.id) AS active, COALESCE(SUM(${MRR_EXPR}), 0) AS mrr
         FROM plans p LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'active'
         GROUP BY p.id ORDER BY mrr DESC`)]);
	return c.json({
		byStatus,
		byPlan: byPlan.map((p) => ({
			planId: p.id,
			name: p.name,
			billingPeriod: p.billing_period,
			active: p.active,
			mrr: fromMinor(Math.round(p.mrr))
		}))
	});
}).get("/payments", validate("query", rangeSchema), async (c) => {
	const { from, to } = range(c.req.valid("query"));
	const rows = await all(c.env.DB, `SELECT method, COUNT(*) AS count, SUM(amount) AS amount FROM payments WHERE paid_on BETWEEN ?1 AND ?2 GROUP BY method ORDER BY amount DESC`, from, to);
	return c.json({
		range: {
			from,
			to
		},
		data: rows.map((r) => ({
			method: r.method,
			count: r.count,
			amount: fromMinor(r.amount)
		}))
	});
}).get("/export/:kind", validate("query", rangeSchema), async (c) => {
	const kind = c.req.param("kind");
	const { from, to } = range(c.req.valid("query"));
	let csv;
	if (kind === "invoices") csv = toCsv([
		"Number",
		"Customer",
		"Status",
		"Issue date",
		"Due date",
		"Total",
		"Paid",
		"Balance"
	], (await all(c.env.DB, `SELECT i.number, COALESCE(c.company_name, c.contact_name) AS customer, i.status, i.issue_date, i.due_date, i.total, i.amount_paid
         FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.issue_date BETWEEN ?1 AND ?2 ORDER BY i.issue_date LIMIT 5000`, from, to)).map((r) => [
		r.number,
		r.customer,
		r.status,
		r.issue_date,
		r.due_date,
		fromMinor(Number(r.total)),
		fromMinor(Number(r.amount_paid)),
		fromMinor(Number(r.total) - Number(r.amount_paid))
	]));
	else if (kind === "payments") csv = toCsv([
		"Paid on",
		"Invoice",
		"Customer",
		"Method",
		"Amount",
		"Reference"
	], (await all(c.env.DB, `SELECT p.paid_on, i.number, COALESCE(c.company_name, c.contact_name) AS customer, p.method, p.amount, p.reference
         FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id LEFT JOIN customers c ON c.id = p.customer_id
         WHERE p.paid_on BETWEEN ?1 AND ?2 ORDER BY p.paid_on LIMIT 5000`, from, to)).map((r) => [
		r.paid_on,
		r.number ?? "Unmatched",
		r.customer,
		r.method,
		fromMinor(Number(r.amount)),
		r.reference
	]));
	else csv = toCsv([
		"Number",
		"Customer",
		"Plan",
		"Status",
		"Start",
		"Expiry",
		"Next invoice",
		"MRR"
	], (await all(c.env.DB, `SELECT s.number, COALESCE(c.company_name, c.contact_name) AS customer, p.name AS plan, s.status, s.start_date, s.expiry_date, s.next_invoice_date, ${MRR_EXPR} AS mrr
         FROM subscriptions s JOIN customers c ON c.id = s.customer_id JOIN plans p ON p.id = s.plan_id ORDER BY s.number LIMIT 5000`)).map((r) => [
		r.number,
		r.customer,
		r.plan,
		r.status,
		r.start_date,
		r.expiry_date,
		r.next_invoice_date,
		fromMinor(Math.round(Number(r.mrr)))
	]));
	return c.body(csv, 200, {
		"content-type": "text/csv; charset=utf-8",
		"content-disposition": `attachment; filename="brightloop-${kind}-${from}-to-${to}.csv"`
	});
});
// worker/modules/customers/routes.ts
/**
* Customer directory, Customer 360° profile, timeline, notes and health. Owner: Person 4.
*/
var { customers: customers$1, customerActivity, customerNotes, users } = schema_exports;
var healthListSchema = listQuerySchema.extend({ category: _enum([
	"healthy",
	"needs_attention",
	"at_risk"
]).optional() });
var customerRoutes = new Hono().get("/", requirePermission("customer:read"), validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = q.q ? or(sql`${customers$1.companyName} like ${likeTerm(q.q)}`, sql`${customers$1.contactName} like ${likeTerm(q.q)}`, sql`${customers$1.email} like ${likeTerm(q.q)}`) : void 0;
	const activeSubs = sql`(select count(*) from subscriptions s where s.customer_id = ${customers$1.id} and s.status = 'active')`;
	const outstanding = sql`(select coalesce(sum(i.total - i.amount_paid), 0) from invoices i where i.customer_id = ${customers$1.id} and i.status = 'confirmed')`;
	const [rows, total] = await Promise.all([db.select({
		c: customers$1,
		activeSubs,
		outstanding
	}).from(customers$1).where(where).orderBy(orderBy(q.sort, {
		contactName: customers$1.contactName,
		companyName: customers$1.companyName,
		createdAt: customers$1.createdAt
	}, desc(customers$1.createdAt))).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(customers$1).where(where).get()]);
	const data = rows.map((r) => ({
		...toCustomer(r.c),
		activeSubscriptions: r.activeSubs,
		outstanding: fromMinor(r.outstanding),
		hasPortalAccess: !!r.c.userId
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/health", requirePermission("customer:read"), validate("query", healthListSchema), async (c) => {
	const q = c.req.valid("query");
	const all = (await computeHealth(c.env.DB)).sort((a, b) => a.score - b.score);
	const filtered = q.category ? all.filter((h) => h.category === q.category) : all;
	const start = (q.page - 1) * q.pageSize;
	return c.json({
		...paginated(filtered.slice(start, start + q.pageSize), q, filtered.length),
		counts: {
			healthy: all.filter((h) => h.category === "healthy").length,
			needs_attention: all.filter((h) => h.category === "needs_attention").length,
			at_risk: all.filter((h) => h.category === "at_risk").length
		}
	});
}).post("/", requirePermission("customer:write"), validate("json", customerSchema), async (c) => {
	const input = c.req.valid("json");
	const db = c.get("db");
	const id = newId();
	const user = await db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), eq(users.role, "customer"))).get();
	try {
		await db.batch([db.insert(customers$1).values({
			id,
			userId: user?.id ?? null,
			...input
		}), activityEntry(db, {
			customerId: id,
			type: "customer.created",
			summary: `Customer created by ${currentUser(c).name}`,
			actorId: currentUser(c).id
		})]);
	} catch (err) {
		if (isUniqueViolation(err)) throw ApiError.conflict("A customer with this email already exists.", { email: "Already exists" });
		throw err;
	}
	const row = await db.select().from(customers$1).where(eq(customers$1.id, id)).get();
	return c.json({ data: toCustomer(row) }, 201);
}).get("/:id", requirePermission("customer:read"), async (c) => {
	const id = c.req.param("id");
	const row = await c.get("db").select().from(customers$1).where(eq(customers$1.id, id)).get();
	if (!row) throw ApiError.notFound("Customer");
	const [stats, health] = await Promise.all([first(c.env.DB, `SELECT (SELECT COUNT(*) FROM subscriptions WHERE customer_id = ?1 AND status = 'active') AS active,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE customer_id = ?1) AS total_paid,
                (SELECT COALESCE(SUM(total - amount_paid), 0) FROM invoices WHERE customer_id = ?1 AND status = 'confirmed') AS outstanding,
                (SELECT MAX(paid_on) FROM payments WHERE customer_id = ?1) AS last_payment,
                (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = ?1 AND status != 'cancelled') AS lifetime_billed`, id), computeHealth(c.env.DB, id)]);
	return c.json({ data: {
		...toCustomer(row),
		hasPortalAccess: !!row.userId,
		stats: {
			activeSubscriptions: stats?.active ?? 0,
			totalPaid: fromMinor(stats?.total_paid ?? 0),
			outstanding: fromMinor(stats?.outstanding ?? 0),
			lifetimeBilled: fromMinor(stats?.lifetime_billed ?? 0),
			lastPayment: stats?.last_payment ?? null
		},
		health: health[0] ?? null
	} });
}).patch("/:id", requirePermission("customer:write"), validate("json", customerSchema), async (c) => {
	const res = await c.get("db").update(customers$1).set({
		...c.req.valid("json"),
		updatedAt: nowISO()
	}).where(eq(customers$1.id, c.req.param("id"))).returning();
	if (!res[0]) throw ApiError.notFound("Customer");
	return c.json({ data: toCustomer(res[0]) });
}).get("/:id/timeline", requirePermission("customer:read"), validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = eq(customerActivity.customerId, c.req.param("id"));
	const [rows, total] = await Promise.all([db.select({
		a: customerActivity,
		actorName: users.name
	}).from(customerActivity).leftJoin(users, eq(users.id, customerActivity.actorId)).where(where).orderBy(desc(customerActivity.createdAt)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(customerActivity).where(where).get()]);
	const data = rows.map((r) => ({
		...r.a,
		actorName: r.actorName ?? (r.a.actorId ? null : "System")
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/:id/notes", requirePermission("customer:read"), async (c) => {
	const rows = await c.get("db").select({
		n: customerNotes,
		authorName: users.name
	}).from(customerNotes).leftJoin(users, eq(users.id, customerNotes.authorId)).where(eq(customerNotes.customerId, c.req.param("id"))).orderBy(desc(customerNotes.createdAt)).limit(50);
	return c.json({ data: rows.map((r) => ({
		...r.n,
		authorName: r.authorName
	})) });
}).post("/:id/notes", requirePermission("customer:write"), validate("json", object({ body: string().trim().min(1).max(2e3) })), async (c) => {
	const db = c.get("db");
	const customerId = c.req.param("id");
	const user = currentUser(c);
	await db.batch([db.insert(customerNotes).values({
		id: newId(),
		customerId,
		authorId: user.id,
		body: c.req.valid("json").body
	}), activityEntry(db, {
		customerId,
		type: "note.added",
		summary: `${user.name} added a note`,
		actorId: user.id
	})]);
	return c.json({ ok: true }, 201);
});
var cancellationRequestSchema = object({
	reason: _enum([
		"too_expensive",
		"temporary",
		"missing_features",
		"not_using",
		"other"
	]),
	comment: string().trim().max(1e3).optional().nullable()
});
var resolveSchema = object({ decision: _enum([
	"accept_alternative",
	"cancel",
	"keep"
]) });
var { subscriptions: subscriptions$1, plans: plans$1, cancellationRequests } = schema_exports;
async function findAlternative(db, subscriptionId, reason) {
	const row = await db.select({
		s: subscriptions$1,
		p: plans$1
	}).from(subscriptions$1).innerJoin(plans$1, eq(plans$1.id, subscriptions$1.planId)).where(eq(subscriptions$1.id, subscriptionId)).get();
	if (!row) throw ApiError.notFound("Subscription");
	const { p } = row;
	const samePeriod = and(eq(plans$1.status, "active"), eq(plans$1.billingPeriod, p.billingPeriod), ne(plans$1.id, p.id));
	if (reason === "temporary") return p.pausable && row.s.status === "active" ? {
		type: "pause",
		label: "Pause instead",
		description: "Keep your account and data. You are not billed while paused, and you can resume any time."
	} : null;
	if (reason === "too_expensive" || reason === "not_using") {
		const cheaper = await db.select().from(plans$1).where(and(samePeriod, lt(plans$1.price, p.price))).orderBy(desc(plans$1.price)).get();
		return cheaper ? {
			type: "plan",
			planId: cheaper.id,
			label: `Switch to ${cheaper.name}`,
			description: `${fromMinor(cheaper.price)} per ${p.billingPeriod.replace("ly", "")} instead of ${fromMinor(p.price)}. A teammate will prepare the change for you.`
		} : null;
	}
	if (reason === "missing_features") {
		const higher = await db.select().from(plans$1).where(and(samePeriod, gt(plans$1.price, p.price))).orderBy(asc(plans$1.price)).get();
		return higher ? {
			type: "plan",
			planId: higher.id,
			label: `Upgrade to ${higher.name}`,
			description: "Includes more capacity. A teammate will contact you to set it up."
		} : null;
	}
	return null;
}
async function requestCancellation(db, subscriptionId, customerId, input, actorId) {
	const sub = await db.select().from(subscriptions$1).where(and(eq(subscriptions$1.id, subscriptionId), eq(subscriptions$1.customerId, customerId))).get();
	if (!sub) throw ApiError.notFound("Subscription");
	if (!["active", "paused"].includes(sub.status)) throw new ApiError("invalid_transition", "Only active or paused subscriptions can be cancelled.");
	const alternative = await findAlternative(db, subscriptionId, input.reason);
	const id = newId();
	await db.batch([db.insert(cancellationRequests).values({
		id,
		subscriptionId,
		customerId,
		reason: input.reason,
		comment: input.comment ?? null,
		offeredAlternative: alternative ? alternative.type === "pause" ? "pause" : `plan:${alternative.planId}` : null
	}), activityEntry(db, {
		customerId,
		type: "cancellation.requested",
		summary: `Cancellation requested for ${sub.number}: ${input.reason.replace("_", " ")}`,
		actorId,
		entity: "subscription",
		entityId: subscriptionId
	})]);
	return {
		requestId: id,
		alternative
	};
}
async function resolveCancellation(db, requestId, customerId, decision, actorId) {
	const req = await db.select().from(cancellationRequests).where(and(eq(cancellationRequests.id, requestId), eq(cancellationRequests.customerId, customerId))).get();
	if (!req) throw ApiError.notFound("Cancellation request");
	if (req.outcome !== "pending") throw ApiError.conflict("This request was already resolved.");
	let message;
	if (decision === "cancel") {
		const sub = await db.select().from(subscriptions$1).where(eq(subscriptions$1.id, req.subscriptionId)).get();
		if ((sub ? await db.select().from(plans$1).where(eq(plans$1.id, sub.planId)).get() : null)?.closable || sub?.status === "paused") {
			await transitionSubscription(db, req.subscriptionId, "closed", actorId, `Cancelled by customer (${req.reason.replace("_", " ")})`);
			message = "Your subscription is cancelled. No further invoices will be issued.";
		} else {
			await db.update(subscriptions$1).set({
				closedReason: "Cancellation requested; ends at expiry",
				updatedAt: nowISO()
			}).where(eq(subscriptions$1.id, req.subscriptionId));
			await notifyStaff(db, `Cancellation at term end requested for subscription ${sub?.number}`);
			message = "Your cancellation is recorded. Your plan has a fixed term, so it ends on its expiry date and will not renew.";
		}
		await db.update(cancellationRequests).set({
			outcome: "cancelled",
			resolvedAt: nowISO()
		}).where(eq(cancellationRequests.id, requestId));
	} else if (decision === "accept_alternative") {
		if (req.offeredAlternative === "pause") {
			await transitionSubscription(db, req.subscriptionId, "paused", actorId, "Paused instead of cancelling");
			message = "Your subscription is paused. Resume it any time from your portal.";
		} else {
			await notifyStaff(db, `Customer accepted a plan change (${req.offeredAlternative}) instead of cancelling.`);
			message = "Thanks for staying. A teammate will prepare the plan change and send you a quotation.";
		}
		await db.update(cancellationRequests).set({
			outcome: "accepted_alternative",
			resolvedAt: nowISO()
		}).where(eq(cancellationRequests.id, requestId));
	} else {
		await db.delete(cancellationRequests).where(eq(cancellationRequests.id, requestId));
		message = "Nothing changed. Your subscription continues.";
	}
	return { message };
}
async function notifyStaff(db, subject) {
	const staff = await db.select({
		id: users$2.id,
		email: users$2.email
	}).from(users$2).where(ne(users$2.role, "customer"));
	for (const s of staff) await notifyInApp(db, {
		userId: s.id,
		recipient: s.email,
		subject,
		body: subject,
		entity: "retention"
	});
}
async function retentionStats(d1) {
	const [byReason, recent] = await Promise.all([all(d1, `SELECT reason, COUNT(*) AS total,
              COUNT(CASE WHEN outcome = 'accepted_alternative' THEN 1 END) AS retained,
              COUNT(CASE WHEN outcome = 'cancelled' THEN 1 END) AS cancelled,
              COUNT(CASE WHEN offered_alternative IS NOT NULL THEN 1 END) AS offered
       FROM cancellation_requests GROUP BY reason ORDER BY total DESC`), all(d1, `SELECT r.id, r.reason, r.outcome, r.offered_alternative, r.comment, r.created_at, s.number, COALESCE(c.company_name, c.contact_name) AS customer
       FROM cancellation_requests r JOIN subscriptions s ON s.id = r.subscription_id JOIN customers c ON c.id = r.customer_id
       ORDER BY r.created_at DESC LIMIT 25`)]);
	const total = byReason.reduce((a, r) => a + r.total, 0);
	const offered = byReason.reduce((a, r) => a + r.offered, 0);
	const retained = byReason.reduce((a, r) => a + r.retained, 0);
	return {
		requests: total,
		retained,
		cancelled: byReason.reduce((a, r) => a + r.cancelled, 0),
		retentionRate: offered ? Math.round(retained / offered * 100) : 0,
		byReason,
		recent: recent.map((r) => ({
			id: r.id,
			reason: r.reason,
			outcome: r.outcome,
			offeredAlternative: r.offered_alternative,
			comment: r.comment,
			createdAt: r.created_at,
			subscriptionNumber: r.number,
			customerName: r.customer
		})),
		asOf: todayISO()
	};
}
// worker/modules/demo/service.ts
/**
* Demo scenario loader (SYS-1 demo data). Owner: Person 4.
* Builds six months of history through the real services (subscriptions, billing,
* payments, retention), so the demo exercises production code paths. Every record it
* creates is ordinary data; customers are named "(demo)" so they are clearly labelled.
* Available only when DEMO_MODE=true and the database has no subscriptions yet.
*/
var COMPANIES = [
	"Acme Labs",
	"Northwind Traders",
	"Globex Corp",
	"Initech",
	"Umbrella Health",
	"Stark Logistics",
	"Wayne Retail",
	"Hooli Cloud",
	"Pied Piper",
	"Soylent Foods",
	"Vandelay Imports",
	"Tyrell Systems",
	"Cyberdyne Analytics",
	"Oscorp Media"
];
/** Small deterministic PRNG so every demo load is identical. */
function rng(seed) {
	return () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
}
async function loadDemoData(db, env, actorId) {
	if (env.DEMO_MODE !== "true") throw ApiError.forbidden("Demo data can be loaded in demo mode only.");
	const existing = await first(env.DB, `SELECT COUNT(*) AS n FROM subscriptions`);
	if (existing && existing.n > 0) throw ApiError.conflict("Demo data needs an empty database. Run `npm run db:reset:local` first.");
	const today = todayISO();
	const rand = rng(42);
	const pick = (xs) => xs[Math.floor(rand() * xs.length)];
	const customers = await all(env.DB, `SELECT id, company_name FROM customers ORDER BY created_at`);
	const stmt = env.DB.prepare(`INSERT OR IGNORE INTO customers (id, email, contact_name, company_name, phone, billing_address) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`);
	const extra = COMPANIES.filter((c) => !customers.some((x) => x.company_name === c)).map((company, i) => ({
		id: newId(),
		email: `billing@${company.toLowerCase().replace(/[^a-z]/g, "")}.test`,
		contact: [
			"Meera Iyer",
			"Arjun Rao",
			"Kavya Shah",
			"Rohan Gupta",
			"Ananya Das",
			"Vikram Joshi",
			"Neha Kapoor"
		][i % 7],
		company: `${company} (demo)`
	}));
	if (extra.length) await env.DB.batch(extra.map((c) => stmt.bind(c.id, c.email, c.contact, c.company, "+91 90000 00000", "Demo address, India")));
	const allCustomers = [...customers.map((c) => c.id), ...extra.map((c) => c.id)];
	const plans = await all(env.DB, `SELECT id, billing_period, pausable FROM plans WHERE status = 'active'`);
	const products = await all(env.DB, `SELECT id FROM products WHERE is_active = 1`);
	const variants = await all(env.DB, `SELECT id, product_id FROM product_variants`);
	const monthly = plans.find((p) => p.billing_period === "monthly") ?? plans[0];
	const yearly = plans.find((p) => p.billing_period === "yearly");
	const subs = [];
	for (const [i, customerId] of allCustomers.entries()) {
		const plan = i % 6 === 5 && yearly ? yearly : monthly;
		const startDate = addDays(addMonths(today, -(1 + Math.floor(rand() * 6))), -Math.floor(rand() * 20));
		const product = pick(products);
		const variant = variants.find((v) => v.product_id === product.id && rand() > .5);
		const expiryDate = i === 1 ? addDays(today, 6) : i === 3 ? addDays(today, 24) : null;
		const sub = await createSubscription(db, env.DB, {
			customerId,
			planId: plan.id,
			startDate,
			expiryDate,
			paymentTermDays: 15,
			lines: [{
				productId: product.id,
				variantId: variant?.id ?? null,
				quantity: 1 + Math.floor(rand() * 6)
			}]
		}, actorId);
		await transitionSubscription(db, sub.id, "quotation", actorId, null, today);
		await transitionSubscription(db, sub.id, "confirmed", actorId, "Accepted (demo)", today);
		subs.push({
			id: sub.id,
			customerId
		});
	}
	for (let m = 6; m >= 1; m--) await runBilling(db, env.DB, {
		today: addMonths(today, -m),
		trigger: "manual",
		actorId
	});
	await runBilling(db, env.DB, {
		today,
		trigger: "manual",
		actorId
	});
	await env.DB.prepare(`UPDATE invoices SET status = 'confirmed', confirmed_at = issue_date WHERE status = 'draft' AND issue_date < ?1`).bind(today).run();
	const invoices = await all(env.DB, `SELECT i.id, i.customer_id, i.total, i.due_date, i.issue_date, c.company_name AS company
     FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.status = 'confirmed' ORDER BY i.issue_date`);
	const lastByCustomer = /* @__PURE__ */ new Map();
	for (const inv of invoices) lastByCustomer.set(inv.customer_id, inv.id);
	let paid = 0;
	for (const inv of invoices) {
		const company = inv.company ?? "";
		const isLast = lastByCustomer.get(inv.customer_id) === inv.id;
		if (company.startsWith("Northwind") && inv.due_date < today && invoices.filter((x) => x.customer_id === inv.customer_id).slice(-2).some((x) => x.id === inv.id)) continue;
		if (isLast && inv.due_date >= today) continue;
		if (isLast && rand() < .25) continue;
		const late = company.startsWith("Globex") ? 9 + Math.floor(rand() * 12) : -Math.floor(rand() * 10);
		const paidOn = addDays(inv.due_date, late) > today ? today : addDays(inv.due_date, late);
		const amount = rand() < .1 ? Math.round(inv.total / 2) : inv.total;
		await recordPayment(db, env.DB, inv.id, {
			method: pick([
				"bank_transfer",
				"upi",
				"card",
				"upi"
			]),
			amount: fromMinor(amount),
			paidOn,
			reference: `UTR${1e5 + paid}`,
			note: null
		}, actorId);
		paid++;
	}
	await recordUnmatchedPayment(db, {
		method: "bank_transfer",
		amount: "12980.00",
		paidOn: addDays(today, -4),
		reference: "UTR-UNKNOWN-7781",
		note: "Receipt without invoice reference",
		customerId: allCustomers[2] ?? null
	}, actorId);
	const late = await createSubscription(db, env.DB, {
		customerId: allCustomers[4],
		planId: monthly.id,
		startDate: addDays(today, -12),
		paymentTermDays: 15,
		lines: []
	}, actorId);
	await transitionSubscription(db, late.id, "quotation", actorId, null, today);
	await transitionSubscription(db, late.id, "confirmed", actorId, null, today);
	await env.DB.prepare(`UPDATE discounts SET ends_on = ?1 WHERE id = 'seed-disc-welcome'`).bind(addMonths(today, -2)).run();
	const cancelSub = subs[6] ?? subs[0];
	await requestCancellation(db, cancelSub.id, cancelSub.customerId, {
		reason: "too_expensive",
		comment: "Budget cut this quarter (demo)"
	}, actorId);
	const ctx = {
		db,
		env,
		today
	};
	const dunning = await runDunning(ctx);
	const renewals = await scanRenewals(ctx);
	const leakage = await scanRevenueLeakage(ctx);
	const anomalies = await scanInvoiceAnomalies(ctx);
	return {
		customers: allCustomers.length,
		subscriptions: subs.length + 1,
		invoices: invoices.length,
		payments: paid,
		leakage,
		anomalies,
		renewals,
		dunning
	};
}
// worker/modules/demo/routes.ts
/** POST /demo/load — loads the demo scenario (admin, demo mode only). Owner: Person 4. */
var demoRoutes = new Hono().post("/load", requireRole("admin"), async (c) => c.json({ data: await loadDemoData(c.get("db"), c.env, currentUser(c).id) }));
// worker/modules/dunning/routes.ts
/**
* Smart Dunning: schedule, reminder history, recovery stats, manual run. Owner: Person 4.
*/
var dunningRoutes = new Hono().get("/schedule", requirePermission("invoice:read"), async (c) => c.json({ data: await getSchedule(c.get("db")) })).put("/schedule", requirePermission("settings:write"), validate("json", dunningScheduleSchema), async (c) => {
	const steps = c.req.valid("json");
	if (new Set(steps.map((s) => s.step)).size !== steps.length) return c.json({ error: {
		code: "validation_failed",
		message: "Step names must be unique.",
		fields: { steps: "Duplicate step name" }
	} }, 422);
	await setSetting(c.get("db"), "dunning.schedule", steps);
	return c.json({ data: await getSchedule(c.get("db")) });
}).get("/reminders", requirePermission("invoice:read"), validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const [rows, total] = await Promise.all([all(c.env.DB, `SELECT r.id, r.step, r.created_at, i.id AS invoice_id, i.number, i.status, i.total - i.amount_paid AS balance,
                COALESCE(c.company_name, c.contact_name) AS customer, n.subject
         FROM payment_reminders r JOIN invoices i ON i.id = r.invoice_id JOIN customers c ON c.id = i.customer_id
         LEFT JOIN notifications n ON n.id = r.notification_id
         ORDER BY r.created_at DESC LIMIT ?1 OFFSET ?2`, q.pageSize, (q.page - 1) * q.pageSize), first(c.env.DB, `SELECT COUNT(*) AS n FROM payment_reminders`)]);
	const data = rows.map((r) => ({
		id: r.id,
		step: r.step,
		sentAt: r.created_at,
		invoiceId: r.invoice_id,
		invoiceNumber: r.number,
		invoiceStatus: r.status,
		balance: fromMinor(r.balance),
		customerName: r.customer,
		subject: r.subject
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/stats", requirePermission("invoice:read"), async (c) => {
	const row = await first(c.env.DB, `SELECT COUNT(*) AS reminded,
              COUNT(CASE WHEN i.status = 'paid' THEN 1 END) AS recovered,
              COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total END), 0) AS recovered_amount,
              COALESCE(SUM(CASE WHEN i.status = 'confirmed' THEN i.total - i.amount_paid END), 0) AS outstanding,
              (SELECT COUNT(*) FROM invoices x WHERE x.status = 'confirmed' AND x.due_date < ?1 AND x.total > x.amount_paid
                 AND NOT EXISTS (SELECT 1 FROM payment_reminders y WHERE y.invoice_id = x.id)) AS overdue_unreminded
       FROM invoices i WHERE EXISTS (SELECT 1 FROM payment_reminders r WHERE r.invoice_id = i.id)`, todayISO());
	const reminded = row?.reminded ?? 0;
	return c.json({
		remindedInvoices: reminded,
		recoveredInvoices: row?.recovered ?? 0,
		recoveryRate: reminded ? Math.round((row?.recovered ?? 0) / reminded * 100) : 0,
		recoveredAmount: fromMinor(row?.recovered_amount ?? 0),
		outstandingAfterReminders: fromMinor(row?.outstanding ?? 0),
		overdueWithoutReminder: row?.overdue_unreminded ?? 0
	});
}).post("/run", requirePermission("invoice:write"), async (c) => c.json({ data: await runDunning({
	db: c.get("db"),
	env: c.env,
	today: todayISO()
}) }));
// worker/modules/portal/routes.ts
/**
* PORT-1, PORT-2: customer self-service portal. Owner: Person 4.
* Every query filters by ownCustomerId(c) from the session — never by an id from the
* request — so customers can only see their own records.
*/
var { subscriptions, plans, invoices, payments, customers } = schema_exports;
async function ownSubscription(c, id) {
	const sub = await c.get("db").select().from(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.customerId, ownCustomerId(c)))).get();
	if (!sub) throw ApiError.notFound("Subscription");
	return sub;
}
var portalRoutes = new Hono().use(requirePermission("portal:access")).get("/summary", async (c) => {
	const id = ownCustomerId(c);
	const today = todayISO();
	const row = await first(c.env.DB, `SELECT (SELECT COUNT(*) FROM subscriptions WHERE customer_id = ?1 AND status = 'active') AS active,
              (SELECT COALESCE(SUM(total - amount_paid), 0) FROM invoices WHERE customer_id = ?1 AND status = 'confirmed') AS outstanding,
              (SELECT COUNT(*) FROM invoices WHERE customer_id = ?1 AND status = 'confirmed' AND due_date < ?2 AND total > amount_paid) AS overdue,
              (SELECT MIN(due_date) FROM invoices WHERE customer_id = ?1 AND status = 'confirmed' AND total > amount_paid) AS next_due,
              (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE customer_id = ?1) AS paid`, id, today);
	return c.json({ data: {
		activeSubscriptions: row?.active ?? 0,
		outstanding: fromMinor(row?.outstanding ?? 0),
		overdueInvoices: row?.overdue ?? 0,
		nextDueDate: row?.next_due ?? null,
		totalPaid: fromMinor(row?.paid ?? 0)
	} });
}).get("/subscriptions", validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = and(eq(subscriptions.customerId, ownCustomerId(c)), inArray(subscriptions.status, [
		"quotation",
		"confirmed",
		"active",
		"paused",
		"closed"
	]));
	const [rows, total] = await Promise.all([db.select({
		s: subscriptions,
		planName: plans.name,
		p: plans
	}).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId)).where(where).orderBy(desc(subscriptions.createdAt)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(subscriptions).where(where).get()]);
	const data = rows.map((r) => ({
		...toSubscription(r.s, { planName: r.planName }),
		billingPeriod: r.p.billingPeriod,
		planPrice: fromMinor(r.p.price),
		pausable: r.p.pausable,
		closable: r.p.closable,
		renewable: r.p.renewable
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).get("/subscriptions/:id", async (c) => {
	await ownSubscription(c, c.req.param("id"));
	const db = c.get("db");
	const [sub, invoiceRows] = await Promise.all([getSubscription(db, c.req.param("id")), db.select().from(invoices).where(and(eq(invoices.subscriptionId, c.req.param("id")), inArray(invoices.status, ["confirmed", "paid"]))).orderBy(desc(invoices.periodStart)).limit(24)]);
	if (sub.status === "draft") throw ApiError.notFound("Subscription");
	return c.json({ data: {
		...sub,
		invoices: invoiceRows.map((i) => toInvoice(i))
	} });
}).post("/subscriptions/:id/pause", async (c) => {
	const sub = await ownSubscription(c, c.req.param("id"));
	return c.json({ data: await transitionSubscription(c.get("db"), sub.id, "paused", currentUser(c).id, "Paused by customer") });
}).post("/subscriptions/:id/resume", async (c) => {
	const sub = await ownSubscription(c, c.req.param("id"));
	if (sub.status !== "paused") throw new ApiError("invalid_transition", "Only paused subscriptions can be resumed.");
	return c.json({ data: await transitionSubscription(c.get("db"), sub.id, "active", currentUser(c).id, "Resumed by customer") });
}).post("/subscriptions/:id/accept", async (c) => {
	const sub = await ownSubscription(c, c.req.param("id"));
	if (sub.status !== "quotation") throw new ApiError("invalid_transition", "Only open quotations can be accepted.");
	return c.json({ data: await transitionSubscription(c.get("db"), sub.id, "confirmed", currentUser(c).id, "Accepted by customer") });
}).post("/subscriptions/:id/renew", async (c) => {
	const sub = await ownSubscription(c, c.req.param("id"));
	return c.json({ data: await createRenewalQuotation(c.get("db"), c.env.DB, sub.id, currentUser(c).id) }, 201);
}).post("/subscriptions/:id/close", async (c) => {
	const sub = await ownSubscription(c, c.req.param("id"));
	return c.json({ data: await transitionSubscription(c.get("db"), sub.id, "closed", currentUser(c).id, "Closed by customer") });
}).post("/subscriptions/:id/cancellation-request", validate("json", cancellationRequestSchema), async (c) => {
	const sub = await ownSubscription(c, c.req.param("id"));
	return c.json({ data: await requestCancellation(c.get("db"), sub.id, ownCustomerId(c), c.req.valid("json"), currentUser(c).id) }, 201);
}).post("/cancellation-requests/:id/resolve", validate("json", resolveSchema), async (c) => c.json({ data: await resolveCancellation(c.get("db"), c.req.param("id"), ownCustomerId(c), c.req.valid("json").decision, currentUser(c).id) })).get("/invoices", validate("query", invoiceListSchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = and(invoiceWhere({
		...q,
		customerId: ownCustomerId(c),
		q: void 0
	}), inArray(invoices.status, [
		"confirmed",
		"paid",
		"cancelled"
	]));
	const [rows, total] = await Promise.all([db.select({
		i: invoices,
		subNumber: subscriptions.number
	}).from(invoices).innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId)).innerJoin(customers, eq(customers.id, invoices.customerId)).where(where).orderBy(desc(invoices.issueDate)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).where(where).get()]);
	return c.json(paginated(rows.map((r) => toInvoice(r.i, { subscriptionNumber: r.subNumber })), q, total?.n ?? 0));
}).get("/invoices/:id", async (c) => {
	const db = c.get("db");
	const inv = await db.select().from(invoices).where(and(eq(invoices.id, c.req.param("id")), eq(invoices.customerId, ownCustomerId(c)))).get();
	if (!inv || inv.status === "draft") throw ApiError.notFound("Invoice");
	const [detail, paymentRows] = await Promise.all([getInvoiceDetail(db, inv.id), db.select().from(payments).where(eq(payments.invoiceId, inv.id)).orderBy(desc(payments.paidOn))]);
	return c.json({ data: {
		...detail,
		payments: paymentRows.map((p) => toPayment(p))
	} });
}).get("/payments", validate("query", listQuerySchema), async (c) => {
	const q = c.req.valid("query");
	const db = c.get("db");
	const where = eq(payments.customerId, ownCustomerId(c));
	const [rows, total] = await Promise.all([db.select({
		p: payments,
		invoiceNumber: invoices.number
	}).from(payments).leftJoin(invoices, eq(invoices.id, payments.invoiceId)).where(where).orderBy(desc(payments.paidOn)).limit(pageOffset(q).limit).offset(pageOffset(q).offset), db.select({ n: count() }).from(payments).where(where).get()]);
	return c.json(paginated(rows.map((r) => toPayment(r.p, { invoiceNumber: r.invoiceNumber })), q, total?.n ?? 0));
}).get("/profile", async (c) => {
	const row = await c.get("db").select().from(customers).where(eq(customers.id, ownCustomerId(c))).get();
	if (!row) throw ApiError.notFound("Customer");
	return c.json({ data: toCustomer(row) });
}).patch("/profile", validate("json", customerSchema.omit({ email: true }).extend({ email: string().optional() })), async (c) => {
	const { email: _ignored, ...input } = c.req.valid("json");
	const res = await c.get("db").update(customers).set({
		...input,
		updatedAt: nowISO()
	}).where(eq(customers.id, ownCustomerId(c))).returning();
	return c.json({ data: toCustomer(res[0]) });
});
// worker/modules/renewals/routes.ts
/**
* Renewal queue and dashboard. Owner: Person 4.
*/
var listSchema = listQuerySchema.extend({
	status: _enum([
		"open",
		"quoted",
		"renewed",
		"cancelled",
		"expired"
	]).optional(),
	window: number().int().min(1).max(365).optional()
});
var renewalRoutes = new Hono().get("/summary", requirePermission("subscription:read"), async (c) => {
	const today = todayISO();
	const row = await first(c.env.DB, `SELECT
         (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND expiry_date BETWEEN ?1 AND ?2) AS due7,
         (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND expiry_date BETWEEN ?1 AND ?3) AS due30,
         (SELECT COUNT(*) FROM renewal_tasks WHERE status = 'quoted') AS quoted,
         (SELECT COUNT(*) FROM renewal_tasks WHERE status = 'renewed') AS renewed,
         (SELECT COUNT(*) FROM renewal_tasks WHERE status = 'expired') AS expired`, today, addDays(today, 7), addDays(today, 30));
	return c.json({
		dueIn7: row?.due7 ?? 0,
		dueIn30: row?.due30 ?? 0,
		awaitingResponse: row?.quoted ?? 0,
		renewed: row?.renewed ?? 0,
		expired: row?.expired ?? 0
	});
}).get("/", requirePermission("subscription:read"), validate("query", listSchema), async (c) => {
	const q = c.req.valid("query");
	const today = todayISO();
	const where = `(?1 IS NULL OR t.status = ?1) AND (?2 IS NULL OR t.due_on <= ?2)`;
	const binds = [q.status ?? null, q.window ? addDays(today, q.window) : null];
	const [rows, total] = await Promise.all([all(c.env.DB, `SELECT t.id, t.status, t.due_on, t.note, s.id AS subscription_id, s.number, s.status AS sub_status, s.customer_id,
                COALESCE(cu.company_name, cu.contact_name) AS customer, p.name AS plan, p.renewable, ${MRR_EXPR} AS mrr,
                t.renewal_subscription_id, r.number AS renewal_number, r.status AS renewal_status
         FROM renewal_tasks t JOIN subscriptions s ON s.id = t.subscription_id JOIN plans p ON p.id = s.plan_id
         JOIN customers cu ON cu.id = s.customer_id LEFT JOIN subscriptions r ON r.id = t.renewal_subscription_id
         WHERE ${where}
         ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'quoted' THEN 1 ELSE 2 END, t.due_on ASC
         LIMIT ?3 OFFSET ?4`, ...binds, q.pageSize, (q.page - 1) * q.pageSize), first(c.env.DB, `SELECT COUNT(*) AS n FROM renewal_tasks t WHERE ${where}`, ...binds)]);
	const data = rows.map((r) => ({
		id: r.id,
		status: r.status,
		dueOn: r.due_on,
		daysLeft: Math.round((Date.parse(r.due_on) - Date.parse(today)) / 864e5),
		note: r.note,
		subscriptionId: r.subscription_id,
		subscriptionNumber: r.number,
		subscriptionStatus: r.sub_status,
		customerId: r.customer_id,
		customerName: r.customer,
		planName: r.plan,
		monthlyValue: fromMinor(Math.round(r.mrr)),
		renewalSubscriptionId: r.renewal_subscription_id,
		renewalNumber: r.renewal_number,
		renewalStatus: r.renewal_status
	}));
	return c.json(paginated(data, q, total?.n ?? 0));
}).post("/:id/quote", requirePermission("subscription:write"), async (c) => {
	const quotation = await quoteRenewal(c.get("db"), c.env.DB, c.req.param("id"), currentUser(c).id);
	if (!quotation) throw ApiError.notFound("Renewal task");
	return c.json({ data: quotation }, 201);
}).patch("/:id", requirePermission("subscription:write"), validate("json", object({
	status: _enum([
		"open",
		"cancelled",
		"expired"
	]),
	note: notesSchema
})), async (c) => {
	const { status, note } = c.req.valid("json");
	if (!(await c.env.DB.prepare(`UPDATE renewal_tasks SET status = ?1, note = COALESCE(?2, note), updated_at = ?3 WHERE id = ?4`).bind(status, note ?? null, (/* @__PURE__ */ new Date()).toISOString(), c.req.param("id")).run()).meta.changes) throw ApiError.notFound("Renewal task");
	return c.json({ ok: true });
}).post("/scan", requirePermission("subscription:write"), async (c) => c.json({ data: await scanRenewals({
	db: c.get("db"),
	env: c.env,
	today: todayISO()
}) }));
// worker/modules/retention/routes.ts
/** Retention analytics for staff. Owner: Person 4. */
var retentionRoutes = new Hono().get("/stats", requirePermission("subscription:read"), async (c) => c.json({ data: await retentionStats(c.env.DB) }));
// worker/modules/simulator/routes.ts
/**
* What-if Financial Simulator baseline. Owner: Person 4.
* Returns current aggregates only; scenarios are computed deterministically in the
* browser (src/modules/simulator/model.ts) so assumptions stay visible.
*/
var simulatorRoutes = new Hono().get("/baseline", requirePermission("report:read"), async (c) => {
	const [plans, totals] = await Promise.all([all(c.env.DB, `SELECT p.id, p.name, p.billing_period, COUNT(s.id) AS subs, COALESCE(SUM(${MRR_EXPR}), 0) AS mrr
       FROM plans p JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'active'
       GROUP BY p.id ORDER BY mrr DESC`), first(c.env.DB, `SELECT (SELECT COUNT(DISTINCT customer_id) FROM subscriptions WHERE status = 'active') AS customers,
              (SELECT COALESCE(SUM(total - amount_paid), 0) FROM invoices WHERE status = 'confirmed') AS outstanding,
              (SELECT COALESCE(SUM(total - amount_paid), 0) FROM invoices WHERE status = 'confirmed' AND due_date < ?1) AS overdue,
              (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE paid_on >= date(?1, '-90 day')) AS collected90,
              (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status != 'cancelled' AND issue_date >= date(?1, '-90 day')) AS billed90`, todayISO())]);
	const mrr = plans.reduce((a, p) => a + p.mrr, 0);
	return c.json({ data: {
		mrr: fromMinor(Math.round(mrr)),
		activeSubscriptions: plans.reduce((a, p) => a + p.subs, 0),
		customers: totals?.customers ?? 0,
		outstanding: fromMinor(totals?.outstanding ?? 0),
		overdue: fromMinor(totals?.overdue ?? 0),
		collectionRate: totals?.billed90 ? Math.min(100, Math.round(totals.collected90 / totals.billed90 * 100)) : 100,
		plans: plans.map((p) => ({
			id: p.id,
			name: p.name,
			billingPeriod: p.billing_period,
			subscriptions: p.subs,
			mrr: fromMinor(Math.round(p.mrr))
		}))
	} });
});
// worker/index.ts
/**
* Brightloop API worker. Serves /api/v1/* and the daily cron. Static assets (the
* React app) are served by Workers Static Assets before this code runs.
*
* Module routers are mounted in `routes` below. Each owner adds one line for their
* module in their PR; do not put route handlers in this file.
*/
var routes = new Hono().route("/auth", authRoutes).route("/staff", staffRoutes).route("/subscriptions", quotationRoutes).route("/subscriptions", subscriptionRoutes).route("/billing", billingRoutes).route("/ai", aiRoutes).route("/", systemRoutes).route("/products", productRoutes).route("/variants", variantRoutes).route("/plans", planRoutes).route("/taxes", taxRoutes).route("/discounts", discountRoutes).route("/quotation-templates", templateRoutes).route("/invoices", invoicePaymentRoutes).route("/invoices", invoiceRoutes).route("/payments", paymentRoutes).route("/reports", reportRoutes).route("/findings", findingRoutes).route("/customers", customerRoutes).route("/portal", portalRoutes).route("/dunning", dunningRoutes).route("/renewals", renewalRoutes).route("/retention", retentionRoutes).route("/simulator", simulatorRoutes).route("/demo", demoRoutes);
var app = new Hono().use("*", secureHeaders()).use(`${API_BASE}/*`, async (c, next) => {
	c.set("db", createDb(c.env.DB));
	await next();
}).use(`${API_BASE}/*`, loadSession).route(API_BASE, routes).all(`${API_BASE}/*`, () => {
	throw new ApiError("not_found", "Endpoint not found.");
});
app.onError((err, c) => errorResponse(c, err));
// \0virtual:cloudflare/worker-entry
var worker_entry_default = {
	fetch: app.fetch,
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(runScheduledJobs(env));
	}
};
export { worker_entry_default as default };

//# sourceMappingURL=index.js.map