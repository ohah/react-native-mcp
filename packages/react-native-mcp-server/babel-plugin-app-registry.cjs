
//#region src/babel-plugin-app-registry.ts
const MCP_RUNTIME_ID = "__REACT_NATIVE_MCP__";
const RUNTIME_MODULE_ID = "@ohah/react-native-mcp-server/runtime";
function babel_plugin_app_registry_default(babel) {
	const t = babel.types;
	return {
		name: "react-native-mcp-app-registry",
		visitor: {
			Program: { enter(_path, state) {
				state.runtimeInjected = false;
			} },
			CallExpression(path, state) {
				const node = path.node;
				if ((path.hub?.file?.opts?.filename ?? "").includes("node_modules")) return;
				if (!t.isCallExpression(node)) return;
				if (!t.isMemberExpression(node.callee)) return;
				const { object, property } = node.callee;
				if (!t.isIdentifier(object) || !t.isIdentifier(property)) return;
				if (object.name !== "AppRegistry" || property.name !== "registerComponent") return;
				if (!state.runtimeInjected) {
					const programPath = path.findParent((p) => p.isProgram?.());
					if (programPath?.node?.body) {
						programPath.node.body.unshift(t.expressionStatement(t.callExpression(t.identifier("require"), [t.stringLiteral(RUNTIME_MODULE_ID)])));
						state.runtimeInjected = true;
					}
				}
				path.replaceWith(t.callExpression(t.memberExpression(t.identifier(MCP_RUNTIME_ID), t.identifier("registerComponent")), node.arguments));
			}
		}
	};
}

//#endregion
module.exports = babel_plugin_app_registry_default;