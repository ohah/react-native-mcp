
//#region src/babel-plugin-inject-testid.ts
function getTestIdStringLiteral(t, attr) {
	if (!attr.value) return null;
	if (t.isStringLiteral(attr.value)) return attr.value.value;
	if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) return attr.value.expression.value;
	return null;
}
function getTagName(t, name) {
	if (t.isJSXIdentifier(name)) return name.name;
	if (t.isJSXNamespacedName(name)) return `${name.namespace.name}.${name.name.name}`;
	const parts = [];
	let cur = name;
	while (true) {
		if (t.isJSXIdentifier(cur.object)) parts.push(cur.object.name);
		else parts.push(getTagName(t, cur.object));
		if (t.isJSXIdentifier(cur.property)) {
			parts.push(cur.property.name);
			break;
		}
		cur = cur.property;
	}
	return parts.join(".");
}
function babel_plugin_inject_testid_default(babel) {
	const t = babel.types;
	return {
		name: "react-native-mcp-inject-testid",
		visitor: {
			Program: { enter(_path, state) {
				state.stack = [];
			} },
			Function: {
				enter(path, state) {
					let name = t.isFunctionDeclaration(path.node) || t.isFunctionExpression(path.node) ? path.node.id?.name ?? null : null;
					if (!name && path.parent && t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) name = path.parent.id.name;
					if (!name && t.isIdentifier(path.node.params[0])) name = path.node.params[0].name;
					state.stack.push({
						componentName: name ?? "Anonymous",
						jsxIndex: 0
					});
				},
				exit(path, state) {
					const scope = state.stack[state.stack.length - 1];
					if (scope && scope.jsxIndex > 0 && scope.componentName !== "Anonymous" && /^[A-Z]/.test(scope.componentName)) {
						const stmt = t.expressionStatement(t.assignmentExpression("=", t.memberExpression(t.identifier(scope.componentName), t.identifier("displayName")), t.stringLiteral(scope.componentName)));
						if (t.isFunctionDeclaration(path.node)) (path.parentPath && (t.isExportDefaultDeclaration(path.parent) || t.isExportNamedDeclaration(path.parent)) ? path.parentPath : path).insertAfter(stmt);
						else if (path.parentPath && t.isVariableDeclarator(path.parent)) {
							let target = path.parentPath.parentPath;
							if (target?.parentPath && (t.isExportDefaultDeclaration(target.parent) || t.isExportNamedDeclaration(target.parent))) target = target.parentPath;
							target?.insertAfter(stmt);
						}
					}
					state.stack.pop();
				}
			},
			JSXOpeningElement(path, state) {
				if ((path.hub?.file?.opts?.filename ?? "").includes("node_modules")) return;
				const scope = state.stack[state.stack.length - 1];
				if (scope === void 0) return;
				const el = path.node;
				const testIdAttr = el.attributes.find((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "testID");
				if (!!!testIdAttr) {
					const tagName = getTagName(t, el.name);
					const baseValue = `${scope.componentName}-${scope.jsxIndex}-${tagName}`;
					const keyAttr = el.attributes.find((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "key");
					let keyExpr = null;
					if (keyAttr?.value) {
						if (t.isStringLiteral(keyAttr.value)) keyExpr = keyAttr.value;
						else if (t.isJSXExpressionContainer(keyAttr.value) && !t.isJSXEmptyExpression(keyAttr.value.expression)) keyExpr = keyAttr.value.expression;
					}
					if (keyExpr) {
						const tpl = t.templateLiteral([t.templateElement({
							raw: baseValue + "-",
							cooked: baseValue + "-"
						}, false), t.templateElement({
							raw: "",
							cooked: ""
						}, true)], [t.cloneNode(keyExpr)]);
						el.attributes.push(t.jsxAttribute(t.jsxIdentifier("testID"), t.jsxExpressionContainer(tpl)));
					} else el.attributes.push(t.jsxAttribute(t.jsxIdentifier("testID"), t.stringLiteral(baseValue)));
					scope.jsxIndex += 1;
				}
				if (getTagName(t, el.name) === "WebView") {
					const webViewTidAttr = testIdAttr ?? el.attributes.find((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "testID");
					const webViewTestIdValue = webViewTidAttr ? getTestIdStringLiteral(t, webViewTidAttr) : null;
					if (webViewTestIdValue != null) {
						const refAttr = el.attributes.find((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "ref");
						const mcpRegister = t.expressionStatement(t.logicalExpression("&&", t.optionalMemberExpression(t.identifier("__REACT_NATIVE_MCP__"), t.identifier("registerWebView"), false, true), t.callExpression(t.memberExpression(t.optionalMemberExpression(t.identifier("__REACT_NATIVE_MCP__"), t.identifier("registerWebView"), false, true), t.identifier("call"), false), [
							t.identifier("__REACT_NATIVE_MCP__"),
							t.identifier("r"),
							t.stringLiteral(webViewTestIdValue)
						])));
						const mcpUnregister = t.expressionStatement(t.logicalExpression("&&", t.optionalMemberExpression(t.identifier("__REACT_NATIVE_MCP__"), t.identifier("unregisterWebView"), false, true), t.callExpression(t.memberExpression(t.optionalMemberExpression(t.identifier("__REACT_NATIVE_MCP__"), t.identifier("unregisterWebView"), false, true), t.identifier("call"), false), [t.identifier("__REACT_NATIVE_MCP__"), t.stringLiteral(webViewTestIdValue)])));
						const bodyStatements = [t.ifStatement(t.identifier("r"), mcpRegister, mcpUnregister)];
						const userRefExpr = refAttr?.value && t.isJSXExpressionContainer(refAttr.value) ? refAttr.value.expression : null;
						if (userRefExpr != null && !t.isJSXEmptyExpression(userRefExpr)) bodyStatements.push(t.ifStatement(t.binaryExpression("!=", t.cloneNode(userRefExpr), t.nullLiteral()), t.blockStatement([t.ifStatement(t.binaryExpression("===", t.unaryExpression("typeof", t.cloneNode(userRefExpr)), t.stringLiteral("function")), t.expressionStatement(t.callExpression(t.cloneNode(userRefExpr), [t.identifier("r")])), t.expressionStatement(t.assignmentExpression("=", t.memberExpression(t.cloneNode(userRefExpr), t.identifier("current")), t.identifier("r"))))])));
						const composedRef = t.arrowFunctionExpression([t.identifier("r")], t.blockStatement(bodyStatements));
						if (refAttr) refAttr.value = t.jsxExpressionContainer(composedRef);
						else el.attributes.push(t.jsxAttribute(t.jsxIdentifier("ref"), t.jsxExpressionContainer(composedRef)));
						const onMessageAttr = el.attributes.find((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "onMessage");
						const userOnMessageExpr = onMessageAttr?.value && t.isJSXExpressionContainer(onMessageAttr.value) ? onMessageAttr.value.expression : null;
						const mcpOnMessage = userOnMessageExpr != null && !t.isJSXEmptyExpression(userOnMessageExpr) ? t.callExpression(t.memberExpression(t.identifier("__REACT_NATIVE_MCP__"), t.identifier("createWebViewOnMessage"), false), [userOnMessageExpr]) : t.arrowFunctionExpression([t.identifier("e")], t.callExpression(t.memberExpression(t.identifier("__REACT_NATIVE_MCP__"), t.identifier("handleWebViewMessage"), false), [t.memberExpression(t.memberExpression(t.identifier("e"), t.identifier("nativeEvent")), t.identifier("data"))]));
						if (onMessageAttr) onMessageAttr.value = t.jsxExpressionContainer(mcpOnMessage);
						else el.attributes.push(t.jsxAttribute(t.jsxIdentifier("onMessage"), t.jsxExpressionContainer(mcpOnMessage)));
					}
				}
			}
		}
	};
}

//#endregion
module.exports = babel_plugin_inject_testid_default;